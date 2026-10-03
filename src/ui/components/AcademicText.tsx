import MathText from "./MathText";
import { academicBlocks } from "../data/academicContent";
import "./AcademicText.css";

function CellText({ text }: { text: string }) {
  // A cell containing only a fraction has no prose to disambiguate. Wrap it
  // for the existing math renderer without changing numerator/denominator.
  const fraction = text.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  return <MathText text={fraction ? "\\(\\frac{" + fraction[1] + "}{" + fraction[2] + "}\\)" : text} />;
}

/** Shared block renderer. Persistence/editing keep the original canonical text. */
export default function AcademicText({ text, className = "" }: {
  text: string | null | undefined;
  className?: string;
}) {
  if (!text) return null;
  const blocks = academicBlocks(text);
  if (!blocks.some(block => block.kind === "table")) return <MathText text={text} className={className} />;
  return (
    <div className={["academic-content", className].filter(Boolean).join(" ")}>
      {blocks.map((block, index) => block.kind === "text"
        ? <div key={index}><MathText text={block.text} /></div>
        : (
          <div key={index} className="academic-table-scroll" role="region" aria-label="Transcribed table" tabIndex={0}>
            <table className="academic-table">
              {block.header && (
                <thead><tr>{block.rows[0].map((cell, column) => (
                  <th key={column} scope="col"><CellText text={cell} /></th>
                ))}</tr></thead>
              )}
              <tbody>{(block.header ? block.rows.slice(1) : block.rows).map((row, rowIndex) => (
                <tr key={rowIndex}>{row.map((cell, column) => block.rowHeaders && column === 0
                  ? <th key={column} scope="row"><CellText text={cell} /></th>
                  : block.rowHeaders && rowIndex === 0
                    ? <th key={column} scope="col"><CellText text={cell} /></th>
                    : <td key={column}><CellText text={cell} /></td>,
                )}</tr>
              ))}</tbody>
            </table>
          </div>
        ),
      )}
    </div>
  );
}
