import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const start = vi.hoisted(() => vi.fn());
vi.mock("../../src/ui/data/useHomePractice", () => ({ useStartPractice: () => start }));
vi.mock("../../src/ui/data/modules", () => ({ sb: {} }));
vi.mock("../../src/ui/lib/haptics", () => ({ hapticFirm() {} }));

import { DueQueueList, LeaksCard, NextBestActionCard, ProgressStrip } from "../../src/ui/components/HomePractice";
import { topLeaks, type FocusArea, type NextBestAction, type ProgressSummary } from "../../src/ui/data/practice";

const wrap = (n: React.ReactNode) => render(<MemoryRouter>{n}</MemoryRouter>);
beforeEach(() => { start.mockReset(); start.mockResolvedValue(undefined); });

const ready: NextBestAction = {
  state: "ready", kind: "topic", key: "t1", label: "Rates of reaction", subject: "Chemistry",
  item_ids: ["a", "b", "c", "d"], marks_recoverable: 9, minutes: 15, papers_seen: 3, reason: "lost in 3 papers",
};

test("AXO-251: one task, gain-framed, and one primary button that starts that session", async () => {
  const { container } = wrap(<NextBestActionCard nba={ready} showTypes={false} onScan={() => {}} />);
  expect(screen.getByText("Re-attempt 4 questions on Rates of reaction")).toBeTruthy();
  expect(screen.getByText("9 marks to win back")).toBeTruthy();
  expect(container.textContent).not.toMatch(/recoverable|\+\d/);
  expect(container.querySelectorAll(".btn.primary")).toHaveLength(1);
  expect(container.textContent).not.toMatch(/%|score/i);
  await userEvent.click(screen.getByRole("button", { name: "Start · 15 min" }));
  expect(start).toHaveBeenCalledWith("topic", { key: "t1", subject: "Chemistry", itemIds: ["a", "b", "c", "d"] });
});

test("AXO-251: a new student is asked to scan, never shown an empty plan", async () => {
  const onScan = vi.fn();
  wrap(<NextBestActionCard nba={{ state: "no_scans" }} showTypes={false} onScan={onScan} />);
  await userEvent.click(screen.getByRole("button", { name: "Scan a paper" }));
  expect(onScan).toHaveBeenCalled();
});

test("AXO-251: a failed start says so and frees the button", async () => {
  start.mockRejectedValue(new Error("There is nothing to practise there right now."));
  wrap(<NextBestActionCard nba={ready} showTypes={false} onScan={() => {}} />);
  await userEvent.click(screen.getByRole("button", { name: "Start · 15 min" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/nothing to practise/);
  expect(screen.getByRole("button", { name: "Start · 15 min" }).hasAttribute("disabled")).toBe(false);
});

test("AXO-252: the due queue lists items with their own minutes and starts one item", async () => {
  wrap(<DueQueueList due={[
    { id: "e1", subject: "Physics", question_label: "Q3(b)", paper_id: "p", attempt_id: "x", marks_lost: 2, marks_available: 4, minutes: 3, next_review_at: "2026-10-12", overdue_days: 1, status: "retried" },
  ]} />);
  expect(screen.getByText("Due 1 day ago · 3 min")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: /Re-attempt Q3\(b\), Physics/ }));
  expect(start).toHaveBeenCalledWith("item", { key: "e1" });
});

const area = (kind: FocusArea["kind"], key: string, m: number): FocusArea => ({
  kind, key, label: key, subject: "Physics", marks_recoverable: m, items_open: 2, papers_seen: 2,
  exam_date: null, exam_days: null, heaviest_paper: null, heaviest_weight_pct: null, score: m, reason: "",
});

test("AXO-253: three leaks, a 'seen in' badge and a fix button; mistake types hidden while the flag is off", async () => {
  const all = [area("mistake_type", "careless", 9), area("topic", "Forces", 8), area("command_word", "Explain", 6), area("ao", "AO2", 5), area("subject", "Physics", 20)];
  expect(topLeaks(all, true).map((l) => l.kind)).toEqual(["mistake_type", "topic", "command_word"]);
  const leaks = topLeaks(all, false);
  expect(leaks.map((l) => l.kind)).toEqual(["topic", "command_word", "ao"]);
  const { container } = wrap(<LeaksCard leaks={leaks} showTypes={false} />);
  expect(container.textContent).not.toMatch(/Slips|These questions/);
  expect(screen.getAllByText(/Seen in 2 papers/)).toHaveLength(3);
  await userEvent.click(screen.getAllByRole("button", { name: /Fix this/ })[0]);
  expect(start).toHaveBeenCalledWith("topic", { key: "Forces", subject: "Physics" });
});

test("AXO-254: before any finished practice the strip says what it counts, not a zero", () => {
  const p: ProgressSummary = { weeks: [], marks_recovered_total: 0, topics_passed_30d: 0, reattempts_this_week: 0, session_dates: [], today: "2026-10-13" };
  const { container } = wrap(<ProgressStrip progress={p} streak={null} />);
  expect(container.textContent).toMatch(/never opening the app/);
  expect(container.querySelector(".pstat")).toBeNull();
});
