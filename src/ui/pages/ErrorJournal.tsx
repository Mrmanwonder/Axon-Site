/* ═══════════════════════════════════════════════════════════════════════════
   ERROR JOURNAL (AXO-259)

   Every part that lost marks, from confirmed evidence only: the original
   answer, what the explanation says, the command word, the mistake type (once
   the classifier passes its bar), where it stands (open, retried, fixed) and
   when it comes back. Each row ends in an action: practise this.

   Filters narrow the list; they never change what a row says. An empty
   filter result says so, and a failed read is never shown as "no lost marks".
   ═══════════════════════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PressBox from "../components/PressBox";
import Chevron from "../components/Chevron";
import Disclose from "../components/Disclose";
import MathText from "../components/MathText";
import PageSkeleton from "../components/PageSkeleton";
import { useApp } from "../data/AppProvider";
import { useResource } from "../data/useResource";
import { errorJournal, practiceFlags, MISTAKE_TYPE_LABEL, type JournalRow, type MistakeType } from "../data/practice";
import { useStartPractice } from "../data/useHomePractice";
import { numMark } from "../data/causes";
import { paths } from "../app/paths";
import { useIngestion } from "../data/useIngestion";
import "../styles/insights.css";
import "../styles/practice.css";

const STATUS_LABEL: Record<JournalRow["status"], string> = { open: "Open", retried: "Retried", fixed: "Fixed" };
const ALL = "";

export default function ErrorJournal() {
  const { addPaper } = useIngestion();
  const { student } = useApp();
  const start = useStartPractice();
  const { resource, reload } = useResource(student?.id ? `journal:${student.id}` : null, async () => {
    const [rows, flags] = await Promise.all([errorJournal(student!.id), practiceFlags().catch(() => null)]);
    return { data: { rows, showTypes: Boolean(flags?.mistake_type_ui) } };
  });
  const [filters, setFilters] = useState({ subject: ALL, topic: ALL, command: ALL, status: ALL, type: ALL });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = resource.data?.rows ?? [];
  const showTypes = resource.data?.showTypes ?? false;
  const options = useMemo(() => ({
    subject: uniq(rows.map((r) => r.subject)),
    topic: uniq(rows.map((r) => r.topic_label)),
    command: uniq(rows.map((r) => r.command_word)),
    type: uniq(rows.map((r) => r.mistake_type)),
  }), [rows]);
  const shown = rows.filter((r) =>
    (!filters.subject || r.subject === filters.subject)
    && (!filters.topic || r.topic_label === filters.topic)
    && (!filters.command || r.command_word === filters.command)
    && (!filters.status || r.status === filters.status)
    && (!filters.type || r.mistake_type === filters.type));

  if (resource.state === "loading" && !resource.data) return <PageSkeleton variant="home" label="Loading your lost marks…" />;

  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLSelectElement>) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const papers = new Set(rows.map((r) => r.paper_id)).size;

  return (
    <>
      <nav aria-label="Breadcrumb" className="crumbs"><Link to={paths.insights}>Insights</Link></nav>
      <div className="greet insightsgreet">
        <h1>Every lost mark</h1>
        {resource.data && <div className="sub">{rows.length} {rows.length === 1 ? "part" : "parts"} · {papers} {papers === 1 ? "paper" : "papers"}</div>}
      </div>

      {resource.state === "failed" && !resource.data ? (
        <div className="estate">
          <h4>We couldn&rsquo;t load your lost marks</h4>
          <p>Your papers are safe. This is us failing to read them.</p>
          <PressBox as="button" type="button" className="btn ghost" onClick={() => void reload()}>Try again</PressBox>
        </div>
      ) : rows.length === 0 ? (
        <div className="estate">
          <h4>No lost marks to list</h4>
          <p>Parts appear here once a marked paper is read and its readings are confirmed.</p>
          <PressBox as="button" type="button" className="btn primary" onClick={addPaper}>Scan a marked paper</PressBox>
        </div>
      ) : (
        <>
          <div className="journalfilters" role="group" aria-label="Filter lost marks">
            <Filter label="Subject" value={filters.subject} options={options.subject} onChange={set("subject")} />
            <Filter label="Topic" value={filters.topic} options={options.topic} onChange={set("topic")} />
            <Filter label="Command word" value={filters.command} options={options.command} onChange={set("command")} />
            <Filter label="Status" value={filters.status} options={["open", "retried", "fixed"]} labels={STATUS_LABEL} onChange={set("status")} />
            {showTypes && <Filter label="Mistake type" value={filters.type} options={options.type} labels={MISTAKE_TYPE_LABEL} onChange={set("type")} />}
          </div>

          {shown.length === 0 ? (
            <div className="subnote" role="status">No lost marks match these filters.</div>
          ) : (
            <div className="card tallycard">
              {shown.map((r) => (
                <div className="tallyrow" key={r.id}>
                  <div className="top">
                    <span className="n">{r.subject ? `${r.subject} · ` : ""}{r.question_label}</span>
                    <span className="v">{numMark(r.marks_lost)}<small>of {numMark(r.marks_available)} lost</small></span>
                  </div>
                  <div className="meta">
                    {[r.topic_label, r.command_word ? `“${r.command_word}”` : null, r.ao,
                      showTypes && r.mistake_type ? MISTAKE_TYPE_LABEL[r.mistake_type as MistakeType] : null,
                      STATUS_LABEL[r.status],
                      r.status === "fixed" ? null : `next ${new Date(r.next_review_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`,
                      r.recurrence_count > 1 ? `seen in ${r.recurrence_count} papers` : null,
                    ].filter(Boolean).join(" · ")}
                  </div>
                  <Disclose label="Your answer and the explanation">
                    <div className="qfield" style={{ borderTop: 0, padding: "4px 0" }}>
                      <div className="k">Your answer</div>
                      <div className={"v steps" + (r.original_answer ? "" : " empty")}>{r.original_answer ? <MathText text={r.original_answer} /> : "Blank"}</div>
                    </div>
                    <div className="qfield" style={{ padding: "4px 0" }}>
                      <div className="k">Where the marks went</div>
                      <div className={"v" + (r.explanation ? "" : " empty")}>{r.explanation ? <MathText text={r.explanation} /> : "No explanation was written for this part yet."}</div>
                    </div>
                    {r.attempt_id && <PressBox as={Link} to={paths.question(r.paper_id, r.attempt_id)} className="textaction">Open on the paper <Chevron /></PressBox>}
                  </Disclose>
                  <PressBox
                    as="button" type="button" className="textaction" disabled={busy !== null} aria-busy={busy === r.id}
                    onClick={async () => {
                      setBusy(r.id); setError(null);
                      try { await start("item", { key: r.id }); } catch (e) { setError(e instanceof Error ? e.message : "That did not start."); setBusy(null); }
                    }}
                  >
                    Practise this <Chevron />
                  </PressBox>
                </div>
              ))}
            </div>
          )}
          {error && <div role="alert" className="subnote">{error}</div>}
          <div className="subnote">From confirmed readings only. Your teacher&rsquo;s marks are never changed here.</div>
        </>
      )}
    </>
  );
}

function Filter({ label, value, options, labels, onChange }: {
  label: string; value: string; options: string[]; labels?: Record<string, string>;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  if (options.length === 0) return null;
  const id = `jf-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <label className="journalfilter" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={onChange}>
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
      </select>
    </label>
  );
}

const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => Boolean(x)))].sort();
