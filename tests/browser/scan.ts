import { scanFixture } from "./scan-fixtures";
import type { ScanFixtureState } from "./scan-fixtures";
import { useState } from "react";
const params = new URLSearchParams(location.search);
const scenario = params.get("scenario");
const styled = location.pathname.includes("paper-reading");
const calls: Record<string, unknown[][]> = {};
(window as unknown as { __scanCalls: typeof calls }).__scanCalls = calls;
const fixed = params.get("view") === "scan-screen" ? scanFixture((params.get("state") ?? "search") as ScanFixtureState, calls) : null;
export function useScan() {
  const [open, setOpen] = useState(scenario !== "closed");
  const [questions, setQuestions] = useState<any[]>(() => [{
    id: "question", label: styled ? "Question 1(a)" : "Question 1", tier: scenario === "unreadable" ? "unreadable" : "unsure", confirmed: scenario === "completed",
    marksAwarded: scenario === "unreadable" ? null : 1, marksAvailable: scenario === "large" ? 40 : scenario === "unknown" ? null : 2,
    answer: styled ? "X | 0 | 1 | 2 | 3\nP | 1/4 | 3/8 | 1/4 | 1/8" : "x + 1",
    questionText: styled ? "State the possible values of X using the printed probability distribution." : null,
    paperId: styled ? "fixture" : undefined, pageNumber: styled ? 1 : undefined, pageNumbers: styled ? [1, 2] : [],
    crop: styled ? { paperId: "fixture", page: 1, box: { x: 30, y: 90, w: 720, h: 260 } } : null,
  }]);
  if (fixed) return fixed;
  const outstanding = questions.filter(q => !q.confirmed).length;
  return { reviewOpen: open, closeReview() { setOpen(false); },
    review: { title: "Review paper", outstanding, cleanCount: 0, saveLabel: outstanding ? `${outstanding} left to check` : "Save to Library", questions },
    reviewHandlers: {
      async onMark(id: string, value: number) {
        if (scenario === "save-failed") throw new Error("The teacher mark could not be saved. Your draft is still here.");
        (window as typeof window & { __markChoice?: number }).__markChoice = value;
        setQuestions(previous => previous.map(q => q.id === id ? { ...q, marksAwarded: value, confirmed: false } : q));
      },
      async onAnswer(id: string, answer: string) { setQuestions(previous => previous.map(q => q.id === id ? { ...q, answer, confirmed: false } : q)); },
      onAction(id: string, action: string) { if (action === "confirm") setQuestions(previous => previous.map(q => q.id === id ? { ...q, confirmed: true } : q)); },
      onConfirmClean() {}, onSave() {},
    },
  };
}
