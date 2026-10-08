/* ═══════════════════════════════════════════════════════════════════════════
   THE SCAN HOST

   `src/scan/ui.js` owns the flow and capture transactions. This provider owns
   the React surfaces it paints into.
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { paths } from "../app/paths";
import { useNavigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useApp } from "../data/AppProvider";
import { useToast } from "../components/ToastProvider";
import { useSheetControls } from "../components/SheetProvider";
import type { SheetConfig } from "../components/SheetProvider";
import type { CropBox } from "../components/Crop";
import type { AnswerBlock } from "../data/modules";
import { captureUploadTelemetry } from '../lib/analytics';
import { hapticTick, hapticFirm } from "../lib/haptics";
import type { SendJob } from "./ReadingScreen";

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
  /** Geometry could not be confirmed; the tray must not look normally accepted. */
  geometryIssue?: boolean;
  /** Why this page needs a look; null when it does not. A quality *warning* is
      a note, not a flag. */
  flag?: { kind: "edges" | "quality"; reason: string } | null;
  /** The original photo is still on this device, so edges can be adjusted. */
  canAdjust?: boolean;
  note?: string | null;
};

export type TorchMode = "auto" | "on" | "off";

/** What the live camera is reporting, one measured reason at a time. */
export type LiveState = {
  hint: string;
  blocking?: string | null;
  tone?: "neutral" | "locked" | "attention";
  reason?: string | null;
  action?: "torch" | null;
  phase?: "searching" | "candidate" | "locked" | string;
  torch?: { supported: boolean; mode: TorchMode; on: boolean; error: string | null };
  engine?: { status: string; source?: string | null; score?: number | null; error?: string | null };
};

export type TrayHandlers = {
  onPage?: (n: number) => void;
  onDone?: () => void;
  onRetake?: (n: number) => void;
  onKeep?: (n: number) => Promise<void> | void;
  onKeepAll?: () => Promise<void> | void;
  onAdjustSource?: (n: number) => { blob: Blob; quad: { x: number; y: number }[] | null } | null;
  onAdjustApply?: (n: number, quad: { x: number; y: number }[]) => Promise<void>;
  onRemove?: (n: number) => Promise<void>;
  onMove?: (n: number, to: number) => Promise<void>;
};

export type ProgressModel = {
  heading?: string;
  now: string;
  sub?: string;
  steps: { label: string; state: "done" | "now" | "wait" }[];
  /** The paper's pages in order, each with its own picture and whether it is safely sent. */
  pages?: { n: number; thumb: string | null; sent: boolean }[];
  skeleton?: boolean;
  note?: string;
} | null;

export type ReviewQuestion = {
  id: string;
  label?: string;
  tier: "confident" | "unsure" | "unreadable";
  confirmed?: boolean;
  /** The pipeline asked about this part (needs_review). */
  flagged?: boolean;
  /** Its measured reason in words, or null when none was recorded. */
  reason?: string | null;
  causeRejected?: boolean;
  marksAwarded?: number | null;
  marksAvailable?: number | null;
  answer?: string | null;
  questionText?: string | null;
  answerBlock?: AnswerBlock | null;
  identityNote?: string | null;
  markStep?: number;
  remark?: string | null;
  crop?: { paperId: string; page: number; box: CropBox } | null;
  pageNumber?: number;
  paperId?: string;
  pageNumbers?: number[];
  unreadableReason?: string | null;
  /** "diagram" when the answer is drawn rather than written. */
  regionType?: string | null;
  alternatives?: number[];
  allocationUnusable?: boolean;
  explanation?: { cause?: string; body?: string; doThisNext?: string } | null;
};

export type ReviewModel = {
  title: string;
  lead?: string;
  delta?: { message: string; ours: number; theirs: number } | null;
  noTotal?: string | null;
  outstanding: number;
  cleanCount: number;
  saving?: boolean;
  /** "Check the reading" on a saved paper: fixes save at once, no rescan. */
  committed?: boolean;
  saveLabel: string;
  questions: ReviewQuestion[];
} | null;

export type ReviewHandlers = {
  onMark: (id: string, value: number) => void | Promise<void>;
  onAction: (id: string, action: string) => void;
  onRelabel?: (id: string, label: string) => Promise<void>;
  onConfirmClean: () => void;
  onSave: () => void;
};

export type ResumeReviewResult =
  | { state: "reviewing" }
  /** The paper is read and saving on its own (AXO-216); open the paper. */
  | { state: "saving"; paperId: string }
  /** The save was refused; the reason is for the student. */
  | { state: "save_failed"; paperId: string; reason: string }
  | { state: "committed"; paperId: string }
  | { state: "processing" }
  | { state: "stopped"; reason: string | null }
  | { state: "gone" };

type ScanModule = {
  resetScan: () => void;

  setScanContext: (ctx: unknown) => void;
  attachSurface: (video: HTMLVideoElement | null, overlay: HTMLCanvasElement | null, options?: { autoCapture: boolean }) => void;
  detachSurface: () => void;
  initScanUI: (ctx: unknown, host: unknown) => Promise<void>;
  setPendingPaperType: (t: string | null) => void;
  acceptUploads: (files: File[]) => Promise<{ accepted: { name: string }[]; rejected: { name: string; reason: string }[] }>;
  setScanVisible: (visible: boolean, camera?: unknown) => void;

  shoot: () => void;
  setAutoCapture: (on: boolean) => void;
  setTorchMode: (mode: TorchMode) => Promise<void> | void;
  resumeDraftReview: (draftId: string, options?: { check?: boolean }) => Promise<ResumeReviewResult>;
  autoSavePaper: (paperId: string) => Promise<void>;
};

type ScanValue = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;
  camera: { on: boolean; phase: string };
  scanPhase: string;
  pendingCaptureCount: number;
  hint: LiveState;
  tray: TrayPage[];
  trayHandlers: TrayHandlers;
  progress: ProgressModel;
  drafts: { id: string; title: string; pages: number; updatedAt?: number | null; thumbs?: Blob[] }[];
  draftsHandlers: { onResume?: (id: string) => void; onDiscard?: (id: string) => void };
  resumable: { id: string; pages: number } | null;
  review: ReviewModel;
  reviewHandlers: ReviewHandlers | null;
  reviewOpen: boolean;
  closeReview: () => void;
  ensureScan: () => Promise<ScanModule>;
  onScreenVisible: (visible: boolean) => void;
  shoot: () => void;
  setAutoCapture: (on: boolean) => void;
  setTorchMode: (mode: TorchMode) => void;
  auto: boolean;
  submitting: boolean;
  pageReviewOpen: boolean;
  openPageReview: () => void;
  closePageReview: () => void;
  /** Papers sending or being read in the background, newest last. */
  sends: SendJob[];
  /** The paper whose reading screen covers the scanner, if any. */
  focusedSend: string | null;
  setFocusedSend: (id: string | null) => void;
  retrySend: (id: string) => void;
  dismissSend: (id: string) => void;
};

const Ctx = createContext<ScanValue | null>(null);

/** Exposed so screens can be rendered against a fixed state in tests. */
export const ScanContext = Ctx;
export type { ScanValue };

function reviewIdentityFromPath(pathname: string) {
  const prefix = "/scan/review/";
  if (!pathname.startsWith(prefix)) return null;
  const identity = pathname.slice(prefix.length).split("/")[0];
  return identity || null;
}

/** For surfaces that may render outside the provider (tests, public pages). */
export function useOptionalScan(): ScanValue | null {
  return useContext(Ctx);
}

export function useScan(): ScanValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useScan called outside ScanProvider");
  return v;
}

export function ScanProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const appRef = useRef(app);
  appRef.current = app;
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location);
  locationRef.current = location;
  const activation = useRef(0);
  const visibleRef = useRef(false);
  const screenVisibleRef = useRef(false);
  const pageSuspendedRef = useRef(false);
  const cameraModule = useRef<typeof import("../../scan/camera.js") | null>(null);

  const toast = useToast();
  const { openSheet } = useSheetControls();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const [camera, setCamera] = useState({ on: false, phase: "idle" });
  const [scanState, setScanState] = useState({ phase: "idle", pendingCaptureCount: 0 });
  const [hint, setHint] = useState<LiveState>({
    hint: "Starting the camera…",
  });
  const [pageReviewOpen, setPageReviewOpen] = useState(false);
  const [tray, setTray] = useState<TrayPage[]>([]);
  const [trayHandlers, setTrayHandlers] = useState<TrayHandlers>({});
  const [progress, setProgress] = useState<ProgressModel>(null);
  const [drafts, setDrafts] = useState<ScanValue["drafts"]>([]);
  const [draftsHandlers, setDraftsHandlers] = useState<ScanValue["draftsHandlers"]>({});
  const [resumable, setResumable] = useState<ScanValue["resumable"]>(null);
  const [review, setReview] = useState<ReviewModel>(null);
  const [reviewHandlers, setReviewHandlers] = useState<ReviewHandlers | null>(null);
  const [reviewIdentity, setReviewIdentity] = useState<string | null>(null);
  const reviewOpen = reviewIdentity !== null && location.pathname === paths.review(reviewIdentity);
  const [submitting, setSubmitting] = useState(false);
  const [auto, setAuto] = useState(true);
  const autoRef = useRef(true);
  const [sends, setSends] = useState<SendJob[]>([]);
  const [focusedSend, setFocusedSend] = useState<string | null>(null);
  type Queue = { subscribe: (fn: (jobs: SendJob[]) => void) => () => void; resume: (studentId: string, titleFor?: (t: string | null) => string | null) => Promise<void>; wake: (id?: string) => void; dismiss: (id: string) => void; cancelAll: () => void };
  const queueRef = useRef<Queue | null>(null);

  // Sends outlive the scanner: they resume as soon as the app opens, on any
  // screen, so a paper interrupted by a closed tab carries on by itself.
  useEffect(() => {
    const studentId = app.student?.id;
    if (!studentId) return;
    let stop = () => {};
    let cancelled = false;
    const start = async () => {
      try {
        const [{ sendQueue }, papersMod, curriculum] = await Promise.all([
          import("../../scan/send-queue.js"), import("../../papers.js"), import("../../curriculum.js"),
        ]);
        if (cancelled) return;
        const queue = (await sendQueue()) as unknown as Queue;
        if (cancelled) return;
        queueRef.current = queue;
        stop = queue.subscribe((jobs) => setSends(jobs.filter((j) => (j as SendJob & { studentId?: string }).studentId === studentId)));
        const types = papersMod.paperTypesFor(curriculum.providerKeyForStudent(appRef.current.student)) as { value: string; label: string }[];
        await queue.resume(studentId, (t) => types.find((x) => x.value === t)?.label ?? null);
      } catch (error) {
        console.warn("[scan] could not resume sends", error);
      }
    };
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const handle = idle ? idle(() => void start()) : window.setTimeout(() => void start(), 800);
    return () => {
      cancelled = true;
      stop();
      if (!idle) window.clearTimeout(handle as number);
    };
  }, [app.student?.id]);

  const scanPromise = useRef<Promise<ScanModule> | null>(null);
  const scanReady = useRef<Promise<unknown> | null>(null);
  const modRef = useRef<ScanModule | null>(null);


  useEffect(() => {
    const clear = (event: Event) => {
      if ((event as CustomEvent).detail.action !== "purge") return;
      ++activation.current;
      modRef.current?.resetScan(); scanReady.current = null;
      setTray([]); setDrafts([]); setReview(null); setReviewIdentity(null); setProgress(null); setResumable(null); setSubmitting(false);
      queueRef.current?.cancelAll(); setSends([]); setFocusedSend(null);
    };
    addEventListener("axon:local-data", clear);
    return () => removeEventListener("axon:local-data", clear);

  }, []);

  useEffect(() => {
    modRef.current?.resetScan(); scanReady.current = null;
    setTray([]); setReview(null); setReviewIdentity(null); setDrafts([]); setResumable(null); setProgress(null);
  }, [app.student?.id]);

  const gotoScan = useCallback(() => { navigate("/scan"); }, [navigate]);

  const ensureScan = useCallback(async (): Promise<ScanModule> => {
    try {
    scanPromise.current ??= import("../../scan/ui.js") as unknown as Promise<ScanModule>;
    const scan = await scanPromise.current;
    modRef.current = scan;
    scanReady.current ??= Promise.resolve(scan.initScanUI(
      { student: appRef.current.student, guardian: appRef.current.guardian },
      {
        toast: (m: string, tone?: "neutral" | "warn") => toast(m, tone),
        submissionBusy: setSubmitting,
        uploadTelemetry: captureUploadTelemetry,
        scannerState: setScanState,
        navigationIntent: () => locationRef.current.key,
        tick: hapticTick,
        firm: hapticFirm,
        scanSurface: () => ({ video: videoRef.current, overlay: overlayRef.current }),
        renderHint: (state: LiveState) => setHint(state),
        reviewPages: () => setPageReviewOpen(true),
        cameraLive: (on: boolean, phase?: string) =>
          setCamera({ on, phase: on ? "live" : (phase ?? "idle") }),
        renderTray: (pages: TrayPage[], handlers: TrayHandlers) => {
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
        sendStarted: (id: string) => setFocusedSend(id),
        openSheet: (cfg: SheetConfig) => openSheet(cfg),
        openReview: (paperId: string, intent: string | null) => {
          // Re-entry can arrive through a canonical paper-id route or a legacy
          // draft-id route. If the user is already on a review route, bind the
          // overlay to that route identity instead of requiring it to equal the
          // canonical paper id returned by the freshly loaded review model.
          const routeIdentity = reviewIdentityFromPath(locationRef.current.pathname);
          if (routeIdentity) {
            setReviewIdentity(routeIdentity);
            return;
          }
          if (paperId && visibleRef.current && intent === locationRef.current.key) {
            setReviewIdentity(paperId);
            navigate(paths.review(paperId));
            return;
          }
          // The student left while it was being read: do not pull them back.
          // Clear the reading screen so the scanner is ready next time, and say
          // where the paper is.
          setProgress(null);
          if (paperId) toast("Your paper is read and ready to check in Library.");
        },
        renderReview: (m: ReviewModel, h: ReviewHandlers) => {
          setReview(m);
          setReviewHandlers(() => h);
          // The review model is already loaded at this point. On a direct
          // /scan/review/:id entry, make it visible immediately; do not wait for
          // a second route-identity handshake that can strand the actual cards
          // behind the processing screen.
          const routeIdentity = reviewIdentityFromPath(locationRef.current.pathname);
          if (routeIdentity) setReviewIdentity(routeIdentity);
        },
        closeReview: (paperId?: string) => { if (locationRef.current.pathname.startsWith("/scan/review/")) navigate(paperId ? paths.paper(paperId) : paths.scan, { replace: true }); },
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
  }, [toast, openSheet, gotoScan, navigate]);


  // A read paper saves on its own, even when the student never opens it
  // (AXO-216, council D1). Once per paper per session; a refused save is kept
  // with its reason by the scan module and not retried into the same refusal.
  const autoSaved = useRef(new Set<string>());
  const progressRows = app.progressResource?.data;
  useEffect(() => { autoSaved.current = new Set(); }, [app.student?.id]);
  useEffect(() => {
    if (!app.student?.id || !progressRows) return;
    const ready = [...progressRows.values()].filter((row) =>
      ["needs_review", "explaining", "ready"].includes(row.status) && !autoSaved.current.has(row.paper_id));
    if (!ready.length) return;
    for (const row of ready) autoSaved.current.add(row.paper_id);
    void ensureScan()
      .then((scan) => Promise.all(ready.map((row) => scan.autoSavePaper(row.paper_id))))
      .catch((error) => console.warn("[scan] a read paper could not start saving", error));
  }, [app.student?.id, progressRows, ensureScan]);

  const setCameraVisible = useCallback((visible: boolean, retry = false) => {
    if (visibleRef.current === visible && !retry) return;
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
        const cameraRequest = import("../../scan/camera.js").then(async camera => {

          cameraModule.current = camera;
          if (request !== activation.current || !visibleRef.current || !camera.cameraSupported()) return null;
          const stream = await camera.requestCamera();
          if (request !== activation.current || !visibleRef.current) {
            stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            return null;
          }
          return stream;
        }).catch(error => error);

        const [scan, stream] = await Promise.all([ensureScan(), cameraRequest]);
        if (request !== activation.current || !visibleRef.current) return;
        scan.attachSurface(videoRef.current, overlayRef.current, { autoCapture: autoRef.current });
        await scan.setScanVisible(true, stream);
      } catch {
        if (request !== activation.current) return;
        // Cancel both halves of startup, including a camera module or permission
        // request that has not returned yet. Retry receives a new activation.
        ++activation.current;

        cameraModule.current?.releaseCamera();
        setCamera({ on: false, phase: "failed" });
        setHint({ hint: "The scanner could not start. Try again.", blocking: "scanner" });
      }
    })();
  }, [ensureScan]);

  const onScreenVisible = useCallback((visible: boolean) => {
    screenVisibleRef.current = visible;
    setCameraVisible(visible && !document.hidden && !pageSuspendedRef.current, visible);
  }, [setCameraVisible]);

  useEffect(() => {
    const syncVisibility = () => {
      setCameraVisible(screenVisibleRef.current && !document.hidden && !pageSuspendedRef.current);
    };
    const hidePage = () => { pageSuspendedRef.current = true; syncVisibility(); };
    const showPage = () => { pageSuspendedRef.current = false; syncVisibility(); };
    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("pagehide", hidePage);
    window.addEventListener("pageshow", showPage);
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("pagehide", hidePage);
      window.removeEventListener("pageshow", showPage);
    };
  }, [setCameraVisible]);

  useEffect(() => () => {
    ++activation.current;
    screenVisibleRef.current = false;
    visibleRef.current = false;
    cameraModule.current?.releaseCamera();
    modRef.current?.setScanVisible(false);
    modRef.current?.detachSurface();
  }, []);

  const shoot = useCallback(() => { modRef.current?.shoot(); }, []);
  const setAutoCapture = useCallback((on: boolean) => {
    autoRef.current = on;
    setAuto(on);
    modRef.current?.setAutoCapture(on);
  }, []);
  const closeReview = useCallback(() => { navigate(-1); }, [navigate]);
  const setTorchMode = useCallback((mode: TorchMode) => { void modRef.current?.setTorchMode(mode); }, []);
  const openPageReview = useCallback(() => setPageReviewOpen(true), []);
  const closePageReview = useCallback(() => setPageReviewOpen(false), []);
  const retrySend = useCallback((id: string) => { queueRef.current?.wake(id); }, []);
  const dismissSend = useCallback((id: string) => {
    queueRef.current?.dismiss(id);
    setFocusedSend((current) => (current === id ? null : current));
  }, []);

  const value = useMemo<ScanValue>(() => ({
    videoRef, overlayRef,
    camera, scanPhase: scanState.phase, pendingCaptureCount: scanState.pendingCaptureCount,
    hint, tray, trayHandlers, progress, drafts, draftsHandlers,
    resumable, review, reviewHandlers, reviewOpen, closeReview,
    ensureScan, onScreenVisible, shoot, setAutoCapture, setTorchMode, auto, submitting,
    pageReviewOpen, openPageReview, closePageReview,
    sends, focusedSend, setFocusedSend, retrySend, dismissSend,
  }), [
    camera, scanState, hint, tray, trayHandlers, progress, drafts, draftsHandlers,
    resumable, review, reviewHandlers, reviewOpen, closeReview,
    ensureScan, onScreenVisible, shoot, setAutoCapture, setTorchMode, auto, submitting,
    pageReviewOpen, openPageReview, closePageReview,
    sends, focusedSend, retrySend, dismissSend,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
