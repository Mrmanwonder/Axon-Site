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

   The idle prewarm is preserved too, including its opt-out: sixteen files is a
   real cost to someone on a metered or 2g connection who may never scan.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef,
} from "react";
import type { ReactNode } from "react";
import { useApp } from "./AppProvider";
import { useScan } from "../scan/ScanProvider";
import { useToast } from "../components/ToastProvider";
import { useSheetControls } from "../components/SheetProvider";
import {
  createPaper, addLinkPage, parsePaperLink, PAPER_TYPES,
} from "./modules";
import { hapticTick, hapticFirm } from "../lib/haptics";

type IngestionValue = {
  /** Open the OS picker. The same path for the Scan tab and for anywhere else. */
  addPaper: () => void;
  addLink: () => void;
  ingestFiles: (files: File[]) => Promise<void>;
};

const Ctx = createContext<IngestionValue | null>(null);

export function useIngestion(): IngestionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useIngestion called outside IngestionProvider");
  return v;
}

export function IngestionProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const toast = useToast();
  const { openSheet } = useSheetControls();
  const { ensureScan } = useScan();
  const inputRef = useRef<HTMLInputElement>(null);

  const ingestFiles = useCallback(async (files: File[]) => {
    if (!app.student) return toast("Create a student profile first.", "warn");
    if (!files.length) return;
    // Uploads join the pipeline rather than bypassing it. An unconditioned page
    // would skip deskew, illumination flattening and red-layer separation, and
    // reach the structure pass in materially worse shape than a captured one.
    const scan = await ensureScan();
    const t = app.takePendingPaperType();
    if (t) scan.setPendingPaperType(t);
    await scan.acceptUploads(files);
    toast(`${files.length} page(s) added. Check the order, then read the paper.`);
  }, [app, ensureScan, toast]);

  const askPaperType = useCallback((then: (v: string) => void) => {
    openSheet({
      title: "What kind of paper is this?",
      body: "This decides whether we can match it to an official marking scheme.",
      choices: PAPER_TYPES.map((t) => ({ label: t.label, value: t.value })),
      onChoice: (value) => then(value),
    });
  }, [openSheet]);

  const ingestLink = useCallback(async (url: string) => {
    if (!app.student) return toast("Create a student profile first.", "warn");
    const run = async (type: string) => {
      try {
        const paper = await createPaper({
          studentId: app.student!.id,
          type,
          dateTaken: new Date().toISOString().slice(0, 10),
        });
        await addLinkPage({
          studentId: app.student!.id, paperId: paper.id, url, pageNumber: 1,
        });
        hapticFirm();
        toast("Link saved. We'll fetch it and tell you when it's readable.");
        await app.refreshLibrary();
      } catch (e) {
        toast((e as Error).message || "That link could not be added.", "warn");
      }
    };
    const t = app.takePendingPaperType();
    if (t) void run(t); else askPaperType(run);
  }, [app, askPaperType, toast]);

  const addPaper = useCallback(() => {
    hapticTick();
    inputRef.current?.click();
  }, []);

  const addLink = useCallback(() => {
    hapticTick();
    openSheet({
      title: "Add a link",
      body: "Paste a link to a school-shared PDF or drive file. We fetch it on our side — a browser can't hand us the file directly.",
      input: { id: "linkUrl", placeholder: "https://…" },
      primary: "Add this link",
      onConfirm: async (raw) => {
        if (!raw.trim()) return toast("Paste a link first.", "warn");
        // Validated before the type is asked: the type question creates the
        // paper row, so a bad link would otherwise orphan one.
        let url: string;
        try { url = parsePaperLink(raw); }
        catch (e) { return toast((e as Error).message, "warn"); }
        await ingestLink(url);
      },
    });
  }, [openSheet, ingestLink, toast]);

  /* Warm the pipeline while the phone is idle so tapping Scan is instant — but
     not on a connection where sixteen files is a real cost to someone who may
     never scan. Save-Data is a request, and a slow link is an answer.

     This warms the module only; it does not call initScanUI, because doing that
     before the Scan screen has mounted would hand the flow a viewfinder that
     does not exist yet. */
  useEffect(() => {
    type Conn = { saveData?: boolean; effectiveType?: string };
    const link = (navigator as Navigator & { connection?: Conn }).connection;
    if (link?.saveData || /^(slow-)?2g$/.test(link?.effectiveType ?? "")) return;
    const idle = window.requestIdleCallback ?? ((fn: () => void) => setTimeout(fn, 2000));
    idle(() => { void import("../../scan/ui.js").catch(() => { /* it will retry on demand */ }); });
  }, []);

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
        accept="image/*,application/pdf"
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
