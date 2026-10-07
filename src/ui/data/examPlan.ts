/* ═══════════════════════════════════════════════════════════════════════════
   EXAM PLAN — from timetable rows to "what's coming up"

   Pure. Every date shown comes from a board timetable row; nothing is
   inferred. A subject's papers are:
   · known: in every published route for the student's level (the syllabus
     says everyone sits them), and pre-filled;
   · chosen: what the student picked, when the routes allow more than one; or
   · open: no published route is stored for the syllabus, so the student picks
     from the papers in the timetable.
   A paper set on two dates in one zone (practical variants) is shown with both
   dates, because the school decides which; Axon does not pick one.
   ═══════════════════════════════════════════════════════════════════════════ */

export type ExamLocation = {
  location_key: string; lookup_value: string; label: string; country: string;
  zone: number; timetable_variant: string;
};
export type ExamTimetable = {
  id: string; provider_key: string; series_key: string; series_label: string; zone: number | null;
  timetable_variant: string; status: string; version_label: string | null; source_url: string;
  fetched_at: string; errata: string[]; first_date: string; last_date: string;
};
export type ExamSitting = {
  timetable_id: string; qualification: string; syllabus_code: string; component: string; paper: number;
  title: string; exam_date: string | null; session: "AM" | "PM" | "EV" | null; duration_minutes: number | null;
  window_start: string | null; window_end: string | null;
};
export type PaperRoute = { syllabus_code: string; programme_key: string; kind: "whole" | "complete"; papers: number[]; source_url: string };
export type ExamPlanInput = {
  subjects: { subject: string; syllabus_code: string | null }[];
  plan: { location_key: string | null; series_key: string | null } | null;
  location: ExamLocation | null;
  papers: { syllabus_code: string; papers: number[] }[];
  timetables: ExamTimetable[];
  routes: PaperRoute[];
  sittings: ExamSitting[];
};

/** name is the paper's subtitle in the timetable, or null when it prints none. */
export type PaperInfo = { paper: number; name: string | null };
export type SubjectPlan = {
  subject: string;
  code: string;
  /** Not in this series' timetable at all. */
  offered: boolean;
  routes: PaperRoute[];
  known: number[];
  /** The papers in force: chosen, or the only route. Null until chosen. */
  papers: number[] | null;
  source: "chosen" | "only-route" | null;
  /** The student still has to pick. */
  needsChoice: boolean;
  /** Every paper in this series for the syllabus, with its name. */
  available: PaperInfo[];
};
export type Upcoming = {
  subject: string; code: string; paper: number; name: string | null;
  /** One entry per date; two or more when the school chooses the variant. */
  dates: { component: string; date: string; session: "AM" | "PM" | "EV"; minutes: number }[];
};
export type Window = { subject: string; code: string; paper: number; name: string | null; from: string; to: string };

const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const sorted = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

/** "Mathematics (Pure Mathematics 1)" → "Pure Mathematics 1"; "Physics" → null. */
export function paperName(title: string): string | null {
  const parts = [...title.matchAll(/\(([^()]+)\)/g)].map((m) => m[1].trim());
  return parts.length ? parts.join(" · ") : null;
}

export function isoToday(now = new Date()): string {
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, "0"), d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Cambridge timetables for one location's zone (and UK variant). */
export function zoneTimetables(timetables: ExamTimetable[], location: Pick<ExamLocation, "zone" | "timetable_variant"> | null) {
  if (!location) return [];
  return timetables.filter((t) => t.provider_key === "cambridge" && t.zone === location.zone
    && t.timetable_variant === location.timetable_variant);
}

/** Series for a location that still have something ahead, earliest first. */
export function seriesOptions(timetables: ExamTimetable[], location: Pick<ExamLocation, "zone" | "timetable_variant"> | null, today: string) {
  return zoneTimetables(timetables, location)
    .filter((t) => t.last_date >= today)
    .sort((a, b) => a.series_key.localeCompare(b.series_key))
    .map((t) => ({ key: t.series_key, label: t.series_label, timetable: t }));
}

export function timetableFor(input: ExamPlanInput): ExamTimetable | null {
  const key = input.plan?.series_key;
  return key ? zoneTimetables(input.timetables, input.location).find((t) => t.series_key === key) ?? null : null;
}

export function subjectPlans(input: ExamPlanInput, programmeKey: string | null | undefined): SubjectPlan[] {
  const timetable = timetableFor(input);
  const out: SubjectPlan[] = [];
  for (const s of input.subjects) {
    if (!s.syllabus_code) continue;
    const code = s.syllabus_code;
    const rows = timetable ? input.sittings.filter((x) => x.timetable_id === timetable.id && x.syllabus_code === code) : [];
    const byPaper = new Map<number, string | null>();
    for (const r of [...rows].sort((a, b) => a.component.localeCompare(b.component))) {
      if (!byPaper.has(r.paper)) byPaper.set(r.paper, paperName(r.title));
    }
    const available = [...byPaper].sort((a, b) => a[0] - b[0]).map(([paper, name]) => ({ paper, name }));
    const routes = input.routes
      .filter((r) => r.syllabus_code === code && r.programme_key === programmeKey)
      .map((r) => ({ ...r, papers: sorted(r.papers) }));
    const known = routes.length
      ? routes.slice(1).reduce((acc, r) => acc.filter((p) => r.papers.includes(p)), routes[0].papers)
      : [];
    const stored = input.papers.find((p) => p.syllabus_code === code);
    let papers: number[] | null = null;
    let source: SubjectPlan["source"] = null;
    if (stored && (!routes.length || routes.some((r) => sameSet(r.papers, sorted(stored.papers))))) {
      papers = sorted(stored.papers);
      source = "chosen";
    } else if (routes.length === 1) {
      papers = routes[0].papers;
      source = "only-route";
    }
    out.push({
      subject: s.subject, code, offered: rows.length > 0, routes, known, papers, source,
      needsChoice: rows.length > 0 && papers === null, available,
    });
  }
  return out;
}

/** The student's own papers still ahead, in date order, and their test windows. */
export function upcoming(input: ExamPlanInput, plans: SubjectPlan[], today: string) {
  const timetable = timetableFor(input);
  const dated: Upcoming[] = [];
  const windows: Window[] = [];
  if (!timetable) return { dated, windows };
  for (const plan of plans) {
    if (!plan.papers) continue;
    for (const paper of plan.papers) {
      const rows = input.sittings.filter((x) => x.timetable_id === timetable.id && x.syllabus_code === plan.code && x.paper === paper);
      const name = plan.available.find((a) => a.paper === paper)?.name ?? null;
      const dates = rows
        .filter((r) => r.exam_date && r.exam_date >= today)
        .map((r) => ({ component: r.component, date: r.exam_date!, session: r.session!, minutes: r.duration_minutes! }))
        .sort((a, b) => a.date.localeCompare(b.date) || a.session.localeCompare(b.session));
      if (dates.length) dated.push({ subject: plan.subject, code: plan.code, paper, name, dates });
      for (const r of rows) {
        if (r.window_start && r.window_end && r.window_end >= today) {
          windows.push({ subject: plan.subject, code: plan.code, paper, name, from: r.window_start, to: r.window_end });
        }
      }
    }
  }
  dated.sort((a, b) => a.dates[0].date.localeCompare(b.dates[0].date) || a.dates[0].session.localeCompare(b.dates[0].session) || a.subject.localeCompare(b.subject));
  windows.sort((a, b) => a.from.localeCompare(b.from));
  return { dated, windows };
}

export function routeLabel(route: PaperRoute, available: PaperInfo[]): string {
  const ps = route.papers;
  const list = ps.length === 1 ? `Paper ${ps[0]}`
    : `Papers ${ps.slice(0, -1).join(", ")} and ${ps[ps.length - 1]}`;
  const names = ps.map((p) => available.find((a) => a.paper === p)?.name).filter(Boolean);
  return `${list}${route.kind === "complete" ? " · completing after AS" : ""}${names.length === ps.length ? ` (${names.join(", ")})` : ""}`;
}

/** Whole days from today to an ISO date, by the calendar. */
export function daysUntil(date: string, today: string): number {
  const [y1, m1, d1] = today.split("-").map(Number);
  const [y2, m2, d2] = date.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export const SESSION_LABEL = { AM: "Morning", PM: "Afternoon", EV: "Evening" } as const;

/** The browser's time zone city, matched to Cambridge's lookup, as a starting suggestion only. */
export function suggestLocation(locations: ExamLocation[], timeZone: string | undefined): ExamLocation | null {
  const city = timeZone?.split("/").pop()?.replace(/_/g, " ");
  if (!city) return null;
  const alias: Record<string, string> = { Calcutta: "Kolkata", Saigon: "Ho Chi Minh" };
  const want = alias[city] ?? city;
  const hits = locations.filter((l) => l.lookup_value === want);
  return hits.length === 1 ? hits[0] : null;
}
