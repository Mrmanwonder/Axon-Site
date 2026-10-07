/* ═══════════════════════════════════════════════════════════════════════════
   SYLLABUS IN DETAIL — /insights/syllabus/:offeringId

   The whole published syllabus for one of the student's subjects: every unit
   with its totals, a tile per topic, and every topic's board objectives
   (verbatim) with the questions placed on it. Reached from "In detail" on
   the Insights radar. Same evidence and rules as the map (syllabusMap.ts):
   untested is never weak, shading waits for the paper threshold, and marks
   are the teacher's.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../data/AppProvider";
import { paperTypeLabel, providerKeyForStudent } from "../data/modules";
import { useSyllabusMaps } from "../data/useInsights";
import { ALL_FILTERS, PATTERN_PAPERS, subjectOf, type QuestionRef } from "../data/insights";
import { Legend, SyllabusUnits } from "../components/SyllabusMap";
import AppDropdown from "../components/AppDropdown";
import PageSkeleton from "../components/PageSkeleton";
import { paths } from "../app/paths";
import "../styles/insights.css";

export default function SyllabusDetail() {
  const { offeringId } = useParams();
  const navigate = useNavigate();
  const { papers, student } = useApp();
  const providerKey = providerKeyForStudent(student);
  const syllabus = useSyllabusMaps(ALL_FILTERS);
  const describe = useMemo(() => {
    const byId = new Map(papers.map((p) => [p.id, p]));
    return (r: QuestionRef) => {
      const p = byId.get(r.paperId);
      return p ? [subjectOf(p), paperTypeLabel(p.type, providerKey)].filter(Boolean).join(" · ") : "";
    };
  }, [papers, providerKey]);

  const back = (
    <Link to={paths.insights} className="rvback" aria-label="Back to Insights">
      <svg viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5 8 12l7 7" />
      </svg>
    </Link>
  );

  if (!syllabus.maps) {
    if (syllabus.state === "failed") return <>
      <div className="rvhead detailhead" style={{ position: "static" }}>{back}<div className="rvtitle">Syllabus</div></div>
      <div className="estate"><h4>Can&rsquo;t load the syllabus</h4><p>Your papers are safe. This view needs a connection.</p></div>
    </>;
    return <PageSkeleton variant="insights" label="Loading the syllabus…" />;
  }
  const map = syllabus.maps.maps.find((m) => m.offeringId === offeringId);
  if (!map) return <>
    <div className="rvhead detailhead" style={{ position: "static" }}>{back}<div className="rvtitle">Syllabus</div></div>
    <div className="estate"><h4>No syllabus for this subject</h4><p>Axon doesn&rsquo;t have a verified syllabus for it yet.</p></div>
  </>;

  const tested = map.units.filter((u) => u.state !== "untested").length;
  return (
    <div className="sdetail">
      <div className="rvhead detailhead" style={{ position: "static" }}>{back}<div className="rvtitle">Syllabus</div></div>
      <div className="greet"><h1>{map.label}</h1>
        <div className="sub">{map.document.title} {map.document.syllabus_code} · {map.document.version_label}</div>
      </div>
      {syllabus.maps.maps.length > 1 && (
        <div className="filterbar">
          <AppDropdown ariaLabel="Subject" value={map.offeringId} selected
            options={syllabus.maps.maps.map((m) => ({ value: m.offeringId, label: `${m.label} · ${m.document.syllabus_code}` }))}
            onChange={(v) => navigate(paths.syllabus(v), { replace: true })} />
        </div>
      )}
      <div className="card sdsummary">
        <div className="sdcounts">
          <div><strong>{tested}</strong><span>of {map.units.length} units tested</span></div>
          <div><strong>{map.topicsTested}</strong><span>of {map.topicsTotal} topics tested</span></div>
          <div><strong>{map.questionsPlaced}</strong><span>{map.questionsPlaced === 1 ? "question" : "questions"} placed</span></div>
        </div>
        <p className="lede">{map.shadingReady
          ? "Each topic is shaded by the share of its marks you lost. Tap a topic to jump to the board’s own objectives and your questions on it."
          : `Shading by marks lost starts at ${PATTERN_PAPERS} ${map.label} papers (${map.papersPlaced} so far). Until then, topics show whether you have been tested on them. Tap a topic to jump to its objectives.`}</p>
        <Legend ready={map.shadingReady} />
        <nav className="sdjump" aria-label="Jump to a unit">
          {map.units.map((u) => <a key={u.id} href={`#unit-${u.code}`} className={u.state === "untested" ? "untested" : ""}>{u.code}</a>)}
        </nav>
      </div>
      <SyllabusUnits map={map} describe={describe} />
      <p className="widgetnote sdsource">
        Objectives quoted from the {map.document.title} {map.document.syllabus_code} syllabus ({map.document.version_label}).{" "}
        <a href={map.document.source_url} target="_blank" rel="noreferrer">Source</a>
      </p>
    </div>
  );
}
