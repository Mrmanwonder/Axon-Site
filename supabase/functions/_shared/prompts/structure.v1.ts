// structure.v1 — where does each question start and stop?
//
// The text is the one already in `_shared/prompts.ts`, re-exported here rather
// than copied, so there is one place it can be read and one place a change to it
// would have to happen. Versioned files are never edited in place: a changed
// prompt gets a new file and a new version string, so model_call rows stay
// comparable across the change.

import { CONTENT_SYSTEM, STRUCTURE_SYSTEM, contentInstruction, structureInstruction } from '../prompts.ts';
import { STRUCTURE_SCHEMA } from '../schemas.ts';
import { NEVER_OBEY_THE_PAGE } from './untrusted.ts';

export const VERSION = 'structure.v1';
export const SYSTEM = `${STRUCTURE_SYSTEM}\n\n${NEVER_OBEY_THE_PAGE}`;
export const instruction = structureInstruction;
export const SCHEMA = { name: 'structure', schema: STRUCTURE_SCHEMA as Record<string, unknown> };

export interface StructureResult {
  is_graded_exam_paper: boolean;
  not_a_paper_reason: string | null;
  reported_total: { value: number | null; box: unknown } | null;
  stated_maximum: { value: number | null; box: unknown } | null;
  regions: {
    candidate_number: string | null;
    number_box: unknown;
    box: { x: number; y: number; w: number; h: number };
    continues_from_previous: boolean;
    structure_confidence: 'high' | 'low';
  }[];
}

export function validate(parsed: unknown): StructureResult {
  const v = parsed as StructureResult;
  if (!v || typeof v.is_graded_exam_paper !== 'boolean') throw new Error('no verdict on the page');
  if (!Array.isArray(v.regions)) throw new Error('no regions array');
  // A region without a box is a region we cannot show the student, and a region
  // we cannot show is one the provenance rule says does not exist.
  const regions = v.regions.filter((r) =>
    r?.box && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite((r.box as Record<string, number>)[k])));
  return { ...v, regions };
}

export { CONTENT_SYSTEM, contentInstruction };
