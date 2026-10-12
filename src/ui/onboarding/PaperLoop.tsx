import "../styles/onboarding-paper-loop.css";

/**
 * Welcome-screen loop (owner, 12 Oct 2026): marked papers drop into a loose
 * stack, Axon's "read" mark appears, the papers streak away and the stack
 * rebuilds.
 *
 * Schematic only. Printed lines, a handwritten answer and a teacher's tick
 * and circle. No numbers, grades or student content are drawn, and the
 * teacher's ink varies by sheet: a teacher's ink can be any colour.
 *
 * Motion is transform and opacity only, on the sheet curve, never a bounce.
 * The resting style is the settled stack, so reduced motion (system or the
 * in-app switch) and screenshots both show a complete, still picture.
 */
const SHEETS = [
  { x: "-17%", y: "-28%", r: "-7deg", ink: "#2f6fe4", exit: "-26px" },
  { x: "11%",  y: "-19%", r: "5deg",  ink: "#1f8f5f", exit: "18px" },
  { x: "-23%", y: "2%",   r: "-3deg", ink: "#7451db", exit: "-34px" },
  { x: "16%",  y: "9%",   r: "6deg",  ink: "#c23a7d", exit: "30px" },
  { x: "-3%",  y: "21%",  r: "-1.5deg", ink: "#2c313b", exit: "-6px" },
] as const;

function Sheet({ index, x, y, r, ink, exit }: (typeof SHEETS)[number] & { index: number }) {
  // Vary the printed lines so the stack does not read as one sheet repeated.
  const lines = [[88, 72, 80], [76, 90, 64], [84, 68, 92], [70, 86, 78], [90, 74, 60]][index];
  return (
    <div className="ob-loop-sheet"
         style={{ "--i": index, "--x": x, "--y": y, "--r": r, "--ink": ink, "--exit": exit } as React.CSSProperties}>
      <span className="ob-loop-head" />
      {lines.map((w, k) => <span key={k} className="ob-loop-line" style={{ width: `${w}%` }} />)}
      <svg className="ob-loop-work" viewBox="0 0 100 46" fill="none" preserveAspectRatio="none">
        {/* The student's answer, in pencil. */}
        <path className="ob-loop-hand"
              d="M4 12c6-5 10 4 16-1s9-4 14 0 8-4 13-1 9 3 14-1 10 1 15-1" />
        <path className="ob-loop-hand"
              d="M4 27c5-4 11 3 17-1s8-3 13 1 9-3 15 0 7 2 12-1" />
        {/* The teacher's tick and circle, in that sheet's ink. */}
        <path className="ob-loop-ink" d="M77 25l5 6 10-14" />
        <ellipse className="ob-loop-ink" cx="27" cy="40" rx="15" ry="5" transform="rotate(-4 27 40)" />
      </svg>
      <span className="ob-loop-line ob-loop-line-short" />
    </div>
  );
}

export default function PaperLoop() {
  return (
    <div className="ob-loop" aria-hidden="true">
      <div className="ob-loop-glow" />
      {SHEETS.map((s, i) => <Sheet key={i} index={i} {...s} />)}
      <span className="ob-loop-read">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="m6.5 12.5 3.5 3.5 7.5-8" stroke="currentColor" strokeWidth="2.1"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}
