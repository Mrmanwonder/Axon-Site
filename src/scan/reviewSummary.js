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
  const unassigned = counts.unassigned_parts
    ? " · " + counts.unassigned_parts + " part" + (counts.unassigned_parts === 1 ? "" : "s") + " with an unassigned question"
    : "";
  const state = needing
    ? " · " + needing + " uncertain reading" + (needing === 1 ? "" : "s") + " to check, shown first"
    : outstanding
      ? " · " + outstanding + " reading" + (outstanding === 1 ? "" : "s") + " to confirm before saving"
      : " · all readings confirmed";
  return base + unassigned + state;
}
