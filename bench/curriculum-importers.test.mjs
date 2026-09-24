import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCambridgeIgcse,
  parseCambridgeAdvanced,
  parseCbseSkill,
  parseIbText,
  validateFixture,
} from "../scripts/curriculum/catalog.mjs";

test("Cambridge IGCSE parser preserves exact syllabus codes and variants", () => {
  const html = [
    '<main>',
    '<a href="/programmes-and-qualifications/cambridge-igcse-mathematics-0580/">Mathematics - 0580</a>',
    '<a href="/programmes-and-qualifications/cambridge-igcse-mathematics-9-1-0980/">Mathematics (9-1) - 0980</a>',
    '<a href="/news/2026/">Unrelated 2026 update</a>',
    '</main>',
    '<footer><a href="/programmes-and-qualifications/cambridge-international-a-level-physics-9702/">Physics - 9702</a></footer>',
  ].join("");
  const rows = parseCambridgeIgcse(html);
  assert.equal(rows.length, 4);
  assert.deepEqual(
    rows.filter(row => row.external_code === "0580").map(row => row.stage_key).sort(),
    ["cambridge_igcse_y10", "cambridge_igcse_y11"],
  );
  assert.equal(rows.find(row => row.external_code === "0980")?.variant, "9-1");
  assert.notEqual(
    rows.find(row => row.external_code === "0580")?.external_code,
    rows.find(row => row.external_code === "0980")?.external_code,
  );
});

test("Cambridge advanced parser keeps AS-only and A-only routes distinct", () => {
  const html = [
    '<a href="/programmes-and-qualifications/cambridge-international-as-and-a-level-french-language-8682/">French Language (AS Level only) - 8682</a>',
    '<a href="/programmes-and-qualifications/cambridge-international-as-and-a-level-english-literature-9695/">English Literature (A Level only) - 9695</a>',
    '<a href="/programmes-and-qualifications/cambridge-international-as-and-a-level-physics-9702/">Physics - 9702</a>',
    '<a href="/other/9701/">Unrelated 9701 link</a>',
  ].join("");
  const rows = parseCambridgeAdvanced(html);

  assert.deepEqual(
    rows.filter(row => row.external_code === "8682").map(row => row.stage_key),
    ["cambridge_as"],
  );
  assert.deepEqual(
    rows.filter(row => row.external_code === "9695").map(row => row.stage_key),
    ["cambridge_a_level"],
  );
  assert.deepEqual(
    rows.filter(row => row.external_code === "9702").map(row => row.stage_key).sort(),
    ["cambridge_a_level", "cambridge_as"],
  );
});

test("CBSE skill parser preserves official subject codes by stage", () => {
  const html = [
    "<h2>Secondary School Curriculum Class IX</h2>",
    "<h3>Optional Skill Subjects</h3>",
    "<li>RETAIL (401) <a href='/retail-x'>IX</a></li>",
    "<li>INFORMATION TECHNOLOGY (402) <a href='/it-x'>IX</a></li>",
    "<h2>Senior Secondary Classes XI-XII</h2>",
    "<h3>Optional Skill Subjects</h3>",
    "<li>801 - Retail</li>",
  ].join("");

  const rows = parseCbseSkill(html);
  assert.ok(rows.some(row => row.stage_key === "cbse_9" && row.external_code === "401" && row.display_name === "RETAIL"));
  assert.ok(rows.some(row => row.stage_key === "cbse_9" && row.external_code === "402"));
  assert.ok(rows.some(row => row.stage_key === "cbse_11" && row.external_code === "801"));
  assert.ok(rows.some(row => row.stage_key === "cbse_12" && row.external_code === "801"));
});

function ibHeader() {
  return "SUBJECT CODE".padEnd(18)
    + "NAME ON TRANSCRIPT".padEnd(30)
    + "SUBJECT NAME FULL".padEnd(34)
    + "SL".padEnd(8)
    + "HL".padEnd(8)
    + "SUBJECT GROUP";
}

function ibRow(code, transcript, fullName, sl, hl, group) {
  return code.padEnd(18)
    + transcript.padEnd(30)
    + fullName.padEnd(34)
    + (sl ? "Yes" : "No").padEnd(8)
    + (hl ? "Yes" : "No").padEnd(8)
    + group;
}

test("IB parser preserves code, transcript name, group and SL/HL flags", () => {
  const text = [
    "SCIENCES",
    ibHeader(),
    ibRow("100452", "Physics", "Physics", true, true, "Sciences"),
    ibRow("100453", "Sports exercise health", "Sports Science", true, false, "Sciences"),
    "DISCONTINUED SUBJECTS",
    ibRow("999999", "Old Subject", "Old Subject", true, true, "Sciences"),
  ].join("\n");

  const rows = parseIbText(text);
  assert.equal(rows.length, 4);
  const physics = rows.find(row => row.external_code === "100452" && row.stage_key === "ibdp_1");
  assert.deepEqual(physics?.levels_supported, ["SL", "HL"]);
  assert.equal(physics?.metadata.group_key, "sciences");

  const sport = rows.find(row => row.external_code === "100453" && row.stage_key === "ibdp_2");
  assert.deepEqual(sport?.levels_supported, ["SL"]);
  assert.ok(sport?.aliases.includes("Sports exercise health"));
  assert.equal(rows.some(row => row.external_code === "999999"), false);
});

test("committed normalized catalog fixtures pass structural and count guards", () => {
  assert.deepEqual(validateFixture("cambridge"), []);
  assert.deepEqual(validateFixture("cbse"), []);
  assert.deepEqual(validateFixture("ib"), []);
});

test("fixture validation rejects duplicate active identity and non-first-party provenance", () => {
  const row = {
    provider: "cambridge",
    programme_key: "cambridge_as",
    stage_key: "cambridge_as",
    display_name: "Physics",
    external_code: "9702",
    source_url: "https://example.com/physics",
    source_version: "test",
    availability: "active",
  };
  const fake = {
    offerings: Array.from({ length: 250 }, (_, index) => ({
      ...row,
      display_name: index < 2 ? "Physics" : "Subject " + index,
      external_code: index < 2 ? "9702" : String(1000 + index).padStart(4, "0"),
    })),
  };
  const errors = validateFixture("cambridge", fake);
  assert.ok(errors.some(error => error.includes("duplicate active offering identity")));
  assert.ok(errors.some(error => error.includes("non-first-party source URL")));
});
