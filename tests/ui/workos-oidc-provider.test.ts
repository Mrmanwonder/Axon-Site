import { afterEach, expect, test, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

test("production/default only exposes Google, never staging WorkOS", async () => {
  vi.stubEnv("VITE_WORKOS_OIDC_STAGING", "");
  vi.resetModules();
  const { OAUTH_PROVIDERS } = await import("../../src/lib/auth/providers.js");
  expect(OAUTH_PROVIDERS).toEqual(["google"]);
  expect(OAUTH_PROVIDERS).not.toContain("custom:workos");
});

test("staging opt-in adds WorkOS custom OIDC without removing Google", async () => {
  vi.stubEnv("VITE_WORKOS_OIDC_STAGING", "true");
  vi.resetModules();
  const { OAUTH_PROVIDERS, PROVIDER_LABEL } = await import("../../src/lib/auth/providers.js");
  expect(OAUTH_PROVIDERS).toEqual(["google", "custom:workos"]);
  expect(PROVIDER_LABEL["custom:workos"]).toBe("WorkOS");
});

test("incorrect flag values fail closed", async () => {
  vi.stubEnv("VITE_WORKOS_OIDC_STAGING", "True");
  vi.resetModules();
  const { OAUTH_PROVIDERS } = await import("../../src/lib/auth/providers.js");
  expect(OAUTH_PROVIDERS).toEqual(["google"]);
});
