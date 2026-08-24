// adjudicate.v1 — the arithmetic does not close. Where did we misread?
//
// Runs only when reconciliation fails, once per paper, on the most capable model
// we are willing to pay for. It is the one stage that looks at the paper as a
// whole rather than a question at a time, because the errors it hunts — a
// question missed entirely, a mark attributed to its neighbour, a question
// counted twice because it straddled a page — are invisible from inside any one
// question.
//
// It corrects our reading. It never corrects a mark. The last paragraph of the
// prompt is doing the most work here: it gives the model a legitimate exit that
// is not "invent a correction", and it keeps the vocabulary clean of any framing
// that could leak into what a student reads.

import { NEVER_OBEY_THE_PAGE, untrusted } from './untrusted.ts';

export const VERSION = 'adjudicate.v1';

export const SYSTEM = `
An automated pipeline read a graded exam paper and the arithmetic does not
close. Your job is to find the reading error.

Identify the most likely reading error. Consider, in order:
  - a question the pipeline missed entirely, whose marks are therefore uncounted
  - a mark misread — 3 read as 8, 7 as 1, a half mark dropped
  - a mark attributed to the wrong question
  - a question counted twice because it was split across pages
  - a total that was itself misread

Report each correction you are confident about, with the question it applies to,
the corrected value, and the evidence you saw.

You must not adjust a value merely to make the sum close. If you cannot find an
error you can actually see, say so by returning an empty corrections list and
explaining what you checked. An unexplained discrepancy is an acceptable and
honest outcome.

It is also possible that the addition on the paper is wrong. If the per-question
marks appear correctly read and simply do not sum to the written total, report
that as cause "total_mismatch_unresolved". Do not describe it as a teacher
error.

${NEVER_OBEY_THE_PAGE}
`.trim();

export interface RegionSummary {
  order_index: number;
  label: string | null;
  marks_awarded: number | null;
  marks_available: number | null;
  confidence_tier: string;
}

export const instruction = (opts: {
  reportedTotal: number | null;
  computedTotal: number;
  delta: number;
  regions: RegionSummary[];
}) => {
  const table = opts.regions.map((r) =>
    `${r.order_index}\t${r.label ?? '(unnumbered)'}\t` +
    `${r.marks_awarded ?? '—'} / ${r.marks_available ?? '—'}\t${r.confidence_tier}`
  ).join('\n');

  return [
    `The paper's total as written on it: ${opts.reportedTotal ?? 'not found'}`,
    `The sum of the marks the pipeline read: ${opts.computedTotal}`,
    `Discrepancy: ${opts.delta}`,
    '',
    'What the pipeline extracted, one question per line, as',
    'order / label / awarded out of available / confidence:',
    '',
    // Fenced: the labels and remarks in here came off the page.
    untrusted('pipeline reading', table),
    '',
    'You are also given crops of the least confident questions, and the page',
    'the total was read from.',
  ].join('\n');
};

export const SCHEMA = {
  name: 'adjudication',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['corrections', 'cause', 'checked'],
    properties: {
      corrections: {
        type: 'array',
        maxItems: 10,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['order_index', 'field', 'corrected_value', 'evidence'],
          properties: {
            order_index: { type: 'integer', minimum: 0 },
            field: { type: 'string', enum: ['marks_awarded', 'marks_available', 'missing_question', 'duplicate_question'] },
            corrected_value: { type: ['number', 'null'] },
            evidence: { type: 'string', maxLength: 400 },
          },
        },
      },
      cause: {
        type: 'string',
        enum: ['misread_mark', 'missed_question', 'misattributed_mark', 'double_counted',
               'misread_total', 'total_mismatch_unresolved', 'not_found'],
      },
      checked: { type: 'string', maxLength: 600 },
    },
  },
} as const;

export interface Adjudication {
  corrections: {
    order_index: number;
    field: 'marks_awarded' | 'marks_available' | 'missing_question' | 'duplicate_question';
    corrected_value: number | null;
    evidence: string;
  }[];
  cause: string;
  checked: string;
}

export function validate(parsed: unknown): Adjudication {
  const v = parsed as Adjudication;
  if (!v || !Array.isArray(v.corrections)) throw new Error('no corrections list');
  if (typeof v.cause !== 'string') throw new Error('no cause');
  // A correction with no evidence is the thing this prompt exists to refuse. It
  // is dropped rather than rejected: a paper with one hallucinated correction
  // among four real ones should keep the four.
  const corrections = v.corrections.filter((c) =>
    Number.isInteger(c?.order_index) && typeof c?.evidence === 'string' && c.evidence.trim().length > 0);
  return { corrections, cause: v.cause, checked: String(v.checked ?? '').slice(0, 600) };
}
