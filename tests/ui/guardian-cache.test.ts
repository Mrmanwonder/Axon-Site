import { beforeEach, expect, test, vi } from "vitest";

const f = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  session: { user: { id: "auth-A" } } as { user: { id: string } } | null,
  selectArgs: [] as string[],
  eqArgs: [] as unknown[][],
  row: null as Record<string, unknown> | null,
  online: true,
}));

// In-memory stand-in with readThrough's real contract: network first, cache on
// failure/offline, and a cleared store means "not available offline".
vi.mock("../../src/cache.js", () => ({
  putCached: async (k: string, v: unknown) => { f.store.set(k, v); },
  clearLocalData: async () => { f.store.clear(); },
  readThrough: async (key: string, fetcher: () => Promise<unknown>) => {
    const cached = f.store.get(key) ?? null;
    if (!f.online) {
      if (cached !== null) return { data: cached, stale: true, offline: true };
      throw new Error("This information is not available offline yet.");
    }
    const data = await fetcher();
    f.store.set(key, data);
    return { data, stale: false, offline: false };
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: vi.fn(async () => ({ data: true, error: null })),
    auth: {
      getSession: async () => ({ data: { session: f.session }, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: (cols: string) => {
        f.selectArgs.push(cols);
        return { eq: (...a: unknown[]) => { f.eqArgs.push(a); return { maybeSingle: async () => ({ data: f.row, error: null }) }; } };
      },
    }),
  }),
}));

import { currentGuardian, signOut } from "../../src/supabase.js";

const FULL_ROW = {
  id: "g1", auth_user_id: "auth-A", name: "Asha", contact: "asha@example.test",
  verified_at: "2026-09-01T00:00:00Z", verification_method: "digilocker", verification_ref: "ref-123",
  deleted_at: null, subscription_status: "active",
};

beforeEach(() => {
  f.store.clear(); f.selectArgs.length = 0; f.eqArgs.length = 0;
  f.session = { user: { id: "auth-A" } }; f.row = { ...FULL_ROW }; f.online = true;
});

test("selects and caches only display identity, never verification or billing state", async () => {
  const g = await currentGuardian();
  expect(f.selectArgs).toEqual(["id, auth_user_id, name, contact"]);
  expect(f.eqArgs).toEqual([["auth_user_id", "auth-A"]]);
  expect(g).toEqual({ id: "g1", auth_user_id: "auth-A", name: "Asha", contact: "asha@example.test" });
  const cached = f.store.get("guardian:auth-A") as Record<string, unknown>;
  expect(Object.keys(cached).sort()).toEqual(["auth_user_id", "contact", "id", "name"]);
});

test("a cached row owned by another auth user is rejected, dropped and never returned", async () => {
  f.store.set("guardian:auth-A", { ...FULL_ROW, auth_user_id: "auth-B", name: "Someone Else" });
  f.online = false;
  expect(await currentGuardian()).toBeNull();
  expect(f.store.get("guardian:auth-A")).toBeNull();
});

test("a legacy full cached row is shrunk on the next offline read", async () => {
  f.store.set("guardian:auth-A", { ...FULL_ROW });
  f.online = false;
  const g = await currentGuardian();
  expect(g).toEqual({ id: "g1", auth_user_id: "auth-A", name: "Asha", contact: "asha@example.test" });
  expect(Object.keys(f.store.get("guardian:auth-A") as object).sort()).toEqual(["auth_user_id", "contact", "id", "name"]);
});

test("a second account on the same device cannot reuse the first account's cached identity", async () => {
  await currentGuardian(); // account A caches identity under guardian:auth-A
  f.session = { user: { id: "auth-B" } };
  f.online = false;
  await expect(currentGuardian()).rejects.toThrow(/not available offline/); // different key, nothing to reuse
});

test("sign-out clears the cached guardian so the next offline boot has nothing to show", async () => {
  await currentGuardian();
  expect(f.store.has("guardian:auth-A")).toBe(true);
  await signOut();
  expect(f.store.has("guardian:auth-A")).toBe(false);
  f.online = false;
  await expect(currentGuardian()).rejects.toThrow(/not available offline/);
});

test("no session means no guardian and no network or cache read", async () => {
  f.session = null;
  expect(await currentGuardian()).toBeNull();
  expect(f.selectArgs).toEqual([]);
});
