// The curriculum the app is scoped to.
//
// v1 is Cambridge (CAIE) only: IGCSE, AS Level and A Level. One board, stated
// in one place, so nothing downstream has to guess which syllabus a paper sits
// against.
//
// `student.class_level` stays a 9-12 smallint because that is what the schema
// holds and what an Indian Cambridge school calls its grades. Cambridge's own
// year names are the labels, not the storage:
//
//   class 9  → IGCSE, Year 10        class 11 → AS Level, Year 12
//   class 10 → IGCSE, Year 11        class 12 → A Level, Year 13
//
// The mapping is one-to-one, so the stage is derived rather than stored — two
// columns that must agree are two columns that eventually don't.

export const BOARD = 'CAIE';
export const BOARD_LABEL = 'Cambridge (CAIE)';

/** Stages, in the order a student moves through them. */
export const STAGES = [
  { stage: 'igcse',    label: 'IGCSE',    classLevels: [9, 10] },
  { stage: 'as_level', label: 'AS Level', classLevels: [11] },
  { stage: 'a_level',  label: 'A Level',  classLevels: [12] },
];

/** Cambridge year name per class level, for labelling only. */
const YEAR_OF_CLASS = { 9: 10, 10: 11, 11: 12, 12: 13 };

export const CLASS_LEVELS = [9, 10, 11, 12];

export function stageForClass(classLevel) {
  const n = Number(classLevel);
  return STAGES.find((s) => s.classLevels.includes(n)) ?? STAGES[0];
}

/** "IGCSE · Year 11". The form used everywhere the class is shown. */
export function classLabel(classLevel) {
  const n = Number(classLevel);
  return `${stageForClass(n).label} · Year ${YEAR_OF_CLASS[n] ?? n}`;
}

/** Short form, for a settings row's value column. */
export function classLabelShort(classLevel) {
  const n = Number(classLevel);
  const stage = stageForClass(n);
  return stage.stage === 'igcse' ? `IGCSE Y${YEAR_OF_CLASS[n]}` : stage.label;
}

/** The class level a student moves to next, or null at the end of A Level. */
export function nextClassLevel(classLevel) {
  const i = CLASS_LEVELS.indexOf(Number(classLevel));
  return i >= 0 && i < CLASS_LEVELS.length - 1 ? CLASS_LEVELS[i + 1] : null;
}

// ── subjects ────────────────────────────────────────────────────────────────
// The syllabus code is the thing that identifies a Cambridge subject: "Physics"
// is 0625 at IGCSE and 9702 at A Level, and they are different syllabuses with
// different papers and different mark schemes. Carrying the code means a past
// paper can be matched to the right one rather than to a subject name that
// happens to collide.

const IGCSE_SUBJECTS = [
  { subject: 'Mathematics',                code: '0580' },
  { subject: 'Additional Mathematics',     code: '0606' },
  { subject: 'Physics',                    code: '0625' },
  { subject: 'Chemistry',                  code: '0620' },
  { subject: 'Biology',                    code: '0610' },
  { subject: 'Combined Science',           code: '0653' },
  { subject: 'Computer Science',           code: '0478' },
  { subject: 'Economics',                  code: '0455' },
  { subject: 'Business Studies',           code: '0450' },
  { subject: 'Accounting',                 code: '0452' },
  { subject: 'English — First Language',   code: '0500' },
  { subject: 'English as a Second Language', code: '0510' },
  { subject: 'English Literature',         code: '0475' },
  { subject: 'Geography',                  code: '0460' },
  { subject: 'History',                    code: '0470' },
  { subject: 'ICT',                        code: '0417' },
];

const A_LEVEL_SUBJECTS = [
  { subject: 'Mathematics',        code: '9709' },
  { subject: 'Further Mathematics', code: '9231' },
  { subject: 'Physics',            code: '9702' },
  { subject: 'Chemistry',          code: '9701' },
  { subject: 'Biology',            code: '9700' },
  { subject: 'Computer Science',   code: '9618' },
  { subject: 'Economics',          code: '9708' },
  { subject: 'Business',           code: '9609' },
  { subject: 'Accounting',         code: '9706' },
  { subject: 'English Language',   code: '9093' },
  { subject: 'English Literature', code: '9695' },
  { subject: 'Psychology',         code: '9990' },
  { subject: 'Geography',          code: '9696' },
  { subject: 'History',            code: '9489' },
  { subject: 'Sociology',          code: '9699' },
];

/**
 * Subjects offered at a class level, each with its Cambridge syllabus code.
 * AS and A Level share a syllabus code — the difference is which papers are
 * sat, not which syllabus — so both stages read the same list.
 */
export function subjectsForClass(classLevel) {
  return stageForClass(classLevel).stage === 'igcse' ? IGCSE_SUBJECTS : A_LEVEL_SUBJECTS;
}

/** Code for a subject at a class level, or null if it isn't offered there. */
export function syllabusCode(subject, classLevel) {
  return subjectsForClass(classLevel).find((s) => s.subject === subject)?.code ?? null;
}

/** "Physics · 9702", the form used wherever a chosen subject is displayed. */
export function subjectLabel(subject, code) {
  return code ? `${subject} · ${code}` : subject;
}
