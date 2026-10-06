// CBSE syllabus parser (AXO-200). The fixture is synthetic: invented subject
// matter laid out the way CBSE curriculum files are (course-structure table,
// then detailed units), because this repository is public and never holds
// board text.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCbseSyllabus, cbsePlausibility, cbseAuditProblems } from "../../scripts/syllabus/cbse.mjs";
import { auditParse } from "../../scripts/syllabus/cambridge.mjs";

const TWO_CLASSES = `
                                   ORBITAL STUDIES
                               Classes XI-XII (2026-27)
                                 COURSE STRUCTURE
                              Class XI - 2026-27 (Theory)
            Unit–I       Lantern Theory
                         Chapter–1: Lantern Basics
            Unit-II      Harbour Motion
                         Chapter–2: Tides of the Harbour                      23
                         Chapter–3: Currents
                                       Total                              70             Unit I:   Lantern Theory
            Chapter–1: Lantern Basics
            Need for lanterns: kinds of lantern; wick, oil and glass; trimming the wick and
            judging the flame against the evening light.
            Unit II:   Harbour Motion
            Chapter–2: Tides of the Harbour
            Rising and falling water, the tide table, slack water and spring tides.
            Note: The following topics are included in the syllabus but will be assessed only formatively to
            reinforce understanding without adding to summative assessments.
            Chapter–3: Currents
            Drift of small boats; reading a current from floating weed; currents near the mole.
            PRACTICALS
            Practical record and viva                                                   10
\f
                               CLASS XII
            Unit–I       Signal Fires
                         Chapter–1: Beacons
            Unit-II      Night Charts
                         Chapter–2: Star Paths
                                       Total                              70
            Unit I:   Signal Fires
            Chapter–1: Beacons
            Choosing a hilltop for a beacon; keeping the fire dry; the order in which beacons are lit along a coast.
            Unit II:   Night Charts
            Chapter–2: Star Paths
            Steering by a fixed star; the turning sky through a night; marking the rising point on the rail.
            PRACTICALS
`;

test("the first class in a two-class file is read even though only the second has a head", () => {
  const p = parseCbseSyllabus(TWO_CLASSES, { classLabel: "XI" });
  assert.deepEqual(p.units.map((u) => `${u.code} ${u.title}`), ["XI.1 Lantern Theory", "XI.2 Harbour Motion"]);
  assert.deepEqual(p.units[1].topics.map((t) => t.title), ["Tides of the Harbour", "Currents"]);
});

test("course-structure rows are skipped; the colon heading starts the detailed syllabus", () => {
  const p = parseCbseSyllabus(TWO_CLASSES, { classLabel: "XI" });
  const all = p.units.flatMap((u) => u.topics.flatMap((t) => t.objectives.map((o) => o.text)));
  assert.ok(all.every((t) => !/Total|Chapter–/.test(t)), "no table text in objectives");
  assert.equal(p.units[0].topics[0].objectives[0].text,
    "Need for lanterns: kinds of lantern; wick, oil and glass; trimming the wick and judging the flame against the evening light.");
});

test("a note about formative assessment is not an objective, and what follows it stays in place", () => {
  const p = parseCbseSyllabus(TWO_CLASSES, { classLabel: "XI" });
  const texts = p.units[1].topics.flatMap((t) => t.objectives.map((o) => o.text));
  assert.ok(!texts.some((t) => /formatively|summative/.test(t)));
  assert.ok(texts.some((t) => /floating weed/.test(t)));
});

test("the detailed syllabus ends at the practicals", () => {
  const p = parseCbseSyllabus(TWO_CLASSES, { classLabel: "XI" });
  const texts = p.units.flatMap((u) => u.topics.flatMap((t) => t.objectives.map((o) => o.text)));
  assert.ok(!texts.some((t) => /record and viva/.test(t)));
});

test("the second class reads only its own part", () => {
  const p = parseCbseSyllabus(TWO_CLASSES, { classLabel: "XII" });
  assert.deepEqual(p.units.map((u) => u.code), ["XII.1", "XII.2"]);
  assert.match(p.units[0].topics[0].objectives[0].text, /^Choosing a hilltop/);
});

test("every objective passes the shared word-order audit", () => {
  for (const cls of ["XI", "XII"]) {
    const p = parseCbseSyllabus(TWO_CLASSES, { classLabel: cls });
    assert.deepEqual(cbseAuditProblems(auditParse(p, TWO_CLASSES, { maxLen: 1500, minLen: 5 }).problems), []);
  }
});

test("a detailed heading without a colon still starts the syllabus when prose follows", () => {
  const text = `
                               CLASS XI
            Unit-I Pond Life
            Chapter-1: The Still Water
            Duckweed, water striders and the film on the surface; why the pond is greener in late summer than in spring.
            Unit-II Reed Beds
            Chapter-2: Reeds
            How reeds spread by runners under the mud and shelter nesting birds through the wet months of the year.
            PRACTICALS`;
  const p = parseCbseSyllabus(text, { classLabel: "XI" });
  assert.deepEqual(p.units.map((u) => u.title), ["Pond Life", "Reed Beds"]);
});

test("a two-column table is refused, not read as interleaved sentences", () => {
  const rows = Array.from({ length: 12 }, (_, i) =>
    `            Topic number ${i} about lanterns              After going through this unit the learner will know ${i}`).join("\n");
  const text = `
                               CLASS XI
            Unit-1: Lanterns
${rows}
            Unit-2: Harbours
${rows}
            PRACTICALS`;
  const p = parseCbseSyllabus(text, { classLabel: "XI" });
  assert.ok(cbsePlausibility(p).some((x) => /second column/.test(x)));
});

test("a table read as prose (chapter-label units, fragment objectives) is refused", () => {
  const p = { units: [
    { code: "XI.1", title: "Chapter 1 Lanterns", topics: [{ code: "XI.1.1", title: "x", objectives: [
      { code: "a", text: "Wick" }, { code: "b", text: "Oil" }, { code: "c", text: "Glass" },
      { code: "d", text: "Trimming the wick and judging the flame at dusk." }] }] },
    { code: "XI.2", title: "Harbours", topics: [{ code: "XI.2.1", title: "y", objectives: Array.from({ length: 6 }, (_, i) => ({ code: `e${i}`, text: "Rising and falling water and the tide table." })) }] },
  ], bodyLines: 10, gapped: 0 };
  const problems = cbsePlausibility(p);
  assert.ok(problems.some((x) => /chapter labels/.test(x)));
});

test("'#' and a straight quote are allowed for CBSE; other stand-in glyphs are not", () => {
  const kept = cbseAuditProblems([
    'XI.1.1.1 has an unmapped glyph: "display each word separated by a #."',
    'XI.1.1.2 has an unmapped glyph: "executing a simple “hello world" program"',
    'XI.1.1.3 has an unmapped glyph: "the angle  is"',
    'XI.1.1.4 words not found in order in the source: "x"',
  ]);
  assert.equal(kept.length, 2);
  assert.ok(kept.some((p) => /XI\.1\.1\.3/.test(p)));
  assert.ok(kept.some((p) => /XI\.1\.1\.4/.test(p)));
});
