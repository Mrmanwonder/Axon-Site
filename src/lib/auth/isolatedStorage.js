/**
 * Auth options for a short-lived secondary client (password probe, pasted-link
 * check). supabase-js warns about "Multiple GoTrueClient instances" when two
 * clients share a storage key, and two clients on one key can race over the
 * same stored session. A unique key with memory-only storage keeps each
 * secondary client entirely to itself.
 */
let isolatedClients = 0;
export function isolatedAuthStorage() {
  const memory = new Map();
  return {
    storageKey: `axon-isolated-auth-${++isolatedClients}`,
    storage: {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => { memory.set(key, value); },
      removeItem: (key) => { memory.delete(key); },
    },
  };
}
