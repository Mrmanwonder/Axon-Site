import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { useState } from "react";
import { isCalendarDate, paperDateLabel } from "../../src/paperDate.js";
import PaperDateEditor from "../../src/ui/components/PaperDateEditor";

const save = vi.hoisted(() => vi.fn());
vi.mock("../../src/ui/data/modules", () => ({ setPaperExamDate: save }));
beforeEach(() => { save.mockReset(); save.mockResolvedValue(undefined); });

test("dates distinguish a supplied exam date from upload history, including old offline copies", () => {
  expect(paperDateLabel({ date_taken: "2026-10-10" })).toBe("Added 10 Oct 2026");
  expect(paperDateLabel({ date_taken: "2026-10-10", exam_date: "2026-09-30" })).toBe("Exam 30 Sept 2026");
  expect(paperDateLabel({ date_taken: "2026-10-10", exam_date: null }, { short: true })).toBe("Added 10 Oct");
  expect(paperDateLabel({ date_taken: "bad" })).toBe("Added date not recorded");
  expect(paperDateLabel({ date_taken: "2026-10-10", exam_date: "2026-02-30" })).toBe("Added 10 Oct 2026");
});

test("calendar validation rejects rollover, timestamps and unsupported years", () => {
  expect(isCalendarDate("2024-02-29")).toBe(true);
  for (const value of ["2026-02-29", "2026-04-31", "0000-01-01", "2026-1-01", "2026-10-10T00:00:00Z", "infinity", null]) {
    expect(isCalendarDate(value)).toBe(false);
  }
  expect(isCalendarDate("0001-01-01")).toBe(true);
  expect(isCalendarDate("9999-12-31")).toBe(true);
});

function Editor({ initial = null }: { initial?: string | null }) {
  const [date, setDate] = useState(initial);
  return <><output>{paperDateLabel({ date_taken: "2026-10-10", exam_date: date })}</output>
    <PaperDateEditor paperId="paper-a" examDate={date} onSaved={setDate} /></>;
}

test("a saved correction updates the label and clearing restores Added without rewriting history", async () => {
  render(<Editor />);
  fireEvent.change(screen.getByLabelText("Exam date"), { target: { value: "2026-09-30" } });
  fireEvent.click(screen.getByRole("button", { name: "Save date" }));
  await waitFor(() => expect(save).toHaveBeenCalledWith("paper-a", "2026-09-30"));
  expect(await screen.findByText("Exam 30 Sept 2026")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Clear date" }));
  fireEvent.click(screen.getByRole("button", { name: "Save date" }));
  await waitFor(() => expect(save).toHaveBeenLastCalledWith("paper-a", null));
  expect(await screen.findByText("Added 10 Oct 2026")).toBeTruthy();
});

test("a rejected save keeps the old visible date and the correction ready for retry", async () => {
  save.mockRejectedValueOnce(new Error("offline"));
  render(<Editor initial="2026-09-29" />);
  fireEvent.change(screen.getByLabelText("Exam date"), { target: { value: "2026-09-30" } });
  fireEvent.click(screen.getByRole("button", { name: "Save date" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("Exam 29 Sept 2026")).toBeTruthy();
  expect((screen.getByLabelText("Exam date") as HTMLInputElement).value).toBe("2026-09-30");
  fireEvent.click(screen.getByRole("button", { name: "Save date" }));
  expect(await screen.findByText("Exam 30 Sept 2026")).toBeTruthy();
});

test("repeated submit while saving starts one write and cannot edit the in-flight value", async () => {
  let complete!: () => void;
  save.mockReturnValue(new Promise<void>(resolve => { complete = resolve; }));
  render(<Editor />);
  const input = screen.getByLabelText("Exam date") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "2026-09-30" } });
  const form = input.closest("form")!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(save).toHaveBeenCalledTimes(1);
  expect(input.disabled).toBe(true);
  await act(async () => complete());
  expect(input.disabled).toBe(false);
});
