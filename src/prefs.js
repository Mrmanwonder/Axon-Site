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

const LOCAL_KEY = 'mastery.prefs.v1';

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
export async function loadPrefs(guardianId) {
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
    await savePrefs(guardianId, local);
    return local;
  }
  const merged = { ...DEFAULTS, ...data };
  writeLocal(merged);
  return merged;
}

/** Write through: local first so the UI is instant, then the server. */
export async function savePrefs(guardianId, patch) {
  const next = { ...readLocal(), ...patch };
  writeLocal(next);
  if (!guardianId) return next;

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
  // Offline is not an error here: local already holds the change and the next
  // successful save reconciles it.
  if (error && navigator.onLine) throw error;
  return next;
}
