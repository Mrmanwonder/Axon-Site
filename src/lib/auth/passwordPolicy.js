// Guardian password enrollment policy. HIBP checks are a browser-side guard on Supabase Free.
// Supabase Auth must additionally enforce this server-side to prevent REST API bypass.
export const PASSWORD_POLICY = Object.freeze({
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
});
export const HIBP_UNAVAILABLE = 'We could not check this password against known breaches right now. Try again.';
export const HIBP_COMPROMISED = 'This password has appeared in a data breach. Choose another password.';
export const COMMON_PASSWORD = 'This password is too common or predictable. Choose another password.';

let denylistPromise;
async function deniedPasswords() {
  denylistPromise ??= import('../../../security/passwords/axon-weak-passwords.json')
    .then(({ default: data }) => new Set(
      [...data.common_passwords, ...data.axon_predictable_variants].map(p => p.toLowerCase()),
    ));
  return denylistPromise;
}

export function validateNewPassword(password) {
  if (typeof password !== 'string' || [...password].length < PASSWORD_POLICY.minLength) {
    throw new Error('Use at least 8 characters for your password.');
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Include at least one uppercase letter, one lowercase letter and one number.');
  }
}

function isPredictableYearPassword(password) {
  const match = /^(?:password|passw0rd|p@ssw0rd|p@ssword|welcome|changeme|admin|root|guest|axon|axonstudy)[!@#._-]?(19\d\d|20\d\d)[!@#._-]?$/i.exec(password);
  return Boolean(match && Number(match[1]) >= 1990 && Number(match[1]) <= 2035);
}

export async function isPasswordPwned(password, options = {}) {
  // SHA-1 is used solely for HIBP's range query; it is not used for storing passwords.
  if (!globalThis.crypto?.subtle) throw new Error(HIBP_UNAVAILABLE);
  let hash;
  try {
    const digest = await globalThis.crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
    hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  } catch {
    throw new Error(HIBP_UNAVAILABLE);
  }
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await (options.fetcher ?? globalThis.fetch)(
      'https://api.pwnedpasswords.com/range/' + prefix,
      { method: 'GET', headers: { 'Add-Padding': 'true' }, credentials: 'omit',
        cache: 'no-store', signal: controller.signal },
    );
    if (!response.ok) throw new Error(HIBP_UNAVAILABLE);
    const data = await response.text();
    for (const line of data.split(/\r?\n/)) {
      const index = line.indexOf(':');
      if (index < 0) continue;
      const candidate = line.slice(0, index);
      const count = line.slice(index + 1).trim();
      if (candidate.toUpperCase() === suffix && /^\d+$/.test(count) && Number(count) > 0) return true;
    }
    return false;
  } catch {
    throw new Error(HIBP_UNAVAILABLE);
  } finally {
    clearTimeout(timeout);
  }
}

export async function assertSafeNewPassword(password) {
  validateNewPassword(password);
  if (isPredictableYearPassword(password) || (await deniedPasswords()).has(password.toLowerCase())) {
    throw new Error(COMMON_PASSWORD);
  }
  if (await isPasswordPwned(password)) throw new Error(HIBP_COMPROMISED);
}
