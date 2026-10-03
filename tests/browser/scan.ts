import { scanFixture } from "./scan-fixtures";
import type { ScanFixtureState } from "./scan-fixtures";

const query = new URLSearchParams(location.search);
const closed = query.get("scenario") === "closed";

// view=scan-screen renders the real Scan page against a fixed scanner state.
const calls: Record<string, unknown[][]> = {};
(window as unknown as { __scanCalls: typeof calls }).__scanCalls = calls;
const fixed = query.get("view") === "scan-screen"
  ? scanFixture((query.get("state") ?? "search") as ScanFixtureState, calls) : null;

export function useScan() {
  if (fixed) return fixed;
  return {
    reviewOpen: !closed,
    closeReview() {},
    review: {
      title: "Review paper",
      outstanding: 1,
      cleanCount: 0,
      saveLabel: "1 left to check",
      questions: [{
        id: "question", label: "Question 1", tier: "unsure", confirmed: false,
        marksAwarded: 1, marksAvailable: 2, answer: "x + 1", alternatives: [0, 1, 2],
      }],
    },
    reviewHandlers: {
      onMark(_id: string, value: number) { (window as typeof window & { __markChoice?: number }).__markChoice = value; },
      onAction() {}, onConfirmClean() {}, onSave() {},
    },
  };
}
