import { describe, expect, it } from "vitest";
import {
  daysUntil, paperName, routeLabel, seriesOptions, subjectPlans, suggestLocation, upcoming,
  type ExamPlanInput, type ExamSitting, type ExamTimetable, type PaperRoute,
} from "../../src/ui/data/examPlan";

const SRC = "https://www.cambridgeinternational.org/Images/x.pdf";
const tt = (id: string, series: string, label: string, zone: number, first: string, last: string, variant = ""): ExamTimetable => ({
  id, provider_key: "cambridge", series_key: series, series_label: label, zone, timetable_variant: variant, status: "final",
  version_label: "Version 1, April 2026", source_url: SRC, fetched_at: "2026-10-06T00:00:00Z", errata: [], first_date: first, last_date: last,
});
const NOV4 = tt("t-nov4", "2026-11", "November 2026", 4, "2026-09-28", "2026-11-13");
const MAR4 = tt("t-mar4", "2027-03", "March 2027", 4, "2027-02-03", "2027-03-10");
const NOV1 = tt("t-nov1", "2026-11", "November 2026", 1, "2026-09-28", "2026-11-13");

// Real rows: Cambridge November 2026, zone 4.
const sit = (code: string, component: string, title: string, date: string | null, session: "AM" | "PM" | null, minutes: number | null, win?: [string, string]): ExamSitting => ({
  timetable_id: "t-nov4", qualification: "as", syllabus_code: code, component,
  paper: component[0] === "0" ? Number(component[1]) : Number(component[0]),
  title, exam_date: date, session, duration_minutes: minutes, window_start: win?.[0] ?? null, window_end: win?.[1] ?? null,
});
const SITTINGS: ExamSitting[] = [
  sit("9709", "12", "Mathematics (Pure Mathematics 1)", "2026-09-30", "PM", 110),
  sit("9709", "22", "Mathematics (Pure Mathematics 2)", "2026-10-13", "PM", 110),
  sit("9709", "32", "Mathematics (Pure Mathematics 3)", "2026-10-15", "PM", 110),
  sit("9709", "42", "Mathematics (Mechanics)", "2026-10-13", "PM", 75),
  sit("9709", "52", "Mathematics (Probability & Statistics 1)", "2026-10-07", "PM", 75),
  sit("9709", "62", "Mathematics (Probability & Statistics 2)", "2026-10-13", "PM", 75),
  sit("9702", "12", "Physics (Multiple Choice)", "2026-11-10", "PM", 75),
  sit("9702", "22", "Physics", "2026-10-14", "PM", 75),
  sit("9702", "33", "Physics (Advanced Practical Skills)", "2026-10-08", "PM", 120),
  sit("9702", "34", "Physics (Advanced Practical Skills)", "2026-10-22", "PM", 120),
  sit("9702", "42", "Physics", "2026-10-12", "PM", 120),
  sit("9702", "52", "Physics (Planning, Analysis & Evaluation)", "2026-10-14", "PM", 75),
  sit("9618", "12", "Computer Science", "2026-10-09", "AM", 90),
  sit("9618", "22", "Computer Science", "2026-10-14", "AM", 120),
  sit("9618", "32", "Computer Science", "2026-10-20", "AM", 90),
  sit("9618", "42", "Computer Science (Practical)", null, null, null, ["2026-10-29", "2026-10-29"]),
  sit("0625", "12", "Physics (Multiple Choice - Core)", "2026-11-05", "AM", 45),
  sit("0625", "22", "Physics (Multiple Choice - Extended)", "2026-11-05", "AM", 45),
];
const route = (code: string, programme: string, kind: "whole" | "complete", papers: number[]): PaperRoute => ({ syllabus_code: code, programme_key: programme, kind, papers, source_url: SRC });
const ROUTES: PaperRoute[] = [
  route("9709", "cambridge_as", "whole", [1, 2]), route("9709", "cambridge_as", "whole", [1, 4]), route("9709", "cambridge_as", "whole", [1, 5]),
  route("9709", "cambridge_a_level", "whole", [1, 3, 4, 5]), route("9709", "cambridge_a_level", "whole", [1, 3, 5, 6]),
  route("9709", "cambridge_a_level", "complete", [3, 5]), route("9709", "cambridge_a_level", "complete", [3, 4]), route("9709", "cambridge_a_level", "complete", [3, 6]),
  route("9702", "cambridge_as", "whole", [1, 2, 3]), route("9702", "cambridge_a_level", "whole", [1, 2, 3, 4, 5]), route("9702", "cambridge_a_level", "complete", [4, 5]),
  route("9618", "cambridge_as", "whole", [1, 2]), route("9618", "cambridge_a_level", "whole", [1, 2, 3, 4]), route("9618", "cambridge_a_level", "complete", [3, 4]),
];
const LOC = { location_key: "India, Kolkata - India Standard Time", lookup_value: "Kolkata", label: "India, Kolkata - India Standard Time", country: "India", zone: 4, timetable_variant: "" };

function input(over: Partial<ExamPlanInput> = {}): ExamPlanInput {
  return {
    subjects: [{ subject: "Mathematics", syllabus_code: "9709" }, { subject: "Physics", syllabus_code: "9702" }, { subject: "Computer Science", syllabus_code: "9618" }],
    plan: { location_key: LOC.location_key, series_key: "2026-11" }, location: LOC, papers: [],
    timetables: [NOV4, MAR4, NOV1], routes: ROUTES, sittings: SITTINGS, ...over,
  };
}

describe("exam plan", () => {
  it("names papers from the timetable title", () => {
    expect(paperName("Mathematics (Pure Mathematics 1)")).toBe("Pure Mathematics 1");
    expect(paperName("English as a Second Language (Speaking Endorsement) (Listening)")).toBe("Speaking Endorsement · Listening");
    expect(paperName("Physics")).toBeNull();
  });

  it("offers only the location's zone and series with something still ahead", () => {
    expect(seriesOptions([NOV4, MAR4, NOV1], LOC, "2026-10-06").map((s) => s.key)).toEqual(["2026-11", "2027-03"]);
    expect(seriesOptions([NOV4, MAR4, NOV1], LOC, "2026-11-20").map((s) => s.key)).toEqual(["2027-03"]);
    expect(seriesOptions([NOV4], { zone: 3, timetable_variant: "uk" }, "2026-10-06")).toEqual([]);
  });

  it("fills in what every route requires and asks for the rest (AS: 9709 P1 known)", () => {
    const plans = subjectPlans(input(), "cambridge_as");
    const maths = plans.find((p) => p.code === "9709")!;
    expect(maths.known).toEqual([1]);
    expect(maths.needsChoice).toBe(true);
    // A syllabus with one AS route needs no question.
    const phys = plans.find((p) => p.code === "9702")!;
    expect([phys.papers, phys.source, phys.needsChoice]).toEqual([[1, 2, 3], "only-route", false]);
  });

  it("A Level: Paper 3 is known; P3 and P6 after AS is a valid choice", () => {
    const plans = subjectPlans(input({ papers: [{ syllabus_code: "9709", papers: [6, 3] }] }), "cambridge_a_level");
    const maths = plans.find((p) => p.code === "9709")!;
    expect(maths.known).toEqual([3]);
    expect([maths.papers, maths.source]).toEqual([[3, 6], "chosen"]);
    const physics = plans.find((p) => p.code === "9702")!;
    expect(physics.known).toEqual([4, 5]);
  });

  it("ignores a stored choice that is no longer a route at the student's level", () => {
    const plans = subjectPlans(input({ papers: [{ syllabus_code: "9709", papers: [3, 6] }] }), "cambridge_as");
    expect(plans.find((p) => p.code === "9709")!.papers).toBeNull();
  });

  it("lists the student's own papers ahead, both dates for a school-set variant, and windows", () => {
    const i = input({ papers: [{ syllabus_code: "9709", papers: [1, 5] }] });
    const plans = subjectPlans(i, "cambridge_as");
    const { dated, windows } = upcoming(i, plans, "2026-10-06");
    // P1 (30 Sep) is past; 9709 P5 is next on 7 Oct.
    expect(dated[0]).toMatchObject({ code: "9709", paper: 5, name: "Probability & Statistics 1" });
    const practical = dated.find((u) => u.code === "9702" && u.paper === 3)!;
    expect(practical.dates.map((d) => d.date)).toEqual(["2026-10-08", "2026-10-22"]);
    expect(dated.some((u) => u.code === "9709" && u.paper === 1)).toBe(false);
    // A route label names papers only when every one has a printed subtitle.
    const phys = plans.find((p) => p.code === "9702")!;
    expect(routeLabel(phys.routes[0], phys.available)).toBe("Papers 1, 2 and 3");
    expect(windows).toEqual([]); // AS Computer Science is papers 1 and 2; P4's window is A Level only
  });

  it("shows a test window for a paper the student sits", () => {
    const i = input();
    const { windows } = upcoming(i, subjectPlans(i, "cambridge_a_level").map((p) => p.code === "9618" ? { ...p, papers: [1, 2, 3, 4] } : p), "2026-10-06");
    expect(windows).toEqual([{ subject: "Computer Science", code: "9618", paper: 4, name: "Practical", from: "2026-10-29", to: "2026-10-29" }]);
  });

  it("a syllabus without routes waits for the student's ticks", () => {
    const i = input({ subjects: [{ subject: "Physics", syllabus_code: "0625" }] });
    const [p] = subjectPlans(i, "cambridge_igcse");
    expect([p.needsChoice, p.available.map((a) => a.paper)]).toEqual([true, [1, 2]]);
  });

  it("a subject not in the series is said so, never asked", () => {
    const i = input({ subjects: [{ subject: "Biology", syllabus_code: "9700" }] });
    expect(subjectPlans(i, "cambridge_as")[0]).toMatchObject({ offered: false, needsChoice: false });
  });

  it("labels routes and counts days by the calendar", () => {
    const maths = subjectPlans(input(), "cambridge_a_level").find((p) => p.code === "9709")!;
    expect(routeLabel(maths.routes.find((r) => r.kind === "complete" && r.papers.join() === "3,6")!, maths.available))
      .toBe("Papers 3 and 6 · completing after AS (Pure Mathematics 3, Probability & Statistics 2)");
    expect(daysUntil("2026-10-15", "2026-10-06")).toBe(9);
    expect(daysUntil("2027-03-01", "2027-02-28")).toBe(1);
  });

  it("suggests a location only on an exact, unique time-zone city match", () => {
    expect(suggestLocation([LOC], "Asia/Kolkata")).toBe(LOC);
    expect(suggestLocation([LOC], "Asia/Calcutta")).toBe(LOC);
    expect(suggestLocation([LOC], "Europe/London")).toBeNull();
  });
});
