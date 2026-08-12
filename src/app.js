// Application glue: auth gate, settings, ingestion, account actions.

import { sb, currentSession, currentGuardian, signOut, onAuthChange, authRedirectError, clearAuthParamsFromUrl } from './supabase.js';
import { startOnboarding } from './onboarding.js';
import { loadPrefs, savePrefs, readLocal } from './prefs.js';
import { listPurposes, readConsentState, recordConsent, withdrawConsent } from './consent.js';
import { createPaper, uploadPages, addLinkPage, parsePaperLink, listPapers, tierForType, PAPER_TYPES } from './papers.js';
import { exportMyData, downloadJson, deleteAccount } from './account.js';
import { PRESETS, presetFor, backgroundFor, paintAvatar } from './avatar.js';

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
    paintProfile();
    renderAvatarStrip();
    wireRename();
    wireClassChange();
  }
}

// ── profile ────────────────────────────────────────────────────────────────
//
// One face, not two. The guardian is the account holder but never opens the
// app — everything they do arrives by email — so the avatar and the name in
// Settings are the student's, and there is only ever one of each to keep in
// sync.

/** The label the avatar and the heading are drawn from. */
const profileLabel = () => ctx.student?.first_name ?? ctx.guardian?.name ?? '?';

function paintProfile() {
  const nameEl = $('#profileName'), mailEl = $('#profileContact'), picEl = $('#profilePic');
  // Keep the pencil: the name is a control, and replacing textContent would
  // strip the only thing that says so.
  if (nameEl) nameEl.firstChild
    ? (nameEl.firstChild.nodeValue = profileLabel())
    : nameEl.prepend(document.createTextNode(profileLabel()));
  if (mailEl) mailEl.textContent = ctx.guardian?.contact ?? '';
  paintAvatar(picEl, ctx.student, profileLabel());
  const cls = $('#set-class-aux');
  if (cls && ctx.student) cls.textContent = String(ctx.student.class_level);
}

/**
 * The ten gradients.
 *
 * Applied on tap and persisted immediately — this is a preference, not a
 * consequential change, so it does not earn a confirmation sheet. Selection is
 * a radio group rather than a list of buttons because exactly one is always in
 * effect, including before anything has been chosen.
 */
function renderAvatarStrip() {
  const strip = $('#avatarStrip');
  if (!strip || !ctx.student) return;
  const current = presetFor(ctx.student);

  strip.innerHTML = PRESETS.map((p) => `
    <button type="button" class="avsw press" role="radio" data-seed="${p.key}"
            aria-checked="${p.key === current.key}" aria-pressed="${p.key === current.key}"
            aria-label="${p.title}" title="${p.title}"
            style="background:${backgroundFor(p)}"></button>`).join('');

  strip.querySelectorAll('[data-seed]').forEach((el) => {
    el.addEventListener('click', async () => {
      const seed = el.dataset.seed;
      if (seed === presetFor(ctx.student).key) return;
      tick();

      const previous = ctx.student.avatar_seed;
      // Paint first. The face is the feedback, and waiting for a round trip to
      // show it would make a free choice feel like a transaction.
      ctx.student = { ...ctx.student, avatar_seed: seed };
      paintProfile();
      markAvatarSelection(strip, seed);

      const { error } = await sb.from('student')
        .update({ avatar_seed: seed }).eq('id', ctx.student.id);
      if (error) {
        ctx.student = { ...ctx.student, avatar_seed: previous };
        paintProfile();
        markAvatarSelection(strip, presetFor(ctx.student).key);
        toast('That could not be saved. Still your old one for now.', 'warn');
      }
    });
  });
  window.__masteryRebindPress?.(strip);
}

function markAvatarSelection(strip, key) {
  strip.querySelectorAll('[data-seed]').forEach((el) => {
    const on = el.dataset.seed === key;
    el.setAttribute('aria-checked', String(on));
    el.setAttribute('aria-pressed', String(on));
  });
}

/**
 * Rename.
 *
 * The student is the authority on their own name, so this saves on confirm
 * with no verification and no review — the same standing the disagree flow
 * gives them over a transcription.
 */
function wireRename() {
  const card = $('#profileCard');
  if (!card || !ctx.student) return;

  const open = () => {
    tick();
    window.__masteryOpenSheet?.({
      title: 'What should we call you?',
      body: 'This is the name shown at the top of Settings. It is not on any paper and nobody else sees it.',
      items: [],
      input: { id: 'sh-name', placeholder: profileLabel() },
      primary: 'Save',
      primaryClass: 'primary',
      onConfirm: async () => {
        const next = document.querySelector('#sh-name')?.value.trim();
        // An empty box means they changed their mind, not that they want to be
        // called nothing. The column refuses blank anyway.
        if (!next || next === ctx.student.first_name) return;

        const previous = ctx.student.first_name;
        ctx.student = { ...ctx.student, first_name: next };
        paintProfile();

        const { error } = await sb.from('student')
          .update({ first_name: next }).eq('id', ctx.student.id);
        if (error) {
          ctx.student = { ...ctx.student, first_name: previous };
          paintProfile();
          toast('That could not be saved.', 'warn');
        }
      },
    });
  };

  card.addEventListener('click', open);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
}

/**
 * Changing class.
 *
 * Two steps, because the consequence is real: class decides which papers can
 * reach Tier 2, and everything already analysed stays pinned to the old scope.
 * Pick the target first, then read what it costs — a warning that arrives
 * before the choice is one nobody has a reason to read yet.
 *
 * Board is deliberately not here. index.html already decided board changes go
 * through support rather than being self-serve, and that stands.
 */
function wireClassChange() {
  const row = $('#set-class');
  if (!row || !ctx.student) return;

  const open = () => {
    tick();
    const from = ctx.student.class_level;
    window.__masteryOpenSheet?.({
      title: 'Which class?',
      body: `Currently Class ${from}. Changing this re-scopes which papers can reach scheme-verified analysis.`,
      items: [],
      choices: [9, 10, 11, 12].filter((c) => c !== from)
        .map((c) => ({ label: `Class ${c}`, value: String(c) })),
      onChoice: (value) => confirmClassChange(from, Number(value)),
    });
  };

  row.addEventListener('click', open);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
}

function confirmClassChange(from, to) {
  // Opened on the next frame: the choice sheet is still springing shut, and
  // reusing the same element mid-animation makes it jump.
  requestAnimationFrame(() => window.__masteryOpenSheet?.({
    title: `Change to Class ${to}?`,
    body: `This re-scopes which papers can reach scheme-verified analysis. Everything you've already analysed stays readable, but it stays pinned to Class ${from}.`,
    items: [
      ['Archived papers keep their old scope.', `They're labelled "analysed under Class ${from}" and are never re-mapped, so nothing is orphaned.`],
      ['They can\'t be re-verified.', `Class ${from} papers won't reach Tier 2 against the Class ${to} scheme.`],
      ['Insights split at the change.', 'Patterns are computed within a scope, so your trend restarts rather than blending two syllabi.'],
    ],
    primary: `Change to Class ${to}`,
    primaryClass: 'primary',
    onConfirm: async () => {
      const { error } = await sb.from('student')
        .update({ class_level: to }).eq('id', ctx.student.id);
      if (error) return toast(error.message || 'That could not be saved.', 'warn');
      ctx.student = { ...ctx.student, class_level: to };
      paintProfile();
      toast(`Now Class ${to}. Papers from before stay as they were.`);
    },
  }));
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

async function ingestFiles(files) {
  if (!ctx.student) return toast('Create a student profile first.', 'warn');
  if (!files.length) return;
  const run = async (type) => {
    try {
      toast('Uploading…');
      const paper = await createPaper({
        studentId: ctx.student.id, type,
        dateTaken: new Date().toISOString().slice(0, 10),
      });
      await uploadPages({
        studentId: ctx.student.id, paperId: paper.id, files,
        onProgress: (n, total) => toast(`Uploading page ${n} of ${total}…`),
      });
      firm();
      toast(`Added ${files.length} page(s). ${tierForType(type) === 'tier_2'
        ? 'We\'ll match it to the official scheme.'
        : 'We\'ll explain it from your teacher\'s marks.'}`);
      await refreshLibrary();
    } catch (e) {
      toast(e.message || 'Upload failed.', 'warn');
    }
  };
  const t = takePendingType();
  t ? run(t) : askPaperType(run);
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
    // A link that failed redirects back here with the reason in the fragment.
    // Without this it is discarded and the guardian sees the landing page again,
    // with nothing to distinguish "that link is spent" from "nothing happened".
    authError: authRedirectError(),
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
  await refreshLibrary();
  $('#obroot')?.setAttribute('hidden', '');
  document.querySelector('.app')?.removeAttribute('aria-hidden');
}

async function boot() {
  applyPrefs(ctx.prefs);

  ctx.session = await currentSession();
  // Read after getSession, so the client has finished with the fragment, and
  // before any render — a reload should not replay an error already dealt with.
  clearAuthParamsFromUrl();
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
