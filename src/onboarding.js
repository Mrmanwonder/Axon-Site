// Onboarding, steps 1-8.
//
// The order is legally load-bearing, not a UX preference:
//   landing → parent account → verify → consent → payment → student profile →
//   student first run → first upload
//
// Two constraints it exists to satisfy:
//   · No student personal data is written before a consent_event grants every
//     required purpose. The database also refuses it, so this is belt and
//     braces rather than the only guard.
//   · Payment comes after consent, never before, so paying cannot become
//     pressure on a consent decision.
//
// Rendered with index.html's own components — it is the design system. The
// onboarding-only pieces (.obwrap, the phase rail, .obfield, .obpanel,
// .obfoot, .obseal) live there too, under the onboarding overlay section.

import {
  sb, sendOtp, verifyOtp, currentSession,
  signInWithProvider, isProviderNotEnabled, OAUTH_PROVIDERS, PROVIDER_LABEL,
} from './supabase.js';
import { getVerificationAdapter } from './verification.js';
import { listPurposes, recordConsent } from './consent.js';
import { PAPER_TYPES } from './papers.js';

const h = (s) => s; // tagging helper for readability
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function tick() { window.__masteryHaptic?.tick?.(); }
function firm() { window.__masteryHaptic?.firm?.(); }

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'Computer Science'];

// The seven causes, shown on the landing screen as a named palette. Hues come
// straight from the design language; they are categorical and equal-weight, so
// there is nothing here to read as a ranking.
const CAUSES = [
  ['#4C7DF0', 'Conceptual gap'],
  ['#3FA9A0', 'Procedural slip'],
  ['#8A6FD1', 'Misread question'],
  ['#C98A3E', 'Incomplete'],
  ['#C46B8A', 'Presentation'],
  ['#7C9455', 'Keyword miss'],
  ['#78808F', 'Timed out'],
];

// Five phases rather than eight steps: the flow branches, so a step count would
// either be wrong on one path or have to lie about the total.
const PHASES = ['Account', 'Verify', 'Consent', 'Plan', 'Student'];
const STEP_PHASE = {
  account: 0, otp: 0, nameOnly: 0,
  age: 1, verify: 1,
  consent: 2,
  plan: 3,
  student: 4,
};

// Back is offered only where returning cannot strand the flow or undo something
// already written. Nothing past consent has a way back: consent is recorded, and
// re-deciding it belongs in Settings, where withdrawal is a first-class action.
const BACK_TO = {
  studentDead: 'landing',
  account: 'landing',
  otp: 'account',
  age: 'account',
  adult: 'age',
  verify: 'age',
};

// Drawn on a 24px grid but rendered at 16-19px, so each one is kept to two or
// three strokes. Anything busier turns to mush at the size it actually ships at.
const ICONS = {
  back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  chev: '<path d="M1 1l5 5-5 5"/>',
  tick: '<path d="M20 6 9 17l-5-5"/>',
  trend: '<path d="M4 16.5 9 9.5l4 4 7-9"/>',
  paper: '<path d="M6 4.5h9l4 4V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z"/><path d="M14.5 4.5V9H19"/>',
  read: '<path d="M5 7.5h10M5 12h13M5 16.5h7"/>',
  explain: '<path d="M12 4a5.5 5.5 0 0 0-3 10.1V17h6v-2.9A5.5 5.5 0 0 0 12 4Z"/><path d="M10.5 20h3"/>',
  mail: '<path d="M4 7h16v10H4z"/><path d="m4.5 7.5 7.5 5.5 7.5-5.5"/>',
  spark: '<circle cx="12" cy="12" r="2.8"/><path d="M12 4.5v2.4M12 17.1v2.4M4.5 12h2.4M17.1 12h2.4"/>',
  shield: '<path d="M12 3.5 5 6v6c0 4 3 7 7 8.5 4-1.5 7-4.5 7-8.5V6l-7-2.5Z"/>',
  never: '<circle cx="12" cy="12" r="8.5"/><path d="m6.5 17.5 11-11"/>',
  clock: '<path d="M12 7v5l3.5 2"/><circle cx="12" cy="12" r="9"/>',
  card: '<path d="M3 9.5h18M3 7.5h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  cap: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M6.5 10.5V16c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-5.5"/>',
  person: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5"/>',
  pencil: '<path d="M4.5 19.5l1-4L16 5l3 3L8.5 18.5l-4 1Z"/>',
  stamp: '<path d="M12 3.5 5 6v6c0 4 3 7 7 8.5 4-1.5 7-4.5 7-8.5V6l-7-2.5Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
};

// Provider marks. These are the two brands' own assets, not our iconography, so
// they are whole <svg> strings rather than entries in ICONS: they are filled
// rather than stroked, and Google's is drawn on a 48 grid it cannot leave.
// Google keeps its four colours because its brand terms require them. Apple's is
// currentColor, which the CSS resolves to black on light and white on dark —
// exactly the pair Apple specifies.
const BRAND = {
  google: `<svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"/>
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46Z"/>
    <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7Z"/>
    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z"/>
  </svg>`,
  apple: `<svg viewBox="0 0 24 24" class="apl" aria-hidden="true">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.377-2.376-2.076-.16-3.844 1.132-4.923 1.132ZM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.687.805-3.583 1.818-.804.896-1.482 2.337-1.296 3.714 1.343.104 2.79-.688 3.634-1.703Z"/>
  </svg>`,
};

// Icon and a specific one-liner per purpose. The generic alternative — repeating
// "Required" down four rows — turns the most consequential screen in the flow
// into a wall of identical switches, which is how blanket consent gets clicked
// through. Each row has to say what it actually permits.
const PURPOSES = {
  store_papers: ['ic-b', ICONS.paper, 'The pages you upload, kept in the account'],
  extract_text: ['ic-b', ICONS.read, 'Reading the questions, answers and remarks'],
  generate_explanations: ['ic-b', ICONS.explain, 'Grounded in the marks the teacher gave'],
  track_progress: ['ic-b', ICONS.trend, 'So a repeated cause shows up over time'],
  weekly_parent_digest: ['ic-a', ICONS.mail, 'A short email to you, once a week'],
  improve_extraction: ['ic-a', ICONS.spark, 'Uses anonymised corrections'],
};

const svg = (paths, cls = '') =>
  `<svg viewBox="0 0 24 24"${cls ? ` class="${cls}"` : ''}>${paths}</svg>`;
const chev = () =>
  `<svg class="chev" viewBox="0 0 7 12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">${ICONS.chev}</svg>`;

export function startOnboarding(root, { onComplete, session = null, providerError = null }) {
  const state = {
    // A live session with no guardian row means the emailed link was clicked, or
    // Google or Apple sent us back signed in; pick the flow up at the only thing
    // still missing. A refused provider round trip opens on the account step
    // instead — landing would make the tap look like it did nothing.
    step: session ? 'nameOnly' : providerError ? 'account' : 'landing',
    contact: session?.user?.email ?? session?.user?.phone ?? '',
    // Google and Apple both hand back a name, so on that path the one remaining
    // question arrives already answered and needs only a glance. Apple withholds
    // it unless the parent chose to share it, and then the field is simply empty
    // — which is the same state the emailed-link path lands in.
    parentName: session?.user?.user_metadata?.full_name
      ?? session?.user?.user_metadata?.name ?? '',
    // 'google', 'apple', or 'email'/'phone' for the OTP paths.
    provider: session?.user?.app_metadata?.provider ?? null,
    busyProvider: null,
    error: providerError?.message ?? null,
    studentAge: null,
    verification: null,
    guardian: null,
    consent: {},
    plan: null,
    student: null,
    // Held so a validation error on the student step does not wipe what was
    // already typed and picked. Being made to re-enter a name because one
    // subject was missed is the flow calling the user careless.
    studentFirst: '',
    studentClass: 11,
    subjects: [],
  };

  const go = (step) => { state.step = step; render(); };

  // Chrome common to every step: the back affordance and the phase rail. Steps
  // outside the numbered flow get no rail — landing and the student's own first
  // run are not partway through anything, and on the two dead ends a rail would
  // claim progress through a flow that has just stopped.
  function shell(inner, { title = '', sub = '' } = {}) {
    const phase = STEP_PHASE[state.step];
    const back = BACK_TO[state.step];
    const rail = phase === undefined ? '' : h(`
      <div class="obprog">
        <div class="segs" role="progressbar" aria-valuemin="1" aria-valuemax="${PHASES.length}"
             aria-valuenow="${phase + 1}"
             aria-valuetext="${esc(PHASES[phase])} — phase ${phase + 1} of ${PHASES.length}">
          ${PHASES.map((_, i) =>
            `<i class="${i < phase ? 'done' : i === phase ? 'now' : ''}"><span></span></i>`).join('')}
        </div>
        <div class="ph">${esc(PHASES[phase])}</div>
      </div>`);

    return h(`
      <div class="obwrap">
        <div class="obhead">
          ${back
            ? `<div class="obback press" data-back="${esc(back)}" role="button" tabindex="0" aria-label="Back">${svg(ICONS.back)}</div>`
            : ''}
          ${rail}
        </div>
        <div class="view on obview">
          ${title ? `<div class="greet"><h1>${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>` : ''}
          ${inner}
        </div>
      </div>`);
  }

  // Amber, never red: red is the sign-out row and nothing else. An error here is
  // something to fix, not a rebuke.
  function err(msg) {
    return msg
      ? `<div class="draft" role="alert"><div class="ic">${svg('<path d="M12 8v5M12 16.5v.4"/><path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>')}</div><div class="b"><div class="t2">${esc(msg)}</div></div></div>`
      : '';
  }

  const field = ({ id, label, value = '', placeholder = '', hint = '', autocomplete = '', cls = '', type = 'text' }) => h(`
    <div class="obfield ${cls}">
      <label class="k" for="${id}">${esc(label)}</label>
      <input id="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}"
             ${autocomplete ? `autocomplete="${autocomplete}"` : 'autocomplete="off"'}>
      ${hint ? `<div class="hint">${esc(hint)}</div>` : ''}
    </div>`);

  // Provider buttons, above the typed path. "Continue with" rather than "Sign in
  // with": a parent arriving here does not have an account yet, and Apple's
  // guidelines allow the phrasing.
  const providers = () => h(`
    <div class="obalt">
      ${OAUTH_PROVIDERS.map((p) => `
        <div class="btn press" data-provider="${p}" role="button" tabindex="0">
          ${BRAND[p]}<span>${state.busyProvider === p
            ? `Opening ${esc(PROVIDER_LABEL[p])}…`
            : `Continue with ${esc(PROVIDER_LABEL[p])}`}</span>
        </div>`).join('')}
    </div>
    <div class="obor">or</div>`);

  const method = (attr, { icon, tone = 'ic-b', t1, t2 = '' }) => h(`
    <div class="method press" ${attr}>
      <div class="ic ${tone}">${svg(icon)}</div>
      <div class="b"><div class="t1">${esc(t1)}</div>${t2 ? `<div class="t2">${esc(t2)}</div>` : ''}</div>
      ${chev()}
    </div>`);

  const srow = (tone, icon, label, small, trailing = '') => h(`
    <div class="srow">
      <div class="ic ${tone}">${svg(icon)}</div>
      <div class="lbl">${esc(label)}${small ? `<small>${esc(small)}</small>` : ''}</div>
      ${trailing}
    </div>`);

  // ── step 1 · landing ─────────────────────────────────────────────────────
  // Parent-facing. A student who lands here is routed to "ask a parent" rather
  // than into a flow they cannot legally complete.
  function landing() {
    return shell(h(`
      <div class="obhero">
        <div class="obwordmark">
          <span class="g">${svg(ICONS.trend)}</span>
          <span class="n">Mastery</span>
        </div>
        <h1>See exactly where the <em>marks went</em>.</h1>
        <div class="sub">Upload a graded paper. We read the questions, the answers and the
          teacher's marks, then explain what to do differently next time.</div>
      </div>
      <div class="sectitle">Every lost mark gets a reason</div>
      <div class="obspec">
        ${CAUSES.map(([c, n]) => `<span style="--c:${c}">${esc(n)}</span>`).join('')}
      </div>
      <div class="obpanel tint" style="margin-top:22px">
        <div class="body" style="margin-top:0">A parent sets this up. Indian law requires a parent's
          verified consent before we can process anything belonging to a student under 18.</div>
      </div>
      <div class="obfoot">
        <div class="btn primary press" id="ob-start">I'm a parent — set this up</div>
        <div class="btn plain press" id="ob-student">I'm the student</div>
      </div>
    `));
  }

  function studentDeadEnd() {
    return shell(h(`
      <div class="estate">
        <div class="ic">${svg('<path d="M12 15.5v.4M12 7v5"/><circle cx="12" cy="12" r="9"/>')}</div>
        <h4>Ask a parent to set this up</h4>
        <p>Because you're under 18, a parent or guardian has to create the account and give consent
           first. Once they've done that, this device is yours to use.</p>
      </div>`), { title: 'Nearly there' });
  }

  // ── step 2 · parent account ──────────────────────────────────────────────
  function account(error) {
    return shell(h(`
      ${err(error)}
      ${providers()}
      <div class="obfields">
        ${field({
          id: 'ob-name', label: 'Your name', value: state.parentName,
          placeholder: 'Full name', autocomplete: 'name',
          hint: 'So the student knows whose account this is.',
        })}
        ${field({
          id: 'ob-contact', label: 'Email or phone', value: state.contact,
          placeholder: 'you@example.com or +91…', autocomplete: 'email',
          hint: "We'll send a one-time code — there's no password to remember.",
        })}
      </div>
      <div class="obpanel tint" style="margin-top:16px">
        <div class="body" style="margin-top:0">Nothing about the student is collected yet, and nothing
          is processed until you've consented.</div>
      </div>
      <div class="obfoot">
        <div class="btn primary press" id="ob-send">Send me a code</div>
      </div>
    `), { title: 'Create your account' });
  }

  function otp(error) {
    return shell(h(`
      ${err(error)}
      <div class="obfields">
        ${field({
          id: 'ob-code', label: 'Your code', cls: 'obcode',
          placeholder: '6 digits, or paste the link', autocomplete: 'one-time-code',
        })}
      </div>
      <div class="subnote">Sent to ${esc(state.contact)}. If the email contains a link rather than a
        code, paste the whole link here — that works too, and it still works after your mail app has
        already opened it.</div>
      <div class="obfoot">
        <div class="btn primary press" id="ob-verify">Continue</div>
        <div class="btn plain press" id="ob-resend">Send it again</div>
      </div>
    `), { title: 'Check your email' });
  }

  // Someone who clicked the emailed link arrives already signed in, but with no
  // guardian row and none of the details this flow collected. Rather than send
  // them back to the start, ask only for what is missing.
  function nameOnly(error) {
    return shell(h(`
      ${err(error)}
      <div class="obfields">
        ${field({
          id: 'ob-name-only', label: 'Your name', value: state.parentName,
          placeholder: 'Full name', autocomplete: 'name',
          hint: 'So the student knows whose account this is.',
        })}
      </div>
      <div class="obfoot">
        <div class="btn primary press" id="ob-name-go">Continue</div>
      </div>
    `), {
      title: 'One detail',
      sub: PROVIDER_LABEL[state.provider]
        ? `Signed in with ${PROVIDER_LABEL[state.provider]} as ${state.contact}.`
        : `Signed in as ${state.contact}.`,
    });
  }

  // ── step 3 · age gate and verification ───────────────────────────────────
  function ageGate() {
    return shell(h(`
      <div class="list">
        ${method('data-age="under_18"', {
          icon: ICONS.cap, t1: 'Under 18',
          t2: "You'll verify and consent on their behalf",
        })}
        ${method('data-age="18_plus"', {
          icon: ICONS.person, t1: '18 or older',
          t2: 'They can hold their own account',
        })}
      </div>
      <div class="subnote">This decides which consent path applies. We don't ask for a date of birth.</div>
    `), { title: 'How old is the student?' });
  }

  function adultPath() {
    return shell(h(`
      <div class="estate">
        <div class="ic">${svg(ICONS.tick)}</div>
        <h4>They can sign up themselves</h4>
        <p>Over 18, no parental consent is needed, so the student holds their own account. That path
           isn't built yet — it's the next thing we're adding.</p>
      </div>`), { title: 'Good news' });
  }

  function verifyStep(error, busy) {
    const adapter = getVerificationAdapter();
    return shell(h(`
      ${err(error)}
      <div class="obpanel tint">
        <div class="chips"><span class="chip n">Required by law</span></div>
        <div class="line">${esc(adapter.label)}</div>
        <div class="body">${esc(adapter.description)}</div>
      </div>
      <div class="sectitle">What we keep</div>
      <div class="list">
        ${srow('ic-g', ICONS.shield, 'A confirmation reference', 'Proof the check happened', '<span class="tier t2">Kept</span>')}
        ${srow('ic-g', ICONS.clock, 'When it happened', 'Timestamp and method', '<span class="tier t2">Kept</span>')}
        ${srow('ic-n', ICONS.never, 'Your documents', 'Aadhaar, licence, anything scanned', '<span class="tier t1">Never stored</span>')}
      </div>
      <div class="obfoot">
        <div class="btn primary press" id="ob-verify-go">${busy ? 'Verifying…' : esc(adapter.label)}</div>
      </div>
    `), { title: 'Verify it\'s you' });
  }

  // ── step 4 · itemised consent ────────────────────────────────────────────
  async function consentStep(error) {
    const purposes = await listPurposes();
    for (const p of purposes) {
      // Required default on; optional default OFF and never pre-ticked.
      if (!(p.purpose in state.consent)) state.consent[p.purpose] = p.is_required;
    }
    const row = (p) => {
      // A purpose added to the table without an entry here still renders, with a
      // neutral icon and the label alone. Better a plain row than a missing one.
      const [tone, icon, note] = PURPOSES[p.purpose] ?? ['ic-n', ICONS.shield, ''];
      const trailing = p.is_required
        ? '<span class="locked">Required</span>'
        : `<div class="sw ob-sw${state.consent[p.purpose] ? ' on' : ''}" data-purpose="${esc(p.purpose)}"
                role="switch" tabindex="0" aria-checked="${state.consent[p.purpose] ? 'true' : 'false'}"
                aria-label="${esc(p.label)}">
             <div class="tr"></div><div class="th"><span class="gI"></span></div><span class="gO"></span></div>`;
      return srow(tone, icon, p.label, note, trailing);
    };

    return shell(h(`
      ${err(error)}
      <div class="sectitle tight">What we need to do</div>
      <div class="list">${purposes.filter(p => p.is_required).map(row).join('')}</div>
      <div class="sectitle">Optional — off unless you turn it on</div>
      <div class="list">${purposes.filter(p => !p.is_required).map(row).join('')}</div>
      <div class="sectitle">What we never do</div>
      <div class="list">
        ${srow('ic-n', ICONS.never, 'Advertising of any kind', '', '<span class="tier t1">Never</span>')}
        ${srow('ic-n', ICONS.never, 'Behavioural tracking', '', '<span class="tier t1">Never</span>')}
        ${srow('ic-n', ICONS.never, 'Selling data to anyone', '', '<span class="tier t1">Never</span>')}
        ${srow('ic-n', ICONS.never, 'Ranking against other students', '', '<span class="tier t1">Never</span>')}
      </div>
      <div class="subnote">You can withdraw any optional consent later in Settings — one tap, no email
        required.</div>
      <div class="obfoot">
        <div class="btn primary press" id="ob-consent-go">Give consent</div>
      </div>
    `), { title: 'What you\'re agreeing to' });
  }

  // ── step 5 · plan, after consent ─────────────────────────────────────────
  function planStep() {
    return shell(h(`
      <div class="list">
        ${method('data-plan="trial"', {
          icon: ICONS.clock, t1: 'Start a free trial',
          t2: 'Full access. No card needed now.',
        })}
        ${method('data-plan="paid"', {
          icon: ICONS.card, t1: 'Subscribe now',
          t2: "Billing isn't wired up yet",
        })}
      </div>
      <div class="subnote">Payment details are never visible to the student profile. We asked for consent
        before this step on purpose — paying shouldn't feel like pressure to agree.</div>
    `), { title: 'Choose a plan' });
  }

  // ── step 6 · student profile ─────────────────────────────────────────────
  function studentStep(error) {
    const chosen = new Set(state.subjects);
    return shell(h(`
      ${err(error)}
      <div class="obfields">
        ${field({
          id: 'ob-sname', label: 'First name', value: state.studentFirst,
          placeholder: "The student's first name",
        })}
      </div>
      <div class="sectitle">Class and board</div>
      <div class="list">
        <div class="srow">
          <div class="ic ic-b">${svg(ICONS.cap)}</div>
          <div class="lbl">Class</div>
          <div class="seg" id="ob-class">
            ${[9, 10, 11, 12].map(c =>
              `<button data-class="${c}"${c === state.studentClass ? ' class="on"' : ''}>${c}</button>`).join('')}
          </div>
        </div>
        ${srow('ic-b', ICONS.paper, 'Board', '', '<span class="aux">CBSE</span>')}
      </div>
      <div class="sectitle">Subjects</div>
      <div class="filterbar" id="ob-subjects" style="position:static">
        ${SUBJECTS.map(s => `<div class="fchip${chosen.has(s) ? ' active' : ''}" data-subject="${esc(s)}">${esc(s)}</div>`).join('')}
      </div>
      <div class="subnote">Nothing else is collected — no school, no address, no photograph.</div>
      <div class="obfoot">
        <div class="btn primary press" id="ob-student-go">Create profile</div>
      </div>
    `), { title: 'The student' });
  }

  // ── step 7 · student first run ───────────────────────────────────────────
  // The seam where delight is allowed: the setup is finished, and this is the
  // student's first screen rather than the parent's last one.
  function firstRun() {
    const name = state.student?.first_name;
    return shell(h(`
      <div class="obhero" style="padding-bottom:2px">
        <div class="obseal">${svg(ICONS.tick)}</div>
        <h1>${name ? `Hello, <em>${esc(name)}</em>.` : 'Hello.'}</h1>
        <div class="sub">This part is yours, not your parent's. Here's how it works.</div>
      </div>
      <div class="list" style="margin-top:22px">
        ${srow('ic-b', ICONS.paper, 'You upload a marked paper',
          "We read the questions, your answers, and your teacher's marks")}
        ${srow('ic-g', ICONS.shield, 'We never overrule your teacher',
          'The marks shown are the marks they gave. We explain where they went.')}
        ${srow('ic-b', ICONS.explain, 'You can see the reasoning',
          'Every insight shows what it was based on')}
        ${srow('ic-b', ICONS.pencil, 'If we read something wrong, fix it',
          'Your correction wins. No review, no arguing.')}
      </div>
      <div class="obfoot">
        <div class="btn primary press" id="ob-first-go">Upload my first paper</div>
        <div class="btn plain press" id="ob-skip">Look around first</div>
      </div>
    `));
  }

  // ── step 8 · guided first upload ─────────────────────────────────────────
  // Part of capture, which gets no decorative motion — the entrance stagger is
  // the same 26ms as everywhere and nothing else moves.
  //
  // Grouped by tier rather than listed flat. Flat, the consequence of the
  // choice has to be repeated under all five rows, and five near-identical
  // subtitles is how a screen stops being read. Grouped, the two tiers each
  // state it once, which is also the actual shape of the distinction.
  function firstUpload() {
    const scheme = (t) => t.value === 'pyq' || t.value === 'sample_paper';
    const group = (types, icon) => types.map(t =>
      method(`data-type="${esc(t.value)}"`, { icon, t1: t.label })).join('');
    const school = PAPER_TYPES.filter(t => !scheme(t));
    const board = PAPER_TYPES.filter(scheme);
    return shell(h(`
      <div class="obpanel">
        <div class="line">What kind of paper is this?</div>
        <div class="body">This one matters, so it's worth getting right. We'll only ask the first time.</div>
      </div>
      <div class="sectitle">School test</div>
      <div class="list">${group(school, ICONS.paper)}</div>
      <div class="subnote">Explained from your teacher's marks and remarks.</div>
      <div class="sectitle">Board paper</div>
      <div class="list">${group(board, ICONS.stamp)}</div>
      <div class="subnote">Matched to the official marking scheme where we have it.</div>
    `), { title: 'Your first paper' });
  }

  // ── render + wiring ──────────────────────────────────────────────────────
  async function render() {
    let html;
    let error = state.error;
    state.error = null;
    switch (state.step) {
      case 'landing':      html = landing(); break;
      case 'studentDead':  html = studentDeadEnd(); break;
      case 'account':      html = account(error); break;
      case 'otp':          html = otp(error); break;
      case 'nameOnly':     html = nameOnly(error); break;
      case 'age':          html = ageGate(); break;
      case 'adult':        html = adultPath(); break;
      case 'verify':       html = verifyStep(error, state.busy); break;
      case 'consent':      html = await consentStep(error); break;
      case 'plan':         html = planStep(); break;
      case 'student':      html = studentStep(error); break;
      case 'firstRun':     html = firstRun(); break;
      case 'firstUpload':  html = firstUpload(); break;
      default:             html = landing();
    }
    root.innerHTML = html;
    wire();
    window.__masteryRebindPress?.(root);
  }

  function on(sel, ev, fn) {
    root.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));
  }

  // Rows and buttons are divs, so keyboard users get nothing for free. Enter and
  // Space on anything carrying a role are mapped to the same handler as a tap.
  function onActivate(sel, fn) {
    on(sel, 'click', fn);
    on(sel, 'keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      fn(e);
    });
  }

  function wire() {
    on('#ob-start', 'click', () => { tick(); go('account'); });
    on('#ob-student', 'click', () => { tick(); go('studentDead'); });
    onActivate('[data-back]', (e) => { tick(); go(e.currentTarget.dataset.back); });

    // Hands off to the provider and navigates away, so there is no success case
    // to handle here — the session arrives on the way back in and boot() picks
    // the flow up at the one detail still missing. Anything typed into the fields
    // is deliberately not carried across: the provider is about to supply both,
    // and the name it gives is the one the parent will recognise.
    onActivate('[data-provider]', async (e) => {
      const provider = e.currentTarget.dataset.provider;
      if (state.busyProvider) return;
      firm();
      state.busyProvider = provider;
      await render();
      try {
        await signInWithProvider(provider);
      } catch (err) {
        state.busyProvider = null;
        state.error = isProviderNotEnabled(err)
          ? `${PROVIDER_LABEL[provider]} sign-in isn't switched on yet. Use your email or phone below.`
          : err.message || `${PROVIDER_LABEL[provider]} sign-in didn't open.`;
        render();
      }
    });

    on('#ob-send', 'click', async () => {
      const name = root.querySelector('#ob-name')?.value.trim() ?? '';
      const contact = root.querySelector('#ob-contact')?.value.trim() ?? '';
      state.parentName = name; state.contact = contact;
      if (!name) { state.error = 'We need your name.'; return render(); }
      if (!contact) { state.error = 'Enter an email address or phone number.'; return render(); }
      firm();
      try { await sendOtp(contact); go('otp'); }
      catch (e) { state.error = e.message || 'That code could not be sent.'; render(); }
    });

    on('#ob-resend', 'click', async () => {
      tick();
      try { await sendOtp(state.contact); state.error = 'Sent again.'; render(); }
      catch (e) { state.error = e.message; render(); }
    });

    on('#ob-verify', 'click', async () => {
      const code = root.querySelector('#ob-code')?.value.trim() ?? '';
      if (!code) { state.error = 'Enter the code we sent.'; return render(); }
      firm();
      try {
        await verifyOtp(state.contact, code);
        // Guardian row first: it holds no student data, so it is safe before consent.
        const session = await currentSession();
        const { data, error } = await sb.from('guardian').upsert(
          { auth_user_id: session.user.id, name: state.parentName, contact: state.contact },
          { onConflict: 'auth_user_id' },
        ).select().single();
        if (error) throw error;
        state.guardian = data;
        go(data.verified_at ? 'consent' : 'age');
      } catch (e) { state.error = e.message || 'That code did not work.'; render(); }
    });

    on('#ob-name-go', 'click', async () => {
      const name = root.querySelector('#ob-name-only')?.value.trim() ?? '';
      state.parentName = name;
      if (!name) { state.error = 'We need your name.'; return render(); }
      firm();
      try {
        const session = await currentSession();
        const { data, error } = await sb.from('guardian').upsert(
          { auth_user_id: session.user.id, name, contact: state.contact },
          { onConflict: 'auth_user_id' },
        ).select().single();
        if (error) throw error;
        state.guardian = data;
        go(data.verified_at ? 'consent' : 'age');
      } catch (e) { state.error = e.message || 'That could not be saved.'; render(); }
    });

    on('[data-age]', 'click', (e) => {
      tick();
      state.studentAge = e.currentTarget.dataset.age;
      go(state.studentAge === '18_plus' ? 'adult' : 'verify');
    });

    on('#ob-verify-go', 'click', async () => {
      firm();
      state.busy = true; await render();
      try {
        const result = await getVerificationAdapter().verify();
        const { data, error } = await sb.from('guardian').update({
          verified_at: result.verifiedAt,
          verification_method: result.method,
          verification_ref: result.reference,
          updated_at: new Date().toISOString(),
        }).eq('id', state.guardian.id).select().single();
        if (error) throw error;
        state.guardian = data; state.busy = false;
        go('consent');
      } catch (e) {
        state.busy = false;
        state.error = e.message || 'Verification did not complete.';
        render();
      }
    });

    // Optional-consent switches. The nav's own switch wiring does not reach
    // markup rendered after boot, so these are bound here.
    onActivate('.ob-sw', (e) => {
      const el = e.currentTarget;
      const purpose = el.dataset.purpose;
      const next = !state.consent[purpose];
      state.consent[purpose] = next;
      el.classList.toggle('on', next);
      el.setAttribute('aria-checked', next ? 'true' : 'false');
      el.querySelector('.th').style.transform = `translateX(${next ? 22 : 0}px)`;
      tick();
    });

    on('#ob-consent-go', 'click', async () => {
      firm();
      try {
        // Guardian-scope: the student profile does not exist yet, which is
        // exactly why consent_event.student_id is nullable.
        await recordConsent({ guardianId: state.guardian.id, studentId: null, decisions: state.consent });
        go('plan');
      } catch (e) { state.error = e.message || 'Consent could not be recorded.'; render(); }
    });

    on('[data-plan]', 'click', (e) => {
      tick();
      state.plan = e.currentTarget.dataset.plan;
      go('student');
    });

    on('#ob-class button', 'click', (e) => {
      tick();
      state.studentClass = Number(e.currentTarget.dataset.class);
      root.querySelectorAll('#ob-class button').forEach(b => b.classList.toggle('on', b === e.currentTarget));
    });

    on('#ob-subjects .fchip', 'click', (e) => {
      tick();
      const el = e.currentTarget;
      const on = el.classList.toggle('active');
      const s = el.dataset.subject;
      state.subjects = on
        ? [...state.subjects.filter(x => x !== s), s]
        : state.subjects.filter(x => x !== s);
    });

    on('#ob-student-go', 'click', async () => {
      // Read into state before validating, so a re-render keeps the answers.
      state.studentFirst = root.querySelector('#ob-sname')?.value.trim() ?? '';
      const first = state.studentFirst;
      const cls = state.studentClass;
      const subjects = state.subjects;
      if (!first) { state.error = 'What should we call the student?'; return render(); }
      if (!subjects.length) { state.error = 'Pick at least one subject.'; return render(); }
      firm();
      try {
        const { data, error } = await sb.from('student').insert({
          guardian_id: state.guardian.id,
          first_name: first,
          class_level: cls,
          age_band: state.studentAge ?? 'under_18',
        }).select().single();
        if (error) throw error;
        await sb.from('student_subject').insert(subjects.map(s => ({ student_id: data.id, subject: s })));
        state.student = { ...data, subjects };
        go('firstRun');
      } catch (e) {
        // The consent gate raises 42501 here if consent is somehow missing.
        state.error = e.code === '42501'
          ? 'We can\'t create the profile until consent is recorded. Go back a step.'
          : (e.message || 'The profile could not be created.');
        render();
      }
    });

    on('#ob-first-go', 'click', () => { tick(); go('firstUpload'); });
    on('#ob-skip', 'click', () => { tick(); onComplete?.({ guardian: state.guardian, student: state.student }); });

    on('[data-type]', 'click', (e) => {
      firm();
      onComplete?.({
        guardian: state.guardian,
        student: state.student,
        firstPaperType: e.currentTarget.dataset.type,
      });
    });
  }

  render();
  return { go, state };
}
