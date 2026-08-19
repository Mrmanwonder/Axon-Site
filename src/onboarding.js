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
// Rendered with index.html's own components — it is the design system.

import { sb, sendOtp, verifyOtp, currentSession } from './supabase.js';
import { getVerificationAdapter } from './verification.js';
import { listPurposes, recordConsent } from './consent.js';
import { PAPER_TYPES } from './papers.js';

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
    plan: null,
    student: null,
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
      <div class="card insight" style="margin-top:18px">
        <div class="line">See exactly where the marks went — and what to do differently next time.</div>
        <div class="subnote" style="margin:14px 0 0">A parent sets this up. Indian law requires a
          parent's verified consent before we can process anything belonging to a student under 18.</div>
      </div>
      <button type="button" class="btn primary press" id="ob-start" style="margin:18px">I'm a parent — set this up</button>
      <button type="button" class="btn plain press" id="ob-student">I'm the student</button>
    `), { title: 'Mastery', sub: 'Understand your graded papers.' });
  }

  function studentDeadEnd() {
    return shell(h(`
      <div class="estate">
        <div class="ic"><svg viewBox="0 0 24 24"><path d="M12 15.5v.4M12 7v5"/><circle cx="12" cy="12" r="9"/></svg></div>
        <h2>Ask a parent to set this up</h2>
        <p>Because you're under 18, a parent or guardian has to create the account and give consent
           first. Once they've done that, this device is yours to use.</p>
        <button type="button" class="btn ghost press" id="ob-back">Back</button>
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
          <div class="search"><input id="ob-name" value="${esc(state.parentName)}" aria-label="Your full name" placeholder="Full name" autocomplete="name"></div>
        </div>
        <div class="srow noicon"><div class="lbl">Email or phone<small>We'll send a one-time code — no password to remember</small></div></div>
        <div class="searchwrap" style="padding:0 18px 14px">
          <div class="search"><input id="ob-contact" value="${esc(state.contact)}" aria-label="Email address or phone number" placeholder="you@example.com or +91…" autocomplete="email"></div>
        </div>
      </div>
      <div class="subnote">Nothing about the student is collected yet. Nothing is processed until you've consented.</div>
      <button type="button" class="btn primary press" id="ob-send" style="margin:18px">Send me a code</button>
    `), { title: 'Create your account' });
  }

  function otp(error) {
    return shell(h(`
      ${err(error)}
      <div class="searchwrap"><div class="search">
        <input id="ob-code" aria-label="One-time code, or the link from the email" placeholder="6-digit code, or paste the link" autocomplete="one-time-code" inputmode="numeric">
      </div></div>
      <div class="subnote">Sent to ${esc(state.contact)}. If the email contains a link rather than a
        code, paste the whole link here — that works too, and it still works after your mail app has
        already opened it.</div>
      <button type="button" class="btn primary press" id="ob-verify" style="margin:18px">Continue</button>
      <button type="button" class="btn plain press" id="ob-resend">Send it again</button>
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
        <input id="ob-name-only" value="${esc(state.parentName)}" aria-label="Your full name" placeholder="Your full name" autocomplete="name">
      </div></div>
      <div class="subnote">So the student knows whose account this is.</div>
      <button type="button" class="btn primary press" id="ob-name-go" style="margin:18px">Continue</button>
    `), { title: 'One detail' });
  }

  // ── step 3 · age gate and verification ───────────────────────────────────
  function ageGate() {
    return shell(h(`
      <div class="sectitle tight">How old is the student?</div>
      <div class="list">
        <button type="button" class="method press" data-age="under_18">
          <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M6.5 10.5V16c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5v-5.5"/></svg></span>
          <span class="b"><span class="t1">Under 18</span><span class="t2">You'll verify and consent on their behalf</span></span>
        </button>
        <button type="button" class="method press" data-age="18_plus">
          <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5"/></svg></span>
          <span class="b"><span class="t1">18 or older</span><span class="t2">They can hold their own account</span></span>
        </button>
      </div>
      <div class="subnote">This decides which consent path applies. We don't ask for a date of birth.</div>
    `), { title: 'One question first' });
  }

  function adultPath() {
    return shell(h(`
      <div class="estate">
        <div class="ic"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></div>
        <h2>They can sign up themselves</h2>
        <p>Over 18, no parental consent is needed, so the student holds their own account. That path
           isn't built yet — it's the next thing we're adding.</p>
        <button type="button" class="btn ghost press" id="ob-back">Back</button>
      </div>`), { title: 'Good news' });
  }

  function verifyStep(error, busy) {
    const adapter = getVerificationAdapter();
    return shell(h(`
      ${err(error)}
      <div class="card insight">
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
      <button type="button" class="btn primary press" id="ob-verify-go" style="margin:18px"${busy ? ' disabled' : ''}>${busy ? 'Verifying…' : esc(adapter.label)}</button>
    `), { title: 'Verify it\'s you' });
  }

  // ── step 4 · itemised consent ────────────────────────────────────────────
  async function consentStep(error) {
    const purposes = await listPurposes();
    for (const p of purposes) {
      // Required default on; optional default OFF and never pre-ticked.
      if (!(p.purpose in state.consent)) state.consent[p.purpose] = p.is_required;
    }
    const row = (p) => h(`
      <div class="srow noicon">
        <div class="lbl">${esc(p.label)}<small>${p.is_required ? 'Required — the app can\'t work without this' : 'Optional'}</small></div>
        ${p.is_required
          ? '<span class="locked">Required</span>'
          : `<button type="button" class="sw ob-sw${state.consent[p.purpose] ? ' on' : ''}" role="switch"
               aria-checked="${!!state.consent[p.purpose]}" aria-label="${esc(p.label)}" data-purpose="${esc(p.purpose)}">
               <span class="tr"></span><span class="th"><span class="gI"></span></span><span class="gO"></span></button>`}
      </div>`);

    return shell(h(`
      ${err(error)}
      <div class="sectitle tight">What we need to do</div>
      <div class="list">${purposes.filter(p => p.is_required).map(row).join('')}</div>
      <div class="sectitle">Optional — off unless you turn it on</div>
      <div class="list">${purposes.filter(p => !p.is_required).map(row).join('')}</div>
      <div class="sectitle">What we never do</div>
      <div class="list">
        <div class="srow noicon"><div class="lbl">Advertising of any kind</div><span class="tier t1">Never</span></div>
        <div class="srow noicon"><div class="lbl">Behavioural tracking</div><span class="tier t1">Never</span></div>
        <div class="srow noicon"><div class="lbl">Selling data to anyone</div><span class="tier t1">Never</span></div>
        <div class="srow noicon"><div class="lbl">Ranking against other students</div><span class="tier t1">Never</span></div>
      </div>
      <div class="subnote">You can withdraw any optional consent later in Settings — one tap, no email required.</div>
      <button type="button" class="btn primary press" id="ob-consent-go" style="margin:18px">Give consent</button>
    `), { title: 'What you\'re agreeing to' });
  }

  // ── step 5 · plan, after consent ─────────────────────────────────────────
  function planStep() {
    return shell(h(`
      <div class="list">
        <button type="button" class="method press" data-plan="trial">
          <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3.5 2"/><circle cx="12" cy="12" r="9"/></svg></span>
          <span class="b"><span class="t1">Start a free trial</span><span class="t2">Full access. No card needed now.</span></span>
        </button>
        <button type="button" class="method press" data-plan="paid">
          <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5h18M3 7.5h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg></span>
          <span class="b"><span class="t1">Subscribe now</span><span class="t2">Billing isn't wired up yet</span></span>
        </button>
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
        <input id="ob-sname" aria-label="Student's first name" placeholder="Student's first name" autocomplete="off">
      </div></div>
      <div class="sectitle">Class</div>
      <div class="list"><div class="srow noicon"><div class="lbl" id="ob-class-lbl">Class</div>
        <div class="seg" id="ob-class" role="radiogroup" aria-labelledby="ob-class-lbl">
          ${[9, 10, 11, 12].map((c, i) => `<button type="button" role="radio" aria-checked="${i === 2}" aria-label="Class ${c}" data-class="${c}"${i === 2 ? ' class="on"' : ''}>${c}</button>`).join('')}
        </div></div>
        <div class="srow noicon"><div class="lbl">Board</div><span class="aux">CBSE</span></div>
      </div>
      <div class="sectitle">Subjects</div>
      <div class="filterbar" id="ob-subjects" style="position:static">
        ${SUBJECTS.map(s => `<button type="button" class="fchip${chosen.has(s) ? ' active' : ''}" aria-pressed="${chosen.has(s)}" data-subject="${esc(s)}">${esc(s)}</button>`).join('')}
      </div>
      <div class="subnote">Nothing else is collected — no school, no address, no photograph.</div>
      <button type="button" class="btn primary press" id="ob-student-go" style="margin:18px">Create profile</button>
    `), { title: 'The student' });
  }

  // ── step 7 · student first run ───────────────────────────────────────────
  function firstRun() {
    return shell(h(`
      <div class="card insight">
        <div class="line">This is yours, ${esc(state.student?.first_name || 'not your parent\'s')}.</div>
      </div>
      <div class="sectitle">How it works</div>
      <div class="list">
        <div class="srow noicon"><div class="lbl">You upload a marked paper<small>We read the questions, your answers, and your teacher's marks</small></div></div>
        <div class="srow noicon"><div class="lbl">We never overrule your teacher<small>The marks shown are the marks they gave. We explain where they went.</small></div></div>
        <div class="srow noicon"><div class="lbl">You can see the reasoning<small>Every insight shows what it was based on</small></div></div>
        <div class="srow noicon"><div class="lbl">If we read something wrong, fix it<small>Your correction wins. No review, no arguing.</small></div></div>
      </div>
      <button type="button" class="btn primary press" id="ob-first-go" style="margin:18px">Upload my first paper</button>
      <button type="button" class="btn plain press" id="ob-skip">Look around first</button>
    `), { title: 'Hello' });
  }

  // ── step 8 · guided first upload ─────────────────────────────────────────
  function firstUpload() {
    return shell(h(`
      <div class="card insight">
        <div class="line">What kind of paper is this?</div>
        <div class="subnote" style="margin:10px 0 0">This one matters: a board paper can be matched to the
          official marking scheme. A school test is explained from your teacher's marks instead.</div>
      </div>
      <div class="list" style="margin-top:14px">
        ${PAPER_TYPES.map(t => `
          <button type="button" class="method press" data-type="${esc(t.value)}">
            <span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h9l4 4V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z"/><path d="M14.5 4.5V9H19"/></svg></span>
            <span class="b"><span class="t1">${esc(t.label)}</span>
              <span class="t2">${t.value === 'pyq' || t.value === 'sample_paper' ? 'Matched to the official scheme where we have it' : 'Explained from your teacher\'s marks'}</span></span>
          </button>`).join('')}
      </div>
      <div class="subnote">We'll only ask this the first time.</div>
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
    on('.ob-sw', 'click', (e) => {
      const el = e.currentTarget;
      const purpose = el.dataset.purpose;
      const next = !state.consent[purpose];
      state.consent[purpose] = next;
      // The design system's switch: same spring as Settings, and it keeps
      // aria-checked in step, which is the half a screen reader reads.
      window.__masterySwitch?.(el, next);
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
      root.querySelectorAll('#ob-class button').forEach((b) => {
        const on = b === e.currentTarget;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    });

    // Subjects are the one genuinely multi-select filter in the app, so they
    // are toggles carrying aria-pressed rather than a single-value chooser.
    on('#ob-subjects .fchip', 'click', (e) => {
      tick();
      const on = e.currentTarget.classList.toggle('active');
      e.currentTarget.setAttribute('aria-pressed', on ? 'true' : 'false');
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
