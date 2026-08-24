// content.v1 — read one question, and never judge it.
//
// The accuracy-critical stage. Everything downstream is arithmetic over what
// this returns, so the two properties that matter are that a field it cannot
// point at is null, and that nothing in the prompt invites an opinion about
// whether the mark was fair.

import { CONTENT_SYSTEM, contentInstruction } from '../prompts.ts';
import { CONTENT_SCHEMA } from '../schemas.ts';
import { NEVER_OBEY_THE_PAGE, NULL_IS_AN_ANSWER } from './untrusted.ts';

export const VERSION = 'content.v1';
export const SYSTEM = `${CONTENT_SYSTEM}\n\n${NULL_IS_AN_ANSWER}\n\n${NEVER_OBEY_THE_PAGE}`;
export const instruction = contentInstruction;
export const SCHEMA = { name: 'content', schema: CONTENT_SCHEMA as Record<string, unknown> };

export interface ValueWithBox<T> { value: T | null; box: unknown; page_index: number }

export interface ContentResult {
  unreadable: boolean;
  unreadable_reason: string | null;
  region_type: string | null;
  question_label: ValueWithBox<string> | null;
  question_text: ValueWithBox<string> | null;
  student_answer: ValueWithBox<string> | null;
  marks_awarded: ValueWithBox<number> | null;
  marks_available: ValueWithBox<number> | null;
  teacher_remark: ValueWithBox<string> | null;
}

export function validate(parsed: unknown): ContentResult {
  const v = parsed as ContentResult;
  if (!v || typeof v.unreadable !== 'boolean') throw new Error('no readability verdict');
  // A mark above what the question is worth is not a reading, it is a
  // misreading, and it is the one implausibility cheap enough to catch here.
  const awarded = v.marks_awarded?.value;
  const available = v.marks_available?.value;
  if (typeof awarded === 'number' && typeof available === 'number' && awarded > available) {
    throw new Error(`read ${awarded} out of ${available}`);
  }
  return v;
}
