import { sb } from './supabase.js';

/**
 * Normalized curriculum client.
 *
 * The database is authoritative. The small Cambridge constants at the bottom
 * are compatibility exports for old screens/tests during the migration only;
 * new profile code must use programme/stage/offering identities.
 */

export const PROVIDERS = [
  { key: 'cambridge', label: 'Cambridge' },
  { key: 'cbse', label: 'CBSE' },
  { key: 'ib', label: 'IB Diploma' },
];

export const PROGRAMMES = {
  cambridge: [
    { key: 'cambridge_igcse', label: 'Cambridge IGCSE' },
    { key: 'cambridge_as', label: 'Cambridge International AS Level' },
    { key: 'cambridge_a_level', label: 'Cambridge International A Level' },
  ],
  cbse: [
    { key: 'cbse_secondary', label: 'CBSE Secondary' },
    { key: 'cbse_senior_secondary', label: 'CBSE Senior Secondary' },
  ],
  ib: [{ key: 'ibdp', label: 'IB Diploma Programme' }],
};

export const STAGE_OPTIONS = {
  cambridge_igcse: [
    { key: 'cambridge_igcse_y10', label: 'IGCSE · Year 10' },
    { key: 'cambridge_igcse_y11', label: 'IGCSE · Year 11' },
  ],
  cambridge_as: [{ key: 'cambridge_as', label: 'AS Level · Year 12' }],
  cambridge_a_level: [{ key: 'cambridge_a_level', label: 'A Level · Year 13' }],
  cbse_secondary: [
    { key: 'cbse_9', label: 'Class 9' },
    { key: 'cbse_10', label: 'Class 10' },
  ],
  cbse_senior_secondary: [
    { key: 'cbse_11', label: 'Class 11' },
    { key: 'cbse_12', label: 'Class 12' },
  ],
  ibdp: [
    { key: 'ibdp_1', label: 'DP1' },
    { key: 'ibdp_2', label: 'DP2' },
  ],
};

const catalogueCache = new Map();

export function providerForProgramme(programmeKey) {
  for (const [provider, programmes] of Object.entries(PROGRAMMES)) {
    if (programmes.some((p) => p.key === programmeKey)) return provider;
  }
  return null;
}

export function programmeForStage(stageKey) {
  for (const [programme, stages] of Object.entries(STAGE_OPTIONS)) {
    if (stages.some((s) => s.key === stageKey)) return programme;
  }
  return null;
}

export function stagesForProgramme(programmeKey) {
  return STAGE_OPTIONS[programmeKey] ?? [];
}

export function programmesForProvider(providerKey) {
  return PROGRAMMES[providerKey] ?? [];
}

export function defaultProgramme(providerKey) {
  return programmesForProvider(providerKey)[0]?.key ?? null;
}

export function defaultStage(programmeKey) {
  return stagesForProgramme(programmeKey)[0]?.key ?? null;
}

export async function getSubjectOfferings({ programmeKey, stageKey, force = false }) {
  const cacheKey = `${programmeKey}:${stageKey}`;
  if (!force && catalogueCache.has(cacheKey)) return catalogueCache.get(cacheKey);

  const [{ data: programme, error: programmeError }, { data: stage, error: stageError }] =
    await Promise.all([
      sb.from('curriculum_programme').select('id').eq('key', programmeKey).single(),
      sb.from('curriculum_stage').select('id').eq('key', stageKey).single(),
    ]);
  if (programmeError) throw programmeError;
  if (stageError) throw stageError;

  const { data, error } = await sb
    .from('subject_offering')
    .select('id,display_name,external_code,external_code_kind,levels_supported,language_code,variant,aliases,metadata')
    .eq('programme_id', programme.id)
    .eq('stage_id', stage.id)
    .eq('availability', 'active')
    .order('display_name', { ascending: true });
  if (error) throw error;

  const normalized = (data ?? []).map((row) => ({
    id: row.id,
    displayName: row.display_name,
    externalCode: row.external_code,
    externalCodeKind: row.external_code_kind,
    levelsSupported: row.levels_supported ?? [],
    languageCode: row.language_code,
    variant: row.variant || null,
    aliases: row.aliases ?? [],
    group: row.metadata?.subject_group ?? row.metadata?.group ?? null,
  }));
  catalogueCache.set(cacheKey, normalized);
  return normalized;
}

export function filterSubjectOfferings(offerings, query) {
  const q = String(query ?? '').trim().toLocaleLowerCase();
  if (!q) return offerings;
  return offerings.filter((o) => [
    o.displayName, o.externalCode, o.languageCode, o.group, ...(o.aliases ?? []),
  ].some((v) => String(v ?? '').toLocaleLowerCase().includes(q)));
}

export function formatSubjectIdentity(offering, level = null) {
  const bits = [offering?.displayName];
  if (offering?.externalCode) bits.push(offering.externalCode);
  if (level) bits.push(level);
  return bits.filter(Boolean).join(' · ');
}

export function assessmentRulesFor({ providerKey } = {}) {
  // Current official paper models in Axon all store integer mark allocations.
  // This function is intentionally provider-scoped so a future assessment that
  // permits another granularity can change without a global arithmetic switch.
  return {
    markStep: 1,
    maxPrecision: 0,
    supportsTeacherPenMarks: true,
    providerKey: providerKey ?? null,
  };
}

export function paperLabelsFor(providerKey) {
  if (providerKey === 'cbse') return { pyq: 'Board paper', sample_paper: 'Sample Question Paper' };
  if (providerKey === 'ib') return { pyq: 'Examination paper', sample_paper: 'Official sample paper' };
  return { pyq: 'Past paper', sample_paper: 'Specimen paper' };
}

// ---------------------------------------------------------------------------
// Compatibility exports. Remove only after all callers use normalized identity.
// ---------------------------------------------------------------------------
export const BOARD = 'CAIE';
export const BOARD_LABEL = 'Cambridge (legacy)';
export const CLASS_LEVELS = [9, 10, 11, 12];
export const STAGES = [
  { stage: 'igcse', label: 'IGCSE', classLevels: [9, 10] },
  { stage: 'as_level', label: 'AS Level', classLevels: [11] },
  { stage: 'a_level', label: 'A Level', classLevels: [12] },
];
const YEAR_OF_CLASS = { 9: 10, 10: 11, 11: 12, 12: 13 };
const IGCSE_SUBJECTS = [
  ['Mathematics','0580'],['Additional Mathematics','0606'],['Physics','0625'],['Chemistry','0620'],
  ['Biology','0610'],['Combined Science','0653'],['Computer Science','0478'],['Economics','0455'],
  ['Business Studies','0450'],['Accounting','0452'],['English — First Language','0500'],
  ['English as a Second Language','0510'],['English Literature','0475'],['Geography','0460'],
  ['History','0470'],['ICT','0417'],
].map(([subject,code]) => ({ subject, code }));
const A_LEVEL_SUBJECTS = [
  ['Mathematics','9709'],['Further Mathematics','9231'],['Physics','9702'],['Chemistry','9701'],
  ['Biology','9700'],['Computer Science','9618'],['Economics','9708'],['Business','9609'],
  ['Accounting','9706'],['English Language','9093'],['English Literature','9695'],['Psychology','9990'],
  ['Geography','9696'],['History','9489'],['Sociology','9699'],
].map(([subject,code]) => ({ subject, code }));
export function stageForClass(classLevel) {
  const n=Number(classLevel); return STAGES.find((s)=>s.classLevels.includes(n)) ?? STAGES[0];
}
export function classLabel(classLevel) {
  const n=Number(classLevel); return `${stageForClass(n).label} · Year ${YEAR_OF_CLASS[n] ?? n}`;
}
export function classLabelShort(classLevel) {
  const n=Number(classLevel), s=stageForClass(n); return s.stage==='igcse' ? `IGCSE Y${YEAR_OF_CLASS[n]}` : s.label;
}
export function nextClassLevel(classLevel) {
  const i=CLASS_LEVELS.indexOf(Number(classLevel)); return i>=0 && i<CLASS_LEVELS.length-1 ? CLASS_LEVELS[i+1] : null;
}
export function subjectsForClass(classLevel) {
  return stageForClass(classLevel).stage==='igcse' ? IGCSE_SUBJECTS : A_LEVEL_SUBJECTS;
}
export function syllabusCode(subject,classLevel) {
  return subjectsForClass(classLevel).find((s)=>s.subject===subject)?.code ?? null;
}
export function subjectLabel(subject,code) { return code ? `${subject} · ${code}` : subject; }
