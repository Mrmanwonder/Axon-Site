// Parent Mode at the serverless boundary.
//
// The database enforces Parent Mode for consent, paper deletion, profile
// deletion and account deletion, because those are ordinary table writes that
// RLS can reach. Billing is not: minting a Stripe session happens in an Edge
// Function, and the function's only input is the guardian's bearer token.
//
// That token is exactly what Parent Mode exists to distrust. It belongs to the
// guardian and it lives on the phone the student is holding, so a function
// that accepts it as sufficient recreates the authority collapse the whole
// boundary was introduced to close — no matter what the Settings screen does
// before calling it. `guard()` in the UI protects honest navigation; a fetch
// typed into the console skips it entirely.
//
// So freshness is re-checked here, server-side, through the caller's own JWT.
//
// ── Why this reads the claim rather than trusting a flag ──────────────────
//
// There is deliberately no `parent_mode: true` in the request body. A client
// that can assert its own authorisation is not being authorised. The check
// goes to `public.parent_mode_state()`, which reads the `amr` claim out of the
// signed token — a client cannot forge that without the project's JWT secret.
//
// It fails closed twice over: a token with no `amr` is not fresh (see the
// migration), and an RPC that errors is treated as "not fresh" here rather
// than waved through.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { failure } from './http.ts';

/**
 * Refuse unless a guardian re-authenticated recently.
 *
 * @returns `null` when the caller may proceed, or the Response to return.
 */
export async function requireParentMode(sb: SupabaseClient): Promise<Response | null> {
  const { data, error } = await sb.rpc('parent_mode_state');

  if (error) {
    // An unreadable freshness state is not a fresh one. This is the same rule
    // the rest of the codebase applies to failed reads: a failure is not an
    // empty result, and here "unknown" must not resolve to "allowed".
    return failure('We could not confirm this is you. Try again.', 503, error.message);
  }

  const state = data as { fresh?: boolean; amr_present?: boolean } | null;

  if (!state?.amr_present) {
    // The token carries no `amr` at all, so no re-authentication can ever be
    // proved. That is a configuration problem on our side, not a parent who
    // has been away, and it deserves a different message and a log line —
    // otherwise it presents as an unlockable loop.
    console.error('parent mode: session carries no amr claim; re-auth cannot be proved');
    return failure('We could not confirm this is you. Signing out and back in should fix it.', 403);
  }

  if (!state.fresh) {
    return failure('This one is for a parent. Confirm it is you and try again.', 403, 'parent_mode_required');
  }

  return null;
}
