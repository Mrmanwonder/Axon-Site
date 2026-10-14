/** Storage may be absent or throw SecurityError in privacy-restricted contexts. */
export function readSessionItem(key: string): string | null {
  try { return globalThis.sessionStorage?.getItem(key) ?? null; }
  catch { return null; }
}
