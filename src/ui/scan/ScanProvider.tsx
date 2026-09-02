/* ═══════════════════════════════════════════════════════════════════════════
   THE SCAN HOST

   `src/scan/ui.js` owns the flow and knows the ten stages in order. This owns
   the surfaces it paints into. The two meet at the `host` object handed to
   `initScanUI`, which replaced the `window.__axon*` globals — nothing about
   the pipeline moved.

   Everything the flow pushes lands in state here: the viewfinder hint, the tray,
   the progress model, the drafts, the review model. Components read it. That is
   the whole bridge.

   ── Load order, which is measured and not incidental ──

   The pipeline is sixteen modules, and none of them are needed to read a paper
   scanned last week. `ensureScan()` in useIngestion is the only way in, and it
   imports them dynamically; as static imports they cost about 0.7s of extra boot
   on a throttled mid-tier profile, against a hard 60fps floor.

   The camera request races that load rather than following it. Asking at the end
   of the chain put roughly ten seconds between tapping Scan and seeing the
   permission sheet, which reads as an app that does not work.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  createContext, useCallback, useContext, useMemo, useRef, useState,
} from "react";
import type { ReactNode } from "react";
import { useApp } from "../data/AppProvider";
import { useToast } from "../components/ToastProvider";
import { useSheetControls } from "../components/SheetProvider";
import type { SheetConfig } from "../components/SheetProvider";
import { hapticTick, hapticFirm } from "../lib/haptics";

export type TrayPage = {
  page_number: number;
  thumb?: string;
  quality?: { verdict: "ok" | "warn" | "fail"; reasons: string[] };
};

export type ProgressModel = {
  heading?: string;
  now: string;
  sub?: string;
  steps: { label: string; state: "done" | "now" | "wait" }[];
  skeleton?: boolean;
  note?: string;
} | null;

export type ReviewQuestion = {
  id: string;
  label?: string;
  tier: "confident" | "unsure" | "unreadable";
  confirmed?: boolean;
  causeRejected?: boolean;
  marksAwarded?: number | null;
  marksAvailable?: number | null;
  answer?: string | null;
  remark?: string | null;
  crop?: string | null;
  pageNumber?: number;
  unreadableReason?: string | null;
  alternatives?: number[];
  explanation?: { cause?: string; body?: string; doThisNext?: string } | null;
};

export type ReviewModel = {
  title: string;
  lead?: string;
  delta?: { message: string; ours: number; theirs: number } | null;
  outstanding: number;
  cleanCount: number;
  /** True from the moment Save is tapped until the paper is committed (or the
      attempt fails) — explanations are generated in this window, before the
      commit that would otherwise ship with none of them. */
  saving?: boolean;
  saveLabel: string;
  questions: ReviewQuestion[];
} | null;

export type ReviewHandlers = {
  onMark: (id: string, value: number) => void;
  onAction: (id: string, action: string) => void;
  onConfirmClean: () => void;
  onSave: () => void;
};

export type ResumeReviewResult =
  | { state: "reviewing" }
  | { state: "committed"; paperId: string }
  | { state: "processing" }
  | { state: "stopped"; reason: string | null }
  | { state: "gone" };

type ScanModule = {
  initScanUI: (ctx: unknown, host: unknown) => Promise<void>;
  setPendingPaperType: (t: string | null) => void;
  acceptUploads: (files: File[]) => Promise<void>;
  setScanVisible: (visible: boolean, camera?: unknown) => void;
  shoot: () => void;
  setAutoCapture: (on: boolean) => void;
  resumeDraftReview: (draftId: string) => Promise<ResumeReviewResult>;
};

type ScanValue = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;

  camera: { on: boolean; phase: string };
  hint: { hint: string; blocking?: string | null };
  tray: TrayPage[];
  trayHandlers: { onPage?: (n: number) => void; onDone?: () => void };
  progress: ProgressModel;
  drafts: { id: string; title: string; pages: number }[];
  draftsHandlers: { onResume?: (id: string) => void };
  resumable: { id: string; pages: number } | null;
  review: ReviewModel;
  reviewHandlers: ReviewHandlers | null;
  reviewOpen: boolean;
  closeReview: () => void;

  /** Load the pipeline and hand it the student. The only way in. */
  ensureScan: () => Promise<ScanModule>;
  onScreenVisible: (visible: boolean) => void;
  shoot: () => void;
  setAutoCapture: (on: boolean) => void;
  auto: boolean;
};

const Ctx = createContext<ScanValue | null>(null);

export function useScan(): ScanValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useScan called outside ScanProvider");
  return v;
}

export function ScanProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const toast = useToast();
  const { openSheet } = useSheetControls();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const [camera, setCamera] = useState({ on: false, phase: "idle" });
  const [hint, setHint] = useState<{ hint: string; blocking?: string | null }>({
    hint: "Starting the camera…",
  });
  const [tray, setTray] = useState<TrayPage[]>([]);
  const [trayHandlers, setTrayHandlers] = useState<ScanValue["trayHandlers"]>({});
  const [progress, setProgress] = useState<ProgressModel>(null);
  const [drafts, setDrafts] = useState<ScanValue["drafts"]>([]);
  const [draftsHandlers, setDraftsHandlers] = useState<ScanValue["draftsHandlers"]>({});
  const [resumable, setResumable] = useState<ScanValue["resumable"]>(null);
  const [review, setReview] = useState<ReviewModel>(null);
  const [reviewHandlers, setReviewHandlers] = useState<ReviewHandlers | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [auto, setAuto] = useState(true);

  const scanPromise = useRef<Promise<ScanModule> | null>(null);
  const scanReady = useRef<Promise<unknown> | null>(null);
  const modRef = useRef<ScanModule | null>(null);

  const gotoScan = useCallback(() => {
    // Retaking a page from the review screen has to put the student back in
    // front of the camera, which is where the next thing they do happens.
    history.pushState({}, "", "/scan");
    dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  const ensureScan = useCallback(async (): Promise<ScanModule> => {
    scanPromise.current ??= import("../../scan/ui.js") as unknown as Promise<ScanModule>;
    const scan = await scanPromise.current;
    modRef.current = scan;
    scanReady.current ??= Promise.resolve(scan.initScanUI(
      { student: app.student, guardian: app.guardian },
      {
        toast: (m: string, tone?: "neutral" | "warn") => toast(m, tone),
        tick: hapticTick,
        firm: hapticFirm,
        scanSurface: () => ({ video: videoRef.current, overlay: overlayRef.current }),
        renderHint: (state: { hint: string; blocking?: string | null }) => setHint(state),
        cameraLive: (on: boolean, phase?: string) =>
          setCamera({ on, phase: on ? "live" : (phase ?? "idle") }),
        renderTray: (pages: TrayPage[], handlers: ScanValue["trayHandlers"]) => {
          setTray(pages);
          setTrayHandlers(() => handlers);
        },
        renderDrafts: (list: ScanValue["drafts"], handlers: ScanValue["draftsHandlers"]) => {
          setDrafts(list);
          setDraftsHandlers(() => handlers);
        },
        draftToast: (d: { id: string; pages: number } | null, handlers: { onResume?: (id: string) => void }) => {
          setResumable(d);
          setDraftsHandlers(() => handlers);
        },
        renderProgress: (m: ProgressModel) => setProgress(m),
        openSheet: (cfg: SheetConfig) => openSheet(cfg),
        openReview: () => setReviewOpen(true),
        renderReview: (m: ReviewModel, h: ReviewHandlers) => {
          setReview(m);
          setReviewHandlers(() => h);
        },
        closeReview: () => setReviewOpen(false),
        goto: gotoScan,
        refreshLibrary: () => app.refreshLibrary(),
      },
    )).then(() => scan.setPendingPaperType(app.takePendingPaperType()));
    await scanReady.current;
    return scan;
  }, [app, toast, openSheet, gotoScan]);

  /** Entry to and exit from the Scan screen. The camera request is fired here,
      before the pipeline has finished loading, and whichever wins waits for the
      other. */
  const onScreenVisible = useCallback((visible: boolean) => {
    if (!visible) {
      modRef.current?.setScanVisible(false);
      return;
    }
    setCamera({ on: false, phase: "starting" });
    setHint({ hint: "Starting the camera…" });
    void (async () => {
      let cameraReq: unknown = null;
      try {
        const { cameraSupported, requestCamera } =
          await import("../../scan/camera.js") as {
            cameraSupported: () => boolean; requestCamera: () => Promise<MediaStream>;
          };
        if (cameraSupported()) cameraReq = requestCamera().catch((e: Error) => e);
      } catch { /* no camera module, no camera; upload still works */ }
      const scan = await ensureScan();
      scan.setScanVisible(true, cameraReq);
    })();
  }, [ensureScan]);

  const shoot = useCallback(() => { modRef.current?.shoot(); }, []);
  const setAutoCapture = useCallback((on: boolean) => {
    setAuto(on);
    modRef.current?.setAutoCapture(on);
  }, []);
  const closeReview = useCallback(() => setReviewOpen(false), []);

  const value = useMemo<ScanValue>(() => ({
    videoRef, overlayRef,
    camera, hint, tray, trayHandlers, progress, drafts, draftsHandlers,
    resumable, review, reviewHandlers, reviewOpen, closeReview,
    ensureScan, onScreenVisible, shoot, setAutoCapture, auto,
  }), [
    camera, hint, tray, trayHandlers, progress, drafts, draftsHandlers,
    resumable, review, reviewHandlers, reviewOpen, closeReview,
    ensureScan, onScreenVisible, shoot, setAutoCapture, auto,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
