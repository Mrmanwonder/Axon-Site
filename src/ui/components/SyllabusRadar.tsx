/* ═══════════════════════════════════════════════════════════════════════════
   SYLLABUS RADAR — a spider-web chart, one spoke per syllabus unit.

   The classic form: a web of rings, a spoke per unit named at its tip, and
   one filled shape joining the student's points. Further from the centre = a
   larger share of that unit's placed marks lost (more lost reads as more,
   like the heatmap). Never a percentage on screen; rings are unlabelled.

   Honesty rules, all visible in the drawing:
   · A unit with no placed question has a dashed spoke, a muted name and NO
     point. The shape joins the tested units only; it never drops an untested
     unit to the centre, because the centre means "nothing lost".
   · Below the subject's shading threshold no values are drawn; tested units
     are marked on the rim and the caption says why.
   · Confidence is form: an early unit (few questions or one paper) is a
     hollow point; a unit with evidence is solid. Survives greyscale.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useId } from "react";
import type { UnitRow } from "../data/syllabusMap";

const W = 400;
const H = 370;
const CX = W / 2;
const CY = H / 2;
const R = 122;
const RINGS = [0.2, 0.4, 0.6, 0.8, 1];

function at(i: number, n: number, r: number) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a), a };
}

const share = (u: UnitRow) => (u.available > 0 ? Math.min(1, Math.max(0, u.lost / u.available)) : null);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function unitSummary(u: UnitRow, ready: boolean): string {
  if (u.state === "untested") return "Not tested yet";
  const sample = `${u.questions} ${u.questions === 1 ? "question" : "questions"} · ${u.papers} ${u.papers === 1 ? "paper" : "papers"}`;
  if (!ready) return `Tested · ${sample}`;
  return `${fmt(u.lost)} of ${fmt(u.available)} marks lost · ${sample}${u.state === "early" ? " · early evidence" : ""}`;
}

/** A unit's name as at most two short lines; long names end in an ellipsis. */
export function nameLines(title: string, width: number): string[] {
  const words = title.replace(/\s*\((AS|A) Level\)\s*$/, "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  let used = 0;
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= width || !cur) { cur = next; used += 1; continue; }
    lines.push(cur);
    if (lines.length === 2) { cur = ""; break; }
    cur = w; used += 1;
  }
  if (cur && lines.length < 2) lines.push(cur);
  if (used < words.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/[,;:]$/, "") + "…";
  return lines;
}

export default function SyllabusRadar({ units, ready, selected, onSelect, label }: {
  units: UnitRow[]; ready: boolean; selected: string | null; onSelect: (unitId: string) => void; label: string;
}) {
  const id = useId();
  const n = units.length;
  if (n < 3) return null;
  const pts = units.map((u, i) => {
    const s = ready && u.state !== "untested" ? share(u) : null;
    // A tested unit with nothing lost still gets a visible point just off the centre.
    return { u, i, p: s === null ? null : at(i, n, Math.max(5, s * R)) };
  });
  const plotted = pts.filter((x) => x.p);
  const shape = plotted.map((x) => `${x.p!.x.toFixed(1)},${x.p!.y.toFixed(1)}`).join(" ");
  // Names fit at the tips of up to ten spokes; beyond that the unit code stands in.
  const named = n <= 10;
  const width = n <= 6 ? 14 : 11;
  const lh = 15;

  return (
    <div className="radar">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{label}</title>
        {RINGS.map((f) => (
          <polygon key={f} className="rring" points={units.map((_, i) => { const q = at(i, n, f * R); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(" ")} />
        ))}
        {pts.map(({ u, i }) => {
          const end = at(i, n, R);
          return <line key={u.id} className={`rspoke${u.state === "untested" ? " untested" : ""}`} x1={CX} y1={CY} x2={end.x} y2={end.y} />;
        })}
        {plotted.length >= 3 && <polygon className="rarea" points={shape} />}
        {plotted.length === 2 && <polyline className="rline" points={shape} />}
        {/* Below the threshold: tested units are marked on the rim, never given a value. */}
        {!ready && pts.map(({ u, i }) => {
          if (u.state === "untested") return null;
          const q = at(i, n, R);
          return <circle key={u.id} className="rtested" cx={q.x} cy={q.y} r={4.5} />;
        })}
        {plotted.map(({ u, p }) => (
          <circle key={u.id} className={`rpoint ${u.state}${u.id === selected ? " on" : ""}`} cx={p!.x} cy={p!.y} r={u.id === selected ? 6 : 4.5} />
        ))}
        {pts.map(({ u, i }) => {
          const q = at(i, n, R + 14);
          const cos = Math.cos(q.a), sin = Math.sin(q.a);
          const anchor = Math.abs(cos) < 0.25 ? "middle" : cos > 0 ? "start" : "end";
          const lines = named ? nameLines(u.title, width) : [u.code];
          // Lines grow away from the web: upward above it, downward below it.
          const y0 = sin < -0.25 ? q.y - (lines.length - 1) * lh : sin > 0.25 ? q.y + 4 : q.y - ((lines.length - 1) * lh) / 2;
          return (
            <text key={u.id} className={`rlabel${u.id === selected ? " on" : ""}${u.state === "untested" ? " untested" : ""}`}
              y={y0} textAnchor={anchor} style={named ? undefined : { fontSize: n > 24 ? 11 : 12.5 }}>
              {lines.map((l, k) => <tspan key={k} x={q.x} dy={k === 0 ? "0.35em" : lh}>{l}</tspan>)}
            </text>
          );
        })}
        {/* Hit areas: a wedge per unit, larger than any mark. */}
        {pts.map(({ u, i }) => {
          const a0 = at(i - 0.5, n, R + 30), a1 = at(i + 0.5, n, R + 30);
          return (
            <path key={u.id} className="rhit" d={`M${CX} ${CY}L${a0.x.toFixed(1)} ${a0.y.toFixed(1)}A${R + 30} ${R + 30} 0 0 1 ${a1.x.toFixed(1)} ${a1.y.toFixed(1)}Z`}
              role="button" tabIndex={0} aria-pressed={u.id === selected}
              aria-label={`${u.code} ${u.title}: ${unitSummary(u, ready)}`}
              onClick={() => onSelect(u.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(u.id); } }} />
          );
        })}
      </svg>
    </div>
  );
}
