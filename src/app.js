// Application glue: auth gate, settings, ingestion, account actions.

import {
  sb, currentSession, currentGuardian, signOut, onAuthChange,
  takeProviderError, authRedirectError, clearAuthParamsFromUrl,
} from './supabase.js';
import { startOnboarding } from './onboarding.js';
import { loadPrefs, savePrefs, readLocal } from './prefs.js';
import { listPurposes, readConsentState, recordConsent, withdrawConsent } from './consent.js';
import {
  createPaper, uploadPages, addLinkPage, parsePaperLink, listPapers, tierForType,
  paperTypeLabel, listSubjects, needsCheck, unreadablePages, lossByCause,
  analyticsReadiness, PAPER_TYPES,
} from './papers.js';
import { exportMyData, downloadJson, deleteAccount } from './account.js';
import {
  BOARD_LABEL, classLabel, classLabelShort, nextClassLevel,
  subjectsForClass, syllabusCode, stageForClass, subjectLabel,
} from './curriculum.js';
import { PRESETS, presetFor, backgroundFor, paintAvatar } from './avatar.js';

const ctx = {
  session: null, guardian: null, student: null, prefs: readLocal(), consent: {},
  subjects: [],
};

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

  renderProfile();
  renderAvatarStrip();
  wireRename();
  wireProfileRows();
}

// ── profile ────────────────────────────────────────────────────────────────
//
// One face, not two. The guardian is the account holder but never opens the
// app — everything they do arrives by email — so the avatar and the name in
// Settings are the student's, and there is only ever one of each to keep in
// sync.

/** The label the avatar and the heading are drawn from. */
const profileLabel = () => ctx.student?.first_name ?? ctx.guardian?.name ?? '?';

function renderProfile() {
  if (!ctx.guardian) return;
  const nameEl = $('#profileName'), mailEl = $('#profileContact'), picEl = $('#profilePic');
  // Keep the pencil: the name is a control, and replacing textContent would
  // strip the only thing that says so.
  if (nameEl) nameEl.firstChild
    ? (nameEl.firstChild.nodeValue = profileLabel())
    : nameEl.prepend(document.createTextNode(profileLabel()));
  if (mailEl) mailEl.textContent = ctx.guardian.contact ?? '';
  paintAvatar(picEl, ctx.student, profileLabel());

  const board = $('#set-board-aux');
  if (board) board.textContent = ctx.student?.board === 'CBSE' ? 'CBSE' : BOARD_LABEL;

  const cls = $('#set-class-aux');
  if (cls && ctx.student) cls.textContent = classLabelShort(ctx.student.class_level);

  const subs = $('#set-subjects-aux');
  if (subs) {
    subs.textContent = ctx.subjects.length
      ? ctx.subjects.map((s) => s.subject).join(', ')
      : 'None yet';
  }
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
      renderProfile();
      markAvatarSelection(strip, seed);

      const { error } = await sb.from('student')
        .update({ avatar_seed: seed }).eq('id', ctx.student.id);
      if (error) {
        ctx.student = { ...ctx.student, avatar_seed: previous };
        renderProfile();
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
        renderProfile();

        const { error } = await sb.from('student')
          .update({ first_name: next }).eq('id', ctx.student.id);
        if (error) {
          ctx.student = { ...ctx.student, first_name: previous };
          renderProfile();
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
 * Moving up a stage is a real change of syllabus, not a bigger number: IGCSE
 * Physics is 0625 and A Level Physics is 9702, with different papers and
 * different mark schemes. Papers already analysed stay pinned to the stage they
 * were analysed under, so the sheet says so before anything moves.
 *
 * Board is deliberately not handled by this row's neighbour here either:
 * index.html already decided board changes go through support rather than
 * being self-serve, and that stands.
 */
// These rows are divs with role="button", so keyboard users get nothing for
// free — the same reason wireRename() binds its own keydown just above.
function onActivate(el, fn) {
  if (!el) return;
  el.addEventListener('click', fn);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
  });
}

let profileWired = false;
function wireProfileRows() {
  if (profileWired) return;
  profileWired = true;

  onActivate($('#set-class'), () => {
    if (!ctx.student) return;
    const from = ctx.student.class_level;
    const to = nextClassLevel(from);
    tick();
    if (!to) {
      return window.__masteryOpenSheet?.({
        title: 'Already at A Level',
        body: `This profile is in ${classLabel(from)}, the last stage we cover. There is nowhere further to move it.`,
        items: [],
        primary: 'Close',
        primaryClass: 'plain',
      });
    }
    const carried = ctx.subjects
      .filter((s) => subjectsForClass(to).some((o) => o.subject === s.subject));
    const dropped = ctx.subjects.length - carried.length;
    window.__masteryOpenSheet?.({
      title: `Move to ${classLabel(to)}?`,
      body: `This re-scopes which mark schemes a new paper can be matched against. Everything already in Library stays readable, pinned to ${classLabel(from)}.`,
      items: [
        ['Existing papers keep their stage.', `They stay analysed under ${classLabel(from)} and are never re-mapped, so nothing is orphaned.`],
        ['Subjects take new syllabus codes.', dropped
          ? `${carried.length} carry over to ${stageForClass(to).label} codes; ${dropped} isn't offered there and is removed from the profile.`
          : `All ${carried.length} carry over, each re-pointed at its ${stageForClass(to).label} syllabus code.`],
        ['Insights split at the change.', 'Patterns are computed within a stage, so the count restarts rather than blending two syllabuses.'],
      ],
      primary: `Move to ${classLabelShort(to)}`,
      primaryClass: 'primary',
      onConfirm: () => changeStage(to),
    });
  });

  onActivate($('#set-board'), () => {
    tick();
    window.__masteryOpenSheet?.({
      title: 'Board changes go through support',
      body: 'Moving between boards re-maps every concept your papers were analysed against, so it is not a self-serve change. Support migrates the account and confirms what carries over first.',
      items: [
        ['Nothing is deleted.', `Existing papers stay readable under ${ctx.student?.board === 'CBSE' ? 'CBSE' : BOARD_LABEL} and keep their original scheme references.`],
        ['Scheme matching restarts.', 'Tier 2 depends on board-specific mark schemes, so matched papers revert to teacher-marks-only under a new board.'],
        ['We only cover Cambridge today.', 'IGCSE, AS and A Level. Other boards are not built yet, so there is nothing to move to.'],
      ],
      primary: 'Close',
      primaryClass: 'plain',
    });
  });

  onActivate($('#set-subjects'), () => {
    if (!ctx.student) return;
    tick();
    const stage = stageForClass(ctx.student.class_level);
    window.__masteryOpenSheet?.({
      title: 'Subjects',
      body: `${classLabel(ctx.student.class_level)} · ${BOARD_LABEL}. The four-digit code is the Cambridge syllabus a past paper is matched against.`,
      items: ctx.subjects.length
        ? ctx.subjects.map((s) => [subjectLabel(s.subject, s.syllabus_code), `${stage.label} syllabus.`])
        : [['No subjects on this profile.', 'Add one from the student profile step to match past papers to a syllabus.']],
      primary: 'Close',
      primaryClass: 'plain',
    });
  });
}

async function changeStage(to) {
  try {
    const { data, error } = await sb.from('student')
      .update({ class_level: to, updated_at: new Date().toISOString() })
      .eq('id', ctx.student.id).select().single();
    if (error) throw error;
    ctx.student = data;

    // Re-point every subject at its syllabus code in the new stage, and drop
    // the ones that stage does not offer. A subject left carrying its old code
    // would quietly match papers against the wrong mark scheme.
    const remapped = ctx.subjects
      .map((s) => ({ subject: s.subject, syllabus_code: syllabusCode(s.subject, to) }))
      .filter((s) => s.syllabus_code);
    await sb.from('student_subject').delete().eq('student_id', ctx.student.id);
    if (remapped.length) {
      const { error: subErr } = await sb.from('student_subject')
        .insert(remapped.map((s) => ({ ...s, student_id: ctx.student.id })));
      if (subErr) throw subErr;
    }
    ctx.subjects = remapped;
    renderProfile();
    toast(`Moved to ${classLabel(to)}.`);
  } catch (e) {
    toast(e.message || 'That change could not be saved.', 'warn');
  }
}

// ── ingestion ──────────────────────────────────────────────────────────────

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
        ? 'We\'ll match it to the Cambridge mark scheme.'
        : 'We\'ll explain it from your teacher\'s marks.'}`);
      await refreshShell();
    } catch (e) {
      toast(e.message || 'Upload failed.', 'warn');
    }
  };
  askPaperType(run);
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
      await refreshShell();
    } catch (e) { toast(e.message || 'That link could not be added.', 'warn'); }
  };
  askPaperType(run);
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

// ── library filters ────────────────────────────────────────────────────────
// Only over columns a paper actually has. There is no subject filter because
// there is no subject on a paper until something reads one off the page, and a
// control that cannot do anything is worse than no control.

const FILTERS = {
  date: {
    label: 'Any date',
    options: [
      { value: 'all', label: 'Any date' },
      { value: '30', label: 'Last 30 days' },
      { value: '90', label: 'Last 3 months' },
      { value: '365', label: 'Last year' },
    ],
    match: (p, v) => v === 'all' ||
      (Date.now() - new Date(p.date_taken).getTime()) / 86400000 <= Number(v),
  },
  type: {
    label: 'All types',
    options: [{ value: 'all', label: 'All types' }, ...PAPER_TYPES],
    match: (p, v) => v === 'all' || p.type === v,
  },
  tier: {
    label: 'Any tier',
    options: [
      { value: 'all', label: 'Any tier' },
      { value: 'tier_2', label: 'Scheme-matched' },
      { value: 'tier_1', label: "Teacher's marks" },
    ],
    match: (p, v) => v === 'all' || p.tier === v,
  },
};

const libFilter = { date: 'all', type: 'all', tier: 'all' };
let libSearch = '';
let libPapers = [];

function applyLibraryFilters(papers) {
  const q = libSearch.trim().toLowerCase();
  return papers.filter((p) =>
    Object.entries(libFilter).every(([k, v]) => FILTERS[k].match(p, v)) &&
    (!q || `${paperTypeLabel(p.type)} ${new Date(p.date_taken).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
      .toLowerCase().includes(q)));
}

function paintLibrary(stale) {
  const filtered = libSearch.trim() !== '' ||
    Object.values(libFilter).some((v) => v !== 'all');
  window.__masteryRenderLibrary?.(applyLibraryFilters(libPapers), { stale, filtered });
}

let libraryWired = false;
function wireLibrary() {
  if (libraryWired) return;
  libraryWired = true;

  document.querySelectorAll('#libFilters [data-filter]').forEach((chip) => {
    const key = chip.dataset.filter;
    chip.addEventListener('click', () => {
      tick();
      window.__masteryOpenSheet?.({
        title: FILTERS[key].label,
        body: '',
        items: [],
        choices: FILTERS[key].options,
        onChoice: (value) => {
          libFilter[key] = value;
          const opt = FILTERS[key].options.find((o) => o.value === value);
          chip.classList.toggle('active', value !== 'all');
          chip.childNodes[0].nodeValue = `${opt.label} `;
          paintLibrary(false);
        },
      });
    });
  });

  $('#libSearch')?.addEventListener('input', (e) => {
    libSearch = e.target.value;
    paintLibrary(false);
  });
}

async function refreshLibrary() {
  if (!ctx.student) return;
  try {
    const { data, stale } = await listPapers(ctx.student.id);
    libPapers = data;
    paintLibrary(stale);
    // Home has nothing honest to show until a paper exists, so it swaps for a
    // single call to action. Driven from the same read as the Library rather
    // than a separate count — one source, so the two can't disagree.
    window.__masteryHomeEmpty?.(data.length === 0, ctx.student.first_name);
    return data;
  } catch { /* the cached view stays on screen */ }
  return null;
}

// ── the shell, painted from real data ──────────────────────────────────────
// Every surface reads from the same fetch, so Home, Scan, Library and Insights
// cannot disagree about how many papers there are.

/** A paper's display title. There is no subject on a paper until something
 *  reads one off the page, so the type is the honest name for it. */
function paperTitle(paper) {
  return paperTypeLabel(paper.type);
}

async function refreshShell() {
  if (!ctx.student) return;

  const papers = (await refreshLibrary()) ?? [];
  const [subjects, checks, unread, readiness, causes] = await Promise.all([
    listSubjects(ctx.student.id).catch(() => ({ data: [] })),
    needsCheck(ctx.student.id).catch(() => ({ data: { count: 0, papers: 0 } })),
    unreadablePages(ctx.student.id).catch(() => ({ data: [] })),
    analyticsReadiness(ctx.student.id).catch(() => ({ data: null })),
    lossByCause(ctx.student.id).catch(() => ({ data: {} })),
  ]);

  ctx.subjects = subjects.data ?? [];
  renderProfile();

  const ready = readiness.data ?? { papers_counted: 0, questions_counted: 0, has_enough_data: false };
  const questions = Number(ready.questions_counted ?? 0);

  window.__masteryRenderHome?.({
    name: ctx.student.first_name,
    papers: papers.length,
    questions,
    ready: !!ready.has_enough_data,
    needsCheck: checks.data?.count ?? 0,
    needsCheckPapers: checks.data?.papers ?? 0,
    unreadable: (unread.data ?? []).length,
    recent: papers.map((p) => ({ title: paperTitle(p), tier: p.tier, date_taken: p.date_taken })),
  });

  window.__masteryRenderInsights?.({
    papers: papers.length,
    questions,
    ready: !!ready.has_enough_data,
    hasAnalysis: questions > 0,
    causes: causes.data ?? {},
  });

  window.__masteryRenderScan?.({
    unreadable: unread.data ?? [],
    recent: papers.slice(0, 5).map((p) => ({
      title: paperTitle(p),
      date_taken: p.date_taken,
      pages: p.paper_page?.[0]?.count ?? 0,
      read: (p.student_attempt?.[0]?.count ?? 0) > 0,
    })),
  });
}

// ── boot ───────────────────────────────────────────────────────────────────

function showOnboarding(providerError = null) {
  const overlay = $('#obroot');
  if (!overlay) return;
  overlay.hidden = false;
  document.querySelector('.app')?.setAttribute('aria-hidden', 'true');
  startOnboarding(overlay, {
    // Passed so a guardian who arrived by clicking the emailed link is not sent
    // back to the beginning of a flow they have already half-completed.
    session: ctx.session,
    // A Google or Apple round trip that came back refused. Handed in so the flow
    // opens on the account step already saying so, rather than looking like the
    // tap did nothing.
    providerError,
    // A link that failed redirects back here with the reason in the fragment.
    // Without this it is discarded and the guardian sees the landing page again,
    // with nothing to distinguish "that link is spent" from "nothing happened".
    authError: authRedirectError(),
    // The rows just created are handed straight over rather than re-fetched.
    // Re-reading would re-run the gate, and on a read replica that has not caught
    // up yet the student would not be there — dropping someone who has just
    // finished onboarding back to the start of it.
    // The student's four first-run screens end by handing over to Home, which
    // is empty and carries one call to action. Onboarding deliberately does not
    // open the file picker itself: landing straight in a system dialog is the
    // opposite of the pacing those four screens just established, and the paper
    // type still gets asked on the first upload by askPaperType().
    onComplete: async ({ guardian, student }) => {
      if (guardian) ctx.guardian = guardian;
      if (student) ctx.student = student;
      overlay.hidden = true;
      document.querySelector('.app')?.removeAttribute('aria-hidden');
      await startApp();
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
  wireLibrary();
  await refreshShell();
  $('#obroot')?.setAttribute('hidden', '');
  document.querySelector('.app')?.removeAttribute('aria-hidden');
}

async function boot() {
  applyPrefs(ctx.prefs);

  // Read before the session, and unconditionally: it clears the error out of the
  // URL either way, so a refused attempt cannot linger in the address bar and
  // reappear on the next reload.
  const providerError = takeProviderError();

  ctx.session = await currentSession();
  // Read after getSession, so the client has finished with the fragment, and
  // before any render — a reload should not replay an error already dealt with.
  clearAuthParamsFromUrl();
  if (!ctx.session) return showOnboarding(providerError);

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

window.__masteryApp = { ctx, boot, applyPrefs, toast, refreshLibrary, refreshShell };
