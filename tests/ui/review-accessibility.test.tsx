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

test("native radio selection stays a draft until the teacher mark is explicitly saved", async () => {
  render(<ReviewSheet />);
  const radios = screen.getAllByRole("radio");
  expect(radios).toHaveLength(3);
  expect((radios[1] as HTMLInputElement).checked).toBe(true);
  const user = userEvent.setup();
  await user.click(radios[2]);
  expect(fixture.state.reviewHandlers.onMark).not.toHaveBeenCalled();
  expect((screen.getByRole("button", { name: "Confirm all readings" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("button", { name: "Save teacher’s mark" }));
  expect(fixture.state.reviewHandlers.onMark).toHaveBeenCalledWith("question", 2);
});

test("failed mark save retains its selected draft and does not confirm the question", async () => {
  const handlers = fixture.state.reviewHandlers as Record<string, any>;
  handlers.onMark.mockRejectedValue(new Error("The server could not save this mark."));
  render(<ReviewSheet />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "0" }));
  await user.click(screen.getByRole("button", { name: "Save teacher’s mark" }));
  expect((await screen.findByRole("alert")).textContent).toContain("The server could not save this mark.");
  expect((screen.getByRole("radio", { name: "0" }) as HTMLInputElement).checked).toBe(true);
  expect(handlers.onAction).not.toHaveBeenCalled();
  expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("button", { name: "Cancel mark change" }));
  expect((screen.getByRole("radio", { name: "1" }) as HTMLInputElement).checked).toBe(true);
});

test("answer edits preserve line breaks and survive a failed save", async () => {
  const onAnswer = vi.fn().mockRejectedValue(new Error("Answer not saved"));
  fixture.state.reviewHandlers = { ...(fixture.state.reviewHandlers as object), onAnswer };
  render(<ReviewSheet />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Edit answer transcription" }));
  const editor = screen.getByRole("textbox", { name: "Edit answer transcription" });
  await user.clear(editor); await user.type(editor, "x + 1\n= 2");
  await user.click(screen.getByRole("button", { name: "Save answer transcription" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Answer not saved");
  expect((editor as HTMLTextAreaElement).value).toBe("x + 1\n= 2");
  expect(onAnswer).toHaveBeenCalledWith("question", "x + 1\n= 2");
});
