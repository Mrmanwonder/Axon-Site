import { useMemo } from "react";
import { useResource, isStale } from "./useResource";
import { examPlanData } from "./modules";
import { useApp } from "./AppProvider";
import { getCached } from "../../cache.js";
import { subjectPlans, timetableFor, upcoming, isoToday, type ExamPlanInput } from "./examPlan";

/** The student's exam plan, shaped. Loading is not "no exams" and a failed read is not either. */
export function useExamPlan() {
  const { student } = useApp();
  const subjectsKey = (student?.subject_selections ?? []).map((s) => s.external_code ?? s.subject).join(",");
  const { resource, reload } = useResource<ExamPlanInput>(
    student?.id && student.provider_key === "cambridge" ? `exams:${student.id}#${subjectsKey}` : null,
    async () => {
      const r = await examPlanData(student!.id);
      return { data: r.data, stale: r.stale };
    },
    async () => (await getCached(`exams:${student!.id}`)) as ExamPlanInput | null,
  );
  const today = isoToday();
  const shaped = useMemo(() => {
    const input = resource.data;
    if (!input) return null;
    const plans = subjectPlans(input, student?.programme_key);
    return { input, plans, timetable: timetableFor(input), ...upcoming(input, plans, today) };
  }, [resource.data, student?.programme_key, today]);
  return { state: resource.state, stale: isStale(resource), data: shaped, reload, today };
}
