/* ═══════════════════════════════════════════════════════════════════════════
   THE UNTYPED BOUNDARY

   One place where the React layer crosses into the plain ES modules, so the
   casts live here instead of as a scatter of @ts-expect-error comments through
   the components.

   Those modules are imported and not ported on purpose — the scan stage modules
   are pure and have to keep running in the Web Worker and in Node under
   `harness/`, and rewriting them as TypeScript components would break two of the
   three environments they are required to work in.

   `checkJs` is off, so TypeScript infers rather than checks them. The inference
   is close but not exact: a parameter defaulted to `null` in JavaScript infers
   as the type `null` rather than "nullable", so a real id is rejected. These
   signatures state what the functions actually accept. If one of them drifts
   from its module, this file is where it should be corrected — not by loosening
   the call site.
   ═══════════════════════════════════════════════════════════════════════════ */

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as supabaseMod from "../../supabase.js";
import * as prefsMod from "../../prefs.js";
import * as consentMod from "../../consent.js";
import * as papersMod from "../../papers.js";
import * as accountMod from "../../account.js";
import * as verificationMod from "../../verification.js";
import * as entitlementsMod from "../../entitlements.js";
import * as billingMod from "../../billing.js";
import * as curriculumMod from "../../curriculum.js";

export type Prefs = {
  theme: "system" | "light" | "dark";
  text_size: "s" | "m" | "l";
  reduce_motion: boolean;
  always_show_reasoning: boolean;
  notify_paper_ready: boolean;
  notify_correction: boolean;
};

export type Guardian = { id: string; name: string; contact: string };
export type Student = {
  id: string;
  first_name: string;
  board: string;
  class_level: number;
  subjects?: string[];
};

export type Paper = {
  id: string;
  type: string;
  /** 'tier_1' (teacher's marks) or 'tier_2' (matched to an official scheme). */
  tier: string | null;
  date_taken: string;
  [k: string]: unknown;
};

/** What every cached read returns.

    `src/cache.js` wraps these in read-through caching, so the value is always
    under `.data` and never the bare result. `stale` means the network read
    failed and this came from the cache — which is a legitimate thing to show a
    student, clearly labelled, because past papers must stay readable offline.
    It is NOT the same as empty, and a caller that ignores the wrapper reads
    `undefined` and renders a confident zero. */
export type Cached<T> = { data: T; stale: boolean; offline: boolean };

/** A refused Google or Apple round trip, already cleared out of the URL. */
export type ProviderError = {
  provider: string | null;
  code: string;
  description: string;
  message: string;
};

/** Purpose -> granted. A MISSING key means unknown, and must never be read as
    "no" — an unreachable ledger is not a withdrawal. */
export type ConsentState = Record<string, boolean>;

/** What onboarding hands back when it finishes. The rows are passed straight
    through rather than re-fetched: re-reading re-runs the boot gate, and on a
    read replica that has not caught up the student is not there yet. */
export type OnboardingResult = {
  guardian?: Guardian;
  student?: Student;
  firstPaperType?: string | null;
};

// ── supabase ───────────────────────────────────────────────────────────────
export const sb = supabaseMod.sb as any;
export const currentSession = supabaseMod.currentSession as () => Promise<unknown>;
export const currentGuardian = supabaseMod.currentGuardian as () => Promise<Guardian | null>;
export const signOut = supabaseMod.signOut as () => Promise<void>;
export const takeProviderError = supabaseMod.takeProviderError as () => ProviderError | null;
/** Returns Supabase's `{ data: { subscription } }`, not an unsubscribe function —
    the shape an effect cleanup needs is `.data.subscription.unsubscribe()`. */
export const onAuthChange = supabaseMod.onAuthChange as (
  fn: (session: unknown) => void,
) => { data: { subscription: { unsubscribe: () => void } } };

// ── auth ───────────────────────────────────────────────────────────────────
export const sendOtp = supabaseMod.sendOtp as (
  contact: string,
) => Promise<{ channel: string; sentTo: string }>;
/** Accepts a typed code OR a whole pasted magic link — the emailed link still
    works after the mail app has already opened it, which is the common case. */
export const verifyOtp = supabaseMod.verifyOtp as (contact: string, input: string) => Promise<unknown>;
export const signInWithProvider = supabaseMod.signInWithProvider as (p: string) => Promise<void>;
export const isProviderNotEnabled = supabaseMod.isProviderNotEnabled as (e: unknown) => boolean;
export const OAUTH_PROVIDERS = supabaseMod.OAUTH_PROVIDERS as ("google" | "apple")[];
export const PROVIDER_LABEL = supabaseMod.PROVIDER_LABEL as Record<string, string>;

// ── guardian verification ──────────────────────────────────────────────────
/** Swappable adapter; the stub is wired for development and DigiLocker is the
    intended production one. Only a reference and a timestamp are ever stored. */
export const getVerificationAdapter = verificationMod.getVerificationAdapter as () => {
  label: string;
  description: string;
  verify: () => Promise<{ verifiedAt: string; method: string; reference: string }>;
};

// ── curriculum ─────────────────────────────────────────────────────────────
/* AGENTS.md: this is the single source for the board, the stages, the
   class-level mapping and the syllabus codes. Nothing else may hardcode
   "CAIE", a stage name or a four-digit code. */
export const BOARD = curriculumMod.BOARD as string;
export const BOARD_LABEL = curriculumMod.BOARD_LABEL as string;
export const CLASS_LEVELS = curriculumMod.CLASS_LEVELS as number[];
export const STAGES = curriculumMod.STAGES as {
  stage: string; label: string; classLevels: number[];
}[];
export const stageForClass = curriculumMod.stageForClass as (c: number) => {
  stage: string; label: string; classLevels: number[];
};
export const classLabel = curriculumMod.classLabel as (c: number) => string;
export const classLabelShort = curriculumMod.classLabelShort as (c: number) => string;
export const subjectsForClass = curriculumMod.subjectsForClass as (
  c: number,
) => { subject: string; code: string }[];
export const syllabusCode = curriculumMod.syllabusCode as (
  subject: string, c: number,
) => string | null;
export const subjectLabel = curriculumMod.subjectLabel as (
  subject: string, code: string | null,
) => string;

// ── prefs ──────────────────────────────────────────────────────────────────
export const DEFAULTS = prefsMod.DEFAULTS as Prefs;
export const readLocal = prefsMod.readLocal as () => Prefs;
export const loadPrefs = prefsMod.loadPrefs as (guardianId?: string) => Promise<Prefs>;
export const savePrefs = prefsMod.savePrefs as (
  guardianId: string | undefined,
  patch: Partial<Prefs>,
) => Promise<Prefs>;

// ── consent ────────────────────────────────────────────────────────────────
export const readConsentState = consentMod.readConsentState as (
  guardianId: string,
  studentId?: string | null,
) => Promise<ConsentState>;
export const recordConsent = consentMod.recordConsent as (a: {
  guardianId: string;
  studentId?: string | null;
  decisions: Record<string, boolean>;
  method?: "in_app_itemised" | "in_app_withdrawal";
}) => Promise<unknown>;
export const withdrawConsent = consentMod.withdrawConsent as (a: {
  guardianId: string;
  studentId?: string | null;
  purpose: string;
}) => Promise<unknown>;
export const listPurposes = consentMod.listPurposes as () => Promise<
  { purpose: string; label: string; is_required: boolean; sort_order: number }[]
>;

// ── papers ─────────────────────────────────────────────────────────────────
export const listPapers = papersMod.listPapers as unknown as (
  studentId: string,
) => Promise<Cached<Paper[]>>;
export const createPaper = papersMod.createPaper as (a: {
  studentId: string; type: string; dateTaken: string;
}) => Promise<Paper>;
export const addLinkPage = papersMod.addLinkPage as (a: {
  studentId: string; paperId: string; url: string; pageNumber: number;
}) => Promise<unknown>;
export const parsePaperLink = papersMod.parsePaperLink as (raw: string) => string;
export const PAPER_TYPES = papersMod.PAPER_TYPES as { value: string; label: string }[];
export const paperTypeLabel = papersMod.paperTypeLabel as (type: string) => string;

/** The five in-flight states AXON_FIX_BRIEF.md §6.5 asks the Library to
    show, keyed by what `paperProgress` reports. A committed paper needs
    none of these — it renders as a normal, finished row. */
export type PaperStatusKey =
  | "scanning" | "reading" | "needs_review" | "ready" | "failed" | "rejected";
export const PAPER_STATUS = papersMod.PAPER_STATUS as Record<
  PaperStatusKey, { label: string; tone: "wait" | "attention" | "stopped" }
>;
/** The raw extraction_status enum value -> a PaperStatusKey, or null for
    'committed' (nothing in-flight to show). */
export const statusKeyForRun = papersMod.statusKeyForRun as (
  rawStatus: string,
) => PaperStatusKey | null;

export type ProgressRow = {
  paper_id: string;
  /** The raw extraction_status enum value — narrower than PaperStatusKey; map it with STATUS_FOR_RUN-equivalent logic, or just use `.tone`/`.label` from PAPER_STATUS after mapping in papers.js. */
  status: string;
  status_reason: string | null;
  started_at: string;
  pages_total: number;
  pages_done: number;
  questions_total: number;
  questions_done: number;
  questions_needing_you: number;
};

/** One row per paper — the current (most recent) run's live status. Not
    cached: a paper mid-pipeline is exactly the case a stale read misleads. */
export const paperProgress = papersMod.paperProgress as unknown as (
  studentId: string,
) => Promise<Map<string, ProgressRow>>;

export type MarkLossEvent = {
  id: string;
  cause: string | null;
  marks_lost: number | null;
  ai_explanation: string | null;
  do_this_next: string | null;
  confidence: "confirmed" | "likely" | "unsure";
  student_confirmed_at: string | null;
  student_rejected_at: string | null;
};

export type StudentAttempt = {
  id: string;
  question_label: string | null;
  question_text: string | null;
  student_answer: string | null;
  marks_awarded: number | null;
  max_marks: number | null;
  marks_source: "teacher_pen" | "official_scheme";
  teacher_remark: string | null;
  extraction_confidence: "confirmed" | "likely" | "unsure";
  student_confirmed_at: string | null;
  mark_loss_event: MarkLossEvent[];
};

export type PaperPage = {
  page_number: number;
  source_kind: string;
  status: string;
  storage_path: string | null;
  source_url: string | null;
  r2_bucket: string | null;
  r2_key: string | null;
  mask_key: string | null;
};

export type QuestionRegionRef = {
  committed_attempt_id: string | null;
  page_spans: { page: number; box: { x: number; y: number; w: number; h: number } }[] | null;
  crop_key: string | null;
};

export type PaperDetail = {
  id: string;
  type: string;
  tier: string | null;
  date_taken: string;
  subject: string | null;
  reported_total: number | null;
  stated_maximum: number | null;
  total_awarded: number | null;
  total_available: number | null;
  reconciled: boolean | null;
  paper_page: PaperPage[];
  page_unreadable: { page_number: number; reason: string; storage_path: string | null }[];
  student_attempt: StudentAttempt[];
  question_region: QuestionRegionRef[];
};

/** One paper with its attempts and losses — the analysis, cached for offline. */
export const readPaper = papersMod.readPaper as unknown as (
  studentId: string,
  paperId: string,
) => Promise<Cached<PaperDetail>>;

/** Signed URLs for a stored page and its mask. */
export const pageAssetUrl = papersMod.pageAssetUrl as unknown as (
  paperId: string,
  pageNumber: number,
) => Promise<{ url: string | null; mask_url: string | null }>;

/* ── the analytics reads ──
   These exist in papers.js and, as of this port, nothing had ever called them.
   That is why Home and Insights were still showing the prototype's numbers on
   main; see the note in ui/pages/Home.tsx. */

/** Marks-lost totals by cause. Reads mark_loss_analytics, never the base table,
    so unsure and student-rejected rows are already excluded — hard rule 3. */
export const lossByCause = papersMod.lossByCause as unknown as (
  studentId: string,
) => Promise<Cached<Record<string, number>>>;

/** Attempts whose transcription came back unsure and are not yet confirmed.
    Reads the BASE table on purpose: hard rule 3 keeps unsure rows out of
    aggregation, and this is the surface that exists to show them. */
export const needsCheck = papersMod.needsCheck as unknown as (
  studentId: string,
) => Promise<Cached<{ count: number; papers: number }>>;

/** Pages OCR could not read — hard rule 4's surface. */
export const unreadablePages = papersMod.unreadablePages as unknown as (
  studentId: string,
) => Promise<Cached<{ id: string; paper_id: string; page_number: number; reason: string }[]>>;

/** Sample size, and whether there is enough to show an insight at all. */
export const analyticsReadiness = papersMod.analyticsReadiness as unknown as (
  studentId: string,
) => Promise<Cached<{
  papers_counted: number; questions_counted: number; has_enough_data: boolean;
}>>;

export const listSubjects = papersMod.listSubjects as unknown as (
  studentId: string,
) => Promise<Cached<{ subject: string; syllabus_code: string }[]>>;

// ── passkeys ───────────────────────────────────────────────────────────────
// Already TypeScript, so re-exported directly rather than cast — the untyped
// boundary above is only for the plain ES modules.
export {
  isPasskeySupported, registerPasskey, signInWithPasskey,
  listPasskeys, renamePasskey, deletePasskey, PASSKEY_MESSAGE,
} from "../../lib/auth/passkeys";
export type { Passkey, PasskeyOutcome } from "../../lib/auth/passkeys";

// ── entitlements and billing ───────────────────────────────────────────────
// The guardian's own account surface only. `src/billing.js` says it plainly:
// neither of these has any business in the student's scan -> understand -> act
// loop, and UX_MONETIZATION_AUDIT.md tracks that as a standing invariant.

/** The resolved free/Pro line, plus the raw state behind it. Read-only: every
    gate this describes is already enforced in RLS, server-side. */
export type Entitlements = {
  tier: "free" | "pro";
  crossSubjectPatterns: boolean;
  fullHistoricalArchive: boolean;
  parentProgressReports: boolean;
  priorityProcessing: boolean;
  /** null = unlimited. */
  maxStudentProfiles: number | null;
  /** Why `tier` is what it is — `past_due` is the one that needs explaining.
      A reason code for parent-facing copy, never a gate. */
  billingState: "free" | "pro" | "pro_annual" | "past_due" | "canceled";
};

export const getEntitlements = entitlementsMod.getEntitlements as () => Promise<Entitlements>;

/** Sends the guardian to Stripe-hosted Checkout for the chosen plan. Navigates
    away, so it never resolves on success; Stripe returns to `${returnTo}?billing=success`
    (or `…=cancelled`). The price lives in Stripe, not in our copy — so no
    screen here quotes a number it cannot source. */
export const startCheckout = billingMod.startCheckout as (
  plan: "monthly" | "annual", returnTo?: string,
) => Promise<void>;

/** Sends the guardian to the Stripe-hosted Customer Portal. Navigates away, so
    it never resolves on success. `return_to` must be an app-relative path. */
export const openBillingPortal = billingMod.openBillingPortal as (returnTo?: string) => Promise<void>;

// ── account ────────────────────────────────────────────────────────────────
export const exportMyData = accountMod.exportMyData as (g: Guardian) => Promise<unknown>;
export const downloadJson = accountMod.downloadJson as (name: string, data: unknown) => void;
export const deleteAccount = accountMod.deleteAccount as (
  g: Guardian,
) => Promise<{ students_erased: number }>;
