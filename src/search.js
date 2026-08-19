// Library search.
//
// Search has to reach past paper titles — a student looking for "moment of
// inertia" is looking for a question, not for the words "Unit test 4". So the
// searchable text for a paper is assembled from what is actually in it: the
// question text we read, the teacher's remark, the concepts the attempts were
// tagged with, the chapters those concepts belong to, and — for Tier 2 — the
// canonical question text carrying the official wording.
//
// Assembled per paper and cached, rather than queried per keystroke. Three
// reasons: a query per keystroke is a request storm on a budget connection,
// filtering in memory keeps typing at 60fps, and a cached index means search
// still works offline, which is the one thing the offline rule promises for
// papers already scanned.
//
// Nothing here writes, and nothing here is recorded. What a student types into
// the search box is not stored, not sent anywhere, and not counted.

import { sb } from './supabase.js';
import { readThrough } from './cache.js';

/** Words we never want to match on — they appear in almost every paper. */
const NOISE = new Set(['the', 'a', 'an', 'of', 'and', 'to', 'in', 'is', 'for', 'on']);

function normalise(parts) {
  const seen = new Set();
  for (const part of parts) {
    if (!part) continue;
    for (const word of String(part).toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
      if (word.length > 1 && !NOISE.has(word)) seen.add(word);
    }
  }
  return [...seen].join(' ');
}

/**
 * Searchable text per paper, as a Map of paper id → text.
 *
 * Reads the base tables rather than the analytics views on purpose: this is a
 * lookup, not an aggregation. Hard rule 3 is about not *counting* unsure rows
 * into a conclusion — hiding an unsure attempt from search would be the other
 * failure, quietly making a page the student uploaded unfindable.
 */
export async function searchIndex(studentId) {
  return readThrough(`search:${studentId}`, async () => {
    const { data, error } = await sb
      .from('student_attempt')
      .select(
        `paper_id,question_label,question_text,teacher_remark,
         canonical_question(question_text),
         attempt_concept(concept(name,chapter(name,subject)))`,
      )
      .eq('student_id', studentId);
    if (error) throw error;

    const byPaper = new Map();
    for (const row of data ?? []) {
      const parts = [row.question_label, row.question_text, row.teacher_remark,
        row.canonical_question?.question_text];
      for (const link of row.attempt_concept ?? []) {
        parts.push(link.concept?.name, link.concept?.chapter?.name, link.concept?.chapter?.subject);
      }
      byPaper.set(row.paper_id, (byPaper.get(row.paper_id) ?? []).concat(parts));
    }
    return [...byPaper].map(([id, parts]) => [id, normalise(parts)]);
  });
}

/**
 * Attach the searchable text to each paper, and the subject and marks-lost
 * figures the library rows sort and filter on.
 *
 * Returns the same papers, so a failure here costs search but never the
 * library itself — an unsearchable list beats an empty one.
 */
export async function decorateForSearch(studentId, papers) {
  let index = new Map();
  try {
    const { data } = await searchIndex(studentId);
    index = new Map(data ?? []);
  } catch {
    /* offline with no cached index: titles and filters still work */
  }
  return papers.map((p) => ({
    ...p,
    search_text: index.get(p.id) ?? '',
    // Subject lives on the chapter, so it is only known for papers whose
    // attempts have been tagged. Blank means "unknown", and the subject filter
    // treats unknown as not-a-match rather than guessing.
    subject: p.subject ?? '',
  }));
}
