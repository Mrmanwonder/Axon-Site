import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
const fake = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../../src/ui/data/modules", () => ({ readQuestionDifficulty: fake.read }));
import QuestionDifficultyHint from "../../src/ui/components/QuestionDifficultyHint";
beforeEach(() => { vi.resetAllMocks(); });
test("missing evidence stays absent without inventing a difficulty rating", async () => {
  fake.read.mockResolvedValue(null); render(<QuestionDifficultyHint attemptId="a" />);
  await waitFor(() => expect(fake.read).toHaveBeenCalledWith("a"));
  expect(screen.queryByText("Question difficulty")).toBeNull();
});
test("a read failure is visible and retry can restore an explicitly estimated rating", async () => {
  fake.read.mockRejectedValueOnce(new Error("unavailable")).mockResolvedValueOnce({
    band: 3, confidence: .28, source: "structural_estimate", method_version: "structural-v1",
  });
  render(<QuestionDifficultyHint attemptId="a" />);
  expect((await screen.findByRole("status")).textContent).toContain("unavailable right now");
  await userEvent.click(screen.getByRole("button", { name: "Try difficulty again" }));
  expect(await screen.findByText("Medium · estimated")).toBeTruthy();
  expect(screen.getByText("Low confidence")).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
});
test("changing the attempt cannot display a previous attempt's delayed rating", async () => {
  let resolve!: (value: object) => void;
  fake.read.mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValueOnce(null);
  const view = render(<QuestionDifficultyHint attemptId="a" />);
  view.rerender(<QuestionDifficultyHint attemptId="b" />);
  resolve({ band: 5, confidence: 1, source: "official_board_statistics", method_version: "v1" });
  await waitFor(() => expect(fake.read).toHaveBeenCalledWith("b"));
  expect(screen.queryByText(/Very hard/)).toBeNull();
});
