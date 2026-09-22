import { useMemo, useState } from "react";
import { useAnalytics } from "../data/useAnalytics";
import { useApp } from "../data/AppProvider";
import { paperTypeLabel } from "../data/modules";
import PressBox from "../components/PressBox";
import AppDropdown from "../components/AppDropdown";
import type { AppDropdownOption } from "../components/AppDropdown";
import { useIngestion } from "../data/useIngestion";

const CAUSE = {
  conceptual_gap: { hue: "var(--cause-conceptual-gap)", label: "Concept gap" },
  procedural_slip: { hue: "var(--cause-procedural-slip)", label: "Slip in the working" },
  misread_question: { hue: "var(--cause-misread-question)", label: "Misread the question" },
  incomplete: { hue: "var(--cause-incomplete)", label: "Left incomplete" },
  presentation: { hue: "var(--cause-presentation)", label: "How it was presented" },
  keyword_miss: { hue: "var(--cause-keyword-miss)", label: "Missing keyword" },
  timed_out: { hue: "var(--cause-timed-out)", label: "Ran out of time" },
} as const;
type Cause = keyof typeof CAUSE;
const THRESHOLD = 4;

function EvidenceGap({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card evidencegap"><div className="unknownmark" aria-hidden="true">?</div><div><h3>{title}</h3><p>{children}</p></div></div>;
}

export default function Insights() {
  const { papers, student } = useApp();
  const { state, readiness, loss, stale } = useAnalytics();
  const { addPaper } = useIngestion();
  const [subject, setSubject] = useState("all");
  const [type, setType] = useState("all");
  const [range, setRange] = useState("all");
  const [tier, setTier] = useState("all");

  const subjects = useMemo(() => {
    const paperSubjects = papers
      .map((paper) => paper.subject)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    return [...new Set([...(student?.subjects ?? []), ...paperSubjects])].sort();
  }, [papers, student?.subjects]);

  const types = useMemo(
    () => [...new Set(papers.map((paper) => paper.type))].sort((a, b) => paperTypeLabel(a).localeCompare(paperTypeLabel(b))),
    [papers],
  );

  const filtered = useMemo(() => papers.filter((p) =>
    (subject === "all" || p.subject === subject) &&
    (type === "all" || p.type === type) &&
    (tier === "all" || p.tier === tier) &&
    (range === "all" || new Date(p.date_taken).getTime() >= Date.now() - 90 * 86400000)
  ), [papers, subject, type, range, tier]);
  const trend = filtered.filter((p) => p.total_available != null && p.total_awarded != null).reverse();
  const maxLost = Math.max(1, ...trend.map((p) => Number(p.total_available) - Number(p.total_awarded)));
  const allEvidence = subject === "all" && type === "all" && range === "all" && tier === "all";
  const entries = Object.entries(loss ?? {}).filter(([c, marks]) => c in CAUSE && marks > 0)
    .sort((a, b) => b[1] - a[1]) as [Cause, number][];
  const total = entries.reduce((n, [, marks]) => n + marks, 0);

  const subjectOptions: AppDropdownOption[] = [
    { value: "all", label: "All subjects" },
    ...subjects.map((item) => ({ value: item, label: item })),
  ];
  const typeOptions: AppDropdownOption[] = [
    { value: "all", label: "All papers" },
    ...types.map((item) => ({ value: item, label: paperTypeLabel(item) })),
  ];
  const rangeOptions: AppDropdownOption[] = [
    { value: "all", label: "Any date" },
    { value: "term", label: "Last 90 days" },
  ];
  const tierOptions: AppDropdownOption[] = [
    { value: "all", label: "Any tier" },
    { value: "tier_1", label: "Teacher marks" },
    { value: "tier_2", label: "Scheme match" },
  ];

  if (state === "loading" && !readiness) return <div role="status">Loading analysis…</div>;
  if (!readiness) return <><div className="greet"><h1>Insights</h1></div><div className="estate"><h4>Can&rsquo;t reach your analysis</h4><p>Your papers are safe. This view needs a connection to work out what changed.</p></div></>;

  return <>
    <div className="greet"><h1>Insights</h1><div className="sub">Patterns from teacher-marked work, never predicted marks.</div></div>

    <div className="filterbar insightfilters" aria-label="Filter insights">
      <AppDropdown ariaLabel="Filter insights by subject" value={subject} options={subjectOptions} onChange={setSubject} selected={subject !== "all"} />
      <AppDropdown ariaLabel="Filter insights by paper type" value={type} options={typeOptions} onChange={setType} selected={type !== "all"} />
      <AppDropdown ariaLabel="Filter insights by date" value={range} options={rangeOptions} onChange={setRange} selected={range !== "all"} />
      <AppDropdown ariaLabel="Filter insights by tier" value={tier} options={tierOptions} onChange={setTier} selected={tier !== "all"} />
    </div>

    {!filtered.length && papers.length > 0 ? <div className="card filterempty"><h3>No matching papers</h3><p>There&rsquo;s no evidence for this combination yet.</p><button onClick={() => { setSubject("all"); setType("all"); setRange("all"); setTier("all"); }}>Clear filters</button></div> : <div className="igrid">
      <section className="isection">
        <div className="sectitle">Coverage</div>
        <div className="card coveragecard"><div className="coveragehead"><strong>{readiness.papers_counted} of {THRESHOLD} papers</strong><span>{readiness.has_enough_data ? "Patterns ready" : "Building evidence"}</span></div><div className="covertrack"><i style={{width: `${Math.min(100, readiness.papers_counted / THRESHOLD * 100)}%`}} /></div><p>{readiness.has_enough_data ? `${readiness.questions_counted} confirmed questions are behind this view.` : `Scan ${Math.max(0, THRESHOLD - readiness.papers_counted)} more comparable paper${THRESHOLD - readiness.papers_counted === 1 ? "" : "s"} before Axon calls anything a pattern.`}</p>{!readiness.has_enough_data && <PressBox as="button" type="button" className="miniadd" onClick={addPaper}>Add a paper</PressBox>}</div>
      </section>

      <section className="isection">
        <div className="sectitle">Trend</div>
        {trend.length >= 4 ? <div className="card trendcard"><div className="hd"><span className="k">Marks lost · paper by paper</span><span className="v">{subject === "all" ? "Comparable papers" : subject}</span></div><div className="spark" aria-label="Marks lost across papers">{trend.map((p, i) => { const v = Number(p.total_available) - Number(p.total_awarded); return <div className="sparkcol" key={p.id}><i style={{height:`${Math.max(8, v / maxLost * 100)}%`}}/><span>{i + 1}</span></div>; })}</div><p className="widgetnote">Paper order, not a date axis. Lower bars mean fewer teacher marks lost.</p></div> : <EvidenceGap title="Not enough comparable papers">A trend needs four papers with confirmed totals. {trend.length ? `${trend.length} ${trend.length === 1 ? "is" : "are"} ready for this filter.` : "None are ready for this filter yet."}</EvidenceGap>}
      </section>

      <section className="isection">
        <div className="sectitle">Why marks are lost</div>
        {!allEvidence ? <EvidenceGap title="No cause breakdown for this filter">The current aggregate cannot be narrowed safely to this selection yet. Axon won&rsquo;t show the all-paper total as if it matched.</EvidenceGap> : !readiness.has_enough_data ? <EvidenceGap title="This breakdown needs more evidence">A couple of questions can describe one bad day, not a pattern. Axon will show causes after four comparable papers.</EvidenceGap> : !total ? <EvidenceGap title="Nothing to break down yet">No confirmed marks lost were found in this evidence.</EvidenceGap> : <div className="card causecard"><div className="causebar">{entries.map(([c,m]) => <i key={c} style={{flex:m,background:CAUSE[c].hue}} />)}</div><div className="causegrid">{entries.map(([c,m]) => <div className="cz" key={c}><span className="sw2" style={{background:CAUSE[c].hue}}/><span className="n">{CAUSE[c].label}</span><span className="v">{m}</span></div>)}</div><p className="widgetnote">Confirmed teacher marks only. Colours identify kinds, not severity.</p></div>}
      </section>

      <section className="isection"><div className="sectitle">Question types</div><EvidenceGap title="Command-word view isn&rsquo;t ready yet">Questions do not yet store a reliable command word. Axon won&rsquo;t infer which kinds cost marks from loose text.</EvidenceGap></section>
      <section className="isection"><div className="sectitle">Topic map</div><EvidenceGap title="No chapter evidence yet">Topic rows are not populated yet. Unknown topics stay unknown — they are not shown as weak or as 0%.</EvidenceGap></section>
      <section className="isection"><div className="sectitle">Quick wins</div><EvidenceGap title="No defensible ranking yet">Axon can count marks, but cannot yet measure the effort a fix takes. It won&rsquo;t make a precise-looking list from a guess.</EvidenceGap></section>
      <section className="isection"><div className="sectitle">Pacing check</div><EvidenceGap title="Pacing isn&rsquo;t captured yet">Blank or rushed final questions need to repeat across papers before this can be called out. That signal is not recorded yet.</EvidenceGap></section>
    </div>}
    {(stale || state === "failed") && <div role="status">Last available analysis.</div>}
  </>;
}
