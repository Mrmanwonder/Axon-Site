import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { CONSENT_NOTICE_VERSION } from "../../src/config.js";
import { noticeContent, purposeNote } from "../../src/notice.js";

// AXO-217 (council D2). The notice text stored per version in
// public.consent_notice_text must be exactly what src/notice.js renders for
// CONSENT_NOTICE_VERSION. If this fails after a wording change, bump the
// version in src/config.js and add a migration that stores the new text; do
// not edit an applied migration.

const migrationsDir = resolve(__dirname, "../../supabase/migrations");

/** Every (version, language) -> content row seeded by any migration. */
function storedNotices(): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(resolve(migrationsDir, file), "utf8");
    const row = /\('(\d+\.\d+\.\d+)', '(en|hi)', \$(notice_[a-z]+)\$\n([\s\S]*?)\n\$\3\$::jsonb\)/g;
    for (const m of sql.matchAll(row)) out.set(`${m[1]}/${m[2]}`, JSON.parse(m[4]));
  }
  return out;
}

/* consent_purpose as seeded in 20260810173906_identity_and_consent.sql and
   live in production on 7 Oct 2026. The database test checks the table's own
   behaviour; this pins the labels the stored text was built from. */
const PURPOSES = [
  { purpose: "store_papers", label: "Storing and reading uploaded papers", is_required: true, sort_order: 1 },
  { purpose: "extract_text", label: "Extracting text from uploaded papers", is_required: true, sort_order: 2 },
  { purpose: "generate_explanations", label: "Explaining where marks were lost", is_required: true, sort_order: 3 },
  { purpose: "track_progress", label: "Tracking progress over time", is_required: true, sort_order: 4 },
  { purpose: "weekly_parent_digest", label: "Weekly summary to the parent", is_required: false, sort_order: 5 },
  { purpose: "improve_extraction", label: "Improving extraction accuracy from corrections", is_required: false, sort_order: 6 },
];

test("the current notice version is 1.1.0", () => {
  expect(CONSENT_NOTICE_VERSION).toBe("1.1.0");
});

test("src/notice.js renders exactly the stored text of the current version, in both languages", () => {
  const stored = storedNotices();
  for (const lang of ["en", "hi"] as const) {
    const row = stored.get(`${CONSENT_NOTICE_VERSION}/${lang}`);
    expect(row, `no stored ${lang} text for ${CONSENT_NOTICE_VERSION}`).toBeDefined();
    expect(noticeContent(lang, PURPOSES)).toEqual(row);
  }
});

test("1.0.0 is not seeded, because no single 1.0.0 text exists", () => {
  const stored = storedNotices();
  expect(stored.has("1.0.0/en")).toBe(false);
  expect(stored.has("1.0.0/hi")).toBe(false);
});

test("the stored notice says behavioural tracking is never done", () => {
  const en = noticeContent("en", PURPOSES) as { sections: { items: { label: string; tag?: string }[] }[] };
  expect(en.sections[2].items).toContainEqual({ label: "Behavioural tracking", tag: "Never" });
});

test("purpose notes are English only, and unknown purposes have none", () => {
  expect(purposeNote("store_papers", "en")).toBe("The pages you upload, kept in the account");
  expect(purposeNote("store_papers", "hi")).toBe("");
  expect(purposeNote("not_a_purpose", "en")).toBe("");
});

test("nothing in the client compares a stored notice_version with the current one", () => {
  // A bump must not re-prompt returning guardians. If a comparison is added,
  // forcing re-consent becomes a deliberate, reviewed change, not a side effect.
  const consent = readFileSync(resolve(__dirname, "../../src/consent.js"), "utf8");
  const uses = consent.match(/CONSENT_NOTICE_VERSION/g) ?? [];
  expect(uses).toHaveLength(2); // the import and the value written on insert
  expect(consent).toMatch(/notice_version: CONSENT_NOTICE_VERSION,/);
});
