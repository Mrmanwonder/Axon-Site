// explain_tier1.v1 — why this mark went, with no scheme to lean on.
//
// Tier 1 is a school test with no official marking scheme in the library. Hard
// rule 2 means we do not reconstruct one: the explanation is grounded in the
// teacher's actual marks and their own words, or it is not written.
//
// This is the only prompt whose output a student reads as prose, and the only
// place page-derived text goes into a prompt as text rather than as pixels — so
// it is the one that has to fence its inputs.

import { EXPLANATION_SYSTEM } from '../prompts.ts';
import { EXPLANATION_SCHEMA } from '../schemas.ts';
import { NEVER_OBEY_THE_PAGE, untrusted } from './untrusted.ts';

export const VERSION = 'explain_tier1.v1';

export const SYSTEM = `
${EXPLANATION_SYSTEM}

There is no official marking scheme for this paper. Do not describe one, do not
approximate one, and do not write "the scheme expected". You have the teacher's
marks and the teacher's own words, and that is what the explanation is built
from. Where they are not enough to say why the mark went, say that, and point
the student at their teacher.

${NEVER_OBEY_THE_PAGE}
`.trim();

export const instruction = (opts: {
  label: string | null;
  subject: string | null;
  classLevel: number | null;
  marksAwarded: number;
  marksAvailable: number;
  questionText: string | null;
  studentAnswer: string | null;
  teacherRemark: string | null;
  markShapes: string[];
}) => {
  const lines = [
    `Question ${opts.label ?? '(unnumbered)'}${opts.subject ? `, ${opts.subject}` : ''}` +
      `${opts.classLevel ? `, class ${opts.classLevel}` : ''}.`,
    `The teacher gave ${opts.marksAwarded} out of ${opts.marksAvailable}. ` +
      `That number is a fact and is not yours to revisit.`,
  ];

  if (opts.markShapes.length) {
    lines.push(
      `The teacher's pen on this question: ${opts.markShapes.join(', ')}. ` +
      `Where they circled or underlined something, that is the best anchor you have.`,
    );
  }

  const fenced: string[] = [];
  if (opts.questionText) fenced.push(untrusted('question', opts.questionText));
  if (opts.studentAnswer) fenced.push(untrusted('student answer', opts.studentAnswer));
  if (opts.teacherRemark) fenced.push(untrusted('teacher remark', opts.teacherRemark));

  if (!fenced.length) {
    lines.push(
      'Nothing of the question or the answer could be transcribed — you have only ' +
      'the crop. If that is not enough to say why the mark went, return a null cause.',
    );
  }

  return [...lines, '', ...fenced].join('\n');
};

export const SCHEMA = { name: 'explanation', schema: EXPLANATION_SCHEMA as Record<string, unknown> };

export interface ExplanationResult {
  cause: string | null;
  marks_lost: number | null;
  body: string | null;
  do_this_next: string | null;
  concepts: string[];
}

const CAUSES = new Set([
  'conceptual_gap', 'procedural_slip', 'misread_question',
  'incomplete', 'presentation', 'keyword_miss', 'timed_out',
]);

export function validate(parsed: unknown): ExplanationResult {
  const v = parsed as ExplanationResult;
  if (!v || typeof v !== 'object') throw new Error('nothing returned');
  // The cause enum is fixed. A model that invents an eighth cause is telling us
  // something, but it is not telling the analytics anything it can aggregate.
  const cause = v.cause && CAUSES.has(v.cause) ? v.cause : null;
  return {
    cause,
    marks_lost: cause && typeof v.marks_lost === 'number' && v.marks_lost > 0 ? v.marks_lost : null,
    body: typeof v.body === 'string' && v.body.trim() ? v.body.trim() : null,
    do_this_next: typeof v.do_this_next === 'string' && v.do_this_next.trim() ? v.do_this_next.trim() : null,
    concepts: Array.isArray(v.concepts) ? v.concepts.filter((c) => typeof c === 'string').slice(0, 6) : [],
  };
}
