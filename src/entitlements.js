// The one place feature code asks "is this Pro?" — a thin wrapper over the
// public.get_entitlements() RPC (see the entitlements_and_billing migration).
//
// This is a convenience for the UI, not the gate itself: the gate is RLS,
// server-side, on every Pro-only table. A modified client that skips this
// module entirely and queries pattern_insight or parent_progress_report
// directly still gets nothing back for a free account — see
// supabase/tests/entitlements_and_billing.sql. What this module is for is
// letting a screen decide what to render without a round trip per feature
// flag.

import { sb } from './supabase.js';

/**
 * @typedef {Object} Entitlements
 * @property {'free'|'pro'} tier
 * @property {boolean} crossSubjectPatterns
 * @property {boolean} fullHistoricalArchive
 * @property {boolean} parentProgressReports
 * @property {boolean} priorityProcessing
 * @property {number|null} maxStudentProfiles  null means unlimited
 * @property {'free'|'pro'|'pro_annual'|'past_due'|'canceled'} billingState
 *   The raw subscription state behind `tier`. It gates nothing — every gate
 *   reads `tier` and the booleans, which are already resolved. It exists so a
 *   downgrade can be explained instead of just happening: `past_due` resolves
 *   to the free tier immediately (a failed payment ends Pro the moment Stripe
 *   reports it — there is no grace window), and a parent who sees Pro features
 *   gone is owed the reason. Render that reason on the parent's own account
 *   surface only, never in the student's app.
 */

/** @returns {Promise<Entitlements>} */
export async function getEntitlements() {
  const { data, error } = await sb.rpc('get_entitlements').single();
  if (error) throw error;
  return {
    tier: data.tier,
    crossSubjectPatterns: data.cross_subject_patterns,
    fullHistoricalArchive: data.full_historical_archive,
    parentProgressReports: data.parent_progress_reports,
    priorityProcessing: data.priority_processing,
    maxStudentProfiles: data.max_student_profiles,
    billingState: data.billing_state,
  };
}

/**
 * The honest, true teaser signal from the thesis (§2.4/§3): whether a genuine
 * cross-subject match exists for this student, for a cause they can already
 * see explained for free. Existence only — never the specifics, which stay
 * behind the Pro gate on pattern_insight itself.
 *
 * Render only in the PARENT surface. Never in the student's own scan ->
 * understand -> act loop — see UX_MONETIZATION_AUDIT.md.
 */
export async function getCrossSubjectSignal(studentId) {
  const { data, error } = await sb.rpc('get_cross_subject_signal');
  if (error) throw error;
  return (data ?? []).filter((row) => row.student_id === studentId && !row.dismissed_at);
}
