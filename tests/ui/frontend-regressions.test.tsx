import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { DraftsButton } from "../../src/ui/components/ScanDrafts";
import Switch from "../../src/ui/components/Switch";

test("scanner does not show a saved-drafts control when there are no drafts", () => {
  render(<DraftsButton count={0} onOpen={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /saved draft/i })).toBeNull();
});

test("scanner exposes saved drafts only when there is something to resume", () => {
  render(<DraftsButton count={1} onOpen={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Open 1 saved draft" })).toBeTruthy();
});

test("switch begins its optimistic move on pointer down with the requested press scale", () => {
  const onChange = vi.fn();
  const { container } = render(<Switch on={false} onChange={onChange} label="Reduce motion" />);
  const control = screen.getByRole("switch", { name: "Reduce motion" });
  const thumb = container.querySelector<HTMLElement>(".th");
  expect(thumb).toBeTruthy();

  fireEvent.pointerDown(control, { button: 0 });

  expect(onChange).toHaveBeenCalledWith(true);
  expect(thumb!.style.transform).toContain("scale(0.92)");
});
