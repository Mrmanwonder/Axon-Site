import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock("../../src/ui/scan/ScanProvider", () => ({ useScan: () => fixture.state }));
vi.mock("../../src/ui/components/Crop", () => ({ default: () => <div>Page crop</div> }));

import ReviewSheet from "../../src/ui/scan/ReviewSheet";

const review = {
  title: "Review paper",
  outstanding: 1,
  cleanCount: 0,
  saveLabel: "1 left to check",
  questions: [{
    id: "question", label: "Question 1", tier: "unsure", confirmed: false,
    marksAwarded: 1, marksAvailable: 2, answer: "x + 1", alternatives: [0, 1, 2],
  }],
};

beforeEach(() => {
  fixture.state = {
    review, reviewOpen: true, closeReview: vi.fn(),
    reviewHandlers: { onMark: vi.fn(), onAction: vi.fn(), onConfirmClean: vi.fn(), onSave: vi.fn() },
  };
});

test("a closed review is absent from the accessibility tree", () => {
  fixture.state = { ...fixture.state, reviewOpen: false };
  render(<ReviewSheet />);
  expect(screen.queryByRole("region", { name: "Review paper" })).toBeNull();
  expect(screen.queryByText("Question 1")).toBeNull();
});

test("mark alternatives use native radio controls and emit the chosen value", async () => {
  render(<ReviewSheet />);
  const radios = screen.getAllByRole("radio");
  expect(radios).toHaveLength(3);
  expect((radios[1] as HTMLInputElement).checked).toBe(true);
  const user = userEvent.setup();
  await user.click(radios[2]);
  expect(fixture.state.reviewHandlers.onMark).toHaveBeenCalledWith("question", 2);
});
