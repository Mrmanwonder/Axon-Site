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

import { VERIFICATION_ADAPTER } from './config.js';

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
 * @property {() => Promise<VerificationResult>} verify
 */

/** Development adapter. Asserts nothing about a real person. */
const stubAdapter = {
  id: 'stub',
  label: 'Development verification',
  description:
    'Stands in for DigiLocker during development. It proves nothing about a real person and must never be enabled in production.',
  async verify() {
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
  async verify() {
    throw new Error(
      'DigiLocker adapter is not implemented. It needs a registered requester and a ' +
        'server-side token exchange; wire that first, then return only the reference.',
    );
  },
};

const adapters = { stub: stubAdapter, digilocker: digilockerAdapter };

export function getVerificationAdapter(id = VERIFICATION_ADAPTER) {
  const adapter = adapters[id];
  if (!adapter) throw new Error(`Unknown verification adapter: ${id}`);
  return adapter;
}

export function listVerificationAdapters() {
  return Object.values(adapters).map(({ id, label, description }) => ({ id, label, description }));
}
