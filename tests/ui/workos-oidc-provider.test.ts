import { afterEach, expect, test, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

const load = async (flag: string) => {
  vi.stubEnv("VITE_WORKOS_OIDC_STAGING", flag);
  vi.resetModules();
  return import("../../src/lib/auth/providers.js");
};

test("default: Google only, and password sign-in stays on Supabase", async () => {
  const p = await load("");
  expect(p.OAUTH_PROVIDERS).toEqual(["google"]);
  expect(p.SIGN_IN_PROVIDERS).toEqual(["google"]);
  expect(p.WORKOS_PASSWORD).toBe(false);
});

test("flag on: WorkOS backs the password choice and never appears as its own button", async () => {
  const p = await load("true");
  expect(p.WORKOS_PASSWORD).toBe(true);
  expect(p.OAUTH_PROVIDERS).toEqual(["google"]);
  expect(p.SIGN_IN_PROVIDERS).toEqual(["google", "custom:workos"]);
  // Parents read this; no vendor name.
  expect(p.PROVIDER_LABEL["custom:workos"]).not.toMatch(/workos/i);
});

test("any other flag value fails closed", async () => {
  for (const v of ["True", "1", "yes", "false"]) {
    const p = await load(v);
    expect(p.WORKOS_PASSWORD).toBe(false);
    expect(p.SIGN_IN_PROVIDERS).toEqual(["google"]);
  }
});
