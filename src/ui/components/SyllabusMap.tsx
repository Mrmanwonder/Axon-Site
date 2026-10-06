/* The syllabus map. On Insights: one subject's units on a radar, with the
   chosen unit's marks and an "In detail" link. On the detail page: every
   unit, a tile per topic shaded by the share of marks lost, and every topic's
   board objectives (verbatim) and the questions behind it.
   See syllabusMap.ts for the rules; this file only draws them. Shade is never
   the only signal: every mark carries its counts in its accessible name. */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppDropdown from "./AppDropdown";
import PressBox from "./PressBox";
import { paths } from "../app/paths";
import { numMark } from "../data/causes";
import { PATTERN_PAPERS, type QuestionRef } from "../data/insights";
import SyllabusRadar, { unitSummary } from "./SyllabusRadar";
import { scopeLabel, type SubjectMap, type SyllabusMaps, type TopicCell } from "../data/syllabusMap";

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

function cellLabel(c: TopicCell, ready: boolean): string {
  if (c.state === "untested") return `${c.code} ${c.title}: not tested yet`;
  const counts = `${numMark(c.lost)} of ${numMark(c.available)} marks lost, ${plural(c.questions, "question")}, ${plural(c.papers, "paper")}`;
  return `${c.code} ${c.title}: ${counts}${c.state === "early" ? ", early evidence" : ""}${ready ? "" : ", not shaded yet"}`;
}

export function Legend({ ready }: { ready: boolean }) {
  return (
    <div className="heatlegend" aria-hidden="true">
      {ready && <span className="ramp"><span>Fewer marks lost</span>{[0, 1, 2, 3, 4].map((l) => <i key={l} className={`heat l${l}`} />)}<span>More</span></span>}
      <span className="key"><i className="heat early" />{ready ? "Early evidence" : "Tested"}</span>
      <span className="key"><i className="heat untested" />Not tested yet</span>
    </div>
  );
}

export function Detail({ cell, map, describe, showSource = true }: { cell: TopicCell; map: SubjectMap; describe: (r: QuestionRef) => string; showSource?: boolean }) {
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
      {showSource && <p className="widgetnote">
        Objectives quoted from the {map.document.title} {map.document.syllabus_code} syllabus ({map.document.version_label}).{" "}
        <a href={map.document.source_url} target="_blank" rel="noreferrer">Source</a>
      </p>}
    </div>
  );
}

/** The Insights card: one subject's units on a radar, the chosen unit's
    numbers, and the way into the full syllabus. */
export default function SyllabusMap({ data, initialSubject }: {
  data: SyllabusMaps; initialSubject?: string | null;
}) {
  const [offering, setOffering] = useState<string | null>(null);
  const map = data.maps.find((m) => m.offeringId === offering)
    ?? data.maps.find((m) => m.label === initialSubject)
    ?? data.maps[0];
  const firstPick = useMemo(() => {
    if (!map?.shadingReady) return null;
    const tested = map.units.filter((u) => u.state !== "untested" && u.available > 0);
    return tested.sort((a, b) => b.lost / b.available - a.lost / a.available || b.questions - a.questions)[0]?.id ?? null;
  }, [map]);
  const [picked, setPicked] = useState<string | null>(null);
  if (!map) return null;
  const selectedId = picked && map.units.some((u) => u.id === picked) ? picked : firstPick;
  const unit = map.units.find((u) => u.id === selectedId) ?? null;
  const tested = map.units.filter((u) => u.state !== "untested").length;

  return (
    <div className="card heatcard">
      <div className="heathead">
        {data.maps.length > 1
          ? <AppDropdown ariaLabel="Syllabus map subject" value={map.offeringId}
              options={data.maps.map((m) => ({ value: m.offeringId, label: `${m.label} · ${m.document.syllabus_code}` }))}
              onChange={(v) => { setOffering(v); setPicked(null); }} selected />
          : <span className="subj">{map.label} · {map.document.syllabus_code}</span>}
        <span className="cov">{tested} of {map.units.length} units tested</span>
      </div>
      <p className="lede">
        {map.shadingReady
          ? "Each spoke is a syllabus unit. The further out your shape reaches, the more of that unit’s marks you lost."
          : map.papersPlaced === 0
            ? `None of your ${map.label} questions have been placed on the syllabus yet.`
            : `Marks lost by unit appear at ${PATTERN_PAPERS} ${map.label} papers (${map.papersPlaced} so far). For now, the web marks the units you have been tested on.`}
      </p>
      {map.units.length >= 3
        ? <SyllabusRadar units={map.units} ready={map.shadingReady} selected={selectedId}
            onSelect={(id) => setPicked(id === selectedId ? null : id)}
            label={`${map.label}: marks lost by syllabus unit`} />
        : null}
      <div className="radarlegend" aria-hidden="true">
        {!map.shadingReady && <span className="key"><i className="rk tested" />Tested</span>}
        <span className="key"><i className="rk dashed" />Not tested yet</span>
      </div>
      <div className="radarpick" aria-live="polite">
        {unit
          ? <><div className="rpname"><span>{unit.code}</span>{unit.title}</div><div className="rpmeta">{unitSummary(unit, map.shadingReady)}</div></>
          : <div className="rpmeta">Tap a unit to see its marks.</div>}
      </div>
      <PressBox as={Link} to={paths.syllabus(map.offeringId)} className="btn ghost indetail">In detail</PressBox>
      <p className="widgetnote">
        Placed so far: {plural(map.questionsPlaced, "question")} in {plural(map.papersPlaced, "paper")}.
        {map.questionsUnplaced > 0 ? ` ${plural(map.questionsUnplaced, "question")} in ${map.label} ${map.questionsUnplaced === 1 ? "is" : "are"} not on the syllabus yet.` : ""}
        {" "}Units come from the board&rsquo;s published syllabus; which unit a question tests is worked out by Axon, and marks are your teacher&rsquo;s.
      </p>
    </div>
  );
}

/** Every unit of one subject in full: unit totals, a tile per topic, and every
    topic's objectives and questions. The detail page. */
export function SyllabusUnits({ map, describe }: { map: SubjectMap; describe: (r: QuestionRef) => string }) {
  return <>
    {map.units.map((u) => (
      <section className="card sunit" key={u.id} id={`unit-${u.code}`} aria-label={`${u.code} ${u.title}`}>
        <div className="sunithead">
          <h2 className="uname"><span>{u.code}</span>{u.title}{scopeLabel(u.scope) ? <em>{scopeLabel(u.scope)}</em> : null}</h2>
          <div className="sunitmeta">{unitSummary(u, map.shadingReady)}</div>
        </div>
        <div className="heatgrid">
          {u.cells.map((c) => (
            <a key={c.id} href={`#topic-${c.id}`}
              className={`heatcell heat ${c.state}${c.level !== null && c.state !== "untested" ? ` l${c.level}` : ""}`}
              aria-label={cellLabel(c, map.shadingReady)}>
              <span className="cc">{c.code}</span>
              <span className="ct">{c.title}</span>
              {c.state !== "untested" && <span className="cq" aria-hidden="true">{c.questions} {c.questions === 1 ? "question" : "questions"}</span>}
            </a>
          ))}
        </div>
        {u.cells.map((c) => <div key={c.id} id={`topic-${c.id}`} className="stopic"><Detail cell={c} map={map} describe={describe} showSource={false} /></div>)}
      </section>
    ))}
  </>;
}
