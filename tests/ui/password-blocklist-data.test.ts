import { describe, expect, test } from "vitest";
import blocklist from "../../security/passwords/axon-weak-passwords.json";

const all = new Set([...blocklist.common_passwords, ...blocklist.axon_predictable_variants]);

describe("Axon source-controlled password denylist", () => {
  test("has source metadata, internally consistent counts, and no duplicates", () => {
    expect(blocklist.schema_version).toBe("1.1.0");
    expect(blocklist.enforcement_status).toMatch(/client-side signup/i);
    expect(blocklist.counts.source_entries).toBe(blocklist.common_passwords.length);
    expect(blocklist.counts.axon_added_entries).toBe(blocklist.axon_predictable_variants.length);
    expect(blocklist.counts.exact_entries).toBe(all.size);
    expect(all.size).toBe(12412);
    expect(blocklist.sources.find(s => s.name.includes("Kaggle"))?.included).toBe(false);
    expect(blocklist.sources.find(s => s.name.includes("HIBP"))?.included).toBe(false);
  });

  test.each([
    "123456", "123456789", "qwerty", "asdfghjk",
    "admin", "password", "root", "guest",
    "Welcome1", "Changeme123", "P@ssw0rd1!",
    "Aa123456", "Password2026",
  ])("rejects explicit weak example %s when dictionary is enforced", password => {
    expect(all.has(password)).toBe(true);
  });

  test("declares the correct server-side and HIBP invariants", () => {
    expect(blocklist.security_policy.min_length).toBe(8);
    expect(blocklist.security_policy.require_uppercase_ascii).toBe(true);
    expect(blocklist.security_policy.require_lowercase_ascii).toBe(true);
    expect(blocklist.security_policy.require_digit_ascii).toBe(true);
    expect(blocklist.security_policy.require_symbols).toBe(false);
    expect(blocklist.security_policy.do_not_modify_password_before_auth).toBe(true);
    expect(blocklist.hibp_policy.prefix_length).toBe(5);
    expect(blocklist.hibp_policy.require_full_hash_suffix_match).toBe(true);
    expect(blocklist.hibp_policy.no_plaintext_or_full_hash_transmission).toBe(true);
  });

  test("does not mistake normal high-entropy passphrases for exact blocked values", () => {
    expect(all.has("A highly unusual long phrase containing password and many independent words")).toBe(false);
    expect(blocklist.security_policy.whole_password_match_only).toBe(true);
  });
});
