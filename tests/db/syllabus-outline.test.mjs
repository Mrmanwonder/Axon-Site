// Tests for the outline parser on invented excerpts that copy only the LAYOUT
// of Cambridge syllabi (no board text is reproduced in this public repository).
import test from "node:test";
import assert from "node:assert/strict";
import { parseCambridgeOutline, plausibility } from "../../scripts/syllabus/cambridge-outline.mjs";
import { auditParse } from "../../scripts/syllabus/cambridge.mjs";

const HEAD = "                                                    Example Board IGCSE Widgets 0001 syllabus for 2030. Subject content";
const FOOT = "    Back to contents page                                                             www.example.org/igcse      12";
/** Puts `right` at column 70, as extract.py lays out a two-column page. */
const row = (left, right = "") => (right ? `${left.padEnd(70)}${right}` : left);
const flat = (p) => p.units.flatMap((u) => u.topics.flatMap((t) => t.objectives.map((o) => ({ ...o, topic: t.code, unit: u.code }))));

test("Core | Supplement: numbered objectives in both columns, units told apart from items", () => {
  const text = ["\f" + HEAD,
    "              1    Widgets and their parts",
    "              1.1 Widget structure",
    row("              Core", "Supplement"),
    row("              1   Describe the parts of a widget,", "3   Explain why a widget needs a hinge"),
    row("                  limited to:", "    when it rotates"),
    "                  (a) the frame",
    "                  (b) the hinge",
    row("              2   State the uses of a widget", "4   Calculate the turning force on a hinge"),
    "              1.2 Widget care",
    row("              Core", "Supplement"),
    "              1   Describe how to clean a widget",
    "              2   Outline how widgets are stored",
    "              2    Gadgets",
    "              2.1 Gadget sizes",
    row("              Core", "Supplement"),
    "              1   State the sizes of gadgets",
    FOOT,
    "\f" + HEAD,
    "              2.1 Gadget sizes continued",
    row("              Core", "Supplement"),
    row("              2   Compare gadget sizes", "3   Estimate the size of a gadget"),
    "              3    Gizmos",
    "              3.1 Gizmo use",
    row("              Core", "Supplement"),
    "              1   Describe a gizmo",
  ].join("\n");
  const p = parseCambridgeOutline(text);
  assert.deepEqual(p.units.map((u) => [u.code, u.title]), [["1", "Widgets and their parts"], ["2", "Gadgets"], ["3", "Gizmos"]]);
  const o = flat(p);
  assert.deepEqual(o.filter((x) => x.topic === "1.1").map((x) => [x.code, x.group, x.text]), [
    ["1.1.1", null, "Describe the parts of a widget, limited to: (a) the frame (b) the hinge"],
    ["1.1.2", null, "State the uses of a widget"],
    ["1.1.3", "Supplement", "Explain why a widget needs a hinge when it rotates"],
    ["1.1.4", "Supplement", "Calculate the turning force on a hinge"],
  ]);
  assert.deepEqual(o.filter((x) => x.topic === "2.1").map((x) => x.code), ["2.1.1", "2.1.2", "2.1.3"]);
  assert.deepEqual(auditParse(p, text, { segments: true }).problems, []);
});

test("sub-topics: a heading on the left, its bullets on the right, intro prose skipped", () => {
  const text = ["\f" + HEAD,
    "              1      Markets",
    "              This topic introduces the ideas that come before everything else in this paper and",
    "              should be read first.",
    "              1.1    How markets work",
    row("              1.1.1 The purpose of a market and the", "•   what buyers do"),
    row("                    people in it:", "•   what sellers do"),
    row("              1.1.2 Prices", "•   how a price is set"),
    row("", "    by buyers and sellers"),
    "              1.2    Market failure",
    "              1.2.1 Causes of market failure",
    "                     •  missing information",
    "                     •  costs to others",
    "              1.2.2 Responses to market failure",
    "                     •  taxes and rules",
  ].join("\n");
  const p = parseCambridgeOutline(text);
  assert.deepEqual(flat(p).map((x) => [x.code, x.text]), [
    ["1.1.1", "The purpose of a market and the people in it: • what buyers do • what sellers do"],
    ["1.1.2", "Prices: • how a price is set by buyers and sellers"],
    ["1.2.1", "Causes of market failure: • missing information • costs to others"],
    ["1.2.2", "Responses to market failure: • taxes and rules"],
  ]);
  assert.ok(p.skipped.some((x) => /introduces the ideas/.test(x.text)));
  assert.deepEqual(auditParse(p, text, { segments: true }).problems, []);
});

test("tier-prefixed topics with notes: stems keep their completions, notes stay notes", () => {
  const text = ["\f" + HEAD,
    "             Core subject content",
    "              1       Counting",
    row("              C1.1    Kinds of count", "Notes and examples"),
    row("              Identify and use:", "Example tasks include:"),
    row("              •   whole counts", "•   write a count in words"),
    "              •   part counts.",
    row("              C1.2    Exact counts", "Notes and examples"),
    "              Know the exact counts of:",
    "              1 small groups of up to ten.",
    "              2 pairs of groups.",
    "             Extended subject content",
    "              1       Counting",
    row("              E1.1    Kinds of count", "Notes and examples"),
    "              Identify and use:",
    "              •   whole counts.",
  ].join("\n");
  const p = parseCambridgeOutline(text);
  assert.deepEqual(p.units.map((u) => [u.code, u.title]), [["C1", "Counting"], ["E1", "Counting"]]);
  assert.deepEqual(flat(p).map((x) => [x.code, x.text, x.notes]), [
    ["C1.1.1", "Identify and use: • whole counts • part counts.", "Example tasks include: • write a count in words"],
    ["C1.2.1", "Know the exact counts of: small groups of up to ten.", null],
    ["C1.2.2", "Know the exact counts of: pairs of groups.", null],
    ["E1.1.1", "Identify and use: • whole counts.", null],
  ]);
});

test("board-numbered objectives: the code's sentence is the objective, wrapped lines join it", () => {
  const text = ["\f" + HEAD,
    "              1      Shapes",
    row("              Candidates should be able to:", "Notes/Examples"),
    row("              1.1    Recognise and name simple shapes.", "Circles and squares only."),
    "              1.2    Transform a shape to and from its mirror image, including",
    "                     finding the line of reflection.",
    "              1.3    Shapes on a grid",
  ].join("\n");
  const p = parseCambridgeOutline(text);
  assert.deepEqual(flat(p).map((x) => [x.code, x.text]), [
    ["1.1", "Recognise and name simple shapes."],
    ["1.2", "Transform a shape to and from its mirror image, including finding the line of reflection."],
  ]);
});

test("learning outcomes on the right, topic title on the left", () => {
  const text = ["\f" + HEAD,
    "              1      Cells",
    row("              1.1 The parts of a cell and", "Learning outcomes"),
    row("                  what they do", "Candidates should be able to:"),
    row("", "1   name the parts of a cell"),
    row("", "2   describe what each part does,"),
    row("", "    including the wall"),
  ].join("\n");
  const p = parseCambridgeOutline(text);
  assert.equal(p.units[0].topics[0].title, "The parts of a cell and what they do");
  assert.deepEqual(flat(p).map((x) => [x.code, x.text]), [
    ["1.1.1", "name the parts of a cell"],
    ["1.1.2", "describe what each part does, including the wall"],
  ]);
});

test("plausibility rejects a parse that is faithful but not a syllabus", () => {
  const text = ["\f" + HEAD, "              1      Shapes", "              1.1    Recognise simple shapes."].join("\n");
  const problems = plausibility(parseCambridgeOutline(text));
  assert.ok(problems.some((x) => /only 1 objectives/.test(x)));
  assert.ok(problems.some((x) => /only 1 topics/.test(x)));
});
