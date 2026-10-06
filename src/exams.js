/**
 * Official exam dates for the student's own papers (AXO-207).
 *
 * Reads the student's exam plan (where they sit, which series), the papers they
 * chose per syllabus, the syllabus paper routes, and the timetable rows for
 * their subjects. Every date comes from a board timetable row with its source;
 * nothing here is inferred. The shaping into "what's next" lives in
 * src/ui/data/examPlan.ts so it can be tested without a network.
 */

import { sb } from './supabase.js';
import { readThrough, clearCache } from './cache.js';

function requireOnline(action) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error(`${action} needs a connection.`);
  }
}

/** Every location in Cambridge's zone lookup. Reference data; cached long. */
export async function examLocations() {
  return readThrough('exam-locations', async () => {
    const { data, error } = await sb
      .from('exam_zone_location')
      .select('location_key,lookup_value,label,country,zone,timetable_variant')
      .order('label');
    if (error) throw error;
    return data ?? [];
  });
}

export async function examPlanData(studentId) {
  return readThrough(`exams:${studentId}`, async () => {
    const [subjectsRes, planRes, papersRes, timetablesRes] = await Promise.all([
      sb.from('student_subject').select('subject,syllabus_code').eq('student_id', studentId).order('subject'),
      sb.from('student_exam_plan').select('location_key,series_key,updated_at').eq('student_id', studentId).maybeSingle(),
      sb.from('student_exam_papers').select('syllabus_code,papers,updated_at').eq('student_id', studentId),
      sb.from('exam_timetable')
        .select('id,provider_key,series_key,series_label,zone,timetable_variant,status,version_label,source_url,fetched_at,errata,first_date,last_date')
        .order('series_key'),
    ]);
    for (const r of [subjectsRes, planRes, papersRes, timetablesRes]) if (r.error) throw r.error;
    const subjects = subjectsRes.data ?? [];
    const codes = [...new Set(subjects.map((s) => s.syllabus_code).filter(Boolean))];
    const plan = planRes.data ?? null;

    let location = null;
    if (plan?.location_key) {
      const { data, error } = await sb.from('exam_zone_location')
        .select('location_key,lookup_value,label,country,zone,timetable_variant')
        .eq('location_key', plan.location_key).maybeSingle();
      if (error) throw error;
      location = data ?? null;
    }

    const timetables = timetablesRes.data ?? [];
    const chosen = location && plan?.series_key
      ? timetables.find((t) => t.provider_key === 'cambridge' && t.zone === location.zone
          && t.timetable_variant === location.timetable_variant && t.series_key === plan.series_key)
      : null;

    let routes = [];
    let sittings = [];
    if (codes.length) {
      const routeRes = await sb.from('syllabus_paper_route')
        .select('syllabus_code,programme_key,kind,papers,source_url')
        .in('syllabus_code', codes);
      if (routeRes.error) throw routeRes.error;
      routes = routeRes.data ?? [];
      if (chosen) {
        const sitRes = await sb.from('exam_sitting')
          .select('timetable_id,qualification,syllabus_code,component,paper,title,exam_date,session,duration_minutes,window_start,window_end')
          .eq('timetable_id', chosen.id)
          .in('syllabus_code', codes);
        if (sitRes.error) throw sitRes.error;
        sittings = sitRes.data ?? [];
      }
    }
    return { subjects, plan, location, papers: papersRes.data ?? [], timetables, routes, sittings };
  });
}

/** Where the student sits and which series. Either may be cleared with null. */
export async function saveExamPlan(studentId, { locationKey, seriesKey }) {
  requireOnline('Saving your exam plan');
  const { error } = await sb.from('student_exam_plan').upsert(
    { student_id: studentId, location_key: locationKey ?? null, series_key: seriesKey ?? null },
    { onConflict: 'student_id' },
  );
  if (error) throw error;
  await clearCache();
}

/** The papers the student sits for one syllabus. null clears the choice. */
export async function saveExamPapers(studentId, syllabusCode, papers) {
  requireOnline('Saving your papers');
  if (papers === null || papers.length === 0) {
    const { error } = await sb.from('student_exam_papers').delete()
      .eq('student_id', studentId).eq('syllabus_code', syllabusCode);
    if (error) throw error;
  } else {
    const { error } = await sb.from('student_exam_papers').upsert(
      { student_id: studentId, syllabus_code: syllabusCode, papers },
      { onConflict: 'student_id,syllabus_code' },
    );
    if (error) throw error;
  }
  await clearCache();
}
