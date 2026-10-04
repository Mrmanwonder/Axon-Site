import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import TeacherMarkControl from "../../src/ui/scan/TeacherMarkControl";

test("an unread mark has no selected option; zero is a deliberate selection", async () => {
  const onSave = vi.fn();
  render(<TeacherMarkControl id="q" awarded={null} available={2} onSave={onSave} />);
  expect(screen.getAllByRole("radio").some(r => (r as HTMLInputElement).checked)).toBe(false);
  expect((screen.getByRole("button", { name: "Save teacher’s mark" }) as HTMLButtonElement).disabled).toBe(true);
  const user = userEvent.setup(); await user.click(screen.getByRole("radio", { name: "0" }));
  await user.click(screen.getByRole("button", { name: "Save teacher’s mark" }));
  expect(onSave).toHaveBeenCalledWith("q", 0);
  expect((await screen.findByRole("status")).textContent).toContain("Check the other readings");
});

test("a forty-mark question uses a bounded number input", async () => {
  const onSave = vi.fn();
  render(<TeacherMarkControl id="q" awarded={3} available={40} onSave={onSave} />);
  expect(screen.queryByRole("radio")).toBeNull();
  const input = screen.getByRole("spinbutton");
  expect(input.getAttribute("max")).toBe("40");
  const user = userEvent.setup(); await user.clear(input); await user.type(input, "41");
  expect((screen.getByRole("button", { name: "Save teacher’s mark" }) as HTMLButtonElement).disabled).toBe(true);
  await user.clear(input); await user.type(input, "40"); await user.click(screen.getByRole("button", { name: "Save teacher’s mark" }));
  expect(onSave).toHaveBeenCalledWith("q", 40);
});

test("an unknown maximum remains unbounded and blank never means zero", () => {
  render(<TeacherMarkControl id="q" awarded={null} available={null} onSave={vi.fn()} />);
  expect(screen.getByRole("spinbutton").hasAttribute("max")).toBe(false);
  expect(screen.queryByRole("radio")).toBeNull();
  expect((screen.getByRole("button", { name: "Save teacher’s mark" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/No maximum has been inferred/)).toBeTruthy();
});

test("a fully awarded three-mark reading stays selected without a save or confirmation", () => {
  const onSave = vi.fn();
  render(<TeacherMarkControl id="full" awarded={3} available={3} onSave={onSave} />);
  expect((screen.getByRole("radio", { name: "3" }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("button", { name: /Save teacher.s mark/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(onSave).not.toHaveBeenCalled();
});
