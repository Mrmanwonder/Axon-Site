import { describe, expect, test, vi } from "vitest";

vi.mock("../../src/supabase.js", () => ({ sb: {} }));

import { isOlderNotice } from "../../src/reconfirm.js";

describe("isOlderNotice", () => {
  test("compares numerically, not as text", () => {
    expect(isOlderNotice("1.9.0", "1.10.0")).toBe(true);
    expect(isOlderNotice("1.3.0", "1.4.0")).toBe(true);
    expect(isOlderNotice("1.0.0", "1.4.0")).toBe(true);
  });
  test("equal or newer is current", () => {
    expect(isOlderNotice("1.4.0", "1.4.0")).toBe(false);
    expect(isOlderNotice("2.0.0", "1.4.0")).toBe(false);
  });
  test("an unreadable version counts as not having seen the current text", () => {
    expect(isOlderNotice("", "1.4.0")).toBe(true);
    expect(isOlderNotice("v1", "1.4.0")).toBe(true);
  });
});
