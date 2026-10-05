// Parser tests on invented excerpts that copy only the LAYOUT of Cambridge
// syllabi (no board text is reproduced in this public repository).
import test from "node:test";
import assert from "node:assert/strict";
import { parseCambridgeSyllabus, auditParse } from "../../scripts/syllabus/cambridge.mjs";
import { rowsFor, stableId, shortTitle } from "../../scripts/syllabus/ingest.mjs";

const HEADER = "                         Example Board AS & A Level Widgets 0001 syllabus for 2030. Subject content";
const FOOT = "Back to contents page                                                www.cambridgeinternational.org/alevel     12";

const bullets = [
  "   1      Widget Theory (for Paper 1)                                            19", // contents line
  "\f" + HEADER, "",
  "          1 Widget Theory (for Paper 1)",
  "          1.1 Basic widgets", "",
  "          Candidates should be able to:                             Notes and examples",
  "          •   describe a widget and its two                         e.g. a round widget or",
  "              principal parts                                       a square one.",
  "",
  "          •   compare widgets of different sizes",
  "",
  "          1.2 Widget forces", "",
  "          Candidates should be able to:                             Notes and examples",
  "          •   calculate the force on a widget                       Including friction.",
  FOOT,
].join("\n");

const numbered = [
  "\f" + HEADER,
  "         AS Level subject content",
  "          1    Gadgets", "",
  "          1.1 Gadget sizes", "",
  "          Candidates should be able to:", "",
  "          1    state the size of a gadget in standard units", "",
  "          2    estimate gadget sizes from a diagram and",
  "               justify the estimate", "",
  "          2   Motion of gadgets", "",
  "          2.1 Speed", "",
  "          Candidates should be able to:",
  "          1    define speed",
  "         A Level subject content",
  "          3    Advanced gadgets",
  "          3.1 Rotation",
  "          Candidates should be able to:",
  "          1    explain rotation of a gadget",
].join("\n");

const plain = [
  "\f" + HEADER,
  "          1      Gizmo representation",
  "          1.1    Gizmo data",
  "          Candidates should be able to:                              Notes and guidance",
  "          Show understanding of gizmo storage                        Use the terms: byte,",
  "          and retrieval                                              word",
  "          Perform calculations on gizmo sizes",
  "",
  "          Sound",
  "          Candidates should be able to:                              Notes and guidance",
  "          Show understanding of gizmo audio                          Including:",
  "                                                                     •   pitch",
  "\f" + HEADER,
  "         The following table is an example of an instruction set:",
  "                    LDM    #n                  Load the number n",
].join("\n");

test("bullet layout: units, topics, objectives and notes split by column", () => {
  const p = parseCambridgeSyllabus(bullets);
  assert.equal(p.style, "bullets");
  assert.deepEqual(p.units.map((u) => [u.code, u.title]), [["1", "Widget Theory (for Paper 1)"]]);
  const [t1, t2] = p.units[0].topics;
  assert.equal(t1.title, "Basic widgets");
  assert.deepEqual(t1.objectives.map((o) => o.text), ["describe a widget and its two principal parts", "compare widgets of different sizes"]);
  assert.equal(t1.objectives[0].notes, "e.g. a round widget or a square one.");
  assert.equal(t2.objectives[0].code, "1.2.1");
  assert.deepEqual(auditParse(p, bullets).problems, []);
});

test("numbered layout: items split by their own numbers, units and AS/A scope tracked", () => {
  const p = parseCambridgeSyllabus(numbered);
  assert.equal(p.style, "numbered");
  assert.deepEqual(p.units.map((u) => [u.code, u.title, u.scope]), [["1", "Gadgets", "AS"], ["2", "Motion of gadgets", "AS"], ["3", "Advanced gadgets", "A"]]);
  assert.deepEqual(p.units[0].topics[0].objectives.map((o) => o.text), [
    "state the size of a gadget in standard units",
    "estimate gadget sizes from a diagram and justify the estimate",
  ]);
  assert.deepEqual(auditParse(p, numbered).problems, []);
});

test("plain layout: sub-headings become groups, tables after a page break are ignored", () => {
  const p = parseCambridgeSyllabus(plain);
  const objs = p.units[0].topics[0].objectives;
  assert.deepEqual(objs.map((o) => [o.text, o.group]), [
    ["Show understanding of gizmo storage and retrieval", null],
    ["Perform calculations on gizmo sizes", null],
    ["Show understanding of gizmo audio", "Sound"],
  ]);
  assert.equal(objs[0].notes, "Use the terms: byte, word");
  assert.ok(!objs.some((o) => /LDM/.test(o.text)));
});

const wrapped = [
  "\f" + HEADER,
  "          1      Gizmo systems",
  "          1.1    Gizmo parts",
  "          Candidates should be able to:                              Notes and guidance",
  "          Explain why a gizmo requires a Central",
  "          Widget Store (CWS)",
  "          Describe the roles of the",
  "          Gizmo Control Unit (GCU) and its clock",
  "          Use the following gizmo symbols:",
  "",
  "                NUT                 BOLT               PIN",
  "",
  "                CLIP                PEG                RIVET",
  "",
  "          Show understanding of how gizmos are joined",
  "",
  "                       Fastener",
  "            Label          Opcode       Operand                      Explanation",
].join("\n");

test("plain layout: a capitalised line continues a phrase or an acronym, labels follow a colon, table headings are dropped", () => {
  const p = parseCambridgeSyllabus(wrapped);
  assert.deepEqual(p.units[0].topics[0].objectives.map((o) => o.text), [
    "Explain why a gizmo requires a Central Widget Store (CWS)",
    "Describe the roles of the Gizmo Control Unit (GCU) and its clock",
    "Use the following gizmo symbols: NUT BOLT PIN CLIP PEG RIVET",
    "Show understanding of how gizmos are joined",
  ]);
});

const notesFirst = [
  "\f" + HEADER,
  "          1 Widget Theory (for Paper 1)",
  "          1.1 Basic widgets", "",
  "          Candidates should be able to:                             Notes and examples",
  "                                                                    Including the round case where",
  "          •   describe a widget",
  "                                                                    necessary.",
  "          •   compare widgets                                       e.g. by size",
  "                                                                     ∫   a widget integral",
].join("\n");

test("notes printed above the first objective belong to it, and a notes-only line never leaks into an objective", () => {
  const p = parseCambridgeSyllabus(notesFirst);
  const [a, b] = p.units[0].topics[0].objectives;
  assert.equal(p.style, "bullets");
  assert.equal(a.text, "describe a widget");
  assert.equal(a.notes, "Including the round case where necessary.");
  assert.equal(b.text, "compare widgets");
  assert.equal(b.notes, "e.g. by size ∫ a widget integral");
});

test("the audit rejects an objective whose words are not in the source", () => {
  const p = parseCambridgeSyllabus(bullets);
  p.units[0].topics[0].objectives[0].text = "describe a widget and invent a word";
  assert.equal(auditParse(p, bullets).problems.length, 1);
});

test("ids are deterministic so a re-ingest keeps every question's tags", () => {
  const doc = { provider_key: "cambridge", syllabus_code: "0001", version_label: "2030" };
  const a = rowsFor(doc, parseCambridgeSyllabus(bullets));
  const b = rowsFor(doc, parseCambridgeSyllabus(bullets));
  assert.deepEqual(a.rows.map((r) => r.id), b.rows.map((r) => r.id));
  assert.match(stableId("x"), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.deepEqual(a.rows.map((r) => [r.kind, r.code, r.depth]), [
    ["unit", "1", 0], ["topic", "1.1", 1], ["objective", "1.1.1", 2], ["objective", "1.1.2", 2], ["topic", "1.2", 1], ["objective", "1.2.1", 2],
  ]);
  const obj = a.rows.find((r) => r.code === "1.1.1");
  assert.equal(obj.parent_id, a.rows.find((r) => r.code === "1.1").id);
});

test("short titles cut at a word and keep the full text elsewhere", () => {
  const long = "understand and use the relationship between a widget and its gadget when both are rotating in the same plane at constant speed";
  const t = shortTitle(long);
  assert.ok(t.length <= 91 && t.endsWith("…") && long.startsWith(t.slice(0, -1)));
});
