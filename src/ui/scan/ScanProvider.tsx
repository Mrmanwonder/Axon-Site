/* ═══════════════════════════════════════════════════════════════════════════
   THE SCAN HOST

   `src/scan/ui.js` owns the flow and capture transactions. This provider owns
   the React surfaces it paints into.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type { ReactNode } from "react";
import { useApp } from "../data/AppProvider";
import { useToast } from "../components/ToastProvider";
import { useSheetControls } from "../components/SheetProvider";
import type { SheetConfig } from "../components/SheetProvider";
import type { CropBox } from "../components/Crop";
import { hapticTick, hapticFirm } from "../lib/haptics";

export type TrayPage = {
  page_number: number;
  thumb?: string;
  quality?: {
    verdict: "ok" | "warn" | "fail";
    reasons: string[];
    /** Explicit user decision to keep a page that the capture gate failed. */
    accepted?: boolean;
  };
  /** True while this slot is being conditioned. A retake uses the existing
      page number, so pending replacement never creates a phantom extra page. */
  pending?: boolean;
  /** Sticky until a replacement is durably stored. */
  retakeRequested?: boolean;
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
  crop?: { paperId: string; page: number; box: CropBox } | null;
  pageNumber?: number;
  unreadableReason?: string | null;
  alternatives?: number[];
  allocationUnusable?: boolean;
  explanation?: { cause?: string; body?: string; doThisNext?: string } | null;
};

export type ReviewModel = {
  title: string;
  lead?: string;
  delta?: { message: string; ours: number; theirs: number } | null;
  outstanding: number;
  cleanCount: number;
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
  setScanContext: (ctx: unknown) => void;
  attachSurface: (video: HTMLVideoElement | null, overlay: HTMLCanvasElement | null) => void;
  detachSurface: () => void;
  initScanUI: (ctx: unknown, host: unknown) => Promise<void>;
  setPendingPaperType: (t: string | null) => void;
  acceptUploads: (files: File[]) => Promise<void>;
  setScanVisible: (visible: boolean, camera?: unknown) => Promise<void> | void;
  shoot: () => void;
  setAutoCapture: (on: boolean) => void;
  resumeDraftReview: (draftId: string) => Promise<ResumeReviewResult>;
};

type ScanValue = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;
  camera: { on: boolean; phase: string };
  scanPhase: string;
  pendingCaptureCount: number;
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
  const appRef = useRef(app);
  appRef.current = app;
  const toast = useToast();
  const { openSheet } = useSheetControls();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const [camera, setCamera] = useState({ on: false, phase: "idle" });
  const [scanState, setScanState] = useState({ phase: "idle", pendingCaptureCount: 0 });
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
  const activation = useRef(0);
  const visibleRef = useRef(false);
  const cameraModule = useRef<typeof import("../../scan/camera.js") | null>(null);

  const gotoScan = useCallback(() => {
    history.pushState({}, "", "/scan");
    dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  const ensureScan = useCallback(async (): Promise<ScanModule> => {
    try {
      scanPromise.current ??= import("../../scan/ui.js") as unknown as Promise<ScanModule>;
      const scan = await scanPromise.current;
      modRef.current = scan;
      scanReady.current ??= Promise.resolve(scan.initScanUI(
        { student: appRef.current.student, guardian: appRef.current.guardian },
        {
          toast: (m: string, tone?: "neutral" | "warn") => toast(m, tone),
          tick: hapticTick,
          firm: hapticFirm,
          scanSurface: () => ({ video: videoRef.current, overlay: overlayRef.current }),
          renderHint: (state: { hint: string; blocking?: string | null }) => setHint(state),
          cameraLive: (on: boolean, phase?: string) =>
            setCamera({ on, phase: on ? "live" : (phase ?? "idle") }),
          scannerState: (state: { phase: string; pendingCaptureCount: number }) => setScanState(state),
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
          refreshLibrary: () => appRef.current.refreshLibrary(),
        },
      )).then(() => scan.setPendingPaperType(appRef.current.takePendingPaperType()));
      await scanReady.current;
      scan.setScanContext({ student: appRef.current.student, guardian: appRef.current.guardian });
      return scan;
    } catch (error) {
      scanPromise.current = null;
      scanReady.current = null;
      throw error;
    }
  }, [toast, openSheet, gotoScan]);

  const onScreenVisible = useCallback((visible: boolean) => {
    const request = ++activation.current;
    visibleRef.current = visible;
    if (!visible) {
      cameraModule.current?.releaseCamera();
      modRef.current?.setScanVisible(false);
      modRef.current?.detachSurface();
      return;
    }
    setCamera({ on: false, phase: "starting" });
    setHint({ hint: "Starting the camera…" });
    void (async () => {
      try {
        const cameraRequest = import("../../scan/camera.js").then(async (camera) => {
          cameraModule.current = camera;
          if (request !== activation.current || !visibleRef.current || !camera.cameraSupported()) return null;
          const stream = await camera.requestCamera();
          if (request !== activation.current || !visibleRef.current) {
            stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            return null;
          }
          return stream;
        }).catch((error: Error) => error);

        const [scan, stream] = await Promise.all([ensureScan(), cameraRequest]);
        if (request !== activation.current || !visibleRef.current) return;
        scan.attachSurface(videoRef.current, overlayRef.current);
        await scan.setScanVisible(true, stream);
      } catch {
        if (request !== activation.current) return;
        cameraModule.current?.releaseCamera();
        setCamera({ on: false, phase: "failed" });
        setHint({ hint: "The scanner could not start. Try again.", blocking: "scanner" });
      }
    })();
  }, [ensureScan]);

  useEffect(() => () => {
    ++activation.current;
    visibleRef.current = false;
    cameraModule.current?.releaseCamera();
    modRef.current?.setScanVisible(false);
    modRef.current?.detachSurface();
  }, []);

  const shoot = useCallback(() => { modRef.current?.shoot(); }, []);
  const setAutoCapture = useCallback((on: boolean) => {
    setAuto(on);
    modRef.current?.setAutoCapture(on);
  }, []);
  const closeReview = useCallback(() => setReviewOpen(false), []);

  const value = useMemo<ScanValue>(() => ({
    videoRef, overlayRef,
    camera, scanPhase: scanState.phase, pendingCaptureCount: scanState.pendingCaptureCount,
    hint, tray, trayHandlers, progress, drafts, draftsHandlers,
    resumable, review, reviewHandlers, reviewOpen, closeReview,
    ensureScan, onScreenVisible, shoot, setAutoCapture, auto,
  }), [
    camera, scanState, hint, tray, trayHandlers, progress, drafts, draftsHandlers,
    resumable, review, reviewHandlers, reviewOpen, closeReview,
    ensureScan, onScreenVisible, shoot, setAutoCapture, auto,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
