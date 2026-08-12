// Onboarding, steps 1-8.
//
// The order is legally load-bearing, not a UX preference:
//   landing → parent account → verify → consent → payment → student profile →
//   the student's first four screens → an empty Home
//
// Two constraints it exists to satisfy:
//   · No student personal data is written before a consent_event grants every
//     required purpose. The database also refuses it, so this is belt and
//     braces rather than the only guard.
//   · Payment comes after consent, never before, so paying cannot become
//     pressure on a consent decision.
//
// The flow has two halves with deliberately different personalities, and they
// are not blended. Steps 1-6 belong to the parent and are efficient and dense:
// the goal is to be finished. Steps 7-8 belong to the student and are paced the
// opposite way — one idea per screen, one forward action. The seam is at
// `FIRST_RUN` below, and it is intentional that the two do not look alike.
//
// Rendered with index.html's own components — it is the design system.

import { sb, sendOtp, verifyOtp, currentSession } from './supabase.js';
import { getVerificationAdapter } from './verification.js';
import { listPurposes, recordConsent } from './consent.js';
import { LANGUAGES, noticeStrings, purposeLabel, noticeIsComplete } from './notice.js';

const h = (s) => s; // tagging helper for readability
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function tick() { window.__masteryHaptic?.tick?.(); }
function firm() { window.__masteryHaptic?.firm?.(); }

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'Computer Science'];

export function startOnboarding(root, { onComplete, session = null }) {
  const state = {
    // A live session with no guardian row means the emailed link was clicked;
    // pick the flow up at the only thing still missing.
    step: session ? 'nameOnly' : 'landing',
    contact: session?.user?.email ?? session?.user?.phone ?? '',
    parentName: '',
    studentAge: null,
    verification: null,
    guardian: null,
    consent: {},
    // Which language the notice is being read in at the moment of the decision.
    // Not persisted as a preference: it is a property of this consent event,
    // not a setting, and the app itself is English-only for now.
    noticeLang: 'en',
    plan: null,
    student: null,
    firstRunIndex: 0,
  };

  const go = (step) => { state.step = step; render(); };

  function shell(inner, { title = '', sub = '' } = {}) {
    return h(`
      <div class="view on" style="position:relative;inset:auto;height:100%;">
        ${title ? `<div class="greet"><h1>${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>` : ''}
        ${inner}
      </div>`);
  }

  function err(msg) {
    return msg
      ? `<div class="draft" role="alert"><div class="ic"><svg viewBox="0 0 24 24"><path d="M12 8v5M12 16.5v.4"/><path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg></div><div class="b"><div class="t2">${esc(msg)}</div></div></div>`
      : '';
  }

  // ── step 1 · landing ─────────────────────────────────────────────────────
  // Parent-facing. A student who lands here is routed to "ask a parent" rather
  // than into a flow they cannot legally complete.
  function landing() {
    return shell(h(`
      <div class="card insight press" style="margin-top:18px">
        <div class="line">See exactly where the marks went — and what to do differently next time.</div>
        <div class="subnote" style="margin:14px 0 0">A parent sets this up. Indian law requires a
          parent's verified consent before we can process anything belonging to a student under 18.</div>
      </div>
      <div class="btn primary press" id="ob-start" role="button" tabindex="0" style="margin:18px">I'm a parent — set this up</div>
      <div class="btn plain press" id="ob-student" role="button" tabindex="0">I'm the student</div>
    `), { title: 'Mastery', sub: 'Understand your graded papers.' });
  }

  function studentDeadEnd() {
    return shell(h(`
      <div class="estate">
        <div class="ic"><svg viewBox="0 0 24 24"><path d="M12 15.5v.4M12 7v5"/><circle cx="12" cy="12" r="9"/></svg></div>
        <h4>Ask a parent to set this up</h4>
        <p>Because you're under 18, a parent or guardian has to create the account and give consent
           first. Once they've done that, this device is yours to use.</p>
        <div class="btn ghost press" id="ob-back" role="button" tabindex="0">Back</div>
      </div>`), { title: 'Nearly there' });
  }

  // ── step 2 · parent account ──────────────────────────────────────────────
  function account(error) {
    return shell(h(`
      ${err(error)}
      <div class="sectitle tight">Your details</div>
      <div class="list">
        <div class="srow noicon"><div class="lbl">Your name<small>So the student knows whose account this is</small></div></div>
        <div class="searchwrap" style="padding:0 18px 12px">
          <div class="search"><input id="ob-name" value="${esc(state.parentName)}" placeholder="Full name" autocomplete="name"></div>
        </div>
        <div class="srow noicon"><div class="lbl">Email or phone<small>We'll send a one-time code — no password to remember</small></div></div>
        <div class="searchwrap" style="padding:0 18px 14px">
          <div class="search"><input id="ob-contact" value="${esc(state.contact)}" placeholder="you@example.com or +91…" autocomplete="email"></div>
        </div>
      </div>
      <div class="subnote">Nothing about the student is collected yet. Nothing is processed until you've consented.</div>
      <div class="btn primary press" id="ob-send" role="button" tabindex="0" style="margin:18px">Send me a code</div>
    `), { title: 'Create your account' });
  }

  function otp(error) {
    return shell(h(`
      ${err(error)}
      <div class="searchwrap"><div class="search">
        <input id="ob-code" placeholder="6-digit code, or paste the link" autocomplete="one-time-code">
      </div></div>
      <div class="subnote">Sent to ${esc(state.contact)}. If the email contains a link rather than a
        code, paste the whole link here — that works too, and it still works after your mail app has
        already opened it.</div>
      <div class="btn primary press" id="ob-verify" role="button" tabindex="0" style="margin:18px">Continue</div>
      <div class="btn plain press" id="ob-resend" role="button" tabindex="0">Send it again</div>
    `), { title: 'Check your email' });
  }

  // Someone who clicked the emailed link arrives already signed in, but with no
  // guardian row and none of the details this flow collected. Rather than send
  // them back to the start, ask only for what is missing.
  function nameOnly(error) {
    return shell(h(`
      ${err(error)}
      <div class="subnote" style="margin-bottom:4px">Signed in as ${esc(state.contact)}.</div>
      <div class="searchwrap"><div class="search">
        <input id="ob-name-only" value="${esc(state.parentName)}" placeholder="Your full name" autocomplete="name">
      </div></div>
      <div class="subnote">So the student knows whose account this is.</div>
      <div class="btn primary press" id="ob-name-go" role="button" tabindex="0" style="margin:18px">Continue</div>
    `), { title: 'One detail' });
  }

  // ── step 3 · age gate and verification ───────────────────────────────────
  function ageGate() {
    return shell(h(`
      <div class="sectitle tight">How old is the student?</div>
      <div class="list">
        <div class="method press" data-age="under_18" role="button" tabindex="0">
          <div class="ic"><svg viewBox="0 0 24 24"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M6.5 10.5V16c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-5.5"/></svg></div>
          <div class="b"><div class="t1">Under 18</div><div class="t2">You'll verify and consent on their behalf</div></div>
        </div>
        <div class="method press" data-age="18_plus" role="button" tabindex="0">
          <div class="ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5"/></svg></div>
          <div class="b"><div class="t1">18 or older</div><div class="t2">They can hold their own account</div></div>
        </div>
      </div>
      <div class="subnote">This decides which consent path applies. We don't ask for a date of birth.</div>
    `), { title: 'One question first' });
  }

  function adultPath() {
    return shell(h(`
      <div class="estate">
        <div class="ic"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></div>
        <h4>They can sign up themselves</h4>
        <p>Over 18, no parental consent is needed, so the student holds their own account. That path
           isn't built yet — it's the next thing we're adding.</p>
        <div class="btn ghost press" id="ob-back" role="button" tabindex="0">Back</div>
      </div>`), { title: 'Good news' });
  }

  function verifyStep(error, busy) {
    const adapter = getVerificationAdapter();
    return shell(h(`
      ${err(error)}
      <div class="card insight press">
        <div class="chips"><span class="chip n">Required by law</span></div>
        <div class="line">${esc(adapter.label)}</div>
        <div class="subnote" style="margin:12px 0 0">${esc(adapter.description)}</div>
      </div>
      <div class="sectitle">What we keep</div>
      <div class="list">
        <div class="srow noicon"><div class="lbl">A confirmation reference<small>Proof the check happened</small></div><span class="tier t2">Kept</span></div>
        <div class="srow noicon"><div class="lbl">When it happened<small>Timestamp and method</small></div><span class="tier t2">Kept</span></div>
        <div class="srow noicon"><div class="lbl">Your documents<small>Aadhaar, licence, anything scanned</small></div><span class="tier t1">Never stored</span></div>
      </div>
      <div class="btn primary press" id="ob-verify-go" role="button" tabindex="0"
           ${busy ? 'aria-disabled="true" aria-busy="true"' : ''} style="margin:18px">${busy ? 'Verifying…' : esc(adapter.label)}</div>
    `), { title: 'Verify it\'s you' });
  }

  // ── step 4 · itemised consent ────────────────────────────────────────────
  //
  // Itemised, never a single checkbox: the Act requires consent to be specific
  // to each purpose, and one box covering six of them is not that. Optional
  // purposes start off and are never pre-ticked.
  //
  // The notice is readable in English and Hindi because a notice the parent
  // cannot read has not informed them, and consent that isn't informed isn't
  // consent. The language applies to the whole screen — chrome and purpose
  // labels together — since a half-translated notice is arguably worse than an
  // untranslated one.
  async function consentStep(error) {
    const purposes = await listPurposes();
    for (const p of purposes) {
      // Required default on; optional default OFF and never pre-ticked.
      if (!(p.purpose in state.consent)) state.consent[p.purpose] = p.is_required;
    }
    const lang = state.noticeLang;
    const t = noticeStrings(lang);
    const label = (p) => purposeLabel(p.purpose, p.label, lang);

    const row = (p) => h(`
      <div class="srow noicon">
        <div class="lbl">${esc(label(p))}<small>${esc(p.is_required ? t.requiredNote : t.optionalNote)}</small></div>
        ${p.is_required
          ? `<span class="locked">${esc(t.requiredTag)}</span>`
          : `<div class="sw ob-sw${state.consent[p.purpose] ? ' on' : ''}" data-purpose="${esc(p.purpose)}"
                  role="switch" aria-checked="${state.consent[p.purpose]}" tabindex="0"
                  aria-label="${esc(label(p))}">
               <div class="tr"></div><div class="th"><span class="gI"></span></div><span class="gO"></span></div>`}
      </div>`);

    // A purpose seeded in SQL but not yet translated would otherwise show in
    // English inside an otherwise-Hindi notice with nothing to say why.
    const partial = !noticeIsComplete(purposes, lang);

    return shell(h(`
      ${err(error)}
      <div class="srow noicon" lang="${lang}">
        <div class="lbl">${esc(t.langLabel)}</div>
        <div class="seg" id="ob-lang">
          ${LANGUAGES.map(l => `<button data-lang="${esc(l.code)}" lang="${esc(l.code)}"${l.code === lang ? ' class="on"' : ''}>${esc(l.label)}</button>`).join('')}
        </div>
      </div>
      <div lang="${lang}">
        <div class="sectitle tight">${esc(t.requiredSection)}</div>
        <div class="list">${purposes.filter(p => p.is_required).map(row).join('')}</div>
        <div class="sectitle">${esc(t.optionalSection)}</div>
        <div class="list">${purposes.filter(p => !p.is_required).map(row).join('')}</div>
        <div class="sectitle">${esc(t.neverSection)}</div>
        <div class="list">
          ${t.neverItems.map(item => `<div class="srow noicon"><div class="lbl">${esc(item)}</div><span class="tier t1">${esc(t.never)}</span></div>`).join('')}
        </div>
        ${partial ? '<div class="subnote">Some items are shown in English — we have not translated them yet.</div>' : ''}
        <div class="subnote">${esc(t.withdrawNote)}</div>
        <div class="btn primary press" id="ob-consent-go" role="button" tabindex="0" style="margin:18px">${esc(t.action)}</div>
      </div>
    `), { title: t.title });
  }

  // ── step 5 · plan, after consent ─────────────────────────────────────────
  function planStep() {
    return shell(h(`
      <div class="list">
        <div class="method press" data-plan="trial" role="button" tabindex="0">
          <div class="ic"><svg viewBox="0 0 24 24"><path d="M12 7v5l3.5 2"/><circle cx="12" cy="12" r="9"/></svg></div>
          <div class="b"><div class="t1">Start a free trial</div><div class="t2">Full access. No card needed now.</div></div>
        </div>
        <div class="method press" data-plan="paid" role="button" tabindex="0">
          <div class="ic"><svg viewBox="0 0 24 24"><path d="M3 9.5h18M3 7.5h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg></div>
          <div class="b"><div class="t1">Subscribe now</div><div class="t2">Billing isn't wired up yet</div></div>
        </div>
      </div>
      <div class="subnote">Payment details are never visible to the student profile. We asked for consent
        before this step on purpose — paying shouldn't feel like pressure to agree.</div>
    `), { title: 'Choose a plan' });
  }

  // ── step 6 · student profile ─────────────────────────────────────────────
  function studentStep(error) {
    const chosen = new Set(state.student?.subjects ?? []);
    return shell(h(`
      ${err(error)}
      <div class="searchwrap"><div class="search">
        <input id="ob-sname" placeholder="Student's first name" autocomplete="off">
      </div></div>
      <div class="sectitle">Class</div>
      <div class="list"><div class="srow noicon"><div class="lbl">Class</div>
        <div class="seg" id="ob-class">
          ${[9, 10, 11, 12].map((c, i) => `<button data-class="${c}"${i === 2 ? ' class="on"' : ''}>${c}</button>`).join('')}
        </div></div>
        <div class="srow noicon"><div class="lbl">Board</div><span class="aux">CBSE</span></div>
      </div>
      <div class="sectitle">Subjects</div>
      <div class="filterbar" id="ob-subjects" style="position:static">
        ${SUBJECTS.map(s => `<div class="fchip${chosen.has(s) ? ' active' : ''}" data-subject="${esc(s)}" role="checkbox" aria-checked="${chosen.has(s)}" tabindex="0">${esc(s)}</div>`).join('')}
      </div>
      <div class="subnote">Nothing else is collected — no school, no address, no photograph.</div>
      <div class="btn primary press" id="ob-student-go" role="button" tabindex="0" style="margin:18px">Create profile</div>
    `), { title: 'The student' });
  }

  // ── steps 7-8 · the student's first minute ───────────────────────────────
  //
  // Everything above this line is the parent's, and it is dense on purpose: a
  // parent wants to be finished, so those screens stack fields and put several
  // decisions on one surface. From here the personality changes completely.
  //
  // These are the first four screens a fourteen-year-old sees, and what they
  // need to come away believing is not a feature list — it is that this thing
  // is on their side. So: one idea per screen, room around it, and a single
  // forward action with nothing next to it to weigh up.
  //
  // The four ideas are load-bearing and ordered. Two of them (we never overrule
  // your teacher, your correction wins) are the product's central promises, and
  // a student who has not understood them will read a diagnosis as a second
  // marking. They are stated here, before any paper exists, so they frame
  // everything that comes after rather than arriving as a disclaimer.
  //
  // No step counter and no skip link — see the note on `.calm` in index.html.
  const FIRST_RUN = [
    {
      // What this does with your papers.
      icon: '<path d="M6 4.5h9l4 4V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z"/><path d="M14.5 4.5V9H19"/>',
      title: 'You add a paper. We read it.',
      body: 'The questions, what you wrote, and your teacher\'s marks and remarks in red. '
          + 'Then we work through where the marks went, question by question.',
      action: 'Continue',
    },
    {
      // It never overrules your teacher.
      icon: '<path d="M20 6 9 17l-5-5"/>',
      title: 'The marks stay your teacher\'s.',
      body: 'We explain their marking. We never change it, and we\'ll never tell you that you '
          + 'deserved more than you got. If a mark looks wrong to you, that is worth raising '
          + 'with your teacher — they were the one reading your paper.',
      action: 'Continue',
    },
    {
      // You can see the reasoning behind anything it says.
      icon: '<circle cx="12" cy="12" r="3.2"/><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/>',
      title: 'Anything we say, you can open up.',
      body: 'Every insight will show you what it was built from — what we read on the page, what '
          + 'the marking scheme asks for, and how sure we are. Nothing arrives as a verdict '
          + 'you just have to accept.',
      action: 'Continue',
    },
    {
      // You can correct it, and your correction wins.
      icon: '<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="M13.5 6.5 17 10"/>',
      title: 'If we get something wrong, you fix it.',
      body: 'Misread your handwriting, or named the wrong reason you lost a mark — tell us and it '
          + 'changes on the spot. No form, no review, nobody checking up on you. You sat the '
          + 'paper and we didn\'t.',
      action: 'Take me in',
    },
  ];

  function firstRun(i) {
    const s = FIRST_RUN[i];
    return h(`
      <div class="view on calmview" style="position:relative;inset:auto;height:100%;">
        <div class="calm">
          <div class="top">
            <div class="ic"><svg viewBox="0 0 24 24">${s.icon}</svg></div>
            <h2>${esc(s.title)}</h2>
            <p>${esc(s.body)}</p>
          </div>
          <div class="foot">
            <div class="btn primary press" id="ob-calm-go" role="button" tabindex="0">${esc(s.action)}</div>
          </div>
        </div>
      </div>`);
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
      case 'firstRun':     html = firstRun(state.firstRunIndex); break;
      default:             html = landing();
    }
    root.innerHTML = html;
    wire();
    window.__masteryRebindPress?.(root);
    // Everything here is rendered after boot, so the boot-time keyboard binding
    // never sees it. Without this the whole flow is pointer-only.
    window.__masteryRebindKeys?.(root);
  }

  function on(sel, ev, fn) {
    root.querySelectorAll(sel).forEach((el) => el.addEventListener(ev, fn));
  }

  function wire() {
    on('#ob-start', 'click', () => { tick(); go('account'); });
    on('#ob-student', 'click', () => { tick(); go('studentDead'); });
    on('#ob-back', 'click', () => { tick(); go('landing'); });

    on('#ob-send', 'click', async () => {
      const name = root.querySelector('#ob-name')?.value.trim() ?? '';
      const contact = root.querySelector('#ob-contact')?.value.trim() ?? '';
      if (!name) { state.error = 'We need your name.'; return render(); }
      if (!contact) { state.error = 'Enter an email address or phone number.'; return render(); }
      state.parentName = name; state.contact = contact;
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
        state.parentName = name;
        go(data.verified_at ? 'consent' : 'age');
      } catch (e) { state.error = e.message || 'That could not be saved.'; render(); }
    });

    on('[data-age]', 'click', (e) => {
      tick();
      state.studentAge = e.currentTarget.dataset.age;
      go(state.studentAge === '18_plus' ? 'adult' : 'verify');
    });

    on('#ob-verify-go', 'click', async (e) => {
      // CSS pointer-events stops a second pointer click, but not a second Enter
      // press — and a double handoff would burn two verification references.
      if (e.currentTarget.getAttribute('aria-disabled') === 'true') return;
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
    on('.ob-sw', 'click', (e) => {
      const el = e.currentTarget;
      const purpose = el.dataset.purpose;
      const next = !state.consent[purpose];
      state.consent[purpose] = next;
      el.classList.toggle('on', next);
      el.setAttribute('aria-checked', String(next));
      el.querySelector('.th').style.transform = `translateX(${next ? 22 : 0}px)`;
      tick();
    });

    // Switching the notice language re-renders it. The decisions already made
    // are held in state, so nothing a parent has toggled is lost by reading the
    // same notice in the other language.
    on('#ob-lang button', 'click', (e) => {
      tick();
      state.noticeLang = e.currentTarget.dataset.lang;
      render();
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
      root.querySelectorAll('#ob-class button').forEach(b => b.classList.toggle('on', b === e.currentTarget));
    });

    on('#ob-subjects .fchip', 'click', (e) => {
      tick();
      e.currentTarget.classList.toggle('active');
    });

    on('#ob-student-go', 'click', async () => {
      const first = root.querySelector('#ob-sname')?.value.trim() ?? '';
      const cls = Number(root.querySelector('#ob-class button.on')?.dataset.class ?? 11);
      const subjects = [...root.querySelectorAll('#ob-subjects .fchip.active')].map(c => c.dataset.subject);
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

    // The four calm screens advance through one handler; the last one ends
    // onboarding and hands over to an empty Home, which carries the only call
    // to action a student with no papers can act on.
    on('#ob-calm-go', 'click', () => {
      const last = state.firstRunIndex === FIRST_RUN.length - 1;
      if (!last) {
        tick();
        state.firstRunIndex += 1;
        return render();
      }
      firm();
      onComplete?.({ guardian: state.guardian, student: state.student });
    });
  }

  render();
  return { go, state };
}
