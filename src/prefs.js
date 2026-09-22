// Preferences.
//
// Written through to Supabase and mirrored in localStorage, so a cold start
// paints the right theme and text size on the first frame instead of flashing
// the default while the network answers. Unlike consent, these are safe to
// cache: a stale text size is a cosmetic annoyance, not a compliance failure.
//
// The weekly digest and extraction-improvement switches are deliberately NOT
// here — they are consent decisions and live in consent_event, so switching one
// off is a recorded withdrawal rather than a silent preference change.

import { sb } from './supabase.js';

const LOCAL_KEY = 'axon.prefs.v1';

export const DEFAULTS = {
  theme: 'system',
  text_size: 'm',
  reduce_motion: false,
  always_show_reasoning: false,
  notify_paper_ready: true,
  notify_correction: true,
};

export function readLocal() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeLocal(prefs) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(prefs));
  } catch {
    /* private browsing, or quota — the server copy is authoritative anyway */
  }
}

/** Pull the server copy and reconcile local. */
async function readServerPrefs(guardianId) {
  if (!guardianId) return readLocal();
  const { data, error } = await sb
    .from('app_preference')
    .select('*')
    .eq('guardian_id', guardianId)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    // First run for this guardian: seed the server from whatever the device
    // already had, so choices made before sign-in are not lost.
    const local = readLocal();
    await writeServerPrefs(guardianId, local);
    return local;
  }
  const merged = { ...DEFAULTS, ...data };
  writeLocal(merged);
  return merged;
}

/** Write through: persist to the server before advancing the local snapshot. */
async function writeServerPrefs(guardianId, patch) {
  const next = { ...readLocal(), ...patch };
  if (!guardianId) { writeLocal(next); return next; }

  const { error } = await sb.from('app_preference').upsert(
    {
      guardian_id: guardianId,
      theme: next.theme,
      text_size: next.text_size,
      reduce_motion: next.reduce_motion,
      always_show_reasoning: next.always_show_reasoning,
      notify_paper_ready: next.notify_paper_ready,
      notify_correction: next.notify_correction,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'guardian_id' },
  );
  // Keep localStorage aligned with the server. The React layer may display an
  // optimistic value, but a failed request must not make that value durable.
  if (error) throw error;
  writeLocal(next);
  return next;
}

// Reads and patches share one queue: even boot cannot overwrite a newer edit.
/** @type {Promise<unknown>} */
let queue = Promise.resolve();
/** @template T @param {() => Promise<T>} operation @returns {Promise<T>} */
function serialized(operation) {
  const pending = queue.then(operation);
  queue = pending.catch(() => {});
  return pending;
}
export const loadPrefs = guardianId => serialized(() => readServerPrefs(guardianId));
export const savePrefs = (guardianId, patch) => serialized(() => writeServerPrefs(guardianId, patch));
