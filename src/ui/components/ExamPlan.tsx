/* ═══════════════════════════════════════════════════════════════════════════
   WHAT'S COMING UP — the student's own exam dates (AXO-207)

   Home shows the next papers from the board's own timetable. Cambridge sets
   dates by administrative zone, so the card asks once where the student sits
   and which series; both stay editable in Settings, as does every paper choice.
   Papers every route requires are filled in from the syllabus; the rest the
   student picks. Nothing here is a guess: a date without a timetable row is
   not shown, and a paper set on two dates shows both.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppDropdown from "./AppDropdown";
import PressBox from "./PressBox";
import { useApp } from "../data/AppProvider";
import { useToast } from "./ToastProvider";
import { examLocations, saveExamPapers, saveExamPlan } from "../data/modules";
import { useExamPlan } from "../data/useExamPlan";
import {
  SESSION_LABEL, daysUntil, routeLabel, seriesOptions, suggestLocation,
  type ExamLocation, type ExamTimetable, type SubjectPlan, type Upcoming,
} from "../data/examPlan";
import { paths } from "../app/paths";
import "../styles/exams.css";

const asDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const dayLabel = (iso: string) => asDate(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const shortDay = (iso: string) => asDate(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const duration = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);
const join = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const papersText = (ps: number[]) => (ps.length === 1 ? `Paper ${ps[0]}` : `Papers ${join(ps.map(String))}`);

function countdown(date: string, today: string) {
  const n = daysUntil(date, today);
  return n <= 0 ? "Today" : n === 1 ? "Tomorrow" : `In ${n} days`;
}

/** The location list, loaded only where the student is choosing one. */
function useLocations(enabled: boolean) {
  const [locations, setLocations] = useState<ExamLocation[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled || locations) return;
    let live = true;
    examLocations().then((r) => { if (live) setLocations(r.data); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [enabled, locations]);
  return { locations, failed };
}

/** Country, then city only where a country spans zones, then series. */
function PlanSetup({ timetables, current, today, onSaved, onCancel, compact, quiet }: {
  timetables: ExamTimetable[]; current: { location_key: string | null; series_key: string | null } | null;
  today: string; onSaved: () => void; onCancel?: () => void; compact?: boolean;
  /** On a screen whose one primary action is something else. */
  quiet?: boolean;
}) {
  const { student } = useApp();
  const toast = useToast();
  const { locations, failed } = useLocations(true);
  const [locationKey, setLocationKey] = useState<string | null>(current?.location_key ?? null);
  const [seriesKey, setSeriesKey] = useState<string | null>(current?.series_key ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!locations || locationKey) return;
    const hint = suggestLocation(locations, Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (hint) setLocationKey(hint.location_key);
  }, [locations, locationKey]);

  const location = locations?.find((l) => l.location_key === locationKey) ?? null;
  const countries = useMemo(() => [...new Set((locations ?? []).map((l) => l.country))].sort((a, b) => a.localeCompare(b)), [locations]);
  const inCountry = (locations ?? []).filter((l) => l.country === location?.country);
  const zonesInCountry = new Set(inCountry.map((l) => `${l.zone}${l.timetable_variant}`));
  const series = seriesOptions(timetables, location, today);
  const seriesValid = series.some((s) => s.key === seriesKey);

  useEffect(() => {
    if (location && !seriesValid && series.length) setSeriesKey(series[0].key);
  }, [location, seriesValid, series]);

  if (failed) return <p className="examnote">The list of exam regions could not be loaded. Try again with a connection.</p>;
  if (!locations) return <p className="examnote" aria-busy="true">Loading exam regions…</p>;

  const save = async () => {
    if (!student || !location) return;
    setBusy(true);
    try {
      await saveExamPlan(student.id, { locationKey: location.location_key, seriesKey: seriesValid ? seriesKey : null });
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Your exam plan could not be saved.", "warn");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`examsetup${compact ? " compact" : ""}`}>
      <div className="examfield">
        <span>Country</span>
        <AppDropdown ariaLabel="Country where you sit your exams" value={location?.country ?? ""}
          options={[...(location ? [] : [{ value: "", label: "Choose a country" }]), ...countries.map((c) => ({ value: c, label: c }))]}
          onChange={(c) => { const first = locations.find((l) => l.country === c); setLocationKey(first?.location_key ?? null); }} />
      </div>
      {location && zonesInCountry.size > 1 && (
        <div className="examfield">
          <span>City or time zone</span>
          <AppDropdown ariaLabel="City or time zone" value={location.location_key}
            options={inCountry.map((l) => ({ value: l.location_key, label: l.label.replace(`${l.country}, `, "") }))}
            onChange={setLocationKey} />
        </div>
      )}
      {location && (
        <div className="examfield">
          <span>Exam series</span>
          {series.length
            ? <AppDropdown ariaLabel="Exam series" value={seriesValid ? seriesKey! : series[0].key}
                options={series.map((s) => ({ value: s.key, label: s.label }))} onChange={setSeriesKey} />
            : <p className="examnote">Cambridge hasn&rsquo;t published the next timetable for this region yet. Axon will show dates once it does.</p>}
        </div>
      )}
      {location && <p className="examnote">Cambridge zone {location.zone}{location.timetable_variant === "uk" ? ", UK timetable" : ""}.</p>}
      <div className="examactions">
        <PressBox as="button" type="button" className={`btn ${quiet ? "ghost" : "primary"}`} disabled={!location || busy} onClick={() => void save()}>
          {busy ? "Saving…" : "Save"}
        </PressBox>
        {onCancel && <button type="button" className="btn plain" disabled={busy} onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

/** One subject's papers: a published route, or the papers in the timetable. */
function PaperChooser({ plan, seriesLabel, onSaved, onCancel }: {
  plan: SubjectPlan; seriesLabel: string; onSaved: () => void; onCancel: () => void;
}) {
  const { student } = useApp();
  const toast = useToast();
  // Nothing is pre-selected that the student has not chosen; the known papers are stated in words.
  const [picked, setPicked] = useState<number[]>(plan.papers ?? []);
  const [busy, setBusy] = useState(false);
  const routed = plan.routes.length > 0;
  const valid = routed ? plan.routes.some((r) => r.papers.join() === [...picked].sort((a, b) => a - b).join()) : picked.length > 0;

  const save = async (papers: number[] | null) => {
    if (!student) return;
    setBusy(true);
    try {
      await saveExamPapers(student.id, plan.code, papers);
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Your papers could not be saved.", "warn");
    } finally {
      setBusy(false);
    }
  };

  if (!plan.offered) {
    return <div className="examchooser"><p className="examnote">{plan.subject} ({plan.code}) is not in the {seriesLabel} timetable for your region.</p>
      <div className="examactions"><button type="button" className="btn plain" onClick={onCancel}>Close</button></div></div>;
  }
  return (
    <div className="examchooser">
      {routed ? <>
        <p className="examnote">
          {plan.known.length ? `Everyone at your level sits ${papersText(plan.known)}. ` : ""}
          Choose the papers you are entered for in {seriesLabel}.
        </p>
        <div className="examopts" role="radiogroup" aria-label={`${plan.subject} papers`}>
          {plan.routes.map((r) => {
            const on = r.papers.join() === [...picked].sort((a, b) => a - b).join();
            return (
              <PressBox key={r.papers.join()} as="button" type="button" role="radio" aria-checked={on}
                className={`examopt${on ? " on" : ""}`} onClick={() => setPicked(r.papers)}>
                <span className="mark" aria-hidden="true" />{routeLabel(r, plan.available)}
              </PressBox>
            );
          })}
        </div>
      </> : <>
        <p className="examnote">Tick the {plan.subject} papers you are entered for in {seriesLabel}. Your school or the syllabus tells you which.</p>
        <div className="examopts" role="group" aria-label={`${plan.subject} papers`}>
          {plan.available.map((a) => {
            const on = picked.includes(a.paper);
            return (
              <PressBox key={a.paper} as="button" type="button" role="checkbox" aria-checked={on}
                className={`examopt check${on ? " on" : ""}`}
                onClick={() => setPicked(on ? picked.filter((p) => p !== a.paper) : [...picked, a.paper])}>
                <span className="mark" aria-hidden="true" />Paper {a.paper}{a.name ? ` · ${a.name}` : ""}
              </PressBox>
            );
          })}
        </div>
      </>}
      <div className="examactions">
        <PressBox as="button" type="button" className="btn primary" disabled={!valid || busy}
          onClick={() => void save([...picked].sort((a, b) => a - b))}>{busy ? "Saving…" : "Save"}</PressBox>
        {plan.source === "chosen" && <button type="button" className="btn plain" disabled={busy} onClick={() => void save(null)}>Clear</button>}
        <button type="button" className="btn plain" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function Source({ timetable }: { timetable: ExamTimetable }) {
  return (
    <p className="widgetnote examsource">
      From Cambridge&rsquo;s {timetable.series_label} timetable for zone {timetable.zone}
      {timetable.timetable_variant === "uk" ? " (UK)" : ""}{timetable.version_label ? `, ${timetable.version_label}` : ""}.{" "}
      <a href={timetable.source_url} target="_blank" rel="noreferrer">Source</a>
      {timetable.errata.length > 0 && <> · Axon corrected {timetable.errata.length === 1 ? "one date" : `${timetable.errata.length} dates`} printed wrongly in the weekly view, confirmed by the timetable&rsquo;s own A&ndash;Z list.</>}
    </p>
  );
}

function VariantNote({ u }: { u: Upcoming }) {
  if (u.dates.length < 2) return null;
  return <div className="examvariant">Set on {join(u.dates.map((d) => `${dayLabel(d.date)} (${SESSION_LABEL[d.session].toLowerCase()})`))}. Your school tells you which.</div>;
}

/** Home: the next papers, or the one question needed to show them. */
export function ExamCard({ quiet = false }: { quiet?: boolean } = {}) {
  const { student } = useApp();
  const provider = student?.provider_key ?? null;
  const exam = useExamPlan();

  if (!student) return null;
  if (provider === "cbse") {
    return <div className="card examcard"><div className="eyebrow">What&rsquo;s coming up</div><div className="t1">No exam dates yet</div>
      <div className="t2">CBSE hasn&rsquo;t published the 2027 board exam date sheet. Your dates will appear here once it does.</div></div>;
  }
  if (provider === "ib") {
    return <div className="card examcard"><div className="eyebrow">What&rsquo;s coming up</div><div className="t1">No exam dates yet</div>
      <div className="t2">IB exam dates aren&rsquo;t in Axon yet.</div></div>;
  }
  if (provider !== "cambridge") return null;
  if (!exam.data) {
    if (exam.state === "failed") {
      return <div className="card examcard"><div className="eyebrow">What&rsquo;s coming up</div><div className="t1">Exam dates didn&rsquo;t load</div>
        <div className="t2">This needs a connection.</div>
        <button type="button" className="textaction" onClick={() => void exam.reload()}>Try again</button></div>;
    }
    return <div className="card examcard" aria-busy="true"><div className="eyebrow">What&rsquo;s coming up</div><div className="t2">Loading your exam dates…</div></div>;
  }

  const { input, plans, timetable, dated, windows } = exam.data;
  if (!input.location || !timetable) {
    return (
      <div className="card examcard">
        <div className="eyebrow">What&rsquo;s coming up</div>
        <div className="t1">Where do you sit your exams?</div>
        <div className="t2">Cambridge sets exam dates by region. Axon reads your papers from that timetable. You can change this in Settings.</div>
        <PlanSetup timetables={input.timetables} current={input.plan} today={exam.today} onSaved={() => void exam.reload()} compact quiet={quiet} />
      </div>
    );
  }

  const choose = plans.filter((p) => p.needsChoice);
  const [next, ...rest] = dated;
  return (
    <div className="card examcard">
      <div className="eyebrow">What&rsquo;s coming up</div>
      {next ? <>
        <div className="examnext">
          <div className="when">{countdown(next.dates[0].date, exam.today)}</div>
          <div className="t1">{next.subject} · Paper {next.paper}</div>
          <div className="t2">{next.name ? `${next.name} · ` : ""}{dayLabel(next.dates[0].date)} · {SESSION_LABEL[next.dates[0].session]} · {duration(next.dates[0].minutes)}</div>
          <VariantNote u={next} />
        </div>
        {rest.length > 0 && (
          <ol className="examlist">
            {rest.slice(0, 5).map((u) => (
              <li key={`${u.code}-${u.paper}`}>
                <span className="d">{shortDay(u.dates[0].date)}</span>
                <span className="w">{u.subject} · Paper {u.paper}{(u.name || u.dates.length > 1) && <small>{[u.name, u.dates.length > 1 ? "school sets the date" : null].filter(Boolean).join(" · ")}</small>}</span>
                <span className="s">{u.dates[0].session}</span>
              </li>
            ))}
          </ol>
        )}
        {rest.length > 5 && <div className="examnote">{rest.length - 5} more in {timetable.series_label}.</div>}
      </> : <>
        <div className="t1">{choose.length ? `${timetable.series_label}` : `Nothing left in ${timetable.series_label}`}</div>
        <div className="t2">{choose.length
          ? "Choose your papers to see their dates."
          : "None of your papers have a date ahead in this series. You can pick the next series in Settings once Cambridge publishes it."}</div>
      </>}
      {windows.length > 0 && (
        <div className="examwindows">
          {windows.map((w) => (
            <div key={`${w.code}-${w.paper}`}>{w.subject} · Paper {w.paper}: your school schedules it {w.from === w.to ? `on ${shortDay(w.from)}` : `between ${shortDay(w.from)} and ${shortDay(w.to)}`}.</div>
          ))}
        </div>
      )}
      {choose.length > 0 && (
        <div className="examask">
          <span>Which {join(choose.map((c) => c.subject))} papers do you sit?</span>
          <Link to={`${paths.settings}#exams`} className="textaction">Choose papers</Link>
        </div>
      )}
      <Source timetable={timetable} />
    </div>
  );
}

/** Settings: where, which series, and each subject's papers. */
export function ExamSettings() {
  const { student } = useApp();
  const exam = useExamPlan();
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#exams") {
      document.getElementById("exams")?.scrollIntoView({ block: "start" });
    }
  }, [exam.data]);

  if (!student || student.provider_key !== "cambridge") return null;
  const done = () => { setEditing(null); void exam.reload(); };

  return <>
    <div className="sectitle" id="exams">Exams</div>
    {!exam.data ? (
      <div className="list"><div className="srow noicon"><div className="lbl">
        {exam.state === "failed" ? "Your exam plan could not be loaded." : "Loading…"}</div></div></div>
    ) : (() => {
      const { input, plans, timetable } = exam.data;
      const seriesLabel = timetable?.series_label ?? "this series";
      return (
        <div className="list examsettings">
          {editing === "plan" ? (
            <div className="examedit"><PlanSetup timetables={input.timetables} current={input.plan} today={exam.today} onSaved={done} onCancel={() => setEditing(null)} /></div>
          ) : (
            <PressBox as="button" type="button" className="srow noicon" data-interactive="" onClick={() => setEditing("plan")}>
              <div className="lbl">Where and when<small>{input.location ? input.location.label.replace(/ - .*$/, "") : "Not set"}</small></div>
              <div className="aux">{timetable ? timetable.series_label : "Choose"}</div>
            </PressBox>
          )}
          {timetable && plans.map((p) => editing === p.code ? (
            <div key={p.code} className="examedit">
              <div className="examedithead">{p.subject} · {p.code}</div>
              <PaperChooser plan={p} seriesLabel={seriesLabel} onSaved={done} onCancel={() => setEditing(null)} />
            </div>
          ) : (
            <PressBox key={p.code} as="button" type="button" className="srow noicon" data-interactive="" onClick={() => setEditing(p.code)}>
              <div className="lbl">{p.subject}<small>{p.code}</small></div>
              <div className="aux">{!p.offered ? `Not in ${seriesLabel}` : p.papers ? papersText(p.papers) : "Choose papers"}</div>
            </PressBox>
          ))}
        </div>
      );
    })()}
  </>;
}
