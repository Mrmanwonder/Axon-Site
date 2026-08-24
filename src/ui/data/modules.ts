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
  tier: number | null;
  date_taken: string;
  [k: string]: unknown;
};

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
export const listPapers = papersMod.listPapers as (
  studentId: string,
) => Promise<{ data: Paper[]; stale: boolean }>;
export const createPaper = papersMod.createPaper as (a: {
  studentId: string; type: string; dateTaken: string;
}) => Promise<Paper>;
export const addLinkPage = papersMod.addLinkPage as (a: {
  studentId: string; paperId: string; url: string; pageNumber: number;
}) => Promise<unknown>;
export const parsePaperLink = papersMod.parsePaperLink as (raw: string) => string;
export const PAPER_TYPES = papersMod.PAPER_TYPES as { value: string; label: string }[];

// ── account ────────────────────────────────────────────────────────────────
export const exportMyData = accountMod.exportMyData as (g: Guardian) => Promise<unknown>;
export const downloadJson = accountMod.downloadJson as (name: string, data: unknown) => void;
export const deleteAccount = accountMod.deleteAccount as (
  g: Guardian,
) => Promise<{ students_erased: number }>;
