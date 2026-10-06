/** Pending confirmations and source uncertainty remain separate after saving. */
export function reviewLeadFor(questions, pages, counts) {
  const parts = counts.parts_total;
  const tops = counts.questions_total;
  const base = (tops
    ? tops + " question" + (tops === 1 ? "" : "s") + " (" + parts + " part" + (parts === 1 ? "" : "s") + ")"
    : parts + " part" + (parts === 1 ? "" : "s")) +
    " · " + pages.length + " page" + (pages.length === 1 ? "" : "s");
  const needing = questions.filter(q => !q.confirmed && q.tier !== "confident").length;
  const outstanding = questions.filter(q => !q.confirmed).length;
  // One short line (owner, 5 Oct 2026: "so much text, no hierarchy").
  const unassigned = counts.unassigned_parts
    ? " · " + counts.unassigned_parts + " part" + (counts.unassigned_parts === 1 ? "" : "s") + " not placed"
    : "";
  const state = needing
    ? " · " + needing + " to check"
    : outstanding
      ? " · " + outstanding + " to confirm"
      : " · all confirmed";
  return base + unassigned + state;
}
