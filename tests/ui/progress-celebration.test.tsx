import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, expect, test } from "vitest";
import ProgressCelebration from "../../src/ui/components/ProgressCelebration";
const defaults = { studentId: "student", readyPaperIds: [], fresh: true, streak: null, progressFresh: false };
beforeEach(() => { localStorage.clear(); window.dispatchEvent(new Event("axon:local-data")); });
test("celebrates the first newly ready paper once, but not historical papers or a reorder", () => {
  const { rerender, unmount } = render(<ProgressCelebration {...defaults} />);
  rerender(<ProgressCelebration {...defaults} readyPaperIds={["p"]} />);
  expect(screen.getByRole("status").textContent).toContain("Paper read. Nice work.");
  fireEvent.click(screen.getByText("Dismiss"));
  unmount(); render(<ProgressCelebration {...defaults} readyPaperIds={["p"]} />);
  expect(screen.queryByRole("status")).toBeNull();
});
test("ignores cached readiness, establishes a first-visit baseline and isolates siblings", () => {
  const { rerender } = render(<ProgressCelebration {...defaults} readyPaperIds={["old"]} />);
  expect(screen.queryByRole("status")).toBeNull();
  rerender(<ProgressCelebration {...defaults} readyPaperIds={["old", "new"]} fresh={false} />);
  expect(screen.queryByRole("status")).toBeNull();
  rerender(<ProgressCelebration {...defaults} readyPaperIds={["old", "new"]} />);
  expect(screen.getByRole("status")).not.toBeNull();
  rerender(<ProgressCelebration {...defaults} studentId="sibling" readyPaperIds={["sibling-paper"]} />);
  expect(screen.queryByRole("status")).toBeNull();
});
test("streak milestones require fresh completed practice today and don't repeat after remount", () => {
  const streak = { current: 7, longest: 7, freezes: 1, frozen: [], todayDone: false };
  const props = { ...defaults, today: "2026-10-14", streak, progressFresh: true };
  const { rerender, unmount } = render(<ProgressCelebration {...props} />);
  expect(screen.queryByRole("status")).toBeNull();
  rerender(<ProgressCelebration {...props} streak={{ ...streak, todayDone: true }} progressFresh={false} />);
  expect(screen.queryByRole("status")).toBeNull();
  rerender(<ProgressCelebration {...props} streak={{ ...streak, todayDone: true }} />);
  expect(screen.getByRole("status").textContent).toContain("7 practice days in a row");
  unmount(); render(<ProgressCelebration {...props} streak={{ ...streak, todayDone: true }} />);
  expect(screen.queryByRole("status")).toBeNull();
});
