import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import {
  assertSafeNewPassword, isPasswordPwned, validateNewPassword,
  COMMON_PASSWORD, HIBP_COMPROMISED, HIBP_UNAVAILABLE,
} from "../../src/lib/auth/passwordPolicy.js";

const hash = (password: string) => createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
const permitted = "LongPurpleStar9";
// Distinct synthetic zero-count padding; no production passwords or requests.
const padded = (...rows: string[]) => [
  ...rows,
  ...Array.from({ length: 800 - rows.length }, (_, i) => i.toString(16).padStart(35, "0") + ":0"),
].join("\r\n") + "\r\n";

beforeEach(() => { vi.stubGlobal("crypto", webcrypto); });
afterEach(() => { vi.unstubAllGlobals(); });

test.each(["short", "lowercase123", "UPPERCASE123", "NoDigitsHere", "", "Abc123"])(
  "requires eight characters, uppercase/lowercase and number: %s", value => {
    expect(() => validateNewPassword(value)).toThrow();
  },
);
test.each(["Abcdefg1", "Aa123456", "A1abcdef", "Space passphrase with Capital9"])(
  "accepts policy-compliant syntax before compromised-password checking: %s", value => {
    expect(() => validateNewPassword(value)).not.toThrow();
  },
);
test("special characters are optional and passwords are not normalized for authentication", () => {
  expect(() => validateNewPassword("OneTwo34")).not.toThrow();
  expect(() => validateNewPassword(" OneTwo34 ")).not.toThrow();
});
test("HIBP sends only five SHA-1 hex characters, never a password or full hash", async () => {
  const digest = hash(permitted);
  const fetcher = vi.fn().mockResolvedValue({ ok: true, text: async () =>
    padded("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:25", digest.slice(5) + ":0") });
  await expect(isPasswordPwned(permitted, { fetcher })).resolves.toBe(false);
  expect(fetcher).toHaveBeenCalledOnce();
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe("https://api.pwnedpasswords.com/range/" + digest.slice(0, 5));
  expect(url).not.toContain(permitted);
  expect(url).not.toContain(digest);
  expect(init.headers).toEqual({ "Add-Padding": "true" });
  expect(init.credentials).toBe("omit");
  expect(init.cache).toBe("no-store");
});
test("HIBP suffix matching rejects exposed passwords and ignores zero-count padding", async () => {
  const digest = hash(permitted);
  const suffix = digest.slice(5);
  const hit = vi.fn().mockResolvedValue({ ok: true, text: async () => padded(suffix + ":17") });
  await expect(isPasswordPwned(permitted, { fetcher: hit })).resolves.toBe(true);
  const paddingOnly = vi.fn().mockResolvedValue({ ok: true, text: async () => padded(suffix + ":0") });
  await expect(isPasswordPwned(permitted, { fetcher: paddingOnly })).resolves.toBe(false);
});
test("rejects a whole-password exact match or predictable default before making HIBP requests", async () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(assertSafeNewPassword("P@ssw0rd1!")).rejects.toThrow(COMMON_PASSWORD);
  await expect(assertSafeNewPassword("Password2033")).rejects.toThrow(COMMON_PASSWORD);
  expect(fetcher).not.toHaveBeenCalled();
});
test("checks HIBP after the local denylist, without checking during typing", async () => {
  const digest = hash(permitted);
  const fetcher = vi.fn().mockResolvedValue({
    ok: true, text: async () => padded(digest.slice(5) + ":19"),
  });
  vi.stubGlobal("fetch", fetcher);
  await expect(assertSafeNewPassword(permitted)).rejects.toThrow(HIBP_COMPROMISED);
  expect(fetcher).toHaveBeenCalledOnce();
});
test("HIBP request errors fail closed for new passwords without leaking input", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
  await expect(assertSafeNewPassword(permitted)).rejects.toThrow(HIBP_UNAVAILABLE);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  await expect(assertSafeNewPassword(permitted)).rejects.toThrow(HIBP_UNAVAILABLE);
});

test.each([
  ["empty", ""],
  ["HTML error page", "<html>Service unavailable</html>"],
  ["truncated padded range", "A".repeat(35) + ":0\r\n"],
  ["invalid suffix", padded("not-a-sha1-suffix:0")],
  ["invalid count", padded("A".repeat(35) + ":NaN")],
  ["duplicate records", padded("A".repeat(35) + ":0", "A".repeat(35) + ":0")],
  ["oversized body", "A".repeat(1024 * 1024 + 1)],
])("HTTP 200 with %s fails closed", async (_label, body) => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, text: async () => body });
  await expect(isPasswordPwned(permitted, { fetcher })).rejects.toThrow(HIBP_UNAVAILABLE);
});
test("a valid padded non-match permits the check without requiring a symbol", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, text: async () => padded() });
  vi.stubGlobal("fetch", fetcher);
  await expect(assertSafeNewPassword(permitted)).resolves.toBeUndefined();
});
test("body-read failures expose only the safe retry message", async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true, text: async () => { throw new Error("sensitive transport detail"); },
  });
  await expect(isPasswordPwned(permitted, { fetcher })).rejects.toThrow(HIBP_UNAVAILABLE);
});
