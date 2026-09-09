// Guardian verification — a swappable adapter, not a hardcoded integration.
//
// Rule 10 of the DPDP Rules 2025 requires verifying three things: the parent's
// identity, that they are an adult, and the parent-child relationship.
// DigiLocker is the route the Rules explicitly name and the intended production
// adapter, but the acceptable methods will change, and a virtual-token or
// Consent-Manager route may be preferable later. Hence the interface.
//
// What every adapter must honour: return a reference and a method, never the
// underlying documents. There is deliberately no field in the schema that could
// hold an identity document, so an adapter cannot leak one into the database
// even by mistake.
//
// ── Why this file refuses things ──────────────────────────────────────────
//
// The stub asserts nothing about a real person. For as long as it was merely
// commented as development-only, a production build could still select it and
// the screen would say "Verify it's you", spin, and write `verified_at` — a
// claim the code does not implement. That is the one failure mode this file
// now makes structurally impossible rather than documented:
//
//   · a dev-only adapter cannot be handed out of a production build at all;
//   · the caller gets a describable "unavailable" state rather than an
//     adapter that lies, so the screen can say so;
//   · the database refuses a stub verification independently (see migration
//     20260909_guardian_verification_is_server_authored), so a tampered
//     bundle pointed at production still cannot record one.
//
// Three layers, because the build guard alone protects only the build we ship.

import { DEV_VERIFICATION_ADAPTER, VERIFICATION_ADAPTER } from './config.js';
import { sb } from './supabase.js';

/** True for anything `vite build` produced. Deliberately not "is the hostname
    axonstudy.online": a preview deploy and a local `npm run build` are both
    bundles that can escape, and neither has any business carrying the stub. */
export const IS_BUILD = Boolean(
  typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD,
);

/** The adapter this environment actually uses. A build gets the production one
    and has no way to reach the development one; `vite dev` gets the stub. */
export const ACTIVE_ADAPTER = IS_BUILD ? VERIFICATION_ADAPTER : DEV_VERIFICATION_ADAPTER;

/**
 * @typedef {Object} VerificationResult
 * @property {boolean} verified
 * @property {'digilocker'|'stub'} method    matches the verify_method enum
 * @property {string} reference              opaque proof that verification happened
 * @property {string} verifiedAt             ISO timestamp
 */

/**
 * @typedef {Object} VerificationAdapter
 * @property {string} id
 * @property {string} label                      shown to the guardian
 * @property {string} description
 * @property {boolean} devOnly                   never selectable from a build
 * @property {boolean} implemented
 * @property {() => Promise<VerificationResult>} verify
 */

/** Development adapter. Asserts nothing about a real person. */
const stubAdapter = {
  id: 'stub',
  label: 'Development verification',
  description:
    'Stands in for DigiLocker during development. It proves nothing about a real person and must never be enabled in production.',
  devOnly: true,
  implemented: true,
  async verify() {
    // Belt to the build guard's braces. If some future caller reaches past
    // `getVerificationAdapter` and holds this object directly, it still
    // refuses rather than minting a verification inside a shipped bundle.
    if (IS_BUILD) {
      throw new Error('The development verification adapter cannot run in a build.');
    }
    // Shaped like a real handoff so swapping adapters does not change callers.
    await new Promise((r) => setTimeout(r, 600));
    const reference = `stub:${crypto.randomUUID()}`;
    return {
      verified: true,
      method: 'stub',
      reference,
      verifiedAt: new Date().toISOString(),
    };
  },
};

/**
 * Production adapter. Intentionally not implemented: DigiLocker issuance
 * requires a registered requester, a redirect URI and a server-side token
 * exchange, none of which can be done from a static client. When it is built,
 * the exchange belongs on the server and only the resulting reference should
 * come back here.
 */
const digilockerAdapter = {
  id: 'digilocker',
  label: 'Verify with DigiLocker',
  description:
    'Confirms your identity, that you are an adult, and your relationship to the student. We receive a confirmation reference only — never a copy of any document.',
  devOnly: false,
  implemented: false,
  async verify() {
    throw new Error(
      'DigiLocker adapter is not implemented. It needs a registered requester and a ' +
        'server-side token exchange; wire that first, then return only the reference.',
    );
  },
};

const adapters = { stub: stubAdapter, digilocker: digilockerAdapter };

/**
 * Why the configured adapter cannot be used, or null if it can.
 *
 * `unknown` and `dev_only_in_build` are configuration bugs and say so; the
 * screen shows the first sentence to nobody but us. `not_implemented` is the
 * honest present state of production and is the one a guardian may actually
 * meet, so it reads as a product state rather than a stack trace.
 *
 * @param {string} [id]
 * @returns {{ reason: 'unknown'|'dev_only_in_build'|'not_implemented', detail: string } | null}
 */
export function verificationUnavailable(id = ACTIVE_ADAPTER) {
  const adapter = adapters[id];
  if (!adapter) {
    return { reason: 'unknown', detail: `Unknown verification adapter: ${id}` };
  }
  if (adapter.devOnly && IS_BUILD) {
    return {
      reason: 'dev_only_in_build',
      detail:
        `VERIFICATION_ADAPTER is '${id}', which is development-only, in a production build. ` +
        'Set it to a real adapter in src/config.js before building.',
    };
  }
  if (!adapter.implemented) {
    return {
      reason: 'not_implemented',
      detail: `The '${id}' verification adapter is not implemented yet.`,
    };
  }
  return null;
}

/**
 * The configured adapter, or a throw naming exactly what is wrong.
 *
 * Callers that render a screen should ask `verificationUnavailable()` first
 * and show that state, rather than catching this: a guardian meeting an
 * unbuilt integration deserves a sentence, not an error boundary.
 */
export function getVerificationAdapter(id = ACTIVE_ADAPTER) {
  const blocked = verificationUnavailable(id);
  if (blocked) throw new Error(blocked.detail);
  return adapters[id];
}

export function listVerificationAdapters() {
  return Object.values(adapters).map(({ id, label, description, devOnly, implemented }) => (
    { id, label, description, devOnly, implemented }
  ));
}

// The assertion the spec asks for, run at module load so it cannot be skipped
// by a code path that happens not to call the accessor. A build that selects a
// development adapter fails loudly at boot rather than shipping a screen that
// claims to verify and does not.
if (IS_BUILD && adapters[VERIFICATION_ADAPTER]?.devOnly) {
  throw new Error(
    `Production build cannot use the '${VERIFICATION_ADAPTER}' guardian verification adapter.`,
  );
}

/**
 * Turn a completed provider assertion into a verified guardian.
 *
 * This used to be `recordVerification({ method, reference })`, and that was a
 * forge: the RPC behind it was granted to `authenticated` and validated the
 * method as "not the stub", so a signed-in browser could call it with
 * ('digilocker', 'anything') and be verified. Moving the write behind a
 * SECURITY DEFINER function relocated the hole rather than closing it —
 * server-authored is not server-validated when the fact being attested still
 * arrives from the client.
 *
 * Now the browser supplies nothing. The RPC consumes a single-use assertion
 * that only a service-role provider callback can have written, so with no
 * provider integration this call can only fail — which is the honest state,
 * and cheaper to reason about than a parameter nobody is checking.
 *
 * @returns {Promise<any>} the updated guardian row
 */
export async function claimVerification() {
  const { data, error } = await sb.rpc('claim_guardian_verification');
  if (error) throw error;
  return data;
}
