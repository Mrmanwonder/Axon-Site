import { beforeEach, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider } from "../../src/ui/components/ToastProvider";
import PaperDifficultyPrompt from "../../src/ui/components/PaperDifficultyPrompt";
import { summarizePerceivedDifficulty } from "../../src/ui/data/perceivedDifficulty";
import { ALL_FILTERS } from "../../src/ui/data/insights";

const fixture = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn() }));
vi.mock("../../src/ui/data/modules", () => ({
  paperDifficultyFeedback: fixture.read,
  savePaperDifficultyFeedback: fixture.save,
}));
const mount = (ready = true) => render(
  <ToastProvider><PaperDifficultyPrompt paperId="p1" studentId="s1" ready={ready} /></ToastProvider>,
);

beforeEach(() => {
  vi.clearAllMocks();
  fixture.read.mockResolvedValue(null);
  fixture.save.mockResolvedValue(undefined);
});

test("never interrupts a paper before saving is done", () => {
  mount(false);
  expect(screen.queryByText("How difficult did this paper feel?")).toBeNull();
  expect(fixture.read).not.toHaveBeenCalled();
});

test("one tap records the response and dismisses; reopening shows only deliberate Edit", async () => {
  const user = userEvent.setup();
  const first = mount();
  await user.click(await screen.findByRole("button", { name: "Hard", exact: true }));
  await waitFor(() => expect(fixture.save).toHaveBeenCalledWith({
    paperId: "p1", studentId: "s1", rating: 4, skipped: false,
  }));
  expect(screen.queryByText("How difficult did this paper feel?")).toBeNull();
  first.unmount();
  fixture.read.mockResolvedValue({ rating: 4, skipped: false });
  mount();
  expect(await screen.findByText("How this paper felt:", { exact: false })).toBeTruthy();
  expect(screen.queryByText("How difficult did this paper feel?")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.click(screen.getByRole("button", { name: "Easy", exact: true }));
  await waitFor(() => expect(fixture.save).toHaveBeenLastCalledWith({
    paperId: "p1", studentId: "s1", rating: 2, skipped: false,
  }));
});

test("Not now is persisted and never prompts on repeated open", async () => {
  const user = userEvent.setup();
  const first = mount();
  await user.click(await screen.findByRole("button", { name: "Not now" }));
  await waitFor(() => expect(fixture.save).toHaveBeenCalledWith({
    paperId: "p1", studentId: "s1", rating: null, skipped: true,
  }));
  first.unmount();
  fixture.read.mockResolvedValue({ rating: null, skipped: true });
  mount();
  await waitFor(() => expect(fixture.read).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("How difficult did this paper feel?")).toBeNull();
});

test("offline read does not pretend there is no response; retry is possible", async () => {
  fixture.read.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(null);
  const user = userEvent.setup();
  mount();
  expect(await screen.findByText(/feedback isn't available offline/)).toBeTruthy();
  expect(screen.queryByText("How difficult did this paper feel?")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("How difficult did this paper feel?")).toBeTruthy();
});

test("failed write leaves choice open, never claims it was saved", async () => {
  fixture.save.mockRejectedValueOnce(new Error("offline"));
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole("button", { name: "Very easy", exact: true }));
  expect(await screen.findByText(/Couldn't save that response/)).toBeTruthy();
  expect(screen.getByText("How difficult did this paper feel?")).toBeTruthy();
});

test("Insight comparison uses only rated, matching, complete teacher-marked papers", () => {
  const papers = [
    { id: "a", type: "test", tier: "tier_1", date_taken: "2026-10-01", subject: "Math", total_awarded: 45, total_available: 50, total_partial: false },
    { id: "b", type: "test", tier: "tier_1", date_taken: "2026-10-02", subject: "Math", total_awarded: 20, total_available: 50, total_partial: false },
    { id: "c", type: "test", tier: "tier_1", date_taken: "2026-10-03", subject: "Science", total_awarded: 15, total_available: 25, total_partial: true },
  ];
  const felt = [
    { paper_id: "a", rating: 5, responded_at: "" },
    { paper_id: "b", rating: 1, responded_at: "" },
    { paper_id: "c", rating: 4, responded_at: "" },
  ];
  expect(summarizePerceivedDifficulty(papers, felt, ALL_FILTERS)?.hardAndHeld).toBe(1);
  expect(summarizePerceivedDifficulty(papers, felt, ALL_FILTERS)?.easyAndLost).toBe(1);
  expect(summarizePerceivedDifficulty(papers, felt, { ...ALL_FILTERS, subject: "Science" })?.hardAndHeld).toBe(0);
  expect(summarizePerceivedDifficulty(papers, [], ALL_FILTERS)).toBeNull();
});
