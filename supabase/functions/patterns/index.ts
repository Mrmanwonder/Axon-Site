// Cross-paper pattern detection -- UX_AND_MONETIZATION_THESIS.md §2.4/§3.
//
// Runs after a paper's extraction commits (called once per student, from
// wherever ensureScan()/the review flow finishes a commit -- see
// src/scan/ui.js). Detects a real, repeated `cause` across attempts the
// student has already confirmed or that were confident enough not to need
// confirming (mark_loss_analytics -- hard rule 3 excludes anything unsure and
// unconfirmed, so a pattern can never be built on a bad read).
//
// Two outputs, deliberately asymmetric:
//   - single_subject: >=2 papers, one subject, same cause. Free. Written and
//     fully readable regardless of tier -- this is the thesis's "the student's
//     experience of this insight must be identical whether or not the parent
//     has Pro" made concrete.
//   - cross_subject: >=2 subjects, same cause, seeded by the same set of
//     papers. Computed and stored the SAME WAY, on the SAME SCHEDULE,
//     regardless of tier -- the detector always tells the truth. What differs
//     is who can SELECT it back out, and that gate lives in RLS
//     (pattern_insight_select_cross_subject), not here.
//
// No model call: the cause is already a confirmed/likely fact from
// mark_loss_analytics, and the summary is assembled from a fixed template, not
// generated -- there is nothing here for CLAUDE.md's hard rule 1 to violate,
// because there is no model output to violate it with.

import { CORS, clientFor, failure, json, readJson } from '../_shared/http.ts';

interface Body { student_id: string }

const CAUSE_LABEL: Record<string, string> = {
  conceptual_gap: 'a concept gap', procedural_slip: 'a slip in the working',
  misread_question: 'misreading the question', incomplete: 'leaving the answer incomplete',
  presentation: 'how the answer was presented', keyword_miss: 'a missing keyword',
  timed_out: 'running out of time',
};

interface Row { attempt_id: string; cause: string; subject: string | null; paper_id: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const sb = clientFor(req);
  if (!sb) return failure('Sign in first.', 401);

  const body = await readJson<Body>(req);
  if (!body?.student_id) return failure('A student is needed.');

  // RLS-scoped: this can only ever see rows the caller's own guardian owns
  // (student_all_own / attempt policies), so there is no id to spoof here.
  const { data: rows, error } = await sb
    .from('mark_loss_analytics')
    .select('attempt_id, cause, student_attempt!inner(paper_id, student_id, paper:paper(subject))')
    .eq('student_attempt.student_id', body.student_id);
  if (error) return failure('Could not read this student\'s marking history.', 500, error.message);

  const flat: Row[] = (rows ?? []).map((r: any) => ({
    attempt_id: r.attempt_id,
    cause: r.cause,
    subject: r.student_attempt?.paper?.subject ?? null,
    paper_id: r.student_attempt?.paper_id,
  })).filter((r) => r.subject && r.paper_id);

  const byCause = new Map<string, Row[]>();
  for (const r of flat) {
    if (!byCause.has(r.cause)) byCause.set(r.cause, []);
    byCause.get(r.cause)!.push(r);
  }

  const written: { scope: string; cause: string; subjects: string[] }[] = [];

  for (const [cause, causeRows] of byCause) {
    const bySubject = new Map<string, Set<string>>(); // subject -> paper ids
    for (const r of causeRows) {
      if (!bySubject.has(r.subject!)) bySubject.set(r.subject!, new Set());
      bySubject.get(r.subject!)!.add(r.paper_id);
    }

    // single_subject: any one subject with the same cause on >=2 papers.
    for (const [subject, paperIds] of bySubject) {
      if (paperIds.size < 2) continue;
      const ids = [...paperIds];
      const questionCount = causeRows.filter((r) => r.subject === subject).length;
      const summary = `Across your last ${ids.length} ${subject} papers, ${CAUSE_LABEL[cause] ?? cause} has cost marks each time.`;
      const { error: upErr } = await sb.from('pattern_insight').upsert({
        student_id: body.student_id, scope: 'single_subject', cause,
        subjects: [subject], paper_ids: ids, question_count: questionCount, summary_text: summary,
        detected_at: new Date().toISOString(),
      }, { onConflict: 'student_id,scope,cause,subjects' });
      if (!upErr) written.push({ scope: 'single_subject', cause, subjects: [subject] });
    }

    // cross_subject: the same cause recurring (>=2 papers total) across >=2
    // distinct subjects. This is the signal that only exists because we are
    // looking across the whole corpus, not any one paper -- Part 2.2's line.
    const subjectsWithRecurrence = [...bySubject.entries()].filter(([, ids]) => ids.size >= 1);
    const distinctSubjects = [...new Set(subjectsWithRecurrence.map(([s]) => s))].sort();
    const allPaperIds = [...new Set(causeRows.map((r) => r.paper_id))];
    if (distinctSubjects.length >= 2 && allPaperIds.length >= 2) {
      const summary = `The same pattern -- ${CAUSE_LABEL[cause] ?? cause} -- shows up in both ${distinctSubjects.join(' and ')}.`;
      const { error: upErr } = await sb.from('pattern_insight').upsert({
        student_id: body.student_id, scope: 'cross_subject', cause,
        subjects: distinctSubjects, paper_ids: allPaperIds, question_count: causeRows.length, summary_text: summary,
        detected_at: new Date().toISOString(),
      }, { onConflict: 'student_id,scope,cause,subjects' });
      if (!upErr) written.push({ scope: 'cross_subject', cause, subjects: distinctSubjects });
    }
  }

  return json({ student_id: body.student_id, patterns_written: written });
});
