// Curriculum reference client.
//
// The database is the catalog authority. This module contains only taxonomy
// helpers, caching, formatting and backwards-compatibility shims for legacy
// Cambridge rows. Subject lists never live in application code.

import { sb } from './supabase.js';

export const PROVIDER_KEYS = ['cambridge', 'cbse', 'ib'];

const PROVIDER_LABELS = {
  cambridge: 'Cambridge',
  cbse: 'CBSE',
  ib: 'IB Diploma',
};

const cache = {
  providers: null,
  programmes: new Map(),
  programmeByKey: new Map(),
  stages: new Map(),
  stageByKey: new Map(),
  offerings: new Map(),
};

function rowsOrThrow(result) {
  if (result.error) throw result.error;
  return result.data ?? [];
}

export async function getProviders() {
  if (!cache.providers) {
    cache.providers = sb.from('curriculum_provider')
      .select('id,key,name')
      .eq('active', true)
      .order('name')
      .then(rowsOrThrow);
  }
  return cache.providers;
}

async function providerByKey(key) {
  const providers = await getProviders();
  const provider = providers.find((row) => row.key === key);
  if (!provider) throw new Error('That curriculum is unavailable.');
  return provider;
}

async function programmeByKey(key) {
  if (!cache.programmeByKey.has(key)) {
    cache.programmeByKey.set(key, sb.from('curriculum_programme')
      .select('id,provider_id,key,label,metadata')
      .eq('key', key)
      .eq('active', true)
      .single()
      .then((result) => {
        if (result.error) throw result.error;
        return result.data;
      }));
  }
  return cache.programmeByKey.get(key);
}

async function stageByKey(key) {
  if (!cache.stageByKey.has(key)) {
    cache.stageByKey.set(key, sb.from('curriculum_stage')
      .select('id,programme_id,key,label,school_year_label,legacy_class_level,sort_order,metadata')
      .eq('key', key)
      .eq('active', true)
      .single()
      .then((result) => {
        if (result.error) throw result.error;
        return result.data;
      }));
  }
  return cache.stageByKey.get(key);
}

export async function getProgrammes(providerKey) {
  if (!cache.programmes.has(providerKey)) {
    cache.programmes.set(providerKey, providerByKey(providerKey).then((provider) =>
      sb.from('curriculum_programme')
        .select('id,provider_id,key,label,metadata')
        .eq('provider_id', provider.id)
        .eq('active', true)
        .order('label')
        .then(rowsOrThrow)
    ));
  }
  return cache.programmes.get(providerKey);
}

export async function getStages(programmeKey) {
  if (!cache.stages.has(programmeKey)) {
    cache.stages.set(programmeKey, programmeByKey(programmeKey).then((programme) =>
      sb.from('curriculum_stage')
        .select('id,programme_id,key,label,school_year_label,legacy_class_level,sort_order,metadata')
        .eq('programme_id', programme.id)
        .eq('active', true)
        .order('sort_order')
        .then(rowsOrThrow)
    ));
  }
  return cache.stages.get(programmeKey);
}

export async function getSubjectOfferings({ programmeKey, stageKey }) {
  const cacheKey = `${programmeKey}:${stageKey}`;
  if (!cache.offerings.has(cacheKey)) {
    cache.offerings.set(cacheKey, Promise.all([
      programmeByKey(programmeKey),
      stageByKey(stageKey),
    ]).then(([programme, stage]) => {
      if (stage.programme_id !== programme.id) throw new Error('Stage does not belong to this curriculum.');
      return sb.from('subject_offering')
        .select('id,programme_id,stage_id,subject_id,display_name,external_code,external_code_kind,levels_supported,language_code,variant,aliases,metadata')
        .eq('programme_id', programme.id)
        .eq('stage_id', stage.id)
        .eq('availability', 'active')
        .order('display_name')
        .then(rowsOrThrow);
    }));
  }
  return cache.offerings.get(cacheKey);
}

export function filterSubjectOfferings(offerings, query) {
  const q = String(query ?? '').trim().toLocaleLowerCase();
  if (!q) return offerings;
  return offerings.filter((offering) => {
    const haystack = [
      offering.display_name,
      offering.external_code,
      offering.language_code,
      offering.variant,
      ...(offering.aliases ?? []),
      offering.metadata?.group,
      offering.metadata?.group_key,
    ].filter(Boolean).join(' ').toLocaleLowerCase();
    return haystack.includes(q);
  });
}

export function formatSubjectIdentity(offering, selectedLevel = null) {
  if (!offering) return '';
  const suffix = [offering.external_code, selectedLevel].filter(Boolean).join(' · ');
  return suffix ? `${offering.display_name} · ${suffix}` : offering.display_name;
}

export function validateSubjectSelection(offering, level = null) {
  const levels = offering?.levels_supported ?? [];
  if (!levels.length) return level == null || level === '';
  return !!level && levels.includes(level);
}

export function defaultLevelFor(offering) {
  const levels = offering?.levels_supported ?? [];
  return levels.length === 1 ? levels[0] : null;
}

export function providerLabel(key) {
  return PROVIDER_LABELS[key] ?? key ?? '';
}

export function programmeLabelFromKey(key) {
  return {
    cambridge_igcse: 'Cambridge IGCSE',
    cambridge_as: 'Cambridge International AS Level',
    cambridge_a_level: 'Cambridge International A Level',
    cbse_secondary: 'CBSE Secondary',
    cbse_senior_secondary: 'CBSE Senior Secondary',
    ibdp: 'IB Diploma Programme',
  }[key] ?? key ?? '';
}

export function stageLabelFromKey(key) {
  return {
    cambridge_igcse_y10: 'IGCSE · Year 10',
    cambridge_igcse_y11: 'IGCSE · Year 11',
    cambridge_as: 'AS Level · Year 12',
    cambridge_a_level: 'A Level · Year 13',
    cbse_9: 'Class 9',
    cbse_10: 'Class 10',
    cbse_11: 'Class 11',
    cbse_12: 'Class 12',
    ibdp_1: 'DP1',
    ibdp_2: 'DP2',
  }[key] ?? key ?? '';
}

export function legacyCurriculumForStudent(student = {}) {
  if (student.programme_key && student.stage_key) {
    return {
      providerKey: student.provider_key,
      programmeKey: student.programme_key,
      stageKey: student.stage_key,
    };
  }
  const n = Number(student.class_level);
  if (student.board === 'CBSE') {
    return {
      providerKey: 'cbse',
      programmeKey: n <= 10 ? 'cbse_secondary' : 'cbse_senior_secondary',
      stageKey: `cbse_${n}`,
    };
  }
  if (student.board === 'IBDP') {
    return { providerKey: 'ib', programmeKey: 'ibdp', stageKey: null };
  }
  if (n <= 10) {
    return {
      providerKey: 'cambridge',
      programmeKey: 'cambridge_igcse',
      stageKey: n === 9 ? 'cambridge_igcse_y10' : 'cambridge_igcse_y11',
    };
  }
  return {
    providerKey: 'cambridge',
    programmeKey: n === 11 ? 'cambridge_as' : 'cambridge_a_level',
    stageKey: n === 11 ? 'cambridge_as' : 'cambridge_a_level',
  };
}

export function assessmentRulesFor({ providerKey, programmeKey } = {}) {
  const provider = providerKey
    ?? (programmeKey?.startsWith('cambridge_') ? 'cambridge'
      : programmeKey?.startsWith('cbse_') ? 'cbse'
      : programmeKey === 'ibdp' ? 'ib' : null);
  // Do not invent half marks. A provider-specific adapter may narrow or extend
  // this when an official assessment model proves a different granularity.
  return {
    provider,
    markStep: 1,
    maxPrecision: 0,
    supportsTeacherPenMarks: true,
    officialSchemeTerminology: provider === 'cbse' ? 'marking scheme'
      : provider === 'ib' ? 'markscheme'
      : 'mark scheme',
    paperLabels: paperLabelsFor(provider),
  };
}

export function paperLabelsFor(providerKey) {
  if (providerKey === 'cbse') {
    return { pyq: 'Board paper', sample_paper: 'Sample Question Paper' };
  }
  if (providerKey === 'ib') {
    return { pyq: 'Examination paper', sample_paper: 'Official sample paper' };
  }
  return { pyq: 'Cambridge past paper', sample_paper: 'Specimen paper' };
}

// ── Legacy compatibility ───────────────────────────────────────────────────
// Kept while old code paths and historical cached profiles still exist. New
// onboarding/settings code uses the normalized async API above.
export const BOARD = 'CAIE';
export const BOARD_LABEL = 'Cambridge (CAIE)';
export const CLASS_LEVELS = [9, 10, 11, 12];
export const STAGES = [
  { stage: 'igcse', label: 'IGCSE', classLevels: [9, 10] },
  { stage: 'as_level', label: 'AS Level', classLevels: [11] },
  { stage: 'a_level', label: 'A Level', classLevels: [12] },
];
const YEAR_OF_CLASS = { 9: 10, 10: 11, 11: 12, 12: 13 };
export function stageForClass(classLevel) {
  const n = Number(classLevel);
  return STAGES.find((s) => s.classLevels.includes(n)) ?? STAGES[0];
}
export function classLabel(classLevel) {
  const n = Number(classLevel);
  return `${stageForClass(n).label} · Year ${YEAR_OF_CLASS[n] ?? n}`;
}
export function classLabelShort(classLevel) {
  const n = Number(classLevel);
  const stage = stageForClass(n);
  return stage.stage === 'igcse' ? `IGCSE Y${YEAR_OF_CLASS[n]}` : stage.label;
}
export function nextClassLevel(classLevel) {
  const i = CLASS_LEVELS.indexOf(Number(classLevel));
  return i >= 0 && i < CLASS_LEVELS.length - 1 ? CLASS_LEVELS[i + 1] : null;
}
export function subjectsForClass() { return []; }
export function syllabusCode() { return null; }
export function subjectLabel(subject, code) {
  return code ? `${subject} · ${code}` : subject;
}
