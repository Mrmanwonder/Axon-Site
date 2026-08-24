/* ═══════════════════════════════════════════════════════════════════════════
   SCAN

   The viewfinder, the tray and the progress panel. Capture flow, so it gets
   zero decorative motion — nothing here animates that is not reporting a real
   change of state.

   Two things the surface is careful about:

   · **There are no fixed corner brackets.** There used to be, inset at 9% and
     12%, and they looked exactly like the detector's output while tracking
     nothing at all — so a viewfinder that had not started yet read as one whose
     page detection was wildly wrong. The only brackets drawn are the ones on a
     page actually found, and the detector draws those into the overlay canvas.

   · **Progress names the step, never a bar.** Nobody knows how long a paper
     takes, and a bar over work of unknown length is a confident lie about it.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect } from "react";
import { useScan } from "../scan/ScanProvider";
import { useIngestion } from "../data/useIngestion";
import { useApp } from "../data/AppProvider";
import PressBox from "../components/PressBox";
import { hapticTick, hapticFirm } from "../lib/haptics";

export default function Scan() {
  const {
    videoRef, overlayRef, camera, hint, tray, trayHandlers, progress,
    resumable, draftsHandlers, onScreenVisible, shoot, setAutoCapture, auto,
  } = useScan();
  const { addPaper, addLink } = useIngestion();
  const { student } = useApp();

  // Entry and exit both matter: leaving the screen must stop the camera, or it
  // keeps the device's light on behind a screen that is no longer showing it.
  useEffect(() => {
    onScreenVisible(true);
    return () => onScreenVisible(false);
  }, [onScreenVisible]);

  const badPages = tray.filter((p) => p.quality && p.quality.verdict !== "ok").length;

  return (
    <>
      <div
        className="scanhero"
        data-camera={camera.on ? "on" : "off"}
        data-phase={camera.on ? undefined : camera.phase}
      >
        {/* The ids are load-bearing, not legacy: system.css addresses the video
            and the overlay by id to size them to the hero and to hide both while
            the camera is off. Without them the video renders at its natural
            size in the corner of a full-bleed viewfinder. */}
        <video id="scanVideo" ref={videoRef} playsInline muted />
        <canvas id="scanOverlay" ref={overlayRef} />

        <div className="feed"><div className="feedgrid" /></div>

        <div className="scanhint" role="status" aria-live="polite"
             data-blocking={hint.blocking ?? undefined}>
          {hint.hint}
        </div>

        {/* Auto-capture assists; it never blocks. The shutter always fires. */}
        <PressBox
          as="button" type="button"
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
                    disabled={!camera.on}
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

        {/* An interrupted booklet is offered back rather than silently kept. */}
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

      {/* Pages accumulate here, reorderable and individually retakeable. A page
          that failed its quality gate is flagged now, while the paper is still
          in front of the student — the same flag at review usually means the
          page is simply lost. */}
      {tray.length > 0 && (
        <div className="tray">
          <div className="trayscroll">
            {tray.map((p) => (
              <PressBox
                as="button" type="button"
                key={p.page_number}
                className="traypage"
                data-quality={p.quality?.verdict ?? "ok"}
                aria-label={`Page ${p.page_number}`}
                onClick={() => { hapticTick(); trayHandlers.onPage?.(p.page_number); }}
              >
                {p.thumb && <img src={p.thumb} alt="" />}
                <span className="n">{p.page_number}</span>
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
              {badPages ? ` · ${badPages} worth retaking` : ""}
            </span>
            <PressBox as="button" type="button" className="btn primary"
                      onClick={() => { hapticFirm(); trayHandlers.onDone?.(); }}>
              Read this paper
            </PressBox>
          </div>
        </div>
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
