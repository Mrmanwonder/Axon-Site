/* ═══════════════════════════════════════════════════════════════════════════
   ONBOARDING

   The order is legally load-bearing, not a UX preference:

     landing → parent account → verify → consent → payment → student profile →
     student first run → first upload

   Two constraints it exists to satisfy, both from India's DPDP Act:

   · No student personal data is written before a `consent_event` grants every
     required purpose. The database refuses it too, so this is belt and braces
     rather than the only guard.
   · Payment comes after consent, never before, so paying cannot become
     pressure on a consent decision.

   ── One behaviour change from the module this replaces ──

   `src/onboarding.js` offers a board picker of CBSE / IGCSE / AS & A Level and
   writes `board: 'CBSE'` by default. It never imports `curriculum.js` and never
   collects a syllabus code, even though the migration adding
   `student_subject.syllabus_code` shipped alongside it.

   CLAUDE.md says board is CAIE for every new profile and that CBSE remains in
   the enum only for accounts created before the switch; AGENTS.md says
   `curriculum.js` is the single source and nothing else may hardcode a board or
   a four-digit code. This screen follows both: the board is no longer a
   question, the stage is derived from the year, and every chosen subject
   carries its Cambridge syllabus code. Carrying the old picker forward would
   have meant knowingly porting a bug.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useApp } from "../data/AppProvider";
import { hapticTick, hapticFirm } from "../lib/haptics";
import {
  sb, sendOtp, verifyOtp, currentSession, currentGuardian,
  signInWithProvider, isProviderNotEnabled, OAUTH_PROVIDERS, PROVIDER_LABEL,
  getVerificationAdapter, listPurposes, recordConsent,
  BOARD, CLASS_LEVELS, classLabel, stageForClass, subjectsForClass, syllabusCode,
  PAPER_TYPES,
  isPasskeySupported, signInWithPasskey, registerPasskey, PASSKEY_MESSAGE,
  startCheckout,
} from "../data/modules";
import type { Guardian, Student } from "../data/modules";
import { Shell, Err, Field, Method, SRow, Icon, ICONS, BRAND } from "./chrome";
import PressBox from "../components/PressBox";
import Switch from "../components/Switch";

type Step =
  | "landing" | "studentDead" | "account" | "otp" | "nameOnly"
  | "passkeyOffer"
  | "age" | "adult" | "verify" | "consent" | "plan" | "student"
  | "firstRun" | "firstUpload";

/* Offered once per device, ever — never re-prompted on a later sign-in. If
   dismissed, the only way back to it is Settings → Security → Passkeys. */
const PASSKEY_OFFER_KEY = "axon.passkeyOfferSeen";
const passkeyOfferSeen = () => {
  try { return localStorage.getItem(PASSKEY_OFFER_KEY) === "1"; } catch { return true; }
};
const markPasskeyOfferSeen = () => {
  try { localStorage.setItem(PASSKEY_OFFER_KEY, "1"); } catch { /* private mode */ }
};

/* Back is offered only where returning cannot strand the flow or undo something
   already written. Nothing past consent has a way back: consent is recorded,
   and re-deciding it belongs in Settings, where withdrawal is first-class. */
const BACK_TO: Partial<Record<Step, Step>> = {
  studentDead: "landing",
  account: "landing",
  otp: "account",
  age: "account",
  adult: "age",
  verify: "age",
};

const STEP_PHASE: Partial<Record<Step, number>> = {
  account: 0, otp: 0, nameOnly: 0,
  age: 1, verify: 1,
  consent: 2,
  plan: 3,
  student: 4,
};

/* The seven causes, as a named palette on the landing screen. Categorical and
   equal-weight, so there is nothing here to read as a ranking. */
const CAUSES: [string, string][] = [
  ["var(--cause-conceptual-gap)", "Conceptual gap"],
  ["var(--cause-procedural-slip)", "Procedural slip"],
  ["var(--cause-misread-question)", "Misread question"],
  ["var(--cause-incomplete)", "Incomplete"],
  ["var(--cause-presentation)", "Presentation"],
  ["var(--cause-keyword-miss)", "Keyword miss"],
  ["var(--cause-timed-out)", "Timed out"],
];

/* Icon and a specific one-liner per purpose. The generic alternative —
   repeating "Required" down four rows — turns the most consequential screen in
   the flow into a wall of identical switches, which is how blanket consent gets
   clicked through. Each row has to say what it actually permits. */
const PURPOSES: Record<string, [string, ReactNode, string]> = {
  store_papers: ["ic-b", ICONS.paper, "The pages you upload, kept in the account"],
  extract_text: ["ic-b", ICONS.read, "Reading the questions, answers and remarks"],
  generate_explanations: ["ic-b", ICONS.explain, "Grounded in the marks the teacher gave"],
  track_progress: ["ic-b", ICONS.trend, "So a repeated cause shows up over time"],
  weekly_parent_digest: ["ic-a", ICONS.mail, "A short email to you, once a week"],
  improve_extraction: ["ic-a", ICONS.spark, "Uses anonymised corrections"],
};

type Purpose = { purpose: string; label: string; is_required: boolean; sort_order: number };
type SessionUser = {
  user?: {
    id: string;
    email?: string;
    phone?: string;
    user_metadata?: { full_name?: string; name?: string };
    app_metadata?: { provider?: string };
  };
};

export default function Onboarding() {
  const { session, providerError, finishOnboarding } = useApp();
  const s = session as SessionUser | null;

  /* A live session with no guardian row means the emailed link was clicked, or
     Google/Apple sent us back signed in; pick the flow up at the only thing
     still missing. A refused provider round trip opens on the account step —
     landing would make the tap look like it did nothing. */
  const [step, setStep] = useState<Step>(
    s ? "nameOnly" : providerError ? "account" : "landing",
  );
  const [error, setError] = useState<string | null>(providerError?.message ?? null);
  const [busy, setBusy] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  const [parentName, setParentName] = useState(
    s?.user?.user_metadata?.full_name ?? s?.user?.user_metadata?.name ?? "",
  );
  const [contact, setContact] = useState(s?.user?.email ?? s?.user?.phone ?? "");
  const [code, setCode] = useState("");
  const provider = s?.user?.app_metadata?.provider ?? null;

  const [studentAge, setStudentAge] = useState<string | null>(null);
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [purposes, setPurposes] = useState<Purpose[] | null>(null);
  const [consent, setConsent] = useState<Record<string, boolean>>({});

  /* Set by the return from Stripe, read by the step it lands on. `null` is the
     ordinary case: nobody has been to Checkout in this run of the flow. */
  const [billingReturn, setBillingReturn] = useState<"success" | "cancelled" | null>(null);
  const [busyCheckout, setBusyCheckout] = useState(false);

  const [busyPasskey, setBusyPasskey] = useState(false);
  const [passkeyNote, setPasskeyNote] = useState<string | null>(null);
  /* What to do once the passkey-offer interstitial is dismissed or accepted —
     set by whichever call site interposed it, per the module note above. */
  const afterPasskeyOffer = useRef<(() => void) | null>(null);

  // ── OTP autofill and resend cooldown ──
  const OTP_RESEND_COOLDOWN_S = 30;
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null);
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
  const otpCooldownRemaining = otpSentAt === null ? 0
    : Math.max(0, OTP_RESEND_COOLDOWN_S - Math.floor((cooldownNow - otpSentAt) / 1000));
  useEffect(() => {
    if (step !== "otp" || otpCooldownRemaining <= 0) return;
    const t = setInterval(() => setCooldownNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step, otpCooldownRemaining]);

  /* Held across re-renders so a validation error does not wipe what was already
     typed and picked. Being made to re-enter a name because one subject was
     missed is the flow calling the user careless. */
  const [studentFirst, setStudentFirst] = useState("");
  const [studentClass, setStudentClass] = useState(11);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [student, setStudent] = useState<Student | null>(null);

  const go = useCallback((next: Step) => { setError(null); setStep(next); }, []);
  const fail = (e: unknown, fallback: string) => setError((e as Error)?.message || fallback);

  /* ── who is this, and what do they still need? ──
     A guardian who already has a student profile has been through verification,
     consent and profile creation already. Routing them through it again is not
     merely redundant: nothing stops a second `student` insert, so it silently
     creates a duplicate profile every time they sign back in, while the flow
     looks like a login that never finishes. That was the "can't log in" bug. */
  /* Interposes the passkey offer ahead of whatever step or completion would
     otherwise happen next, but only the first time this device sees it — see
     `passkeyOfferSeen`. Every call site below that used to `go(...)` or
     `finishOnboarding(...)` directly now routes through this instead, so the
     offer shows up after every confirmed sign-in path: fresh OTP, the
     link/nameOnly path, and a returning guardian's passkey sign-in alike. */
  const proceedOrOfferPasskey = useCallback((next: () => void) => {
    if (isPasskeySupported() && !passkeyOfferSeen()) {
      afterPasskeyOffer.current = next;
      go("passkeyOffer");
    } else {
      next();
    }
  }, [go]);

  const continueAsGuardian = useCallback(async (g: Guardian) => {
    const { data: existing, error: e1 } = await sb
      .from("student").select("*")
      .eq("guardian_id", g.id)
      .order("created_at", { ascending: true })
      .limit(1);
    if (e1) throw e1;

    if (existing?.length) {
      const st = existing[0];
      const { data: subjectRows } = await sb
        .from("student_subject").select("subject").eq("student_id", st.id);
      const finish = () => void finishOnboarding({
        guardian: g,
        student: { ...st, subjects: (subjectRows ?? []).map((r: { subject: string }) => r.subject) },
      });
      proceedOrOfferPasskey(finish);
      return;
    }
    const hasVerified = !!(g as Guardian & { verified_at?: string }).verified_at;
    proceedOrOfferPasskey(() => go(hasVerified ? "consent" : "age"));
  }, [finishOnboarding, go, proceedOrOfferPasskey]);

  /* ── back from Stripe ──
     Checkout is a full-page round trip to another origin: this component is
     unmounted, the app boots again, and every piece of local state the flow was
     holding is gone. The session and the guardian row survive, so the flow can
     be picked up from the database rather than restarted — and it must be.
     Landing back on `nameOnly` would ask a parent who has just paid for their
     name again and then walk them back through consent they already gave.

     The query param is stripped either way, so a reload or a shared URL cannot
     replay this. */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const outcome = params.get("billing");
    if (outcome !== "success" && outcome !== "cancelled") return;

    params.delete("billing");
    const rest = params.toString();
    history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : "") + location.hash);

    setBillingReturn(outcome);
    if (!s) return; // signed out mid-round-trip; the landing screen is honest.

    (async () => {
      const g = await currentGuardian();
      if (!g) return; // nothing paid for yet — leave the flow where it was.
      setGuardian(g);
      // Consent and verification are already recorded for anyone who reached
      // the plan step, so the profile is the only thing still missing.
      go("student");
    })().catch(() => { /* the step they landed on still works */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* The OTP step's "Continue" action, hoisted out so auto-submit (below) and
     the button can share it without duplicating the guardian upsert. */
  const verifyOtpCode = useCallback(async (raw: string) => {
    if (!raw.trim()) return setError("Enter the code we sent.");
    if (otpBusy) return;
    hapticFirm();
    setOtpBusy(true);
    try {
      await verifyOtp(contact.trim(), raw.trim());
      // Guardian row first: it holds no student data, so it is safe before
      // consent.
      const sess = await currentSession() as SessionUser;
      const { data, error: e } = await sb.from("guardian").upsert(
        { auth_user_id: sess.user!.id, name: parentName, contact },
        { onConflict: "auth_user_id" },
      ).select().single();
      if (e) throw e;
      setGuardian(data);
      await continueAsGuardian(data);
    } catch (e) { fail(e, "That code did not work."); }
    finally { setOtpBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, parentName, otpBusy, continueAsGuardian]);

  /* Auto-submit the instant a 6-digit numeric code is complete — typed,
     pasted, or autofilled from the iOS QuickType bar — rather than making the
     student make a separate tap once autofill has already done the work. A
     pasted magic link is much longer than 6 characters and is handled by the
     "Continue" button instead, via verifyOtp's own link-parsing. */
  useEffect(() => {
    if (step !== "otp" || otpBusy) return;
    if (/^\d{6}$/.test(code.trim())) void verifyOtpCode(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  /* Purposes are fetched when that step opens, not at mount. The optional ones
     must never arrive pre-ticked, so their default comes from `is_required` and
     from nothing else. */
  useEffect(() => {
    if (step !== "consent" || purposes) return;
    listPurposes()
      .then((ps) => {
        setPurposes(ps);
        setConsent((prev) => {
          const next = { ...prev };
          for (const p of ps) if (!(p.purpose in next)) next[p.purpose] = p.is_required;
          return next;
        });
      })
      .catch((e) => fail(e, "We could not load what you're agreeing to."));
  }, [step, purposes]);

  /* Changing year can change stage, and the two stages have different subject
     catalogues. Picks that do not exist in the new one are dropped rather than
     carried into a syllabus that has no code for them. */
  const catalogue = useMemo(() => subjectsForClass(studentClass), [studentClass]);
  useEffect(() => {
    setSubjects((prev) => prev.filter((x) => catalogue.some((c) => c.subject === x)));
  }, [catalogue]);

  const back = BACK_TO[step];
  const shellProps = {
    phase: STEP_PHASE[step],
    onBack: back ? () => go(back) : undefined,
  };

  // ── landing ──────────────────────────────────────────────────────────────
  if (step === "landing") {
    return (
      <Shell {...shellProps}>
        <div className="obhero">
          <div className="obwordmark">
            <span className="g"><Icon d={ICONS.trend} /></span>
            <span className="n">Axon</span>
          </div>
          <h1>See exactly where the <em>marks went</em>.</h1>
          <div className="sub">
            Upload a graded paper. We read the questions, the answers and the
            teacher&rsquo;s marks, then explain what to do differently next time.
          </div>
        </div>
        <div className="sectitle">Every lost mark gets a reason</div>
        <div className="obspec">
          {CAUSES.map(([c, n]) => (
            <span key={n} style={{ "--c": c } as React.CSSProperties}>{n}</span>
          ))}
        </div>
        <div className="obpanel tint" style={{ marginTop: 22 }}>
          <div className="body" style={{ marginTop: 0 }}>
            A parent sets this up. Indian law requires a parent&rsquo;s verified
            consent before we can process anything belonging to a student under 18.
          </div>
        </div>
        <div className="obfoot">
          <PressBox as="button" type="button" className="btn primary"
                    onClick={() => { hapticTick(); go("account"); }}>
            I&rsquo;m a parent — set this up
          </PressBox>
          <PressBox as="button" type="button" className="btn plain"
                    onClick={() => { hapticTick(); go("studentDead"); }}>
            I&rsquo;m the student
          </PressBox>
        </div>
      </Shell>
    );
  }

  if (step === "studentDead") {
    return (
      <Shell {...shellProps} title="Nearly there">
        <div className="estate">
          <div className="ic"><Icon d={ICONS.info} /></div>
          <h4>Ask a parent to set this up</h4>
          <p>
            Because you&rsquo;re under 18, a parent or guardian has to create the
            account and give consent first. Once they&rsquo;ve done that, this
            device is yours to use.
          </p>
        </div>
      </Shell>
    );
  }

  // ── parent account ───────────────────────────────────────────────────────
  if (step === "account") {
    /* Hands off to the provider and navigates away, so there is no success case
       here — the session arrives on the way back and boot picks the flow up at
       the one detail still missing. Anything typed is deliberately not carried
       across: the provider is about to supply both, and the name it gives is
       the one the parent will recognise. */
    const useProvider = async (p: string) => {
      if (busyProvider) return;
      hapticFirm();
      setBusyProvider(p);
      try {
        await signInWithProvider(p);
      } catch (e) {
        setBusyProvider(null);
        setError(isProviderNotEnabled(e)
          ? `${PROVIDER_LABEL[p]} sign-in isn't switched on yet. Use your email or phone below.`
          : (e as Error).message || `${PROVIDER_LABEL[p]} sign-in didn't open.`);
      }
    };

    const send = async () => {
      if (!parentName.trim()) return setError("We need your name.");
      if (!contact.trim()) return setError("Enter an email address or phone number.");
      hapticFirm();
      try {
        await sendOtp(contact.trim());
        setOtpSentAt(Date.now());
        setCooldownNow(Date.now());
        go("otp");
      }
      catch (e) { fail(e, "That code could not be sent."); }
    };

    /* Discoverable-credential sign-in: no email typed, the authenticator
       resolves the account. This only ever succeeds for someone who has
       already registered a passkey on this device, which means they already
       have a guardian row — so on success this goes straight through the
       same routing a returning OTP sign-in uses. A cancelled OS prompt and
       "no passkey here" both fall straight back to the fields already on
       this screen, per the plain-language outcomes in passkeys.ts. */
    const usePasskey = async () => {
      if (busyPasskey) return;
      hapticFirm();
      setBusyPasskey(true);
      setPasskeyNote(null);
      try {
        const result = await signInWithPasskey();
        if (result.outcome === "ok") {
          const g = await currentGuardian();
          if (!g) {
            setPasskeyNote("Signed in, but we couldn't find your account — use your email or phone below.");
            return;
          }
          setGuardian(g);
          await continueAsGuardian(g);
          return;
        }
        if (result.outcome === "cancelled") return;
        setPasskeyNote(PASSKEY_MESSAGE[result.outcome] ?? "Passkey sign-in didn't work.");
      } catch (e) { fail(e, "Passkey sign-in didn't work."); }
      finally { setBusyPasskey(false); }
    };

    return (
      <Shell {...shellProps} title="Create your account">
        <Err message={error} />
        {isPasskeySupported() && (
          <>
            <div className="obalt">
              <PressBox as="button" type="button" className="btn primary" onClick={() => void usePasskey()}>
                {busyPasskey ? "Checking…" : "Sign in with a passkey"}
              </PressBox>
            </div>
            {passkeyNote && <div className="subnote">{passkeyNote}</div>}
            <div className="obor">or</div>
          </>
        )}
        {/* "Continue with" rather than "Sign in with": a parent arriving here
            does not have an account yet, and Apple's guidelines allow it. */}
        <div className="obalt">
          {OAUTH_PROVIDERS.map((p) => (
            <PressBox as="button" type="button" key={p} className="btn"
                      onClick={() => void useProvider(p)}>
              {BRAND[p]}
              <span>
                {busyProvider === p
                  ? `Opening ${PROVIDER_LABEL[p]}…`
                  : `Continue with ${PROVIDER_LABEL[p]}`}
              </span>
            </PressBox>
          ))}
        </div>
        <div className="obor">or</div>
        <div className="obfields">
          <Field id="ob-name" label="Your name" value={parentName} onChange={setParentName}
                 placeholder="Full name" autoComplete="name"
                 hint="So the student knows whose account this is." />
          <Field id="ob-contact" label="Email or phone" value={contact} onChange={setContact}
                 placeholder="you@example.com or +91…" autoComplete="email"
                 onEnter={() => void send()}
                 hint="We'll send a one-time code — there's no password to remember." />
        </div>
        <div className="obpanel tint" style={{ marginTop: 16 }}>
          <div className="body" style={{ marginTop: 0 }}>
            Nothing about the student is collected yet, and nothing is processed
            until you&rsquo;ve consented.
          </div>
        </div>
        <div className="obfoot">
          <PressBox as="button" type="button" className="btn primary" onClick={() => void send()}>
            Send me a code
          </PressBox>
        </div>
      </Shell>
    );
  }

  if (step === "otp") {
    return (
      <Shell {...shellProps} title="Check your email">
        <Err message={error} />
        <div className="obfields">
          {/* inputMode="numeric" is what makes autoComplete="one-time-code"
              actually trigger the iOS QuickType autofill suggestion; no
              maxLength, because a pasted magic link is longer than 6 chars
              and still has to fit here — see the subnote below. */}
          <Field id="ob-code" label="Your code" className="obcode" value={code} onChange={setCode}
                 placeholder="6 digits, or paste the link" autoComplete="one-time-code"
                 inputMode="numeric" onEnter={() => void verifyOtpCode(code)} />
        </div>
        <div className="subnote">
          Sent to {contact}. If the email contains a link rather than a code, paste
          the whole link here — that works too, and it still works after your mail
          app has already opened it.
        </div>
        <div className="obfoot">
          <PressBox as="button" type="button" className="btn primary" disabled={otpBusy}
                    onClick={() => void verifyOtpCode(code)}>
            {otpBusy ? "Checking…" : "Continue"}
          </PressBox>
          {/* Plain text, not a prominent button — resending is available, not
              the default thing to reach for — and disabled during a short
              cooldown so a mistap can't fire a flurry of emails. */}
          <PressBox
            as="button" type="button" className="btn plain"
            disabled={otpCooldownRemaining > 0}
            onClick={async () => {
              hapticTick();
              try {
                await sendOtp(contact.trim());
                setOtpSentAt(Date.now());
                setCooldownNow(Date.now());
                setError("Sent again.");
              } catch (e) { fail(e, "That could not be sent."); }
            }}
          >
            {otpCooldownRemaining > 0 ? `Resend in ${otpCooldownRemaining}s` : "Send it again"}
          </PressBox>
        </div>
      </Shell>
    );
  }

  /* Someone who clicked the emailed link arrives already signed in, but with no
     guardian row and none of the details this flow collected. Rather than send
     them back to the start, ask only for what is missing. */
  if (step === "nameOnly") {
    const save = async () => {
      if (!parentName.trim()) return setError("We need your name.");
      hapticFirm();
      try {
        const sess = await currentSession() as SessionUser;
        const { data, error: e } = await sb.from("guardian").upsert(
          { auth_user_id: sess.user!.id, name: parentName.trim(), contact },
          { onConflict: "auth_user_id" },
        ).select().single();
        if (e) throw e;
        setGuardian(data);
        await continueAsGuardian(data);
      } catch (e) { fail(e, "That could not be saved."); }
    };

    return (
      <Shell
        {...shellProps}
        title="One detail"
        sub={provider && PROVIDER_LABEL[provider]
          ? `Signed in with ${PROVIDER_LABEL[provider]} as ${contact}.`
          : `Signed in as ${contact}.`}
      >
        <Err message={error} />
        <div className="obfields">
          <Field id="ob-name-only" label="Your name" value={parentName} onChange={setParentName}
                 placeholder="Full name" autoComplete="name" onEnter={() => void save()}
                 hint="So the student knows whose account this is." />
        </div>
        <div className="obfoot">
          <PressBox as="button" type="button" className="btn primary" onClick={() => void save()}>
            Continue
          </PressBox>
        </div>
      </Shell>
    );
  }

  /* Calm, dismissible, once. Reached only through `proceedOrOfferPasskey`
     immediately after a confirmed sign-in — never as the first thing a new
     parent sees, per the ordering constraint in passkeys.ts: registering a
     passkey requires an existing, confirmed, non-anonymous user. No rail: it
     is not a numbered step in the flow, it is an interstitial on top of one. */
  if (step === "passkeyOffer") {
    const resume = () => {
      markPasskeyOfferSeen();
      const next = afterPasskeyOffer.current;
      afterPasskeyOffer.current = null;
      setError(null);
      next?.();
    };
    const setUp = async () => {
      hapticFirm();
      setBusyPasskey(true);
      try {
        const result = await registerPasskey();
        if (result.outcome === "ok") { resume(); return; }
        if (result.outcome === "cancelled") return; // both options stay visible
        setError(PASSKEY_MESSAGE[result.outcome] ?? "That didn't work.");
      } catch (e) { fail(e, "That didn't work."); }
      finally { setBusyPasskey(false); }
    };
    return (
      <Shell {...shellProps} title="Skip typing a code next time">
        <Err message={error} />
        <div className="obpanel tint">
          <div className="body" style={{ marginTop: 0 }}>
            Set up a passkey using Face ID, Touch ID, or your device&rsquo;s
            screen lock. Next time you sign in on this device, that&rsquo;s all it takes.
          </div>
        </div>
        <div className="obfoot">
          <PressBox as="button" type="button" className="btn primary" disabled={busyPasskey}
                    onClick={() => void setUp()}>
            {busyPasskey ? "Setting up…" : "Set up a passkey"}
          </PressBox>
          <PressBox as="button" type="button" className="btn plain" onClick={() => { hapticTick(); resume(); }}>
            Not now
          </PressBox>
        </div>
      </Shell>
    );
  }

  // ── age gate and verification ────────────────────────────────────────────
  if (step === "age") {
    const pick = (age: string) => {
      hapticTick();
      setStudentAge(age);
      go(age === "18_plus" ? "adult" : "verify");
    };
    return (
      <Shell {...shellProps} title="How old is the student?">
        <div className="list">
          <Method icon={ICONS.cap} t1="Under 18"
                  t2="You'll verify and consent on their behalf"
                  onClick={() => pick("under_18")} />
          <Method icon={ICONS.person} t1="18 or older"
                  t2="They can hold their own account"
                  onClick={() => pick("18_plus")} />
        </div>
        <div className="subnote">
          This decides which consent path applies. We don&rsquo;t ask for a date of birth.
        </div>
      </Shell>
    );
  }

  if (step === "adult") {
    return (
      <Shell {...shellProps} title="Good news">
        <div className="estate">
          <div className="ic"><Icon d={ICONS.tick} /></div>
          <h4>They can sign up themselves</h4>
          <p>
            Over 18, no parental consent is needed, so the student holds their own
            account. That path isn&rsquo;t built yet — it&rsquo;s the next thing we&rsquo;re adding.
          </p>
        </div>
      </Shell>
    );
  }

  if (step === "verify") {
    const adapter = getVerificationAdapter();
    const run = async () => {
      hapticFirm();
      setBusy(true);
      try {
        const result = await adapter.verify();
        const { data, error: e } = await sb.from("guardian").update({
          verified_at: result.verifiedAt,
          verification_method: result.method,
          verification_ref: result.reference,
          updated_at: new Date().toISOString(),
        }).eq("id", guardian!.id).select().single();
        if (e) throw e;
        setGuardian(data);
        setBusy(false);
        go("consent");
      } catch (e) { setBusy(false); fail(e, "Verification did not complete."); }
    };

    return (
      <Shell {...shellProps} title="Verify it's you">
        <Err message={error} />
        <div className="obpanel tint">
          <div className="chips"><span className="chip n">Required by law</span></div>
          <div className="line">{adapter.label}</div>
          <div className="body">{adapter.description}</div>
        </div>
        <div className="sectitle">What we keep</div>
        <div className="list">
          <SRow tone="ic-g" icon={ICONS.shield} label="A confirmation reference"
                small="Proof the check happened" trailing={<span className="tier t2">Kept</span>} />
          <SRow tone="ic-g" icon={ICONS.clock} label="When it happened"
                small="Timestamp and method" trailing={<span className="tier t2">Kept</span>} />
          <SRow tone="ic-n" icon={ICONS.never} label="Your documents"
                small="Aadhaar, licence, anything scanned"
                trailing={<span className="tier t1">Never stored</span>} />
        </div>
        <div className="obfoot">
          <PressBox as="button" type="button" className="btn primary" disabled={busy}
                    onClick={() => void run()}>
            {busy ? "Verifying…" : adapter.label}
          </PressBox>
        </div>
      </Shell>
    );
  }

  // ── itemised consent ─────────────────────────────────────────────────────
  if (step === "consent") {
    const give = async () => {
      hapticFirm();
      try {
        // Guardian-scope: the student profile does not exist yet, which is
        // exactly why consent_event.student_id is nullable.
        await recordConsent({ guardianId: guardian!.id, studentId: null, decisions: consent });
        go("plan");
      } catch (e) { fail(e, "Consent could not be recorded."); }
    };

    const row = (p: Purpose) => {
      // A purpose added to the table without an entry here still renders, with a
      // neutral icon and its label alone. Better a plain row than a missing one.
      const [tone, icon, note] = PURPOSES[p.purpose] ?? ["ic-n", ICONS.shield, ""];
      return (
        <SRow
          key={p.purpose}
          tone={tone}
          icon={icon}
          label={p.label}
          small={note}
          trailing={p.is_required
            ? <span className="locked">Required</span>
            : (
              <Switch
                label={p.label}
                on={consent[p.purpose] === true}
                onChange={(next) => setConsent((c) => ({ ...c, [p.purpose]: next }))}
              />
            )}
        />
      );
    };

    return (
      <Shell {...shellProps} title="What you're agreeing to">
        <Err message={error} />
        {purposes && (
          <>
            <div className="sectitle tight">What we need to do</div>
            <div className="list">{purposes.filter((p) => p.is_required).map(row)}</div>
            <div className="sectitle">Optional — off unless you turn it on</div>
            <div className="list">{purposes.filter((p) => !p.is_required).map(row)}</div>
          </>
        )}
        <div className="sectitle">What we never do</div>
        <div className="list">
          {["Advertising of any kind", "Behavioural tracking", "Selling data to anyone",
            "Ranking against other students"].map((label) => (
            <SRow key={label} tone="ic-n" icon={ICONS.never} label={label}
                  trailing={<span className="tier t1">Never</span>} />
          ))}
        </div>
        <div className="subnote">
          You can withdraw any optional consent later in Settings — one tap, no
          email required.
        </div>
        <div className="obfoot">
          <PressBox as="button" type="button" className="btn primary" disabled={!purposes}
                    onClick={() => void give()}>
            Give consent
          </PressBox>
        </div>
      </Shell>
    );
  }

  // ── plan, after consent ──────────────────────────────────────────────────
  /* The one screen in the flow that leaves the app. "Subscribe" hands off to
     Stripe-hosted Checkout — there is no card form here and there never will
     be, so no page in this codebase ever touches a card number.

     No price is printed on this screen. The amount lives in Stripe, and a
     number typed into our copy is a number that goes stale the day pricing
     changes and quietly lies until someone notices. Stripe's own page states
     it, tax included, in the payer's currency.

     Free is not a trial and is not worded as one. Every paper a student scans
     gets its full analysis on the free tier, permanently; Pro adds the lens
     ACROSS papers. Calling this "a free trial" would promise a cliff that
     does not exist. */
  if (step === "plan") {
    const skip = () => { hapticTick(); go("student"); };
    const buy = async (plan: "monthly" | "annual") => {
      if (busyCheckout) return;
      hapticFirm();
      setBusyCheckout(true);
      setError(null);
      try {
        // Navigates away to Stripe, so this does not resolve on success.
        await startCheckout(plan, "/");
      } catch (e) {
        fail(e, "Checkout could not be opened.");
        setBusyCheckout(false);
      }
    };

    return (
      <Shell {...shellProps} title="Choose a plan">
        <Err message={error} />
        {billingReturn === "cancelled" && (
          <div className="obpanel tint">
            <div className="body" style={{ marginTop: 0 }}>
              Nothing was charged. Free is a complete product, and Pro is here
              whenever it earns its place.
            </div>
          </div>
        )}
        <div className="list">
          <Method icon={ICONS.clock} t1="Continue on Free"
                  t2="Every paper you scan, fully explained. No card." onClick={skip} />
          <Method icon={ICONS.card} t1="Subscribe to Pro — monthly"
                  t2={busyCheckout ? "Opening Stripe…" : "Adds the pattern across papers and subjects"}
                  onClick={() => void buy("monthly")} />
          <Method icon={ICONS.card} t1="Subscribe to Pro — yearly"
                  t2={busyCheckout ? "Opening Stripe…" : "The same, billed once a year"}
                  onClick={() => void buy("annual")} />
        </div>
        <div className="subnote">
          Payment is handled by Stripe, and card details never reach us. Payment
          details are never visible to the student profile. We asked for consent
          before this step on purpose — paying shouldn&rsquo;t feel like
          pressure to agree.
        </div>
      </Shell>
    );
  }

  // ── student profile ──────────────────────────────────────────────────────
  if (step === "student") {
    const stage = stageForClass(studentClass);

    const create = async () => {
      if (!studentFirst.trim()) return setError("What should we call the student?");
      if (!subjects.length) return setError("Pick at least one subject.");
      hapticFirm();
      try {
        const { data, error: e } = await sb.from("student").insert({
          guardian_id: guardian!.id,
          first_name: studentFirst.trim(),
          board: BOARD,
          class_level: studentClass,
          age_band: studentAge ?? "under_18",
        }).select().single();
        if (e) throw e;
        /* Each subject carries its Cambridge syllabus code. "Physics" is 0625 at
           IGCSE and 9702 at A Level — different syllabuses, different papers,
           different mark schemes — so the name alone cannot match a past paper. */
        await sb.from("student_subject").insert(subjects.map((subject) => ({
          student_id: data.id,
          subject,
          syllabus_code: syllabusCode(subject, studentClass),
        })));
        setStudent({ ...data, subjects });
        go("firstRun");
      } catch (e) {
        // The consent gate raises 42501 here if consent is somehow missing.
        setError((e as { code?: string }).code === "42501"
          ? "We can't create the profile until consent is recorded. Go back a step."
          : (e as Error).message || "The profile could not be created.");
      }
    };

    return (
      <Shell {...shellProps} title="The student">
        <Err message={error} />
        {/* Stripe has taken the payment; our own entitlement row is written by
            the webhook a moment later. So this says what is actually known —
            the payment went through — and not "Pro is active", which is a
            different claim and not ours to make yet. */}
        {billingReturn === "success" && (
          <div className="obpanel tint">
            <div className="body" style={{ marginTop: 0 }}>
              Payment received. Pro switches on as soon as Stripe confirms it,
              usually within a few seconds. The profile is the last step.
            </div>
          </div>
        )}
        <div className="obfields">
          <Field id="ob-sname" label="First name" value={studentFirst} onChange={setStudentFirst}
                 placeholder="The student's first name" />
        </div>

        <div className="sectitle">Stage</div>
        <div className="list">
          <div className="srow">
            <div className="ic ic-b"><Icon d={ICONS.cap} /></div>
            <div className="lbl">Class<small>{classLabel(studentClass)}</small></div>
            <div className="seg" role="group" aria-label="Class">
              {CLASS_LEVELS.map((c) => (
                <button key={c} type="button" className={c === studentClass ? "on" : undefined}
                        aria-pressed={c === studentClass}
                        onClick={() => { hapticTick(); setStudentClass(c); }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          {/* The board is not a question any more. v1 is Cambridge only, and
              curriculum.js is the single source for that. */}
          <SRow tone="ic-b" icon={ICONS.paper} label="Board" small={stage.label}
                trailing={<span className="locked">Cambridge</span>} />
        </div>

        <div className="sectitle">Subjects</div>
        <div className="filterbar" style={{ position: "static" }}>
          {catalogue.map(({ subject, code: sc }) => {
            const chosen = subjects.includes(subject);
            return (
              <button
                key={subject}
                type="button"
                className={"fchip" + (chosen ? " active" : "")}
                aria-pressed={chosen}
                onClick={() => {
                  hapticTick();
                  setSubjects((prev) => chosen
                    ? prev.filter((x) => x !== subject)
                    : [...prev, subject]);
                }}
              >
                {subject} <span className="obcode-badge">{sc}</span>
              </button>
            );
          })}
        </div>
        <div className="subnote">
          The four-digit code is the syllabus, and it is what lets a past paper be
          matched to the right mark scheme. Nothing else is collected — no school,
          no address, no photograph.
        </div>
        <div className="obfoot">
          <PressBox as="button" type="button" className="btn primary" onClick={() => void create()}>
            Create profile
          </PressBox>
        </div>
      </Shell>
    );
  }

  // ── student first run ────────────────────────────────────────────────────
  /* The seam where delight is allowed: the setup is finished, and this is the
     student's first screen rather than the parent's last one. */
  if (step === "firstRun") {
    return (
      <Shell {...shellProps}>
        <div className="obhero" style={{ paddingBottom: 2 }}>
          <div className="obseal"><Icon d={ICONS.tick} /></div>
          <h1>{student?.first_name ? <>Hello, <em>{student.first_name}</em>.</> : "Hello."}</h1>
          <div className="sub">This part is yours, not your parent&rsquo;s. Here&rsquo;s how it works.</div>
        </div>
        <div className="list" style={{ marginTop: 22 }}>
          <SRow tone="ic-b" icon={ICONS.paper} label="You upload a marked paper"
                small="We read the questions, your answers, and your teacher's marks" />
          <SRow tone="ic-g" icon={ICONS.shield} label="We never overrule your teacher"
                small="The marks shown are the marks they gave. We explain where they went." />
          <SRow tone="ic-b" icon={ICONS.explain} label="You can see the reasoning"
                small="Every insight shows what it was based on" />
          <SRow tone="ic-b" icon={ICONS.pencil} label="If we read something wrong, fix it"
                small="Your correction wins. No review, no arguing." />
        </div>
        <div className="obfoot">
          <PressBox as="button" type="button" className="btn primary"
                    onClick={() => { hapticTick(); go("firstUpload"); }}>
            Upload my first paper
          </PressBox>
          <PressBox as="button" type="button" className="btn plain"
                    onClick={() => {
                      hapticTick();
                      void finishOnboarding({ guardian: guardian!, student: student! });
                    }}>
            Look around first
          </PressBox>
        </div>
      </Shell>
    );
  }

  // ── guided first upload ──────────────────────────────────────────────────
  /* Grouped by tier rather than listed flat. Flat, the consequence of the choice
     has to be repeated under all five rows, and five near-identical subtitles is
     how a screen stops being read. Grouped, each tier states it once, which is
     also the actual shape of the distinction. */
  const isScheme = (t: { value: string }) => t.value === "pyq" || t.value === "sample_paper";
  const choose = (value: string) => {
    hapticFirm();
    void finishOnboarding({ guardian: guardian!, student: student!, firstPaperType: value });
  };

  return (
    <Shell {...shellProps} title="Your first paper">
      <div className="obpanel">
        <div className="line">What kind of paper is this?</div>
        <div className="body">
          This one matters, so it&rsquo;s worth getting right. We&rsquo;ll only ask the first time.
        </div>
      </div>
      <div className="sectitle">School test</div>
      <div className="list">
        {PAPER_TYPES.filter((t) => !isScheme(t)).map((t) => (
          <Method key={t.value} icon={ICONS.paper} t1={t.label} onClick={() => choose(t.value)} />
        ))}
      </div>
      <div className="subnote">Explained from your teacher&rsquo;s marks and remarks.</div>
      <div className="sectitle">Board paper</div>
      <div className="list">
        {PAPER_TYPES.filter(isScheme).map((t) => (
          <Method key={t.value} icon={ICONS.stamp} t1={t.label} onClick={() => choose(t.value)} />
        ))}
      </div>
      <div className="subnote">Matched to the official marking scheme where we have it.</div>
    </Shell>
  );
}
