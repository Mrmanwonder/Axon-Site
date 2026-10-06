/* ═══════════════════════════════════════════════════════════════════════════
   SYLLABUS RADAR — one spoke per syllabus unit.

   Each unit's wedge is shaded like the heatmap (darker = a larger share of
   its placed marks lost) and its point sits further from the centre the
   more it lost. Never a percentage on screen; rings are unlabelled.

   Honesty rules, all visible in the drawing:
   · A unit with no placed question has a dashed spoke and NO point. It is
     never drawn at the centre, because the centre means "nothing lost".
   · Below the subject's shading threshold no values are drawn at all; tested
     units are marked on the rim and the caption says why.
   · Confidence is form: an early unit (few questions or one paper) is a
     hollow point; a unit with evidence is solid. Survives greyscale.
   · Lines join neighbouring tested units only; a gap stays a gap.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useId } from "react";
import { levelFor, type UnitRow } from "../data/syllabusMap";

const SIZE = 320;
const C = SIZE / 2;
const R = 116;
const RINGS = [0.25, 0.5, 0.75, 1];

function at(i: number, n: number, r: number) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a), a };
}

const share = (u: UnitRow) => (u.available > 0 ? Math.min(1, Math.max(0, u.lost / u.available)) : null);

export function unitSummary(u: UnitRow, ready: boolean): string {
  if (u.state === "untested") return "Not tested yet";
  const sample = `${u.questions} ${u.questions === 1 ? "question" : "questions"} · ${u.papers} ${u.papers === 1 ? "paper" : "papers"}`;
  if (!ready) return `Tested · ${sample}`;
  return `${fmt(u.lost)} of ${fmt(u.available)} marks lost · ${sample}${u.state === "early" ? " · early evidence" : ""}`;
}
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function SyllabusRadar({ units, ready, selected, onSelect, label }: {
  units: UnitRow[]; ready: boolean; selected: string | null; onSelect: (unitId: string) => void; label: string;
}) {
  const id = useId();
  const n = units.length;
  if (n < 3) return null;
  const pts = units.map((u, i) => {
    const s = ready && u.state !== "untested" ? share(u) : null;
    // A tested unit with nothing lost still gets a visible point just off the centre.
    return { u, i, s, p: s === null ? null : at(i, n, Math.max(6, s * R)) };
  });
  const segments: string[] = [];
  for (let k = 0; k < n; k++) {
    const a = pts[k], b = pts[(k + 1) % n];
    if (a.p && b.p) segments.push(`M${a.p.x.toFixed(1)} ${a.p.y.toFixed(1)}L${b.p.x.toFixed(1)} ${b.p.y.toFixed(1)}`);
  }
  const closed = pts.every((x) => x.p);
  const labelSize = n > 24 ? 9.5 : n > 14 ? 10.5 : 11.5;

  return (
    <div className="radar">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="group" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>{label}</title>
        {/* Sectors: the heatmap. A tested unit's wedge is shaded by the share of its
            marks lost (darker = more lost); before shading starts it takes the light
            "tested" wash; an untested wedge stays empty. */}
        {pts.map(({ u, i }) => {
          if (u.state === "untested") return null;
          // The wedge stays inside the web: centre, the midpoint of the edge before,
          // the unit's own vertex, the midpoint of the edge after.
          const v = at(i, n, R), prev = at(i - 1, n, R), next = at(i + 1, n, R);
          const m0 = { x: (prev.x + v.x) / 2, y: (prev.y + v.y) / 2 }, m1 = { x: (next.x + v.x) / 2, y: (next.y + v.y) / 2 };
          const cls = ready && u.available > 0 ? `rsector heatfill l${levelFor(u.lost, u.available)}` : "rsector tested";
          return <path key={u.id} className={`${cls}${u.state === "early" ? " early" : ""}`}
            d={`M${C} ${C}L${m0.x.toFixed(1)} ${m0.y.toFixed(1)}L${v.x.toFixed(1)} ${v.y.toFixed(1)}L${m1.x.toFixed(1)} ${m1.y.toFixed(1)}Z`} />;
        })}
        {/* The web: rings as polygons, unlabelled. */}
        {RINGS.map((f) => (
          <polygon key={f} className="rring" points={units.map((_, i) => { const q = at(i, n, f * R); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(" ")} />
        ))}
        {pts.map(({ u, i }) => {
          const end = at(i, n, R);
          return <line key={u.id} className={`rspoke${u.state === "untested" ? " untested" : ""}${u.id === selected ? " on" : ""}`} x1={C} y1={C} x2={end.x} y2={end.y} />;
        })}
        {closed && <polygon className="rarea" points={pts.map((x) => `${x.p!.x.toFixed(1)},${x.p!.y.toFixed(1)}`).join(" ")} />}
        {segments.length > 0 && <path className="rline" d={segments.join("")} />}
        {/* Below the threshold: tested units are marked on the rim, never given a value. */}
        {!ready && pts.map(({ u, i }) => {
          if (u.state === "untested") return null;
          const q = at(i, n, R);
          return <circle key={u.id} className="rtested" cx={q.x} cy={q.y} r={4} />;
        })}
        {pts.map(({ u, p }) => p && (
          <circle key={u.id} className={`rpoint ${u.state}${u.id === selected ? " on" : ""}`} cx={p.x} cy={p.y} r={u.id === selected ? 5.5 : 4.5} />
        ))}
        {pts.map(({ u, i }) => {
          const q = at(i, n, R + 15);
          const anchor = Math.abs(Math.cos(q.a)) < 0.2 ? "middle" : Math.cos(q.a) > 0 ? "start" : "end";
          return (
            <text key={u.id} className={`rlabel${u.id === selected ? " on" : ""}${u.state === "untested" ? " untested" : ""}`}
              x={q.x} y={q.y} dy="0.35em" textAnchor={anchor} style={{ fontSize: labelSize }}>{u.code}</text>
          );
        })}
        {/* Hit areas: a wedge per unit, larger than any mark. */}
        {pts.map(({ u, i }) => {
          const a0 = at(i - 0.5, n, R + 26), a1 = at(i + 0.5, n, R + 26);
          return (
            <path key={u.id} className="rhit" d={`M${C} ${C}L${a0.x.toFixed(1)} ${a0.y.toFixed(1)}A${R + 26} ${R + 26} 0 0 1 ${a1.x.toFixed(1)} ${a1.y.toFixed(1)}Z`}
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
