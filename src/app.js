// Application glue: auth gate, settings, ingestion, account actions.

import { sb, currentSession, currentGuardian, signOut, onAuthChange } from './supabase.js';
import { startOnboarding } from './onboarding.js';
import { loadPrefs, savePrefs, readLocal } from './prefs.js';
import { listPurposes, readConsentState, recordConsent, withdrawConsent } from './consent.js';
import { createPaper, addLinkPage, parsePaperLink, listPapers, PAPER_TYPES } from './papers.js';
import { exportMyData, downloadJson, deleteAccount } from './account.js';
import { acceptUploads, initScanUI, setPendingPaperType } from './scan/ui.js';

const ctx = { session: null, guardian: null, student: null, prefs: readLocal(), consent: {} };

const $ = (s) => document.querySelector(s);
const tick = () => window.__masteryHaptic?.tick?.();
const firm = () => window.__masteryHaptic?.firm?.();

// ── display preferences ────────────────────────────────────────────────────
// Applied to the root element so CSS owns the actual scaling. Called before the
// first paint from the local mirror, so there is no flash of the wrong theme.

export function applyPrefs(prefs) {
  const root = document.documentElement;
  const resolved = prefs.theme === 'system'
    ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : prefs.theme;
  root.dataset.theme = resolved;
  document.body.dataset.page = resolved;
  root.dataset.text = prefs.text_size;
  root.dataset.motion = prefs.reduce_motion ? 'reduce' : 'full';
  $('#themeColor')?.setAttribute('content', resolved === 'dark' ? '#000000' : '#F4F4F7');
  document.querySelectorAll('.disclose').forEach((d) => {
    if (prefs.always_show_reasoning) window.__masteryOpenDisclosure?.(d);
  });
}

// Uses the design system's own spring so an app-managed switch feels identical
// to a demo one. These switches carry data-managed, so index.html's generic .sw
// handler deliberately leaves them alone — two handlers on one switch race, and
// whichever ran second read a class the first had already flipped.
function setSwitch(el, on) {
  if (!el) return;
  if (window.__masterySwitch) return window.__masterySwitch(el, on);
  el.classList.toggle('on', !!on);
  const th = el.querySelector('.th');
  if (th) th.style.transform = `translateX(${on ? 22 : 0}px)`;
}

function setSeg(container, value, attr) {
  container?.querySelectorAll('button').forEach((b) =>
    b.classList.toggle('on', b.dataset[attr] === String(value)));
}

// ── toast ──────────────────────────────────────────────────────────────────
// Reuses the draft-toast furniture rather than inventing a new surface.

let toastTimer = null;
function toast(message, tone = 'neutral') {
  const el = $('#appToast');
  if (!el) return;
  el.querySelector('.t1').textContent = message;
  el.dataset.tone = tone;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}

// ── settings ───────────────────────────────────────────────────────────────

async function wireSettings() {
  const p = ctx.prefs;

  setSeg($('#segTheme'), p.theme, 'mode');
  setSeg($('#segText'), p.text_size, 'size');
  setSwitch($('#set-reducemotion'), p.reduce_motion);
  setSwitch($('#set-reasoning'), p.always_show_reasoning);
  setSwitch($('#set-paperready'), p.notify_paper_ready);
  setSwitch($('#set-correction'), p.notify_correction);

  // Consent-bearing switches read their state from the ledger, never from a
  // cached preference, so what the toggle shows is what was actually recorded.
  if (ctx.guardian) {
    ctx.consent = await readConsentState(ctx.guardian.id, ctx.student?.id ?? null);
    setSwitch($('#set-digest'), ctx.consent.weekly_parent_digest === true);
    setSwitch($('#set-improve'), ctx.consent.improve_extraction === true);
  }

  const pref = async (patch) => {
    ctx.prefs = await savePrefs(ctx.guardian?.id, patch);
    applyPrefs(ctx.prefs);
  };

  $('#segTheme')?.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    tick(); setSeg($('#segTheme'), b.dataset.mode, 'mode'); pref({ theme: b.dataset.mode });
  });

  $('#segText')?.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    tick(); setSeg($('#segText'), b.dataset.size, 'size'); pref({ text_size: b.dataset.size });
  });

  const toggle = (sel, key) => $(sel)?.addEventListener('click', () => {
    const next = !$(sel).classList.contains('on');
    setSwitch($(sel), next); tick(); pref({ [key]: next });
  });
  toggle('#set-reducemotion', 'reduce_motion');
  toggle('#set-reasoning', 'always_show_reasoning');
  toggle('#set-paperready', 'notify_paper_ready');
  toggle('#set-correction', 'notify_correction');

  // Turning an optional purpose off is a withdrawal, recorded as its own event.
  const consentToggle = (sel, purpose) => $(sel)?.addEventListener('click', async () => {
    if (!ctx.guardian) return;
    const next = !$(sel).classList.contains('on');
    setSwitch($(sel), next);
    firm();
    try {
      if (next) {
        await recordConsent({
          guardianId: ctx.guardian.id, studentId: ctx.student?.id ?? null,
          decisions: { [purpose]: true },
        });
        toast('Consent recorded.');
      } else {
        await withdrawConsent({
          guardianId: ctx.guardian.id, studentId: ctx.student?.id ?? null, purpose,
        });
        toast('Consent withdrawn. Processing for this stops now.');
      }
      ctx.consent = await readConsentState(ctx.guardian.id, ctx.student?.id ?? null);
      setSwitch($(sel), ctx.consent[purpose] === true);
    } catch (e) {
      setSwitch($(sel), !next); // put it back — the ledger is the truth
      toast(e.message || 'That could not be recorded.', 'warn');
    }
  });
  consentToggle('#set-digest', 'weekly_parent_digest');
  consentToggle('#set-improve', 'improve_extraction');

  $('#set-export')?.addEventListener('click', async () => {
    if (!ctx.guardian) return;
    tick();
    try {
      toast('Gathering your data…');
      downloadJson(`mastery-data-${new Date().toISOString().slice(0, 10)}.json`,
        await exportMyData(ctx.guardian));
      toast('Downloaded.');
    } catch (e) { toast(e.message || 'Export failed.', 'warn'); }
  });

  $('#set-signout')?.addEventListener('click', async () => {
    firm();
    await signOut();
    location.reload();
  });

  // Erasure uses the warning sheet, which states consequences, rather than an
  // "are you sure?" — CLAUDE.md rules that pattern out.
  $('#set-delete-account')?.addEventListener('click', () => {
    firm();
    window.__masteryOpenSheet?.({
      title: 'Delete this account?',
      body: 'This removes the student\'s papers and everything we worked out from them. It cannot be undone.',
      items: [
        ['Papers and analysis go first.', 'Every uploaded page and every explanation is deleted, not archived.'],
        ['Your consent record is kept.', 'It holds no personal data and is the evidence that consent was properly obtained.'],
        ['Sign-in stops working immediately.', 'The account is released, so this email or number can start fresh later.'],
      ],
      primary: 'Delete everything',
      primaryClass: 'primary',
      onConfirm: async () => {
        try {
          toast('Deleting…');
          const result = await deleteAccount(ctx.guardian);
          toast(`Deleted ${result.students_erased} profile(s). Signing out.`);
          setTimeout(() => location.reload(), 1200);
        } catch (e) { toast(e.message || 'Deletion failed.', 'warn'); }
      },
    });
  });

  $('#set-delete-data')?.addEventListener('click', () => {
    tick();
    window.__masteryOpenSheet?.({
      title: 'Delete the student\'s data?',
      body: 'This clears papers and analysis but keeps the account, so you can start again without signing up.',
      items: [
        ['Papers and analysis are removed.', 'Uploaded pages and everything derived from them.'],
        ['The profile stays.', 'Name, class and subjects remain, so nothing needs re-entering.'],
      ],
      primary: 'Delete the data',
      primaryClass: 'primary',
      onConfirm: async () => {
        try {
          if (!ctx.student) return toast('Nothing to delete yet.');
          const { error } = await sb.from('paper').delete().eq('student_id', ctx.student.id);
          if (error) throw error;
          toast('Papers and analysis deleted.');
        } catch (e) { toast(e.message || 'Deletion failed.', 'warn'); }
      },
    });
  });

  if (ctx.guardian) {
    const nameEl = $('#profileName'), mailEl = $('#profileContact'), picEl = $('#profilePic');
    if (nameEl) nameEl.textContent = ctx.student?.first_name ?? ctx.guardian.name;
    if (mailEl) mailEl.textContent = ctx.guardian.contact;
    if (picEl) picEl.textContent = (ctx.student?.first_name ?? ctx.guardian.name ?? '?')[0].toUpperCase();
    const cls = $('#set-class-aux'); if (cls && ctx.student) cls.textContent = String(ctx.student.class_level);
  }
}

// ── ingestion ──────────────────────────────────────────────────────────────

// Set once by onboarding step 8, which has already asked the guided question.
// Consumed on the next ingest and cleared, so the second paper is asked about
// rather than silently inheriting the first one's type — which would file a
// board paper as a school test and cost it its marking scheme.
let pendingType = null;
function takePendingType() {
  const t = pendingType;
  pendingType = null;
  return t;
}

function askPaperType(then) {
  window.__masteryOpenSheet?.({
    title: 'What kind of paper is this?',
    body: 'This decides whether we can match it to an official marking scheme.',
    items: [],
    choices: PAPER_TYPES.map((t) => ({ label: t.label, value: t.value })),
    onChoice: (value) => then(value),
  });
}

/**
 * Uploaded pages join the scanning pipeline rather than bypassing it.
 *
 * Before capture existed this uploaded raw files straight to storage, which was
 * right when nothing read them. Now that something does, an unconditioned page
 * would skip stage 1 and stage 2 — no deskew, no illumination flattening, no
 * red-layer separation — and arrive at the structure pass in materially worse
 * shape than a captured one. Upload is a first-class path, so it takes the same
 * road; it simply has no quad to warp by.
 */
async function ingestFiles(files) {
  if (!ctx.student) return toast('Create a student profile first.', 'warn');
  if (!files.length) return;
  const t = takePendingType();
  if (t) setPendingPaperType(t);
  await acceptUploads(files);
  toast(`${files.length} page(s) added. Check the order, then read the paper.`);
}

async function ingestLink(url) {
  if (!ctx.student) return toast('Create a student profile first.', 'warn');
  const run = async (type) => {
    try {
      const paper = await createPaper({
        studentId: ctx.student.id, type,
        dateTaken: new Date().toISOString().slice(0, 10),
      });
      await addLinkPage({ studentId: ctx.student.id, paperId: paper.id, url, pageNumber: 1 });
      firm();
      toast('Link saved. We\'ll fetch it and tell you when it\'s readable.');
      await refreshLibrary();
    } catch (e) { toast(e.message || 'That link could not be added.', 'warn'); }
  };
  const t = takePendingType();
  t ? run(t) : askPaperType(run);
}

function wireIngestion() {
  const input = $('#fileInput');
  $('#uploadBtn')?.addEventListener('click', () => { tick(); input?.click(); });
  document.querySelectorAll('[data-action="upload"]').forEach((el) =>
    el.addEventListener('click', () => { tick(); input?.click(); }));
  input?.addEventListener('change', () => {
    const files = [...(input.files ?? [])];
    input.value = '';
    ingestFiles(files);
  });

  document.querySelectorAll('[data-action="link"]').forEach((el) =>
    el.addEventListener('click', () => {
      tick();
      window.__masteryOpenSheet?.({
        title: 'Add a link',
        body: 'Paste a link to a school-shared PDF or drive file. We fetch it on our side — a browser can\'t hand us the file directly.',
        items: [],
        input: { id: 'linkUrl', placeholder: 'https://…' },
        primary: 'Add this link',
        primaryClass: 'primary',
        onConfirm: async () => {
          const raw = document.querySelector('#linkUrl')?.value ?? '';
          if (!raw.trim()) return toast('Paste a link first.', 'warn');
          // Validate before asking for the paper type: the type question creates
          // the paper row, so a bad link would otherwise orphan one.
          let url;
          try { url = parsePaperLink(raw); }
          catch (e) { return toast(e.message, 'warn'); }
          await ingestLink(url);
        },
      });
    }));
}

async function refreshLibrary() {
  if (!ctx.student) return;
  try {
    const { data, stale } = await listPapers(ctx.student.id);
    window.__masteryRenderLibrary?.(data, { stale });
  } catch { /* the cached view stays on screen */ }
}

// ── boot ───────────────────────────────────────────────────────────────────

function showOnboarding() {
  const overlay = $('#obroot');
  if (!overlay) return;
  overlay.hidden = false;
  document.querySelector('.app')?.setAttribute('aria-hidden', 'true');
  startOnboarding(overlay, {
    // Passed so a guardian who arrived by clicking the emailed link is not sent
    // back to the beginning of a flow they have already half-completed.
    session: ctx.session,
    // The rows just created are handed straight over rather than re-fetched.
    // Re-reading would re-run the gate, and on a read replica that has not caught
    // up yet the student would not be there — dropping someone who has just
    // finished onboarding back to the start of it.
    onComplete: async ({ guardian, student, firstPaperType }) => {
      pendingType = firstPaperType ?? null;
      if (guardian) ctx.guardian = guardian;
      if (student) ctx.student = student;
      overlay.hidden = true;
      document.querySelector('.app')?.removeAttribute('aria-hidden');
      await startApp();
      if (firstPaperType) $('#fileInput')?.click();
    },
  });
}

/** Everything that runs once we know who this is. */
async function startApp() {
  if (ctx.guardian) {
    ctx.prefs = await loadPrefs(ctx.guardian.id);
    applyPrefs(ctx.prefs);
  }
  await wireSettings();
  wireIngestion();
  await initScanUI(ctx);
  setPendingPaperType(pendingType);
  await refreshLibrary();
  $('#obroot')?.setAttribute('hidden', '');
  document.querySelector('.app')?.removeAttribute('aria-hidden');
}

async function boot() {
  applyPrefs(ctx.prefs);

  ctx.session = await currentSession();
  if (!ctx.session) return showOnboarding();

  ctx.guardian = await currentGuardian();
  if (!ctx.guardian) return showOnboarding();

  const { data: students } = await sb.from('student').select('*').limit(1);
  ctx.student = students?.[0] ?? null;
  if (!ctx.student) return showOnboarding();

  return startApp();
}

function wireConnectivity() {
  const paint = () => {
    document.documentElement.dataset.online = navigator.onLine ? 'yes' : 'no';
    if (!navigator.onLine) toast('Offline. Saved papers stay readable; new uploads need a connection.');
  };
  addEventListener('online', paint);
  addEventListener('offline', paint);
  paint();
}

// Apply the cached prefs synchronously so the first frame is already correct.
applyPrefs(readLocal());

onAuthChange((session) => {
  const had = !!ctx.session;
  ctx.session = session;
  if (!session && had) location.reload();
});

wireConnectivity();
boot().catch((e) => {
  console.error(e);
  toast(e.message || 'Something went wrong starting up.', 'warn');
});

window.__masteryApp = { ctx, boot, applyPrefs, toast, refreshLibrary };
