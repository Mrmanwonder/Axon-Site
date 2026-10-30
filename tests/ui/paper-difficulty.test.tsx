import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const ROW = /^How hard was this paper\?/;
const open = async (name: string | RegExp = ROW) => {
  await userEvent.click(await screen.findByRole("button", { name }));
  return screen.findByRole("slider");
};

beforeEach(() => {
  vi.clearAllMocks();
  // The orb settles at once under reduced motion, so a key press is a result, not an animation.
  document.documentElement.dataset.motion = "reduce";
  fixture.read.mockResolvedValue(null);
  fixture.save.mockResolvedValue(undefined);
});
afterEach(() => { delete document.documentElement.dataset.motion; });

test("never offers the row before a paper is saved", () => {
  mount(false);
  expect(screen.queryByRole("button", { name: ROW })).toBeNull();
  expect(fixture.read).not.toHaveBeenCalled();
});

test("the row is there on every paper, and nothing opens until it is pressed", async () => {
  mount();
  expect(await screen.findByRole("button", { name: ROW })).toBeTruthy();
  expect(screen.queryByRole("slider")).toBeNull();
});

test("the orb starts at About right; a key press moves it and Save records that step", async () => {
  const user = userEvent.setup();
  mount();
  const slider = await open();
  expect(slider.getAttribute("aria-valuetext")).toBe("About right");
  slider.focus();
  await user.keyboard("{ArrowRight}");
  await waitFor(() => expect(slider.getAttribute("aria-valuetext")).toBe("Hard"));
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(fixture.save).toHaveBeenCalledWith({
    paperId: "p1", studentId: "s1", rating: 4, skipped: false,
  }));
  expect(await screen.findByText("Saved")).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("slider")).toBeNull(), { timeout: 4000 });
  expect(screen.getByText("Hard")).toBeTruthy();
  expect(screen.getByRole("button", { name: /^How hard it felt/ })).toBeTruthy();
});

test("End and Home jump to the ends", async () => {
  const user = userEvent.setup();
  mount();
  const slider = await open();
  slider.focus();
  await user.keyboard("{End}");
  await waitFor(() => expect(slider.getAttribute("aria-valuetext")).toBe("Very hard"));
  await user.keyboard("{Home}");
  await waitFor(() => expect(slider.getAttribute("aria-valuetext")).toBe("Very easy"));
  expect(slider.getAttribute("aria-valuenow")).toBe("1");
});

test("keyboard feedback does not wait for an animation frame", async () => {
  mount();
  const slider = await open();
  document.documentElement.dataset.motion = "full";
  const frame = vi.spyOn(globalThis, "requestAnimationFrame").mockReturnValue(1);
  try {
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(frame).toHaveBeenCalled();
    expect(slider.getAttribute("aria-valuetext")).toBe("Hard");
    expect(slider.getAttribute("aria-valuenow")).toBe("4");
    fireEvent.keyDown(slider, { key: "Home" });
    expect(slider.getAttribute("aria-valuetext")).toBe("Very easy");
  } finally { frame.mockRestore(); }
});

test("an existing answer is shown on the row and the sheet reopens on it", async () => {
  fixture.read.mockResolvedValue({ rating: 2, skipped: false });
  const user = userEvent.setup();
  mount();
  const slider = await open(/How hard it felt/);
  expect(slider.getAttribute("aria-valuetext")).toBe("Easy");
  await user.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(fixture.save).toHaveBeenCalledWith({
    paperId: "p1", studentId: "s1", rating: 2, skipped: false,
  }));
});

test("an older Not now is not an answer: the row still offers the question", async () => {
  fixture.read.mockResolvedValue({ rating: null, skipped: true });
  mount();
  expect(await screen.findByRole("button", { name: ROW })).toBeTruthy();
});

test("Not now closes the sheet and writes nothing", async () => {
  const user = userEvent.setup();
  mount();
  await open();
  await user.click(screen.getByRole("button", { name: "Not now" }));
  await waitFor(() => expect(screen.queryByRole("slider")).toBeNull());
  expect(fixture.save).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: ROW })).toBeTruthy();
});

test("offline read does not pretend there is no response; retry is possible", async () => {
  fixture.read.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(null);
  const user = userEvent.setup();
  mount();
  expect(await screen.findByText(/feedback is unavailable right now/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: ROW })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("button", { name: ROW })).toBeTruthy();
});

test("failed write keeps the sheet open, says so, and never claims it was saved", async () => {
  fixture.save.mockRejectedValueOnce(new Error("offline"));
  const user = userEvent.setup();
  mount();
  await open();
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/did not save/);
  expect(screen.queryByText("Saved")).toBeNull();
  expect(screen.getByRole("slider")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Saved")).toBeTruthy();
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

test("repeated Save presses while a write is pending produce exactly one request", async () => {
  let resolve!: () => void;
  fixture.save.mockReturnValue(new Promise<void>(done => { resolve = done; }));
  mount(); await open();
  const save = screen.getByRole("button", { name: "Save" });
  for (let i = 0; i < 10; i++) fireEvent.click(save);
  expect(fixture.save).toHaveBeenCalledOnce();
  await act(async () => resolve());
});

test("a previous paper's delayed save cannot mark the next paper as answered", async () => {
  let resolve!: () => void;
  fixture.save.mockReturnValue(new Promise<void>(done => { resolve = done; }));
  const view = mount();
  await open();
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  view.rerender(<ToastProvider><PaperDifficultyPrompt paperId="p2" studentId="s2" ready /></ToastProvider>);
  await screen.findByRole("button", { name: ROW });
  expect(screen.queryByRole("slider")).toBeNull();
  await act(async () => resolve());
  expect(screen.getByRole("button", { name: ROW })).toBeTruthy();
  expect(screen.queryByText("Saved")).toBeNull();
  expect(screen.queryByRole("button", { name: /^How hard it felt/ })).toBeNull();
});

test("an old retry cannot overwrite feedback in a different student scope", async () => {
  let resolve!: (value: { rating: number; skipped: boolean }) => void;
  fixture.read.mockRejectedValueOnce(new Error("outage"))
    .mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValueOnce(null);
  const next = mount();
  await userEvent.click(await screen.findByRole("button", { name: "Retry" }));
  next.rerender(<ToastProvider><PaperDifficultyPrompt paperId="p2" studentId="s2" ready /></ToastProvider>);
  await screen.findByRole("button", { name: ROW });
  await act(async () => resolve({ rating: 5, skipped: false }));
  expect(screen.getByRole("button", { name: ROW })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^How hard it felt/ })).toBeNull();
});
