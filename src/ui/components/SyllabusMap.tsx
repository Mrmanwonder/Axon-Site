/* The syllabus map: one subject's published topic tree, shaded by the share
   of marks lost on questions placed on each topic. See syllabusMap.ts for the
   rules; this file only draws them.

   A cell is a button. Choosing one opens its detail below the grid: the marks,
   the board's own learning objectives (verbatim), and the questions behind it,
   each linking to the question. Shade is never the only signal: every cell
   carries its counts in its accessible name and in the detail. */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppDropdown from "./AppDropdown";
import PressBox from "./PressBox";
import { paths } from "../app/paths";
import { numMark } from "../data/causes";
import { PATTERN_PAPERS, type QuestionRef } from "../data/insights";
import { scopeLabel, type SubjectMap, type SyllabusMaps, type TopicCell } from "../data/syllabusMap";

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

function cellLabel(c: TopicCell, ready: boolean): string {
  if (c.state === "untested") return `${c.code} ${c.title}: not tested yet`;
  const counts = `${numMark(c.lost)} of ${numMark(c.available)} marks lost, ${plural(c.questions, "question")}, ${plural(c.papers, "paper")}`;
  return `${c.code} ${c.title}: ${counts}${c.state === "early" ? ", early evidence" : ""}${ready ? "" : ", not shaded yet"}`;
}

function Legend({ ready }: { ready: boolean }) {
  return (
    <div className="heatlegend" aria-hidden="true">
      {ready && <span className="ramp"><span>Fewer marks lost</span>{[0, 1, 2, 3, 4].map((l) => <i key={l} className={`heat l${l}`} />)}<span>More</span></span>}
      <span className="key"><i className="heat early" />Early evidence</span>
      <span className="key"><i className="heat untested" />Not tested yet</span>
    </div>
  );
}

function Detail({ cell, map, describe }: { cell: TopicCell; map: SubjectMap; describe: (r: QuestionRef) => string }) {
  const groups = useMemo(() => {
    const out: { group: string | null; items: TopicCell["objectives"] }[] = [];
    for (const o of cell.objectives) {
      const last = out[out.length - 1];
      if (last && last.group === o.group) last.items.push(o); else out.push({ group: o.group, items: [o] });
    }
    return out;
  }, [cell]);
  return (
    <div className="heatdetail" aria-live="polite">
      <div className="hdtop">
        <div><div className="code">{cell.code}{scopeLabel(cell.scope) ? ` · ${scopeLabel(cell.scope)}` : ""}</div><h3>{cell.title}</h3></div>
        {cell.state !== "untested" && <div className="v">{numMark(cell.lost)} of {numMark(cell.available)}<small>marks lost</small></div>}
      </div>
      <p className="meta">
        {cell.state === "untested"
          ? "No question you have scanned has been placed on this topic yet. Untested is not the same as weak."
          : `${plural(cell.questions, "question")} · ${plural(cell.papers, "paper")}${cell.state === "early" ? " · early evidence, read it lightly" : ""}`}
      </p>
      <div className="objlabel">What the syllabus asks for</div>
      {groups.map((g, i) => (
        <div key={i}>
          {g.group && <div className="objgroup">{g.group}</div>}
          <ol className="objlist">
            {g.items.map((o) => (
              <li key={o.id} className={o.questions ? "hit" : ""}>
                <span className="oc">{o.code}</span>
                <span className="ot">{o.text}{o.notes && <span className="on">{o.notes}</span>}</span>
                {o.questions > 0 && <span className="oq">{plural(o.questions, "question")}</span>}
              </li>
            ))}
          </ol>
        </div>
      ))}
      {cell.refs.length > 0 && <>
        <div className="objlabel">Your questions on this topic</div>
        <ul className="evlist">
          {cell.refs.map((r) => (
            <li key={r.attemptId}>
              <PressBox as={Link} to={paths.question(r.paperId, r.attemptId)} className="evrow" data-interactive="">
                <span className="q">{r.label}</span>
                <span className="p">{describe(r)}</span>
                <span className="m">{numMark(r.marks)}<small>lost</small></span>
              </PressBox>
            </li>
          ))}
        </ul>
      </>}
      <p className="widgetnote">
        Objectives quoted from the {map.document.title} {map.document.syllabus_code} syllabus ({map.document.version_label}).{" "}
        <a href={map.document.source_url} target="_blank" rel="noreferrer">Source</a>
      </p>
    </div>
  );
}

export default function SyllabusMap({ data, describe, initialSubject }: {
  data: SyllabusMaps; describe: (r: QuestionRef) => string; initialSubject?: string | null;
}) {
  const [offering, setOffering] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const map = data.maps.find((m) => m.offeringId === offering)
    ?? data.maps.find((m) => m.label === initialSubject)
    ?? data.maps[0];
  if (!map) return null;
  const cell = map.units.flatMap((u) => u.cells).find((c) => c.id === selected) ?? null;

  return (
    <div className="card heatcard">
      <div className="heathead">
        {data.maps.length > 1
          ? <AppDropdown ariaLabel="Syllabus map subject" value={map.offeringId}
              options={data.maps.map((m) => ({ value: m.offeringId, label: `${m.label} · ${m.document.syllabus_code}` }))}
              onChange={(v) => { setOffering(v); setSelected(null); }} selected />
          : <span className="subj">{map.label} · {map.document.syllabus_code}</span>}
        <span className="cov">{map.topicsTested} of {map.topicsTotal} topics tested</span>
      </div>
      {!map.shadingReady && (
        <p className="lede">
          {map.papersPlaced === 0
            ? `None of your ${map.label} questions have been placed on the syllabus yet.`
            : `Shading starts once ${PATTERN_PAPERS} ${map.label} papers are on the syllabus; ${map.papersPlaced} ${map.papersPlaced === 1 ? "is" : "are"} so far. Until then the map shows which topics you have been tested on.`}
        </p>
      )}
      <Legend ready={map.shadingReady} />
      {map.units.map((u) => (
        <section className="heatunit" key={u.id} aria-label={`${u.code} ${u.title}`}>
          <div className="uname"><span>{u.code}</span>{u.title}{scopeLabel(u.scope) ? <em>{scopeLabel(u.scope)}</em> : null}</div>
          <div className="heatgrid">
            {u.cells.map((c) => (
              <button key={c.id} type="button"
                className={`heatcell heat ${c.state}${c.level !== null && c.state !== "untested" ? ` l${c.level}` : ""}${c.id === selected ? " on" : ""}`}
                aria-pressed={c.id === selected} aria-label={cellLabel(c, map.shadingReady)} title={cellLabel(c, map.shadingReady)}
                onClick={() => setSelected(c.id === selected ? null : c.id)}>
                <span className="cc">{c.code}</span>
                <span className="ct">{c.title}</span>
                {c.state !== "untested" && <span className="cq">{c.questions}</span>}
              </button>
            ))}
          </div>
          {cell && u.cells.some((c) => c.id === cell.id) && <Detail cell={cell} map={map} describe={describe} />}
        </section>
      ))}
      <p className="widgetnote">
        Each topic is shaded by the share of its marks you lost, across {plural(map.questionsPlaced, "question")} in {plural(map.papersPlaced, "paper")}.
        {map.questionsUnplaced > 0 ? ` ${plural(map.questionsUnplaced, "question")} in ${map.label} ${map.questionsUnplaced === 1 ? "is" : "are"} not on the map yet: still being placed, or not clearly on one topic.` : ""}
        {" "}Topics come from the board&rsquo;s published syllabus; which topic a question tests is worked out by Axon, and marks are your teacher&rsquo;s.
      </p>
    </div>
  );
}
