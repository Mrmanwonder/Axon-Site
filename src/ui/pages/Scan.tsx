/* ═══════════════════════════════════════════════════════════════════════════
   SCAN

   The live camera surface is deliberately kept clear. Page thumbnails and the
   submit action live below it, not over the paper a student is trying to align.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect } from "react";
import { useScan } from "../scan/ScanProvider";
import { useIngestion } from "../data/useIngestion";
import { useApp } from "../data/AppProvider";
import PressBox from "../components/PressBox";
import { hapticTick, hapticFirm } from "../lib/haptics";
import "../styles/scanner.css";

export default function Scan() {
  const {
    videoRef, overlayRef, camera, hint, tray, trayHandlers, progress,
    resumable, draftsHandlers, onScreenVisible, shoot, setAutoCapture, auto,
    pendingCaptureCount,
  } = useScan();
  const { addPaper, addLink } = useIngestion();
  const { student } = useApp();

  useEffect(() => {
    document.documentElement.classList.add("scanner-active");
    onScreenVisible(true);
    return () => {
      document.documentElement.classList.remove("scanner-active");
      onScreenVisible(false);
    };
  }, [onScreenVisible]);

  // iOS Safari handles pinch through gesture events outside touch-action.
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    const listen = document.addEventListener.bind(document) as
      (t: string, l: EventListener, o?: AddEventListenerOptions) => void;
    const unlisten = document.removeEventListener.bind(document) as
      (t: string, l: EventListener) => void;
    const kinds = ["gesturestart", "gesturechange", "gestureend"];
    for (const kind of kinds) listen(kind, stop, { passive: false });
    return () => { for (const kind of kinds) unlisten(kind, stop); };
  }, []);

  const pendingPages = tray.filter((p) => p.pending).length;
  const unresolvedPages = tray.filter((p) =>
    p.retakeRequested || (p.quality?.verdict === "fail" && !p.quality.accepted));
  const warningPages = tray.filter((p) =>
    !p.pending && p.quality?.verdict === "warn").length;
  const firstRetake = unresolvedPages[0]?.page_number;
  const cannotSubmit = pendingCaptureCount > 0 || pendingPages > 0 || unresolvedPages.length > 0;

  return (
    <>
      <div
        className="scanhero"
        data-camera={camera.on ? "on" : "off"}
        data-phase={camera.on ? undefined : camera.phase}
      >
        <video id="scanVideo" ref={videoRef} autoPlay playsInline muted disablePictureInPicture />
        <canvas id="scanOverlay" ref={overlayRef} />
        <div className="feed"><div className="feedgrid" /></div>

        <div
          className="scanhint"
          role="status"
          aria-live="polite"
          data-blocking={hint.blocking ?? undefined}
        >
          {hint.hint}
        </div>

        <PressBox
          as="button"
          type="button"
          className={"autotoggle" + (auto ? " on" : "")}
          aria-pressed={auto}
          onClick={() => setAutoCapture(!auto)}
        >
          Auto <span className="dot" />
        </PressBox>

        <div className="scanctrls">
          <PressBox as="button" type="button" className="sidebtn" aria-label="Add a link"
                    onClick={addLink}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 13a4.5 4.5 0 0 0 6.4.4l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4l-1.5 1.5" />
              <path d="M14 11a4.5 4.5 0 0 0-6.4-.4L5 13.2a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5" />
            </svg>
          </PressBox>

          <PressBox as="button" type="button" className="shutter" aria-label="Take this page"
                    disabled={!camera.on || pendingCaptureCount > 0}
                    onClick={() => { hapticTick(); shoot(); }}>
            <div className="ring" />
          </PressBox>

          <PressBox as="button" type="button" className="sidebtn" aria-label="Upload from files"
                    onClick={addPaper}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 16V5M12 5 8 9M12 5l4 4" />
              <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
            </svg>
          </PressBox>
        </div>

        {resumable && (
          <div className="drafttoast" style={{ transform: "translateY(0)" }}>
            <div className="dh" />
            <div className="row2">
              <div className="ic">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 7v5l3.5 2" /><circle cx="12" cy="12" r="9" />
                </svg>
              </div>
              <div className="b">
                <div className="t1">Resume draft</div>
                <div className="t2">
                  {resumable.pages} page{resumable.pages === 1 ? "" : "s"} added · not sent yet
                </div>
              </div>
              <PressBox as="button" type="button" className="go"
                        onClick={() => draftsHandlers.onResume?.(resumable.id)}>
                Resume
              </PressBox>
            </div>
          </div>
        )}
      </div>

      {tray.length > 0 && (
        <section className="tray" aria-label="Scanned pages">
          <div className="trayscroll">
            {tray.map((p) => (
              <PressBox
                as="button"
                type="button"
                key={p.page_number}
                className="traypage"
                data-quality={p.quality?.verdict ?? "ok"}
                data-retake={p.retakeRequested ? "true" : undefined}
                aria-label={`Page ${p.page_number}${p.retakeRequested ? ", retake requested" : ""}`}
                onClick={() => { hapticTick(); trayHandlers.onPage?.(p.page_number); }}
              >
                {p.thumb && <img src={p.thumb} alt="" />}
                <span className="n">{p.page_number}</span>
                {p.pending && <span className="pending">Preparing…</span>}
                {p.retakeRequested && <span className="retakebadge">Retake</span>}
                <span className="flag">
                  <svg viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M6 2.5v4" /><path d="M6 9h.01" />
                  </svg>
                </span>
              </PressBox>
            ))}
          </div>
          <div className="traybar">
            <span className="cnt">
              {tray.length} page{tray.length === 1 ? "" : "s"}
              {pendingPages > 0
                ? ` · ${pendingPages} preparing`
                : unresolvedPages.length > 0
                  ? ` · ${unresolvedPages.length} needs retake`
                  : warningPages > 0
                    ? ` · ${warningPages} quality note${warningPages === 1 ? "" : "s"}`
                    : ""}
            </span>
            <PressBox
              as="button"
              type="button"
              className="btn primary"
              disabled={cannotSubmit}
              onClick={() => { hapticFirm(); trayHandlers.onDone?.(); }}
            >
              {firstRetake ? `Retake page ${firstRetake} first` : "Read this paper"}
            </PressBox>
          </div>
        </section>
      )}

      {progress && (
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
      )}

      {!student && (
        <div className="subnote">Create a student profile before scanning.</div>
      )}
    </>
  );
}
