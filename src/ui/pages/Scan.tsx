/* ═══════════════════════════════════════════════════════════════════════════
   SCAN

   Phones and tablets: a camera screen that is a column, not an overlay.
   Top bar (close, Auto, drafts, more) · camera · guidance strip · bottom bar
   (paper stack, capsule shutter, Done or Review). Nothing sits on the paper
   except the corner brackets and a faint level line; every word the scanner
   says lives in the strip under the camera.

   Laptops and desktops: an import screen. A webcam is not offered.

   The shutter is never disabled by detection. Detection only decides what the
   brackets show and when Auto may fire.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { useNavigate } from "react-router-dom";
import { useScan } from "../scan/ScanProvider";
import type { TorchMode } from "../scan/ScanProvider";
import { useIngestion } from "../data/useIngestion";
import { useApp } from "../data/AppProvider";
import PressBox from "../components/PressBox";
import Dialog, { SHEET_EXIT_MS, useDialogDismiss } from "../components/Dialog";
import GlideSegment from "../components/GlideSegment";
import CameraLevel from "../scan/CameraLevel";
import PaperStack, { DoneButton, needsLook } from "../scan/PaperStack";
import PageReview from "../scan/PageReview";
import DraftsSheet from "../scan/DraftsSheet";
import ImportDesk from "../scan/ImportDesk";
import ReadingScreen, { modelForSend } from "../scan/ReadingScreen";
import type { SendJob } from "../scan/ReadingScreen";
import { useDeskMode } from "../scan/useDeskMode";
import { hapticTick } from "../lib/haptics";
import { CheckSymbol, CropFreeSymbol, InfoSymbol } from "../components/MaterialSymbols";
import Chevron from "../components/Chevron";
import { paths } from "../app/paths";
import "../styles/scanner.css";

const PROBLEM_TITLE: Record<string, string> = {
  unavailable: "This device has no camera we can use",
  blocked: "Camera access is off for this site",
  failed: "The scanner could not start",
};

const TORCH_LABEL: Record<TorchMode, string> = { auto: "Auto", on: "On", off: "Off" };

type Strip = {
  tone: "neutral" | "locked" | "attention";
  text: string;
  action?: { label: string; run: () => void };
};

export default function Scan() {
  const {
    videoRef, overlayRef, camera, hint, tray, trayHandlers,
    drafts, draftsHandlers, onScreenVisible, ensureScan, shoot,
    setAutoCapture, setTorchMode, auto, submitting, pendingCaptureCount,
    pageReviewOpen, openPageReview, closePageReview,
    sends, focusedSend, setFocusedSend, retrySend,
  } = useScan();
  const { ingestFiles, addPaper, addLink } = useIngestion();
  const { student } = useApp();
  const navigate = useNavigate();
  const desk = useDeskMode();
  const [menuOpen, setMenuOpen] = useState(false);
  // The scanner fades up and its controls settle in; it closes by fading out
  // (scanner.css; 200 ms out, instant under reduced motion).
  const [leaving, setLeaving] = useState(false);
  const closeScanner = () => {
    if (leaving) return;
    const reduced = document.documentElement.dataset.motion === "reduce"
      || matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { navigate(paths.home); return; }
    setLeaving(true);
    window.setTimeout(() => navigate(paths.home), 200);
  };
  const cameraApp = useRef<HTMLInputElement>(null);

  // The paper just handed over, while its reading screen covers the camera.
  const focused = sends.find((job) => job.id === focusedSend) ?? null;
  const covered = Boolean(focused);

  useEffect(() => {
    document.documentElement.classList.add("scanner-active");
    if (desk) void ensureScan().catch(() => { /* the screen still takes files */ });
    else onScreenVisible(!covered);
    return () => {
      document.documentElement.classList.remove("scanner-active");
      if (!desk) onScreenVisible(false);
    };
  }, [desk, onScreenVisible, ensureScan, covered]);

  // The paper is read while the student is still looking at it: open review.
  useEffect(() => {
    if (focused?.phase !== "review" || !focused.paperId) return;
    setFocusedSend(null);
    navigate(paths.review(focused.paperId));
  }, [focused?.phase, focused?.paperId, setFocusedSend, navigate]);

  // iOS Safari handles pinch through gesture events outside touch-action.
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    const surface = videoRef.current?.parentElement;
    if (!surface) return;
    const listen = surface.addEventListener.bind(surface) as
      (t: string, l: EventListener, o?: AddEventListenerOptions) => void;
    const unlisten = surface.removeEventListener.bind(surface) as
      (t: string, l: EventListener) => void;
    const kinds = ["gesturestart", "gesturechange", "gestureend"];
    for (const kind of kinds) listen(kind, stop, { passive: false });
    return () => { for (const kind of kinds) unlisten(kind, stop); };
  }, [desk, videoRef]);

  // A short, earned acknowledgment after a page is stored: never during a shot.
  const settled = tray.filter((p) => !p.pending);
  const settledCount = useRef(settled.length);
  const [savedPage, setSavedPage] = useState<number | null>(null);
  useEffect(() => {
    if (settled.length > settledCount.current) {
      const last = settled[settled.length - 1];
      if (!needsLook(last)) {
        setSavedPage(last.page_number);
        const timer = window.setTimeout(() => setSavedPage(null), 3000);
        settledCount.current = settled.length;
        return () => window.clearTimeout(timer);
      }
    }
    settledCount.current = settled.length;
  }, [settled]);

  const flaggedPages = tray.filter(needsLook);

  const [draftsOpen, setDraftsOpen] = useState(false);
  const openDrafts = () => { hapticTick(); setDraftsOpen(true); };

  const review = pageReviewOpen && <PageReview onClose={closePageReview} />;

  if (desk) {
    return (
      <>
        <ImportDesk onReview={openPageReview} />
        {review}
        {focused && <SendingScreen job={focused} onContinue={() => setFocusedSend(null)} onRetry={() => retrySend(focused.id)} />}
        {!student && <div className="subnote">Create a student profile before scanning.</div>}
      </>
    );
  }

  const live = camera.on;
  const torch = hint.torch;
  const capturing = Boolean(hint.capturing);
  const strip: Strip = (() => {
    if (!live) {
      return { tone: camera.phase === "starting" || camera.phase === "idle" ? "neutral" : "attention", text: hint.hint };
    }
    if (capturing) return { tone: "neutral", text: "Taking this page" };
    if (hint.tone === "attention" && hint.reason) {
      if (hint.action === "torch" && torch?.supported) {
        return { tone: "attention", text: hint.hint,
          action: { label: "Turn on torch", run: () => setTorchMode("on") } };
      }
      if (hint.reason === "nothing" || hint.reason === "engine") {
        return { tone: "attention", text: hint.hint,
          action: { label: "Take photo", run: shoot } };
      }
      return { tone: "attention", text: hint.hint };
    }
    if (flaggedPages.length) {
      const page = flaggedPages[0];
      return {
        tone: "attention",
        text: `Page ${page.page_number}: ${page.flag?.reason ?? "waiting for the new photo"}`,
        action: page.retakeRequested ? undefined
          : { label: "Retake", run: () => trayHandlers.onRetake?.(page.page_number) },
      };
    }
    if (savedPage !== null) {
      return { tone: "locked", text: `Page ${savedPage} saved. Turn to the next page` };
    }
    return { tone: hint.tone === "locked" ? "locked" : "neutral", text: hint.hint };
  })();

  const locked = live && hint.phase === "locked";
  const cameraProblem = !live && ["unavailable", "blocked", "failed"].includes(camera.phase);
  const shutterOff = !live || capturing || submitting || pendingCaptureCount >= 2;
  const draftsCount = drafts.length;

  const closeMenuThen = (fn: () => void) => { window.setTimeout(fn, 0); };

  return (
    <>
      <div className={"sc" + (leaving ? " is-leaving" : "")} data-camera={live ? "on" : "off"} data-phase={live ? undefined : camera.phase}>
        {/* The top bar wears the navigation bar's material, the same as the
            shutter below it: close on its own, and the three tools in one
            capsule whose "on" state is the tab bar's pill. Line glyphs at the
            tab bar's weight, so the camera reads as the same app. */}
        <div className="sc-top">
          <PressBox as="button" type="button" className="sc-circ sc-close" aria-label="Close scanner"
                    onClick={closeScanner}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
          </PressBox>
          <span className="sc-grow" />
          <div className="sc-tools sc-glass">
            <PressBox as="button" type="button" className="sc-auto" data-on={auto ? "true" : "false"}
                      aria-pressed={auto} onClick={() => { hapticTick(); setAutoCapture(!auto); }}>
              <span>Auto</span>
            </PressBox>
            <PressBox as="button" type="button" className="sc-circ"
                      aria-label={draftsCount ? `Saved drafts, ${draftsCount}` : "Saved drafts"}
                      onClick={openDrafts}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 3.75h6.6L18.25 8.4V19a1.25 1.25 0 0 1-1.25 1.25H7A1.25 1.25 0 0 1 5.75 19V5A1.25 1.25 0 0 1 7 3.75Z" />
                <path d="M13.25 3.9V8.75h4.85" /><path d="M9 13h6M9 16.25h4" />
              </svg>
              {draftsCount > 0 && <span className="dot" aria-hidden="true" />}
            </PressBox>
            <PressBox as="button" type="button" className="sc-circ" aria-label="More"
                      aria-haspopup="dialog" onClick={() => { hapticTick(); setMenuOpen(true); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className="dots">
                <circle cx="6" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18" cy="12" r="1.6" />
              </svg>
            </PressBox>
          </div>
        </div>

        {/* The ids are load-bearing: system.css sizes the video and the overlay
            by id, and capture.js reads the overlay through the video's layout. */}
        <div className="sc-vf" data-locked={locked ? "true" : undefined}>
          <video id="scanVideo" ref={videoRef} autoPlay playsInline muted disablePictureInPicture />
          <canvas id="scanOverlay" ref={overlayRef} />
          <CameraLevel active={live} />
          {cameraProblem && (
            <div className="sc-problem" role="group" aria-label="Camera unavailable">
              <h2>{PROBLEM_TITLE[camera.phase] ?? "The scanner could not start"}</h2>
              {camera.phase !== "unavailable" && (
                <button type="button" className="sc-btn" onClick={() => onScreenVisible(true)}>Try the camera again</button>
              )}
              <button type="button" className="sc-btn ghost" onClick={() => cameraApp.current?.click()}>
                Use your camera app
              </button>
              <button type="button" className="sc-btn ghost" onClick={addPaper}>Import photos</button>
            </div>
          )}
        </div>

        <div className="sc-strip" data-tone={strip.tone} role="status" aria-live="polite">
          <span className="g" aria-hidden="true">
            {strip.tone === "locked" ? <CheckSymbol size={18} />
              : strip.tone === "attention" ? <InfoSymbol size={18} /> : <CropFreeSymbol size={18} />}
          </span>
          <span className="t">{strip.text}</span>
          {strip.action && (
            <button type="button" className="act" onClick={() => { hapticTick(); strip.action!.run(); }}>
              {strip.action.label}
            </button>
          )}
        </div>

        <div className="sc-dock">
          <PaperStack pages={tray} onOpen={openPageReview} disabled={submitting} />
          <PressBox as="button" type="button" className="sc-shutter" aria-label="Take this page"
                    data-locked={locked && auto ? "true" : undefined} data-capturing={capturing ? "true" : undefined}
                    aria-busy={capturing} disabled={shutterOff}
                    onClick={() => { hapticTick(); shoot(); }}>
            <span />
          </PressBox>
          <DoneButton pages={tray} busy={submitting}
                      onDone={() => { trayHandlers.onDone?.(); }} onReview={openPageReview} />
        </div>
      </div>

      <input ref={cameraApp} type="file" accept="image/*" capture="environment" hidden
             onChange={(e) => { const files = [...(e.target.files ?? [])]; e.target.value = ""; void ingestFiles(files); }} />

      {menuOpen && (
        <Dialog title="More" busy={false} onClose={() => setMenuOpen(false)} className="sc-menu">
          <MoreMenu then={closeMenuThen}>{(then) => (<>
          {/* Rows straight on the sheet, divided by hairlines, the way the
              app's other sheets list things: no card inside the overlay. */}
          <div className="sc-menu-list">
            <PressBox as="button" type="button" className="srow noicon" data-interactive=""
                      onClick={() => then(addPaper)}>
              <div className="lbl">Import photos<small>From your gallery or files</small></div>
              <Chevron />
            </PressBox>
            <PressBox as="button" type="button" className="srow noicon" data-interactive=""
                      onClick={() => then(() => cameraApp.current?.click())}>
              <div className="lbl">Use your camera app<small>Take the photo with your phone’s own camera</small></div>
              <Chevron />
            </PressBox>
            <PressBox as="button" type="button" className="srow noicon" data-interactive=""
                      onClick={() => then(addLink)}>
              <div className="lbl">Add a link<small>A shared PDF or drive file</small></div>
              <Chevron />
            </PressBox>
            <PressBox as="button" type="button" className="srow noicon" data-interactive=""
                      onClick={() => then(openDrafts)}>
              <div className="lbl">Saved drafts</div>
              <div className="aux">{draftsCount || "None"}</div>
              <Chevron />
            </PressBox>
            {torch?.supported && (
              <div className="srow noicon sc-torch">
                <div className="lbl">Torch{torch.error && <small role="alert">{torch.error}</small>}</div>
                <GlideSegment label="Torch" value={torch.mode as TorchMode}
                              options={(["auto", "on", "off"] as TorchMode[]).map((mode) => ({ value: mode, label: TORCH_LABEL[mode] }))}
                              onChange={(mode) => { hapticTick(); setTorchMode(mode); }} />
              </div>
            )}
          </div>
          </>)}</MoreMenu>
</Dialog>
      )}

      {draftsOpen && (
        <DraftsSheet drafts={drafts} onClose={() => setDraftsOpen(false)}
          onOpen={(id) => draftsHandlers.onResume?.(id)}
          onDelete={(id) => draftsHandlers.onDiscard?.(id)} />
      )}

      {review}
      {focused && <SendingScreen job={focused} onContinue={() => setFocusedSend(null)} onRetry={() => retrySend(focused.id)} />}

      {!student && <div className="subnote">Create a student profile before scanning.</div>}
    </>
  );
}

/* The scanner after Read (owner, 6 Oct 2026): the whole screen becomes this
   paper's reading screen. Continue scanning hands the camera back for the next
   paper while this one carries on; Go to Library leaves it to finish there. */
function SendingScreen({ job, onContinue, onRetry }: { job: SendJob; onContinue: () => void; onRetry: () => void }) {
  const navigate = useNavigate();
  const toLibrary = () => navigate(paths.library);
  const actions = job.phase === "stuck"
    ? [{ label: "Try again", run: onRetry, primary: true }, { label: "Continue scanning", run: onContinue }]
    : job.phase === "refused"
      ? [{ label: "Continue scanning", run: onContinue, primary: true }, { label: "Go to Library", run: toLibrary }]
      : [{ label: "Continue scanning", run: () => { hapticTick(); onContinue(); }, primary: true }, { label: "Go to Library", run: toLibrary }];
  return (
    <ReadingScreen model={modelForSend(job)} variant="overlay" onClose={toLibrary} closeLabel="Go to Library"
      actions={actions}
      footnote={["sending", "waiting", "reading"].includes(job.phase)
        ? "This carries on while you scan the next paper or leave. It waits in your Library."
        : null} />
  );
}

/** The More sheet's body. Every row leaves through the sheet's exit motion first. */
function MoreMenu({ then, children }: { then: (fn: () => void) => void; children: (go: (fn: () => void) => void) => React.ReactNode }) {
  const dismiss = useDialogDismiss();
  // No Close row: the sheet closes by tapping outside it or Escape, like the
  // system's own action sheets. A row closes the sheet first, then acts.
  const go = (fn: () => void) => { dismiss(); window.setTimeout(() => then(fn), SHEET_EXIT_MS + 10); };
  return <>{children(go)}</>;
}
