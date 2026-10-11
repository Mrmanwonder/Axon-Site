import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import {
  assertSafeNewPassword, isPasswordPwned, validateNewPassword,
  COMMON_PASSWORD, HIBP_COMPROMISED, HIBP_UNAVAILABLE,
} from "../../src/lib/auth/passwordPolicy.js";

const hash = (password: string) => createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
const permitted = "LongPurpleStar9";

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
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:25\r\n" + digest.slice(5) + ":0\r\n" });
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
  const hit = vi.fn().mockResolvedValue({ ok: true, text: async () => suffix + ":17\r\n" });
  await expect(isPasswordPwned(permitted, { fetcher: hit })).resolves.toBe(true);
  const padded = vi.fn().mockResolvedValue({ ok: true, text: async () => suffix + ":0\r\n" });
  await expect(isPasswordPwned(permitted, { fetcher: padded })).resolves.toBe(false);
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
    ok: true, text: async () => digest.slice(5) + ":19\r\n",
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
