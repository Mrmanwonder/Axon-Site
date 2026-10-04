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

function recoverCachedRequest(map, key) {
  const pending = map.get(key);
  return pending.catch(error => {
    if (map.get(key) === pending) map.delete(key);
    throw error;
  });
}

export async function getProviders() {
  if (!cache.providers) {
    cache.providers = sb.from('curriculum_provider')
      .select('id,key,name')
      .eq('active', true)
      .order('name')
      .then(rowsOrThrow)
      .catch(error => { cache.providers = null; throw error; });
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
  return recoverCachedRequest(cache.programmeByKey, key);
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
  return recoverCachedRequest(cache.stageByKey, key);
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
        .then(rows => {
          for (const row of rows) cache.programmeByKey.set(row.key, Promise.resolve(row));
          return rows;
        })
    ));
  }
  return recoverCachedRequest(cache.programmes, providerKey);
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
        .then(rows => {
          for (const row of rows) cache.stageByKey.set(row.key, Promise.resolve(row));
          return rows;
        })
    ));
  }
  return recoverCachedRequest(cache.stages, programmeKey);
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
  return recoverCachedRequest(cache.offerings, cacheKey);
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

/** Boards that legitimately mean Cambridge on a pre-multi-curriculum profile. */
const LEGACY_CAMBRIDGE_BOARDS = new Set(['CAIE', 'IGCSE', 'AS_A_LEVEL']);

/**
 * Provider for a legacy `student.board`. Only the explicit legacy values map;
 * anything else is unknown (null). Axon.md / AXO-94: no layer may let missing
 * or unrecognised identity silently become Cambridge.
 */
export function providerKeyForBoard(board) {
  if (board === 'CBSE') return 'cbse';
  if (board === 'IBDP') return 'ib';
  if (LEGACY_CAMBRIDGE_BOARDS.has(board)) return 'cambridge';
  return null;
}

/** Normalised provider for a student row: stored key first, then explicit board, else null. */
export function providerKeyForStudent(student) {
  const stored = student?.provider_key;
  if (PROVIDER_KEYS.includes(stored)) return stored;
  return providerKeyForBoard(student?.board);
}

const UNRESOLVED_IDENTITY = Object.freeze({ providerKey: null, programmeKey: null, stageKey: null });

export function legacyCurriculumForStudent(student = {}) {
  if (student.programme_key && student.stage_key) {
    return {
      providerKey: student.provider_key ?? null,
      programmeKey: student.programme_key,
      stageKey: student.stage_key,
    };
  }
  const providerKey = providerKeyForBoard(student.board);
  const n = Number(student.class_level);
  const validClass = Number.isInteger(n) && n >= 9 && n <= 12;
  // Unknown board, or a class that is not 9-12, stays unresolved. The caller
  // renders an explicit "could not be resolved" state; we never guess a stage.
  if (!providerKey) return { ...UNRESOLVED_IDENTITY };
  if (providerKey === 'cbse') {
    if (!validClass) return { providerKey, programmeKey: null, stageKey: null };
    return {
      providerKey,
      programmeKey: n <= 10 ? 'cbse_secondary' : 'cbse_senior_secondary',
      stageKey: `cbse_${n}`,
    };
  }
  if (providerKey === 'ib') return { providerKey, programmeKey: 'ibdp', stageKey: null };
  if (!validClass) return { providerKey, programmeKey: null, stageKey: null };
  if (n <= 10) {
    return {
      providerKey,
      programmeKey: 'cambridge_igcse',
      stageKey: n === 9 ? 'cambridge_igcse_y10' : 'cambridge_igcse_y11',
    };
  }
  return {
    providerKey,
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
      : provider === 'cambridge' ? 'mark scheme'
      : 'marking scheme',
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
  if (providerKey === 'cambridge') {
    return { pyq: 'Cambridge past paper', sample_paper: 'Specimen paper' };
  }
  // Unknown or missing provider: neutral vocabulary. Never assume Cambridge.
  return { pyq: 'Past paper', sample_paper: 'Sample paper' };
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
/** The Cambridge stage for a class level, or null — an invalid class is not IGCSE. */
export function stageForClass(classLevel) {
  const n = Number(classLevel);
  return STAGES.find((s) => s.classLevels.includes(n)) ?? null;
}
export function classLabel(classLevel) {
  const n = Number(classLevel);
  const stage = stageForClass(n);
  return stage ? `${stage.label} · Year ${YEAR_OF_CLASS[n] ?? n}` : 'Stage not set';
}
export function classLabelShort(classLevel) {
  const n = Number(classLevel);
  const stage = stageForClass(n);
  if (!stage) return 'Stage not set';
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
