/* ═══════════════════════════════════════════════════════════════════════════
   INGESTION

   `wireIngestion`, `ensureScan` and `armScan` from src/app.js, as a provider.

   Four things carried over that a naive port loses, all of them from AGENTS.md
   or from comments in app.js that record a bug already paid for:

   · **The scanner is imported dynamically, and that is load-bearing.** The
     pipeline is sixteen modules and none of them are needed to read a paper
     scanned last week. As a static import they cost about 0.7s of extra boot on
     a throttled mid-tier profile — measured, not guessed — against a hard 60fps
     floor. `ensureScan()` is the only way in.

   · **Both entry points go through `ensureScan`.** The module holds its own
     state, and calling into it before `initScanUI` has handed it the student
     drops the upload silently — the invisible failure hard rule 4 exists to
     prevent. `ScanProvider` owns that load-once dance now, and this defers to
     it rather than keeping a second copy: two loaders would each think they
     were first, and the second `initScanUI` would reset the flow's state
     underneath a capture already in progress.

   · **The camera request races the pipeline load rather than following it.**
     Asking at the end of the chain put about ten seconds between tapping Scan
     and seeing the permission sheet, which reads as an app that does not work.

   · **The pending paper type is consumed once and cleared.** Onboarding sets it
     for the first paper; if the second inherited it silently, a Cambridge past
     paper would be filed as a school test and lose its marking scheme.

   Speculative loading follows scan intent, with Save-Data/2g opt-outs.
   Merely reading past papers must not download the capture pipeline.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useApp } from "./AppProvider";
import { useScan } from "../scan/ScanProvider";
import { useToast } from "../components/ToastProvider";
import { useSheetControls } from "../components/SheetProvider";
import {
  sb, parsePaperLink,
} from "./modules";

/** What a paper is until a printed paper code or the student says otherwise (D7). */
const DEFAULT_PAPER_TYPE = "unit_test";
import { hapticTick, hapticFirm } from "../lib/haptics";
import { IMPORT_ACCEPT } from "../../scan/import-decode.js";

type IngestionValue = {
  /** Open the OS picker. The same path for the Scan tab and for anywhere else. */
  addPaper: () => void;
  addLink: () => void;
  ingestFiles: (files: File[]) => Promise<void>;
};

const Ctx = createContext<IngestionValue | null>(null);

/**
 * The summary toast replaces any toast the scanner raised for an individual
 * page (the toast surface holds one message), so it has to carry the reason
 * itself. "1 file(s) could not be used" with no reason was the whole of issue
 * #301's photo-import report: the refusal (usually the resolution floor) was
 * said and then immediately overwritten.
 */
export function importSummary(result: { accepted: unknown[]; rejected: { name?: string; reason?: string }[] }) {
  const added = result.accepted.length;
  const rejected = result.rejected;
  if (!rejected.length) return `${added} page(s) added. Check the order, then read the paper.`;
  for (const r of rejected) console.warn("[scan] import refused", r.name, r.reason);
  const reasons = [...new Set(rejected.map((r) => r.reason).filter(Boolean))];
  const head = added
    ? `${added} page(s) added. ${rejected.length} file(s) could not be used`
    : rejected.length === 1 ? "That file could not be used" : `${rejected.length} files could not be used`;
  return reasons.length ? `${head}: ${reasons[0]}` : `${head}.`;
}

export function useIngestion(): IngestionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useIngestion called outside IngestionProvider");
  return v;
}

export function IngestionProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const { openSheet } = useSheetControls();
  const { ensureScan } = useScan();
  const linkFlight = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const importScope = useRef({ student: app.student?.id, guardian: app.guardian?.id });
  if (importScope.current.student !== app.student?.id || importScope.current.guardian !== app.guardian?.id) {
    importScope.current = { student: app.student?.id, guardian: app.guardian?.id };
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; importScope.current = { ...importScope.current }; };
  }, []);

  const ingestFiles = useCallback(async (files: File[]) => {
    // A delayed paste/drop callback may itself belong to a previous render.
    if (!mounted.current || app.student?.id !== importScope.current.student || app.guardian?.id !== importScope.current.guardian) return;
    if (!app.student) return toast("Create a student profile first.", "warn");
    if (!files.length) return;
    // Uploads join the pipeline rather than bypassing it. An unconditioned page
    // would skip deskew, illumination flattening and red-layer separation, and
    // reach the structure pass in materially worse shape than a captured one.
    const scope = importScope.current;
    try {
      const scan = await ensureScan();
      if (importScope.current !== scope) return;
      const t = app.takePendingPaperType();
      if (t) scan.setPendingPaperType(t);
      const result = await scan.acceptUploads(files);
      if (importScope.current !== scope) return;
      if (result.accepted.length) navigate("/scan");
      if (result.rejected.length) toast(importSummary(result), "warn");
      else toast(importSummary(result));
    } catch {
      if (importScope.current === scope) toast("These files could not be added. Try selecting them again.", "warn");
    }
  }, [app, ensureScan, toast, navigate]);

  const ingestLink = useCallback(async (url: string) => {
    if (!app.student) return toast("Create a student profile first.", "warn");
    const requestId = crypto.randomUUID();
    const run = async (type: string) => {
      if (linkFlight.current) return;
      linkFlight.current = true;
      try {
        const { error } = await sb.rpc("create_link_paper", {
          p_request_id: requestId, p_student_id: app.student!.id,
          p_type: type, p_date: new Date().toISOString().slice(0, 10), p_url: url,
        });
        if (error) throw error;
        hapticFirm();
        toast("Link saved. We'll fetch it and tell you when it's readable.");
        await app.refreshLibrary();
      } catch (e) {
        toast((e as Error).message || "That link could not be added.", "warn");
      } finally { linkFlight.current = false; }
    };
    // No "What kind of paper is this?" (council D7): a link starts as a school
    // test, and triage makes it a past paper only on a printed paper code read
    // with high confidence. The type can be changed on the paper.
    void run(app.takePendingPaperType() ?? DEFAULT_PAPER_TYPE);
  }, [app, toast]);

  const addPaper = useCallback(() => {
    hapticTick();
    inputRef.current?.click();
  }, []);

  const addLink = useCallback(() => {
    hapticTick();
    openSheet({
      title: "Add a link",
      body: "Paste a link to a school-shared PDF or drive file. We fetch it on our side — a browser can't hand us the file directly.",
      input: { label: "Paper link", id: "linkUrl", placeholder: "https://…", inputMode: "url" },
      primary: "Add this link",
      onConfirm: async (raw) => {
        if (!raw.trim()) return toast("Paste a link first.", "warn");
        // Validated before the paper row is created, so a bad link never
        // orphans one.
        let url: string;
        try { url = parsePaperLink(raw); }
        catch (e) { return toast((e as Error).message, "warn"); }
        await ingestLink(url);
      },
    });
  }, [openSheet, ingestLink, toast]);

  /* Warm code on scan intent only; never open a camera or initialise a draft.
     Recheck metered/offline state at the event, not just at app mount. */
  useEffect(() => {
    let requested = false;
    const warm = (event: Event) => {
      if (requested || !app.student || document.visibilityState !== "visible") return;
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('a[href="/scan"], [data-scan-intent]')) return;
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      if (!navigator.onLine || connection?.saveData || /^(slow-)?2g$/.test(connection?.effectiveType ?? "")) return;
      requested = true;
      void import("../../scan/ui.js").catch(() => { requested = false; });
    };
    document.addEventListener("pointerover", warm);
    document.addEventListener("focusin", warm);
    return () => {
      document.removeEventListener("pointerover", warm);
      document.removeEventListener("focusin", warm);
    };
  }, [app.student?.id]);

  const value = useMemo<IngestionValue>(
    () => ({ addPaper, addLink, ingestFiles }),
    [addPaper, addLink, ingestFiles],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Deliberately without `capture`: that forces the camera open and stops
          someone picking an already-taken photo or a PDF. On mobile the OS
          picker offers the camera anyway, which is the v1 intent. */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={IMPORT_ACCEPT}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          void ingestFiles(files);
        }}
      />
    </Ctx.Provider>
  );
}
