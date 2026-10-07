import { createRef } from "react";
import type { ScanValue, TrayPage, LiveState } from "../../src/ui/scan/ScanProvider";

export const SCAN_STATES = [
  "search", "locked", "saved", "reading", "offline", "dark", "small", "stuck", "flag", "review", "denied", "desk", "desk-pages",
] as const;
export type ScanFixtureState = typeof SCAN_STATES[number];

/** A page-shaped picture, so the stack and review show something real. */
export function paperThumb(n: number, hue = 40): string {
  const lines = Array.from({ length: 9 }, (_, i) =>
    `<rect x="14" y="${30 + i * 15}" width="${100 - ((i * 13 + n * 7) % 38)}" height="3" rx="1.5" fill="#8a867c" opacity=".55"/>`).join("");
  const pen = `<path d="M18 ${52 + n * 4} q20 -10 44 2" stroke="#d92d20" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="176" viewBox="0 0 128 176"><rect width="128" height="176" fill="hsl(${hue} 22% 90%)"/><text x="14" y="20" font-family="sans-serif" font-size="9" fill="#555">Page ${n}</text>${lines}${pen}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** A 1000x1400 "photograph" of a page on a desk, as an SVG blob. */
function photoBlob(): Blob {
  const lines = Array.from({ length: 16 }, (_, i) =>
    `<rect x="260" y="${330 + i * 56}" width="${420 - ((i * 37) % 120)}" height="8" rx="4" fill="#8a867c"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1400" viewBox="0 0 1000 1400"><rect width="1000" height="1400" fill="#3b3a36"/><polygon points="210,200 790,230 770,1230 230,1200" fill="#ece8de"/>${lines}</svg>`;
  return new Blob([svg], { type: "image/svg+xml" });
}
let PHOTO = photoBlob();
// Real photographs are JPEG: render the same scene to one and swap it in.
{
  const canvas = document.createElement("canvas");
  canvas.width = 1000; canvas.height = 1400;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#3b3a36"; ctx.fillRect(0, 0, 1000, 1400);
  ctx.fillStyle = "#ece8de";
  ctx.beginPath(); ctx.moveTo(210, 200); ctx.lineTo(790, 230); ctx.lineTo(770, 1230); ctx.lineTo(230, 1200); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#8a867c";
  for (let i = 0; i < 16; i++) ctx.fillRect(260, 330 + i * 56, 420 - ((i * 37) % 120), 8);
  canvas.toBlob((blob) => { if (blob) PHOTO = blob; }, "image/jpeg", 0.92);
}
const PAGE_QUAD = [{ x: 210, y: 200 }, { x: 790, y: 230 }, { x: 770, y: 1230 }, { x: 230, y: 1200 }];

const page = (n: number, extra: Partial<TrayPage> = {}): TrayPage => ({
  page_number: n, thumb: paperThumb(n), quality: { verdict: "ok", reasons: [] }, canAdjust: true, ...extra,
});

const live = (extra: Partial<LiveState> = {}): LiveState => ({
  hint: "Looking for the page", tone: "neutral", reason: null, action: null, phase: "searching",
  torch: { supported: false, mode: "auto", on: false, error: null }, engine: { status: "ready" }, ...extra,
});

export function scanFixture(state: ScanFixtureState, calls: Record<string, unknown[][]>): ScanValue {
  const record = (name: string) => (...args: unknown[]) => { (calls[name] ??= []).push(args); };
  const flagged = page(2, {
    flag: { kind: "edges", reason: "The page edges weren't found, so the whole photo was kept" },
  });
  const blurry = page(2, {
    flag: { kind: "quality", reason: "Blurry. Words may not read clearly" },
    quality: { verdict: "fail", reasons: ["Blurry. Words may not read clearly"] },
  });
  let tray: TrayPage[] = [];
  let hint = live();
  let pageReviewOpen = false;
  let cameraState = { on: true, phase: "live" };
  switch (state) {
    case "locked": hint = live({ hint: "Page found. Hold still to capture", tone: "locked", phase: "locked" }); break;
    case "saved": tray = [page(1), page(2), page(3)]; hint = live({ hint: "Looking for the page" }); break;
    case "dark": hint = live({
      hint: "Too dark to see the page edges", tone: "attention", reason: "dark", action: "torch",
      torch: { supported: true, mode: "auto", on: false, error: null },
    }); break;
    case "small": tray = [page(1)]; hint = live({
      hint: "Move closer, the page is small", tone: "attention", reason: "small", phase: "candidate",
    }); break;
    case "stuck": tray = [page(1)]; hint = live({
      hint: "Can't find the page edges. Take the photo and drag the corners to the page.",
      tone: "attention", reason: "nothing",
    }); break;
    case "flag": tray = [page(1), blurry, page(3)]; break;
    case "review": tray = [page(1), flagged, page(3)]; pageReviewOpen = true; break;
    case "denied":
      cameraState = { on: false, phase: "blocked" };
      hint = { hint: "Camera access is off for this site. You can still add pages from your files.", blocking: "camera" };
      break;
    case "desk-pages": tray = [page(1), flagged, page(3)]; break;
    default: break;
  }
  const noop = () => {};
  return {
    videoRef: createRef<HTMLVideoElement>(), overlayRef: createRef<HTMLCanvasElement>(),
    camera: cameraState, scanPhase: "live-guiding", pendingCaptureCount: 0,
    hint, tray,
    trayHandlers: {
      onPage: record("onPage"), onDone: record("onDone"), onRetake: record("onRetake"),
      onKeep: record("onKeep"), onKeepAll: record("onKeepAll"),
      onAdjustSource: () => ({ blob: PHOTO, quad: PAGE_QUAD }),
      onAdjustApply: async (...args: unknown[]) => { record("onAdjustApply")(...args); },
      onRemove: async (...args: unknown[]) => { record("onRemove")(...args); },
      onMove: async (...args: unknown[]) => { record("onMove")(...args); },
    },
    progress: null,
    sends: state === "reading" || state === "offline" ? [{
      id: "draft-1", paperId: "paper-1", runId: null, title: "Past paper",
      phase: state === "offline" ? "waiting" : "sending", stage: "upload",
      message: state === "offline" ? "No connection. Sending carries on by itself when you are back online." : "4 of 12 pages safely sent",
      pages: Array.from({ length: 12 }, (_, i) => ({ n: i + 1, thumb: paperThumb(i + 1), sent: i < 4 })),
      steps: [
        { label: "Sending the pages", state: "now" }, { label: "Finding the questions", state: "wait" },
        { label: "Reading the answers and the marking", state: "wait" }, { label: "Checking the marks add up", state: "wait" },
      ],
    }] : [],
    focusedSend: state === "reading" || state === "offline" ? "draft-1" : null,
    setFocusedSend: record("setFocusedSend"), retrySend: record("retrySend"), dismissSend: record("dismissSend"),
    drafts: state === "desk-pages" || state === "saved" ? [{ id: "d1", title: "Maths mock", pages: 3, updatedAt: Date.now() - 60_000, thumbs: [] }] : [],
    draftsHandlers: { onResume: record("onResume"), onDiscard: record("onDiscard") },
    resumable: null, review: null, reviewHandlers: null, reviewOpen: false, closeReview: noop,
    ensureScan: async () => ({}) as never,
    onScreenVisible: record("onScreenVisible"),
    shoot: record("shoot"), setAutoCapture: record("setAutoCapture"), setTorchMode: record("setTorchMode"),
    auto: true, submitting: false,
    pageReviewOpen, openPageReview: record("openPageReview"), closePageReview: record("closePageReview"),
  };
}
