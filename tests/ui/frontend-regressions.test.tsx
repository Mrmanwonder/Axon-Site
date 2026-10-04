import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import Switch from "../../src/ui/components/Switch";

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
