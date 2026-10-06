import { beforeEach, expect, test, vi } from "vitest";

/* recordConsent writes the notice language on every row, and refuses a
   language the database would reject. */
const inserted = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock("../../src/supabase.js", () => ({
  sb: {
    from: (table: string) => {
      if (table !== "consent_event") throw new Error(`unexpected table: ${table}`);
      return {
        insert: (rows: Record<string, unknown>[]) => {
          inserted.rows = rows;
          return { select: async () => ({ data: rows, error: null }) };
        },
      };
    },
  },
}));

import { recordConsent, withdrawConsent } from "../../src/consent.js";

beforeEach(() => { inserted.rows = []; });

test("each consent row carries the language the notice was shown in", async () => {
  await recordConsent({
    guardianId: "g", studentId: null,
    decisions: { store_papers: true, weekly_parent_digest: false },
    noticeLanguage: "hi",
  });
  expect(inserted.rows).toHaveLength(2);
  for (const row of inserted.rows) expect(row.notice_language).toBe("hi");
});

test("the notice language defaults to English, including withdrawals", async () => {
  await recordConsent({ guardianId: "g", decisions: { store_papers: true } });
  expect(inserted.rows[0].notice_language).toBe("en");
  await withdrawConsent({ guardianId: "g", purpose: "weekly_parent_digest" });
  expect(inserted.rows[0].notice_language).toBe("en");
});

test("an unknown notice language is refused before anything is written", async () => {
  await expect(recordConsent({
    guardianId: "g", decisions: { store_papers: true }, noticeLanguage: "fr" as "en",
  })).rejects.toThrow(/notice language/);
  expect(inserted.rows).toHaveLength(0);
});
