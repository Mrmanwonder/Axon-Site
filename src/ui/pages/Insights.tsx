/* ═══════════════════════════════════════════════════════════════════════════
   INSIGHTS — what the student's confirmed history says, and nothing else

   Every module renders from `buildInsights` (src/ui/data/insights.ts), which
   reads only the analytics views. Each claim carries its sample size and opens
   onto the questions it rests on, so a student can check any sentence here
   against their own paper.

   Order is by usefulness to the next paper, not by data type:
     1. Before your next paper — the student's own fixes for mistakes that recur
     2. Recurring mistakes — causes seen in two or more papers of one subject
     3. Where your marks go — the cause breakdown, split knowledge / technique
     4. Trend — the student against their own earlier papers, never others
     5. Question size, command words, answer stage, topics — where marks go
     6. End of paper, knock-on errors, subjects

   Nothing here ranks, predicts or compares the student with anyone else, and
   nothing is shown as a percentage. Under four papers only coverage is shown.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../data/AppProvider";
import { paperTypeLabel, providerKeyForStudent } from "../data/modules";
import PressBox from "../components/PressBox";
import { InfoSymbol } from "../components/MaterialSymbols";
import AppDropdown from "../components/AppDropdown";
import type { AppDropdownOption } from "../components/AppDropdown";
import { useIngestion } from "../data/useIngestion";
import PageSkeleton from "../components/PageSkeleton";
import Disclose from "../components/Disclose";
import { useInsights, useSyllabusMaps } from "../data/useInsights";
import SyllabusMap from "../components/SyllabusMap";
import type { SyllabusMaps } from "../data/syllabusMap";
import { CAUSE_HUE, CAUSE_LABEL, numMark } from "../data/causes";
import { PATTERN_PAPERS, MIN_COMMAND_WORD_QUESTIONS, subjectOf, ALL_FILTERS } from "../data/insights";
import type { Cause, ErrorType, InsightFilters, InsightsModel, QuestionRef, Tally } from "../data/insights";
import { paths } from "../app/paths";
import "../styles/insights.css";

const CAUSE_MEANING: Record<Cause, string> = {
  conceptual_gap: "The idea itself was not there yet. This needs learning, not just care.",
  procedural_slip: "The method was right; a step in the working went wrong.",
  misread_question: "The answer responded to something other than what was asked.",
  incomplete: "The answer stopped short of everything the marks asked for.",
  presentation: "The content was right; the way it was set out cost the mark.",
  keyword_miss: "The idea was there without the term the mark needed.",
  timed_out: "The question was reached too late to finish.",
};

const STAGE_LABEL: Record<ErrorType, string> = {
  method: "In the method",
  final_answer: "At the final answer",
  omitted_step: "A step left out",
  presentation: "In how it was set out",
  other: "Elsewhere",
};

/** Leads with the largest group, whichever it is. Ties name both. */
function groupLede(g: InsightsModel["groups"], total: number): string {
  const text = {
    technique: "where the knowledge was there: slips, misreadings, missing keywords and presentation",
    completion: "on answers that were left unfinished or not reached",
    knowledge: "to concept gaps, where the idea itself needs learning",
  } as const;
  const order = (Object.keys(text) as (keyof typeof text)[]).filter((k) => g[k] > 0).sort((a, b) => g[b] - g[a]);
  if (!order.length) return "";
  const [first, second] = order;
  const lead = `${numMark(g[first])} of ${numMark(total)} explained marks were lost ${text[first]}.`;
  return second && g[second] === g[first] ? `${lead} As many again were lost ${text[second]}.` : lead;
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const sample = (t: { questions: number; papers: number }) => `${plural(t.questions, "question")} · ${plural(t.papers, "paper")}`;

function EvidenceGap({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card evidencegap"><div className="unknownmark" aria-hidden="true"><InfoSymbol size={18} /></div><div><h3>{title}</h3><p>{children}</p></div></div>;
}

/** The questions a claim rests on. Every row opens the question itself. */
function Evidence({ refs, describe, label }: { refs: QuestionRef[]; describe: (r: QuestionRef) => string; label?: string }) {
  if (!refs.length) return null;
  return (
    <Disclose label={label ?? `Show ${plural(refs.length, "question")}`}>
      <ul className="evlist">
        {refs.map((r) => (
          <li key={r.attemptId + ":" + r.marks}>
            <PressBox as={Link} to={paths.question(r.paperId, r.attemptId)} className="evrow" data-interactive="">
              <span className="q">{r.label}</span>
              <span className="p">{describe(r)}</span>
              <span className="m">{numMark(r.marks)}<small>lost</small></span>
            </PressBox>
          </li>
        ))}
      </ul>
    </Disclose>
  );
}

/** A labelled row with a lost-of-available track. Share is drawn, never printed. */
function ShareRow({ label, lost, available, meta }: { label: string; lost: number; available: number; meta: string }) {
  const share = available > 0 ? Math.min(1, lost / available) : 0;
  return (
    <div className="sharerow">
      <div className="top"><span className="n">{label}</span><span className="v">{numMark(lost)} of {numMark(available)} lost</span></div>
      <div className="track" aria-hidden="true"><i style={{ width: `${share * 100}%` }} /></div>
      <div className="meta">{meta}</div>
    </div>
  );
}

function TallyRow({ swatch, label, tally, describe, extra }: {
  swatch?: string; label: string; tally: Tally; describe: (r: QuestionRef) => string; extra?: React.ReactNode;
}) {
  return (
    <div className="tallyrow">
      <div className="top">
        {swatch && <span className="sw2" style={{ background: swatch }} aria-hidden="true" />}
        <span className="n">{label}</span>
        <span className="v">{numMark(tally.marks)}<small>marks lost</small></span>
      </div>
      <div className="meta">{sample(tally)}</div>
      {extra}
      <Evidence refs={tally.refs} describe={describe} />
    </div>
  );
}

/** The strongest few, with the rest one tap away. Keeps a long history from becoming a long page. */
function MoreList({ items, shown, noun }: { items: React.ReactNode[]; shown: number; noun: string }) {
  if (items.length <= shown + 1) return <>{items}</>;
  const rest = items.length - shown;
  return <>{items.slice(0, shown)}<div className="morelist"><Disclose label={`Show ${rest} more ${noun}`}>{items.slice(shown)}</Disclose></div></>;
}

export default function Insights() {
  const { papers, student } = useApp();
  const providerKey = providerKeyForStudent(student);
  const { addPaper } = useIngestion();
  const [filters, setFilters] = useState<InsightFilters>(ALL_FILTERS);
  const set = (k: keyof InsightFilters) => (v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const { state, model, stale } = useInsights(filters);
  const syllabus = useSyllabusMaps(filters);

  const subjects = useMemo(() => {
    const fromPapers = papers.map((p) => subjectOf(p)).filter((s): s is string => !!s);
    return [...new Set([...(student?.subjects ?? []), ...fromPapers])].sort();
  }, [papers, student?.subjects]);
  const types = useMemo(
    () => [...new Set(papers.map((p) => p.type))].sort((a, b) => paperTypeLabel(a, providerKey).localeCompare(paperTypeLabel(b, providerKey))),
    [papers, providerKey],
  );

  // Paper order within the current evidence, for "paper 3 of 7" style references.
  const describe = useMemo(() => {
    const byId = new Map(papers.map((p) => [p.id, p]));
    return (r: QuestionRef) => {
      const p = byId.get(r.paperId);
      if (!p) return "";
      const subject = subjectOf(p);
      return [subject, paperTypeLabel(p.type, providerKey)].filter(Boolean).join(" · ");
    };
  }, [papers, providerKey]);

  const subjectOptions: AppDropdownOption[] = [{ value: "all", label: "All subjects" }, ...subjects.map((s) => ({ value: s, label: s }))];
  const typeOptions: AppDropdownOption[] = [{ value: "all", label: "All papers" }, ...types.map((t) => ({ value: t, label: paperTypeLabel(t, providerKey) }))];
  const rangeOptions: AppDropdownOption[] = [{ value: "all", label: "Any date" }, { value: "term", label: "Last 90 days" }];
  const tierOptions: AppDropdownOption[] = [{ value: "all", label: "Any tier" }, { value: "tier_1", label: "Teacher marks" }, { value: "tier_2", label: "Scheme match" }];
  const filtered = filters.subject !== "all" || filters.type !== "all" || filters.range !== "all" || filters.tier !== "all";

  if (state === "loading" && !model) return <PageSkeleton variant="insights" label="Loading analysis…" />;
  if (!model) return <><div className="greet"><h1>Insights</h1></div><div className="estate"><h4>Can&rsquo;t reach your analysis</h4><p>Your papers are safe. This view needs a connection to work out what changed.</p></div></>;

  return <>
    <div className="greet insightsgreet"><h1>Insights</h1><div className="sub">Patterns from teacher-marked work, never predicted marks.</div></div>

    <div className="filterbar insightfilters" aria-label="Filter insights">
      <AppDropdown ariaLabel="Filter insights by subject" value={filters.subject} options={subjectOptions} onChange={set("subject")} selected={filters.subject !== "all"} />
      <AppDropdown ariaLabel="Filter insights by paper type" value={filters.type} options={typeOptions} onChange={set("type")} selected={filters.type !== "all"} />
      <AppDropdown ariaLabel="Filter insights by date" value={filters.range} options={rangeOptions} onChange={set("range")} selected={filters.range !== "all"} />
      <AppDropdown ariaLabel="Filter insights by tier" value={filters.tier} options={tierOptions} onChange={set("tier")} selected={filters.tier !== "all"} />
    </div>

    {model.evidence.papers === 0 && filtered && papers.length > 0
      ? <div className="card filterempty"><h3>No matching papers</h3><p>There&rsquo;s no confirmed evidence for this combination yet.</p><button onClick={() => setFilters(ALL_FILTERS)}>Clear filters</button></div>
      : <Body model={model} describe={describe} addPaper={addPaper} filtered={filtered}
          syllabus={<SyllabusSection maps={syllabus.maps} state={syllabus.state} subject={filters.subject === "all" ? null : filters.subject} />} />}

    {(stale || state === "failed") && <div role="status" className="subnote">Last available analysis.</div>}
  </>;
}

function SyllabusSection({ maps, state, subject }: {
  maps: SyllabusMaps | null; state: string; subject: string | null;
}) {
  return <section className="isection isection-wide">
    <div className="sectitle">Syllabus map</div>
    {!maps ? (state === "failed"
      ? <EvidenceGap title="Syllabus map unavailable">Axon couldn&rsquo;t load the syllabus right now. Your papers are unaffected.</EvidenceGap>
      : <div className="card heatcard" role="status" aria-label="Loading syllabus map"><p className="lede">Loading the syllabus…</p></div>)
      : maps.maps.length ? <SyllabusMap data={maps} initialSubject={subject} />
      : <EvidenceGap title="No syllabus map yet">
          {maps.withoutSyllabus.length
            ? `The official syllabus for ${maps.withoutSyllabus.join(", ")} isn’t available in Axon yet. Topics will appear here once it is.`
            : "Add your subjects in Settings and Axon will lay your papers out on their official syllabus."}
        </EvidenceGap>}
  </section>;
}

function Body({ model, describe, addPaper, filtered, syllabus }: {
  model: InsightsModel; describe: (r: QuestionRef) => string; addPaper: () => void; filtered: boolean; syllabus: React.ReactNode;
}) {
  const ev = model.evidence;
  const evidenceLine = `${plural(ev.questions, "confirmed question")} · ${plural(ev.papers, "paper")}`;

  if (!ev.enough) {
    const counted = Math.min(ev.papers, PATTERN_PAPERS);
    const left = Math.max(0, PATTERN_PAPERS - ev.papers);
    return <div className="igrid">
      <section className="isection isection-wide">
        <div className="sectitle">Coverage</div>
        <div className="card growcard">
          <div className="growhead">
            <div className="growcount"><strong>{counted}</strong><span>of {PATTERN_PAPERS} papers</span></div>
            <div className="growtag">Patterns start at {PATTERN_PAPERS}</div>
          </div>
          <div className="growsteps" role="img" aria-label={`${counted} of ${PATTERN_PAPERS} papers counted`}>
            {Array.from({ length: PATTERN_PAPERS }, (_, i) => <i key={i} className={i < counted ? "on" : ""} />)}
          </div>
          <p className="growline">{filtered
            ? `This filter has ${plural(ev.papers, "confirmed paper")}. Patterns need ${PATTERN_PAPERS}.`
            : left === 1
              ? "One more marked paper and Axon starts comparing them. One paper can describe a bad day; four can describe a habit."
              : `${plural(left, "more marked paper")} and Axon starts comparing them. One paper can describe a bad day; four can describe a habit.`}</p>
          <div className="growlist">
            <div className="growcap">What opens at {PATTERN_PAPERS} papers</div>
            <ul>
              <li>Mistakes you repeat, with your own fix for each</li>
              <li>A short checklist for your next paper</li>
              <li>Where your marks go: knowledge, technique or finishing</li>
              <li>The question sizes, command words and topics that cost most</li>
              <li>Questions left blank at the end of a paper</li>
            </ul>
          </div>
          {!filtered && <PressBox as="button" type="button" className="btn primary growcta" onClick={addPaper}>Scan a marked paper</PressBox>}
          <p className="widgetnote">Every paper you have scanned already has its own explanations in <Link to={paths.library}>Library</Link>.</p>
        </div>
      </section>
      {syllabus}
    </div>;
  }

  const causeTotal = model.causes.reduce((n, c) => n + c.marks, 0);

  return <div className="igrid">
    {/* 1 · The student's own rules for the next paper. */}
    <section className="isection">
      <div className="sectitle">Before your next paper</div>
      {model.checklist.length ? <div className="card checkcard">
        <ol>
          {model.checklist.map((c) => (
            <li key={c.ref.attemptId}>
              <span className="sw2" style={{ background: CAUSE_HUE[c.cause] }} aria-hidden="true" />
              <div>
                <div className="t">{c.text}</div>
                <PressBox as={Link} to={paths.question(c.ref.paperId, c.ref.attemptId)} className="src">
                  From {c.ref.label} · {describe(c.ref)} · {CAUSE_LABEL[c.cause]}
                </PressBox>
              </div>
            </li>
          ))}
        </ol>
        <p className="widgetnote">Taken from your own explained questions, for mistakes that came back in more than one paper.</p>
      </div> : <EvidenceGap title="No repeated mistake to plan around">
        Nothing has come back in two different papers of the same subject yet. That is a real result, not missing data.
      </EvidenceGap>}
    </section>

    {/* 2 · Recurring mistakes, and ones that have stopped. */}
    <section className="isection">
      <div className="sectitle">Mistakes that repeat</div>
      {model.patterns.length ? <div className="card tallycard">
        <MoreList shown={3} noun="patterns" items={model.patterns.map((p) => (
          <TallyRow key={p.cause + (p.subject ?? "")} swatch={CAUSE_HUE[p.cause]}
            label={`${CAUSE_LABEL[p.cause]}${p.subject ? ` · ${p.subject}` : ""}`}
            tally={p} describe={describe}
            extra={<div className="meta">{`In ${p.recentHits} of your last ${plural(p.recentWindow, "paper")}`}{p.subject ? "" : " · subject not set"}</div>} />
        ))} />
        {model.fading.length > 0 && <div className="fading">
          {model.fading.map((f) => (
            <p key={f.cause + (f.subject ?? "")}>
              <strong>{CAUSE_LABEL[f.cause]}{f.subject ? ` · ${f.subject}` : ""}</strong> appeared in {plural(f.earlierPapers, "earlier paper")} and in none of your last {f.recentWindow}.
            </p>
          ))}
        </div>}
        <p className="widgetnote">A mistake counts as repeating when it costs marks in two or more papers of the same subject. {evidenceLine}.</p>
      </div> : model.fading.length ? <div className="card tallycard"><div className="fading">
        {model.fading.map((f) => (
          <p key={f.cause + (f.subject ?? "")}><strong>{CAUSE_LABEL[f.cause]}{f.subject ? ` · ${f.subject}` : ""}</strong> appeared in {plural(f.earlierPapers, "earlier paper")} and in none of your last {f.recentWindow}.</p>
        ))}
      </div></div> : <EvidenceGap title="No repeating mistakes">
        No cause has cost marks in two different papers of the same subject in this evidence. {evidenceLine}.
      </EvidenceGap>}
    </section>

    {syllabus}

    {/* 3 · Where marks go, by kind. */}
    <section className="isection">
      <div className="sectitle">Where your marks go</div>
      {causeTotal > 0 ? <div className="card causecard">
        <p className="lede">{groupLede(model.groups, causeTotal)}</p>
        <div className="causebar" aria-hidden="true">{model.causes.map((c) => <i key={c.cause} style={{ flex: c.marks, background: CAUSE_HUE[c.cause] }} />)}</div>
        <div className="groupline"><span>Knowledge {numMark(model.groups.knowledge)}</span><span>Exam technique {numMark(model.groups.technique)}</span><span>Finishing {numMark(model.groups.completion)}</span></div>
        <ul className="causelist">
          {model.causes.map((c) => (
            <li key={c.cause}>
              <span className="sw2" style={{ background: CAUSE_HUE[c.cause] }} aria-hidden="true" />
              <span className="n">{CAUSE_LABEL[c.cause]}<small>{sample(c)}</small></span>
              <span className="v">{numMark(c.marks)}</span>
            </li>
          ))}
        </ul>
        <Disclose label="What each cause means">
          <dl className="causedefs">
            {model.causes.map((c) => <div key={c.cause}><dt>{CAUSE_LABEL[c.cause]}</dt><dd>{CAUSE_MEANING[c.cause]}</dd></div>)}
          </dl>
        </Disclose>
        <Evidence label="Show the questions behind these marks" describe={describe}
          refs={model.causes.flatMap((c) => c.refs).filter((r, i, all) => all.findIndex((x) => x.attemptId === r.attemptId) === i)
            .sort((a, b) => b.paperIndex - a.paperIndex || b.marks - a.marks)} />
        <p className="widgetnote">
          {numMark(ev.marksLost)} marks lost in total across {evidenceLine}; {numMark(causeTotal)} of them have a confirmed cause. Uncertain readings and causes you marked &ldquo;Not why I lost it&rdquo; are left out. Colours identify kinds, not severity.
        </p>
      </div> : <EvidenceGap title="No explained marks lost">No confirmed marks lost have a cause in this evidence. {evidenceLine}.</EvidenceGap>}
    </section>

    {/* 4 · Trend, against the student's own earlier papers. */}
    <section className="isection">
      <div className="sectitle">Trend</div>
      {model.trend.points.length >= PATTERN_PAPERS ? <div className="card trendcard">
        <div className="hd"><span className="k">Share of marks lost · paper by paper</span><span className="v neutral">{plural(model.trend.points.length, "paper")}</span></div>
        <div className="spark" role="img" aria-label={`Marks lost on ${model.trend.points.length} papers, oldest first`}>
          {model.trend.points.map((p) => (
            <div className="sparkcol" key={p.paperId} title={`${numMark(p.lost)} of ${numMark(p.available)} lost`}>
              <i style={{ height: `${Math.max(4, (p.lost / p.available) * 100)}%` }} /><span>{p.index}</span>
            </div>
          ))}
        </div>
        {model.trend.summary && <p className="lede trendlede">{model.trend.summary.direction === "fewer"
          ? `Your last ${model.trend.summary.recent} papers lost a smaller share of their marks than your first ${model.trend.summary.earlier}.`
          : model.trend.summary.direction === "more"
            ? `Your last ${model.trend.summary.recent} papers lost a larger share of their marks than your first ${model.trend.summary.earlier}. Harder papers can do this on their own.`
            : `Your last ${model.trend.summary.recent} papers and your first ${model.trend.summary.earlier} lost a similar share of their marks.`}</p>}
        <p className="widgetnote">Oldest paper first. Bar height is the share of that paper&rsquo;s marks lost, so short and long papers compare fairly. Papers with unreadable marks are left out.</p>
      </div> : <EvidenceGap title="Not enough complete papers">
        A trend needs {PATTERN_PAPERS} papers whose every mark was read. {model.trend.points.length ? `${model.trend.points.length} ${model.trend.points.length === 1 ? "is" : "are"} ready for this filter.` : "None are ready for this filter yet."}
      </EvidenceGap>}
    </section>

    {/* 5 · Question size: the one view with a complete denominator. */}
    <section className="isection">
      <div className="sectitle">By question size</div>
      {model.tariff.length >= 2 ? <div className="card sharecard">
        {model.tariffNote && <p className="lede">{model.tariffNote}</p>}
        {model.tariff.map((b) => <ShareRow key={b.key} label={b.label} lost={b.lost} available={b.available} meta={plural(b.questions, "question")} />)}
        <p className="widgetnote">Every confirmed question counts here, including the ones with full marks. Sizes with fewer than three questions are not shown.</p>
      </div> : <EvidenceGap title="Not enough variety yet">This view compares question sizes, and needs at least three questions in two sizes.</EvidenceGap>}
    </section>

    <section className="isection">
      <div className="sectitle">Command words</div>
      {model.commandWords.rows.length ? <div className="card tallycard">
        <MoreList shown={3} noun="command words" items={model.commandWords.rows.map((r) => <TallyRow key={r.word} label={r.word} tally={r} describe={describe} />)} />
        <p className="widgetnote">Marks lost on questions by the instruction word they used. Only questions that lost marks are tagged, so this shows where marks went, not how often you get a kind right. {model.commandWords.coverage.tagged} of {plural(model.commandWords.coverage.total, "explained question")} carry a command word; a word is shown once it covers {MIN_COMMAND_WORD_QUESTIONS} questions.</p>
      </div> : <EvidenceGap title="No command word repeats yet">{model.commandWords.coverage.tagged
        ? `A command word is shown once it covers ${MIN_COMMAND_WORD_QUESTIONS} questions that lost marks. None does yet (${model.commandWords.coverage.tagged} of ${model.commandWords.coverage.total} explained questions carry one).`
        : "None of the explained questions in this evidence carry a command word yet. Axon doesn’t guess one from loose text."}</EvidenceGap>}
    </section>

    <section className="isection">
      <div className="sectitle">Where in the answer</div>
      {model.stages.rows.length ? <div className="card tallycard">
        {model.stages.rows.map((s) => (
          <div className="tallyrow" key={s.type}>
            <div className="top"><span className="n">{STAGE_LABEL[s.type]}</span><span className="v">{numMark(s.marks)}<small>marks lost</small></span></div>
            <div className="meta">{plural(s.questions, "question")}</div>
          </div>
        ))}
        <p className="widgetnote">From the mark-by-mark breakdown of {plural(model.stages.coverage.split, "question")}, of {model.stages.coverage.total} explained. A breakdown is used only when it accounts for exactly the marks your teacher took off.</p>
      </div> : <EvidenceGap title="No mark-by-mark breakdowns yet">Newer explanations split a question&rsquo;s lost marks by where in the answer they went. None in this evidence do yet.</EvidenceGap>}
    </section>

    <section className="isection">
      <div className="sectitle">Topics that keep coming up</div>
      {model.topics.length ? <div className="card tallycard">
        <MoreList shown={4} noun="topics" items={model.topics.map((t) => (
          <TallyRow key={t.label} label={t.label} tally={{ marks: t.marks, questions: t.questions, papers: t.papers, refs: t.refs }} describe={describe} />
        ))} />
        <p className="widgetnote">Topics named in the explanations of questions that lost marks, in two or more papers. Names are matched as written; similar names are not merged. Marks are those lost on the tagged questions.</p>
      </div> : <EvidenceGap title="No topic repeats across papers">No topic has been named on lost marks in two different papers yet. Unknown topics stay unknown; they are not shown as weak.</EvidenceGap>}
    </section>

    <section className="isection">
      <div className="sectitle">End of the paper</div>
      {model.pacing.papersRead === 0 ? <EvidenceGap title="Question order not available">These papers don&rsquo;t carry the order their questions appeared in, so Axon can&rsquo;t tell the end of a paper from the middle.</EvidenceGap>
        : <div className="card tallycard">
          <p className="lede">{model.pacing.papersWithEndBlanks === 0
            ? `None of ${plural(model.pacing.papersRead, "paper")} ended with unanswered questions.`
            : `${model.pacing.papersWithEndBlanks} of ${plural(model.pacing.papersRead, "paper")} ended with unanswered questions: ${plural(model.pacing.endBlankQuestions, "question")}, ${numMark(model.pacing.endBlankMarks)} marks.`}
            {model.pacing.isPattern ? " Blanks at the end of more than one paper often point to time rather than knowledge." : ""}</p>
          {model.pacing.timedOutMarks > 0 && <div className="meta">{numMark(model.pacing.timedOutMarks)} further marks were explained as running out of time.</div>}
          <Evidence refs={model.pacing.refs} describe={describe} />
          <p className="widgetnote">Counts the blank, zero-mark questions at the very end of each paper, in the order they were printed. A blank in the middle is not counted here.</p>
        </div>}
    </section>

    {model.knockOn.questions >= 2 && <section className="isection">
      <div className="sectitle">Built on an earlier part</div>
      <div className="card tallycard">
        <p className="lede">{numMark(model.knockOn.marks)} marks were lost on {plural(model.knockOn.questions, "part")} that used an answer from an earlier part. One early slip can cost marks more than once.</p>
        <Evidence refs={model.knockOn.refs} describe={describe} />
      </div>
    </section>}

    {model.subjects.length >= 2 && <section className="isection">
      <div className="sectitle">By subject</div>
      <div className="card sharecard">
        {model.subjects.map((s) => <ShareRow key={s.subject ?? "unset"} label={s.subject ?? "Subject not set"} lost={s.lost} available={s.available} meta={`${plural(s.questions, "question")} · ${plural(s.papers, "paper")}`} />)}
        <p className="widgetnote">Each subject against its own marks. Patterns above are found within one subject at a time.</p>
      </div>
    </section>}
  </div>;
}
