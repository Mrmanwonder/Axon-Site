import { render, screen, within } from "@testing-library/react";
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

test("mark alternatives are one radio group with the teacher's number checked, and emit the chosen value", async () => {
  render(<ReviewSheet />);
  const group = screen.getByRole("radiogroup", { name: "Which number did your teacher write?" });
  const radios = within(group).getAllByRole("radio");
  expect(radios).toHaveLength(3);
  expect(radios[1].getAttribute("aria-checked")).toBe("true");
  const user = userEvent.setup();
  await user.click(radios[2]);
  expect(fixture.state.reviewHandlers.onMark).toHaveBeenCalledWith("question", 2);
});

test("a drawn answer says so instead of 'Not read', and review carries no explanation of lost marks", () => {
  fixture.state = { ...fixture.state, review: { ...review, questions: [{
    ...review.questions[0], answer: null, regionType: "diagram",
    explanation: { cause: "procedural_slip", body: "The quartile position was rounded down.", doThisNext: "Use (n+1)/4." },
  }] } };
  render(<ReviewSheet />);
  expect(screen.getByText(/A drawn answer/)).toBeTruthy();
  expect(screen.queryByText("Not read")).toBeNull();
  // Checking the reading is review's only job (owner, 6 Oct 2026).
  expect(screen.queryByText(/Why the mark went/i)).toBeNull();
  expect(screen.queryByText(/quartile position/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Not why I lost it" })).toBeNull();
});

test("the student places a part by tapping its label: question, then part", async () => {
  const onRelabel = vi.fn().mockResolvedValue(undefined);
  fixture.state = { ...fixture.state, review: { ...review, questions: [{ ...review.questions[0], label: "(b)" }] },
    reviewHandlers: { ...(fixture.state.reviewHandlers as object), onRelabel } };
  const user = userEvent.setup();
  render(<ReviewSheet />);
  await user.click(screen.getByRole("button", { name: /Question \(b\)\. Change/ }));
  await user.click(within(screen.getByRole("radiogroup", { name: "Question number" })).getByRole("radio", { name: "4" }));
  expect(within(screen.getByRole("radiogroup", { name: "Part" })).getByRole("radio", { name: "(b)" }).getAttribute("aria-checked")).toBe("true");
  await user.click(within(screen.getByRole("radiogroup", { name: "Part" })).getByRole("radio", { name: "(a)" }));
  await user.click(screen.getByRole("button", { name: "This is 4(a)" }));
  expect(onRelabel).toHaveBeenCalledWith("question", "4(a)");
});
