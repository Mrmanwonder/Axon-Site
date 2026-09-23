/* ═══════════════════════════════════════════════════════════════════════════
   WHAT AXON READ — the transcription, with its structure intact.

   The heading used to say YOUR ANSWER. What follows it is a machine
   transcription which the live data shows contains fabricated characters and
   destroyed operators: handwritten `8/2` stored as `8+1`, `3/16 × 2⁵` stored as
   `3/16 | 2^5`. That heading asserted a fidelity the system does not have.

   The crop directly above *is* the student's answer, losslessly, in their own
   hand. So the crop is the authority and this block is what we made of it —
   which is what the name now says. It costs nothing and removes an entire class
   of complaint permanently.

   KaTeX is bundled rather than loaded from a CDN: a flash of unstyled maths on
   a student's own answer looks broken, and a CDN dependency breaks the offline
   reading this app promises. Its settings are hardened because the LaTeX is
   model-generated and therefore untrusted input — see `render` below.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import type { AnswerBlock as Block, Segment } from "../data/modules";
import MathText, { SafeLatex } from "./MathText";

/* All mathematical text, including structured OCR segments, goes through
 * MathText's one hardened KaTeX boundary. Keeping one renderer matters here:
 * model explanations and the student's transcription must refuse the same
 * unsafe commands and fail in the same quiet way. */
const ANNOTATION_CLASS: Record<string, string> = {
  struck_through: "an-struck",
  boxed: "an-boxed",
  circled: "an-circled",
  underlined: "an-underlined",
  inserted: "an-inserted",
  overwritten: "an-overwritten",
};

function SegmentView({
  seg, onPick, picked,
}: { seg: Segment; onPick: (s: Segment) => void; picked: boolean }) {
  const cls = ["seg", ...seg.annotations.map((a) => ANNOTATION_CLASS[a]).filter(Boolean)];
  if (picked) cls.push("picked");
  // Below this the transcription is uncertain enough to say so inline, rather
  // than discrediting the whole answer with one badge at the top.
  const unsure = typeof seg.confidence === "number" && seg.confidence < 0.6;
  if (unsure) cls.push("seg-unsure");

  const body = (() => {
    if (seg.latex) {
      return <SafeLatex latex={seg.latex} fallback={seg.text ?? seg.latex} className="seg-latex" />;
    }
    return <MathText text={seg.text} />;
  })();

  // Only a segment that knows where it came from is tappable — otherwise the
  // tap would promise a highlight it cannot deliver.
  if (!seg.bbox) return <span className={cls.join(" ")}>{body}</span>;
  return (
    <button
      type="button"
      className={cls.join(" ")}
      aria-pressed={picked}
      aria-label={seg.text ?? seg.latex ?? undefined}
      aria-description="Show this part in your handwriting"
      onClick={() => onPick(seg)}
    >
      {body}
    </button>
  );
}

export default function AnswerBlockView({
  block, rawText, recognition, onPick,
}: {
  block: Block | null;
  rawText: string | null;
  /** From `confidence_signals.recognition`. Three-valued: the string "unknown" is real. */
  recognition: boolean | "unknown" | null;
  /** Tapping a segment highlights its box in the crop above. */
  onPick?: (seg: Segment | null) => void;
}) {
  const [picked, setPicked] = useState<Segment | null>(null);

  const pick = (s: Segment) => {
    const next = picked === s ? null : s;
    setPicked(next);
    onPick?.(next);
  };

  const lines = useMemo(() => block?.lines ?? [], [block]);

  return (
    <div className="qfield">
      <div className="k">What Axon read</div>

      {/* Where the handwriting could not be read, that is said at the top of the
          block rather than left for the student to infer from odd-looking text.
          The crop above is unaffected and remains the authority. */}
      {recognition === false && (
        <div className="subnote" style={{ marginBottom: 8 }}>
          Axon struggled with this handwriting. Read the crop above as the real answer — this is
          only our best attempt at it.
        </div>
      )}
      {recognition === "unknown" && (
        <div className="subnote" style={{ marginBottom: 8 }}>
          Axon didn&rsquo;t check how well it read this one. The crop above is your actual answer.
        </div>
      )}

      {lines.length ? (
        <div className="answerblock">
          {lines.map((line, i) => (
            <div key={i} className={"aline role-" + line.role}>
              {line.segments.map((seg, j) => (
                <SegmentView key={j} seg={seg} onPick={pick} picked={picked === seg} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        /* No structured block yet — every row written before the extraction
           stage produced one. The raw text is what exists, shown as steps so at
           least the student's line breaks survive. */
        <div className={"v" + (rawText ? " steps" : " empty")}>
          {rawText ? <MathText text={rawText} /> : "Not read"}
        </div>
      )}

      {picked && (
        <div className="subnote" style={{ marginTop: 7 }}>
          Highlighted above. Tap again to clear.
        </div>
      )}
    </div>
  );
}
