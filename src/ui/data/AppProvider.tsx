/* ═══════════════════════════════════════════════════════════════════════════
   APP CONTEXT

   What `src/app.js` called `ctx`, as React state. The modules it reads from —
   supabase, prefs, consent, papers — are imported unchanged; this replaces the
   imperative glue that wired them to the DOM, not the modules themselves.

   Three properties carried over deliberately, each of which was a bug once:

   · **Consent is never cached optimistically.** `refreshConsent` always goes to
     the server, and `setConsent` re-reads the ledger after writing rather than
     trusting the value it just sent. On failure the switch goes back to what
     the ledger says, because the ledger is the truth and the UI is not.

   · **Prefs are safe to cache and consent is not.** A stale text size is a
     cosmetic annoyance; a stale yes is a compliance failure. They are separate
     paths here for that reason, not merely for tidiness.

   · **The student's rows are handed over, not re-fetched, after onboarding.**
     Re-reading re-runs the gate, and on a read replica that has not caught up
     the student is not there yet — which drops someone who has just finished
     onboarding back to the start of it.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type { ReactNode } from "react";
import {
  sb, currentSession, signOut, onAuthChange, takeProviderError,
  loadPrefs, savePrefs, readLocal,
  readConsentState, recordConsent, withdrawConsent,
  listPapers, paperProgress, watchLibrary,
} from "./modules";
import type { Prefs, Guardian, Student, ProviderError, ConsentState, Paper, ProgressRow } from "./modules";
import { getCached } from "../../cache.js";


/** What the boot sequence concluded about who this is.

    `boot_error` exists because the catch below used to say `onboarding`. A
    returning guardian whose account read failed — an outage, a schema drift, a
    dropped connection — was shown the new-account flow, which reads as "your
    data is gone" and invites them to set up an account they already have.

    That is hard rule 4 at the level of the whole app: an infrastructure failure
    became a different fact rather than an admitted gap. A failed read is never
    an answer about who someone is. */
export type Gate = "loading" | "onboarding" | "ready" | "boot_error";

type AppValue = {
  gate: Gate;
  /** What went wrong at boot, for the recovery screen to show. Null unless
      `gate` is "boot_error". */
  bootError: string | null;
  /** Re-runs the boot sequence. The recovery screen's only action. */
  retryBoot: () => void;
  providerError: ProviderError | null;
  session: unknown;
  guardian: Guardian | null;
  student: Student | null;

  prefs: Prefs;
  setPref: (patch: Partial<Prefs>) => Promise<void>;

  /** purpose -> granted. Absent key means unknown, never "no". */
  consent: ConsentState;
  refreshConsent: () => Promise<void>;
  setConsent: (purpose: string, granted: boolean) => Promise<void>;

  papers: Paper[];
  /** False only until we have either a cached/network answer or a named read
      failure. It prevents the first frame of a returning account from saying
      "No papers yet" while its library is still being read. */
  papersLoaded: boolean;
  papersStale: boolean;
  /** Set when the library read itself failed — not when it came back empty.
      An empty library and an unreadable one look identical on screen unless
      something carries the difference, and for weeks they were: the read was
      returning 300 PGRST201 on every call and the interface said "no papers
      yet" over a library that had papers in it. Hard rule 4 — an admitted gap
      is recoverable, an invisible one is not. */
  papersError: string | null;
  /** paper_id -> its current (most recent) run's live status. A paper with
      no entry here has no run in flight — either it has committed attempts
      already, or nothing has ever been submitted for it. Not stale-tolerant
      the way `papers` is: a paper mid-pipeline is exactly the case where an
      old read actively misleads, so a failed fetch here just leaves the
      previous map in place rather than substituting a guess. */
  progress: Map<string, ProgressRow>;
  refreshLibrary: () => Promise<void>;

  /** Persist the student's chosen avatar preset. Optimistic: the disc and the
      nav swatch repaint on the tap and revert together if the write fails —
      this is decoration, and a face that lags a tap by a round trip reads as
      an app that did not hear you. */
  setAvatar: (presetKey: string) => Promise<void>;

  /** Save the identity fields as one database transaction. Class and subject
      syllabus codes must never be allowed to drift apart. */
  updateStudentProfile: (profile: {
    firstName: string;
    classLevel: number;
    subjects: { subject: string; syllabus_code: string }[];
  }) => Promise<void>;

  online: boolean;
  finishOnboarding: (r: { guardian?: Guardian; student?: Student; firstPaperType?: string | null }) => Promise<void>;
  /** Set by onboarding step 8; consumed by the next ingest, then cleared. */
  takePendingPaperType: () => string | null;
  signOutNow: () => Promise<void>;
};

const Ctx = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp called outside AppProvider");
  return v;
}

/** Applied to the root element so CSS owns the actual scaling — the same
    contract `applyPrefs` had, and the reason the pre-paint script in index.html
    can set these before React exists. */
function applyPrefs(prefs: Prefs) {
  const root = document.documentElement;
  const resolved = prefs.theme === "system"
    ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : prefs.theme;
  root.dataset.theme = resolved;
  root.dataset.text = prefs.text_size;
  root.dataset.motion = prefs.reduce_motion ? "reduce" : "full";
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#000000" : "#F4F4F7");
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [gate, setGate] = useState<Gate>("loading");
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);
  const retryBoot = useCallback(() => {
    setBootError(null);
    setGate("loading");
    setBootAttempt((n) => n + 1);
  }, []);
  const [providerError, setProviderError] = useState<ProviderError | null>(null);
  const [session, setSession] = useState<unknown>(null);
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(() => readLocal());
  const [consent, setConsentState] = useState<ConsentState>({});
  const [papers, setPapers] = useState<Paper[]>([]);
  const [papersLoaded, setPapersLoaded] = useState(false);
  const [papersStale, setPapersStale] = useState(false);
  const [papersError, setPapersError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Map<string, ProgressRow>>(new Map());
  const [online, setOnline] = useState(() => navigator.onLine);

  const pendingPaperType = useRef<string | null>(null);
  const takePendingPaperType = useCallback(() => {
    const t = pendingPaperType.current;
    pendingPaperType.current = null;
    return t;
  }, []);

  // The cached prefs are already on the root from index.html's inline script;
  // this keeps React's copy and the DOM in step from here on.
  useEffect(() => { applyPrefs(prefs); }, [prefs]);

  // A theme of "system" has to follow the OS while the app is open, not only at
  // boot — otherwise a phone that flips to dark at sunset leaves this in light.
  useEffect(() => {
    if (prefs.theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyPrefs(prefs);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [prefs]);

  useEffect(() => {
    const paint = () => setOnline(navigator.onLine);
    addEventListener("online", paint);
    addEventListener("offline", paint);
    return () => {
      removeEventListener("online", paint);
      removeEventListener("offline", paint);
    };
  }, []);

  const setPref = useCallback(async (patch: Partial<Prefs>) => {
    // Local first so the UI is instant; savePrefs treats offline as non-fatal
    // because the local mirror already holds the change.
    const next = await savePrefs(guardian?.id, patch);
    setPrefs(next);
  }, [guardian]);

  const refreshConsent = useCallback(async () => {
    if (!guardian) return;
    // Always the server. An unreachable ledger leaves the previous map in place
    // rather than substituting a guess; a missing key reads as unknown.
    setConsentState(await readConsentState(guardian.id, student?.id ?? null));
  }, [guardian, student]);

  const setConsent = useCallback(async (purpose: string, granted: boolean) => {
    if (!guardian) return;
    const args = { guardianId: guardian.id, studentId: student?.id ?? null };
    if (granted) await recordConsent({ ...args, decisions: { [purpose]: granted } });
    else await withdrawConsent({ ...args, purpose });
    // Re-read rather than trusting what we just wrote. If this throws, the
    // caller reverts the switch — the ledger decides, not the interface.
    setConsentState(await readConsentState(guardian.id, student?.id ?? null));
  }, [guardian, student]);

  const refreshLibrary = useCallback(async () => {
    if (!student) return;

    // Paint the last known library immediately while the authoritative network
    // request is already in flight. The cache never substitutes for a live
    // in-progress status: paperProgress remains network-only below.
    const cachedPromise = getCached(`papers:${student.id}`).then((cached: unknown) => {
      if (cached === null) return;
      setPapers((cached as Paper[]) ?? []);
      setPapersStale(!navigator.onLine);
      setPapersError(null);
      setPapersLoaded(true);
    });

    // Papers and progress are independent reads. Starting them together removes
    // a full network RTT from every initial load and every realtime refresh.
    const papersPromise = listPapers(student.id);
    const progressPromise = paperProgress(student.id);
    await cachedPromise;

    const [paperResult, progressResult] = await Promise.allSettled([
      papersPromise,
      progressPromise,
    ]);

    if (paperResult.status === "fulfilled") {
      const { data, stale } = paperResult.value;
      setPapers(data ?? []);
      setPapersStale(!!stale);
      setPapersError(null);
      setPapersLoaded(true);
    } else {
      // A failed read is not "no papers". If a cached copy painted above it
      // remains on screen; if there was no cache, the error state can now say
      // exactly what happened instead of rendering a false empty library.
      console.error("library read failed", paperResult.reason);
      setPapersError(
        (paperResult.reason as Error)?.message || "We could not read your library.",
      );
      setPapersLoaded(true);
    }

    if (progressResult.status === "fulfilled") {
      setProgress(progressResult.value);
    }
  }, [student]);

  const setAvatar = useCallback(async (presetKey: string) => {
    if (!student) return;
    const previous = student.avatar_seed ?? null;
    setStudent({ ...student, avatar_seed: presetKey });
    const { error } = await sb
      .from("student").update({ avatar_seed: presetKey }).eq("id", student.id);
    if (error) {
      setStudent((s) => (s ? { ...s, avatar_seed: previous } : s));
      throw error;
    }
  }, [student]);

  const updateStudentProfile = useCallback(async (profile: {
    firstName: string;
    classLevel: number;
    subjects: { subject: string; syllabus_code: string }[];
  }) => {
    if (!student) throw new Error("There is no student profile to update.");
    const { data, error } = await sb.rpc("update_student_profile", {
      p_student_id: student.id,
      p_first_name: profile.firstName,
      p_class_level: profile.classLevel,
      p_subjects: profile.subjects,
    });
    if (error) throw error;
    const saved = Array.isArray(data) ? data[0] : data;
    if (!saved) throw new Error("The profile was saved but could not be read back.");
    setStudent({
      ...student,
      ...saved,
      subjects: profile.subjects.map(({ subject }) => subject),
    });
  }, [student]);

  const finishOnboarding = useCallback(async (r: {
    guardian?: Guardian; student?: Student; firstPaperType?: string | null;
  }) => {
    pendingPaperType.current = r.firstPaperType ?? null;
    if (r.guardian) setGuardian(r.guardian);
    if (r.student) setStudent(r.student);
    setGate("ready");
  }, []);

  const signOutNow = useCallback(async () => {
    await signOut();
    location.reload();
  }, []);

  // ── boot ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Read before the session and unconditionally: it clears the error out of
      // the URL either way, so a refused provider attempt cannot linger in the
      // address bar and reappear on the next reload.
      const err = takeProviderError();
      if (err && !cancelled) setProviderError(err);

      const s = await currentSession();
      if (cancelled) return;
      setSession(s);
      if (!s) return setGate("onboarding");

      // One RLS-preserving RPC replaces the previous guardian -> student ->
      // subjects waterfall. PostgreSQL still executes the same ownership rules;
      // the browser now pays one regional round trip instead of three.
      const { data: bootstrap, error: bootstrapError } = await sb.rpc(
        "bootstrap_current_user",
      );
      if (cancelled) return;
      if (bootstrapError) throw bootstrapError;

      const g = (bootstrap?.guardian ?? null) as Guardian | null;
      setGuardian(g);
      if (!g) return setGate("onboarding");

      const st = (bootstrap?.student ?? null) as Student | null;
      if (!st) return setGate("onboarding");

      setStudent(st);
      setGate("ready");
    })().catch((e) => {
      // NOT onboarding. Boot failing says nothing about whether this person has
      // an account; it says we could not find out. Showing the new-account flow
      // asserts the opposite of what we know, and to a returning guardian it
      // reads as their data having been lost.
      if (cancelled) return;
      console.error("boot failed", e);
      setBootError((e as Error)?.message || "We could not reach your account.");
      setGate("boot_error");
    });

    return () => { cancelled = true; };
  }, [bootAttempt]);

  // Server-side prefs and consent land once we know who this is.
  useEffect(() => {
    if (!guardian) return;
    loadPrefs(guardian.id).then((p: Prefs) => setPrefs(p)).catch(() => { /* local stands */ });
  }, [guardian]);

  useEffect(() => { void refreshConsent(); }, [refreshConsent]);
  useEffect(() => { void refreshLibrary(); }, [refreshLibrary]);

  // ── the library, kept live ──────────────────────────────────────────────
  //
  // This used to be the read above and nothing else: once, on mount, forever.
  // Two things fell out of that, and both read as the app being broken rather
  // than as the app being a moment behind. A paper scanned in this session did
  // not reach the Library until a reload, and a paper uploaded on the phone
  // never reached the laptop at all.
  //
  // The second one is worth being precise about, because it looks like a
  // missing feature and is not. There is no sync layer to build: both devices
  // are signed into the same account and already reading the same Postgres
  // rows. The laptop just had no way to learn that a row had arrived. Listening
  // is the whole of it.
  //
  // Coalesced, because committing a paper inserts every one of its attempts in
  // one transaction — unbatched, that is one full library refetch per question,
  // on a device the 60fps floor is written for.
  useEffect(() => {
    if (!student) return;

    let timer: number | undefined;
    const coalesced = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void refreshLibrary(); }, 350);
    };

    const stop = watchLibrary(student.id, coalesced);

    // Realtime is the fast path, not the only one. A socket that dropped while
    // the phone was in a pocket comes back with no backlog, so returning to the
    // app and regaining a connection each re-read once — cheap, and the
    // difference between "a moment behind" and "wrong until you reload".
    const onWake = () => { if (document.visibilityState === "visible") coalesced(); };
    document.addEventListener("visibilitychange", onWake);
    addEventListener("online", coalesced);

    return () => {
      clearTimeout(timer);
      stop();
      document.removeEventListener("visibilitychange", onWake);
      removeEventListener("online", coalesced);
    };
  }, [student, refreshLibrary]);

  // A sign-out in another tab must not leave this one showing a signed-in app.
  useEffect(() => {
    let had = false;
    const { data: { subscription } } = onAuthChange((s: unknown) => {
      if (s) had = true;
      else if (had) location.reload();
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AppValue>(() => ({
    gate, bootError, retryBoot, providerError, session, guardian, student,
    prefs, setPref,
    consent, refreshConsent, setConsent,
    papers, papersLoaded, papersStale, papersError, progress, refreshLibrary,
    setAvatar, updateStudentProfile,
    online, finishOnboarding, takePendingPaperType, signOutNow,
  }), [
    gate, bootError, retryBoot, providerError, session, guardian, student, prefs, setPref,
    consent, refreshConsent, setConsent, papers, papersLoaded, papersStale, papersError,
    progress, refreshLibrary, setAvatar, updateStudentProfile, online, finishOnboarding,
    takePendingPaperType, signOutNow,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
