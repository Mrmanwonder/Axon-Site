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
import { useNavigate } from "react-router-dom";
import { useScan } from "../scan/ScanProvider";
import type { TorchMode } from "../scan/ScanProvider";
import { useIngestion } from "../data/useIngestion";
import { useApp } from "../data/AppProvider";
import PressBox from "../components/PressBox";
import Dialog from "../components/Dialog";
import { DraftAlert } from "../components/ScanDrafts";
import CameraLevel from "../scan/CameraLevel";
import PaperStack, { DoneButton, needsLook } from "../scan/PaperStack";
import PageReview from "../scan/PageReview";
import ImportDesk from "../scan/ImportDesk";
import { useDeskMode } from "../scan/useDeskMode";
import { useSheetControls } from "../components/SheetProvider";
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
    videoRef, overlayRef, camera, hint, tray, trayHandlers, progress,
    resumable, drafts, draftsHandlers, onScreenVisible, ensureScan, shoot,
    setAutoCapture, setTorchMode, auto, submitting, pendingCaptureCount,
    pageReviewOpen, openPageReview, closePageReview,
  } = useScan();
  const { ingestFiles, addPaper, addLink } = useIngestion();
  const { student } = useApp();
  const { openSheet } = useSheetControls();
  const navigate = useNavigate();
  const desk = useDeskMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const cameraApp = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.classList.add("scanner-active");
    if (desk) void ensureScan().catch(() => { /* the screen still takes files */ });
    else onScreenVisible(true);
    return () => {
      document.documentElement.classList.remove("scanner-active");
      if (!desk) onScreenVisible(false);
    };
  }, [desk, onScreenVisible, ensureScan]);

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

  const openDrafts = () => {
    hapticTick();
    openSheet({
      title: "Saved drafts",
      body: drafts.length
        ? "These unfinished scans are stored on this device until you resume and send them."
        : "No saved scans yet. Pages you capture will be stored on this device until you send them.",
      choices: drafts.length
        ? drafts.map((draft) => ({
            label: `${draft.title} · ${draft.pages} page${draft.pages === 1 ? "" : "s"}`,
            value: draft.id,
          }))
        : undefined,
      primary: "Done",
      onChoice: (id) => draftsHandlers.onResume?.(id),
    });
  };

  const review = pageReviewOpen && <PageReview onClose={closePageReview} />;

  if (desk) {
    return (
      <>
        <ImportDesk onReview={openPageReview} />
        {review}
        {progress && <ProgressPanel progress={progress} />}
        {!student && <div className="subnote">Create a student profile before scanning.</div>}
      </>
    );
  }

  const live = camera.on;
  const torch = hint.torch;
  const strip: Strip = (() => {
    if (!live) {
      return { tone: camera.phase === "starting" || camera.phase === "idle" ? "neutral" : "attention", text: hint.hint };
    }
    if (hint.tone === "attention" && hint.reason) {
      if (hint.action === "torch" && torch?.supported) {
        return { tone: "attention", text: hint.hint,
          action: { label: "Turn on light", run: () => setTorchMode("on") } };
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
  const shutterOff = !live || submitting || pendingCaptureCount >= 2;
  const draftsCount = drafts.length;

  const closeMenuThen = (fn: () => void) => { setMenuOpen(false); window.setTimeout(fn, 0); };

  return (
    <>
      <div className="sc" data-camera={live ? "on" : "off"} data-phase={live ? undefined : camera.phase}>
        {/* The top bar wears the navigation bar's material, the same as the
            shutter below it: close on its own, and the three tools in one
            capsule whose "on" state is the tab bar's pill. Line glyphs at the
            tab bar's weight, so the camera reads as the same app. */}
        <div className="sc-top">
          <PressBox as="button" type="button" className="sc-circ sc-glass" aria-label="Close scanner"
                    onClick={() => navigate(paths.home)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
          </PressBox>
          <span className="sc-grow" />
          <div className="sc-tools sc-glass">
            <PressBox as="button" type="button" className="sc-auto" data-on={auto ? "true" : "false"}
                      aria-pressed={auto} onClick={() => { hapticTick(); setAutoCapture(!auto); }}>
              Auto
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
          {resumable && draftsHandlers.onResume && tray.length === 0 && (
            <DraftAlert draft={resumable} onResume={draftsHandlers.onResume} />
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
                    data-locked={locked && auto ? "true" : undefined} disabled={shutterOff}
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
          {/* The Settings list, verbatim: plain rows, a label with its note
              under it, a chevron where the row leads somewhere, and the app's
              segmented control for a three-way choice. */}
          <div className="list sc-menu-list">
            <PressBox as="button" type="button" className="srow noicon" data-interactive=""
                      onClick={() => closeMenuThen(addPaper)}>
              <div className="lbl">Import photos<small>From your gallery or files</small></div>
              <Chevron />
            </PressBox>
            <PressBox as="button" type="button" className="srow noicon" data-interactive=""
                      onClick={() => closeMenuThen(() => cameraApp.current?.click())}>
              <div className="lbl">Use your camera app<small>Take the photo with your phone’s own camera</small></div>
              <Chevron />
            </PressBox>
            <PressBox as="button" type="button" className="srow noicon" data-interactive=""
                      onClick={() => closeMenuThen(addLink)}>
              <div className="lbl">Add a link<small>A shared PDF or drive file</small></div>
              <Chevron />
            </PressBox>
            <PressBox as="button" type="button" className="srow noicon" data-interactive=""
                      onClick={() => closeMenuThen(openDrafts)}>
              <div className="lbl">Saved drafts</div>
              <div className="aux">{draftsCount || "None"}</div>
              <Chevron />
            </PressBox>
            {torch?.supported && (
              <div className="srow noicon sc-light" role="group" aria-label="Light">
                <div className="lbl">Light{torch.error && <small role="alert">{torch.error}</small>}</div>
                <div className="seg">
                  {(["auto", "on", "off"] as TorchMode[]).map((mode) => (
                    <button type="button" key={mode} aria-pressed={torch.mode === mode}
                            className={torch.mode === mode ? "on" : undefined}
                            onClick={() => setTorchMode(mode)}>{TORCH_LABEL[mode]}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="acts">
            <button type="button" className="btn plain" onClick={() => setMenuOpen(false)}>Close</button>
          </div>
        </Dialog>
      )}

      {review}
      {progress && <ProgressPanel progress={progress} />}

      {!student && <div className="subnote">Create a student profile before scanning.</div>}
    </>
  );
}

function ProgressPanel({ progress }: { progress: NonNullable<ReturnType<typeof useScan>["progress"]> }) {
  return (
    <div className="scanbelow">
      <div className="sectitle tight">{progress.heading ?? "Reading this paper"}</div>
      <div className="card proc">
        <div className="hd">{progress.now}</div>
        {progress.sub && <div className="sub">{progress.sub}</div>}
        {progress.steps.map((st, i) => (
          <div key={i} className={"pline" + (st.state === "now" ? " now" : "")}>
            <span className={"st " + st.state}>
              {st.state === "done" && (
                <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5 4.5 9 10 3.5" /></svg>
              )}
            </span>
            <span className="lb">{st.label}</span>
          </div>
        ))}
        {progress.skeleton && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="skel" style={{ width: "82%" }} />
            <div className="skel" style={{ width: "64%" }} />
            <div className="skel" style={{ width: "73%" }} />
          </div>
        )}
      </div>
      {progress.note && <div className="subnote">{progress.note}</div>}
    </div>
  );
}
