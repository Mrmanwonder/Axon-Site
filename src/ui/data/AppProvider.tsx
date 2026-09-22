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
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import {
  sb, currentSession, currentGuardian, signOut, onAuthChange, takeProviderError,
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
import { useResource, isStale } from "./useResource";
import { loadProfiles, selectedProfile } from "./profiles";
import type { Loadable } from "./useResource";

export type Gate = "loading" | "onboarding" | "ready" | "boot_error" | "choose_profile";

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
  profiles: Student[];
  profileStale: boolean;
  selectStudent: (id: string) => Promise<void>;

  prefs: Prefs;
  setPref: (patch: Partial<Prefs>) => Promise<void>;

  /** purpose -> granted. Absent key means unknown, never "no". */
  consent: ConsentState;
  refreshConsent: () => Promise<void>;
  setConsent: (purpose: string, granted: boolean) => Promise<void>;

  papersResource: Loadable<Paper[]>;
  progressResource: Loadable<Map<string, ProgressRow>>;
  consentResource: Loadable<ConsentState>;
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
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
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
  const [profiles, setProfiles] = useState<Student[]>([]);
  const [profileStale, setProfileStale] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(() => readLocal());
  const [dataRevision, setDataRevision] = useState(0);
  const { resource: papersResource, reload: reloadPapers } = useResource<Paper[]>(student ? `${student.id}:${dataRevision}` : null, () => listPapers(student!.id), () => getCached(`papers:${student!.id}`));
  const { resource: progressResource, reload: reloadProgress } = useResource<Map<string, ProgressRow>>(student ? `${student.id}:${dataRevision}` : null, async () => ({ data: await paperProgress(student!.id) }));
  const { resource: consentResource, reload: refreshConsent } = useResource<ConsentState>(guardian ? `${guardian.id}:${student?.id ?? ""}` : null, async () => ({ data: await readConsentState(guardian!.id, student?.id ?? null) }));
  const papersLoaded = papersResource.state !== "loading" || papersResource.data !== null;
  const papers = papersResource.data ?? [];
  const progress = progressResource.data ?? new Map<string, ProgressRow>();
  const consent = consentResource.data ?? {};
  const papersStale = isStale(papersResource);
  const papersError = papersResource.state === "failed" ? papersResource.error.message : null;

  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const invalidate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail.action === "purge") {
        setDataRevision(value => value + 1);
        if (detail.studentId === null) { setStudent(null); setProfiles([]); setGuardian(null); setGate("loading"); }
      }
      if (detail.action === "complete" && detail.studentId === student?.id) void refreshLibrary();
    };
    addEventListener("axon:local-data", invalidate);
    return () => removeEventListener("axon:local-data", invalidate);
  });

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

  const prefRevision = useRef(0);
  const pendingPrefs = useRef(new Map<number, Partial<Prefs>>());
  const confirmedPrefs = useRef(prefs);
  const prefQueue = useRef<Promise<unknown>>(Promise.resolve());
  const setPref = useCallback(async (patch: Partial<Prefs>) => {
    const request = ++prefRevision.current;
    pendingPrefs.current.set(request, patch);
    const repaint = () => setPrefs(Object.assign({}, confirmedPrefs.current, ...pendingPrefs.current.values()));
    repaint();
    const operation = prefQueue.current.then(() => savePrefs(guardian?.id, patch));
    prefQueue.current = operation.catch(() => {});
    try { confirmedPrefs.current = await operation; }
    finally { pendingPrefs.current.delete(request); repaint(); }
  }, [guardian?.id]);

  const setConsent = useCallback(async (purpose: string, granted: boolean) => {
    if (!guardian) return;
    const args = { guardianId: guardian.id, studentId: student?.id ?? null };
    if (granted) await recordConsent({ ...args, decisions: { [purpose]: granted } });
    else await withdrawConsent({ ...args, purpose });
    // Re-read rather than trusting what we just wrote. If this throws, the
    // caller reverts the switch — the ledger decides, not the interface.
    await refreshConsent(true);
  }, [guardian, student, refreshConsent]);

  const refreshLibrary = useCallback(async () => {
    await Promise.all([reloadPapers(), reloadProgress()]);
  }, [reloadPapers, reloadProgress]);


  const avatarQueue = useRef<Promise<unknown>>(Promise.resolve());
  const avatarRevision = useRef(0);
  const setAvatar = useCallback(async (presetKey: string) => {
    if (!student) return;
    const request = ++avatarRevision.current;
    const id = student.id;
    setStudent(current => current?.id === id ? { ...current, avatar_seed: presetKey } : current);
    const operation = avatarQueue.current.then(async () => {
      const { error } = await sb.from("student").update({ avatar_seed: presetKey }).eq("id", id);
      if (error) throw error;
    });
    avatarQueue.current = operation.catch(() => {});
    try { await operation; }
    catch (error) {
      if (request === avatarRevision.current) {
        const result = await sb.from("student").select("avatar_seed").eq("id", id).single();
        if (!result.error) setStudent(current => current?.id === id ? { ...current, avatar_seed: result.data.avatar_seed } : current);
      }
      throw error;
    }
  }, [student]);

  const selectStudent = useCallback(async (id: string) => {
    const profile = profiles.find(item => item.id === id);
    if (!profile || !guardian) throw new Error("That profile is unavailable.");
    try { localStorage.setItem(`axon.active_student_id:${guardian.id}`, id); } catch { /* This session still switches. */ }
    setStudent(profile); setGate("ready");
  }, [profiles, guardian]);
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
    const updated = { ...student, ...saved, subjects: profile.subjects.map(({ subject }) => subject) };
    setStudent(current => current?.id === updated.id ? updated : current);
    setProfiles(current => current.map(item => item.id === updated.id ? updated : item));
  }, [student]);


  const finishOnboarding = useCallback(async (r: {
    guardian?: Guardian; student?: Student; firstPaperType?: string | null;
  }) => {
    pendingPaperType.current = r.firstPaperType ?? null;
    if (r.guardian) setGuardian(r.guardian);
    if (r.student) { setStudent(r.student); setProfiles(previous => [...previous.filter(profile => profile.id !== r.student!.id), r.student!]); }
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
      if (err && !cancelled) { setProviderError(err); if (err.cleanedPath) navigateRef.current(err.cleanedPath, { replace: true }); }

      const s = await currentSession();
      if (cancelled) return;
      setSession(s);
      if (!s) return setGate("onboarding");

      // Profile selection needs every owned student, not the bootstrap RPC's
      // oldest single student. Retain offline-safe guardian/profile reads.
      const g = await currentGuardian();
      if (cancelled) return;
      setGuardian(g);
      if (!g) return setGate("onboarding");

      const profilesResult = await loadProfiles(g.id);
      if (cancelled) return;
      setProfiles(profilesResult.data);
      setProfileStale(profilesResult.stale);
      if (!profilesResult.data.length) return setGate("onboarding");
      const st = selectedProfile(g.id, profilesResult.data);
      if (!st) return setGate("choose_profile");

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
    const revision = prefRevision.current;
    let active = true;
    loadPrefs(guardian.id).then((p: Prefs) => { if (active && revision === prefRevision.current) { confirmedPrefs.current = p; setPrefs(p); } }).catch(() => { /* local stands */ });
    return () => { active = false; };
  }, [guardian]);



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
    gate, bootError, retryBoot, providerError, session, guardian, student, profiles, profileStale, selectStudent,
    prefs, setPref,
    papersResource, progressResource, consentResource,
    consent, refreshConsent, setConsent,
    papers, papersLoaded, papersStale, papersError, progress, refreshLibrary,
    setAvatar, updateStudentProfile,
    online, finishOnboarding, takePendingPaperType, signOutNow,
  }), [
    gate, bootError, retryBoot, providerError, session, guardian, student, profiles, profileStale, selectStudent, prefs, setPref,
    papersResource, progressResource, consentResource,
    consent, refreshConsent, setConsent, papers, papersStale, papersError, progress, refreshLibrary,
    setAvatar, updateStudentProfile, online, finishOnboarding, takePendingPaperType, signOutNow,

  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
