import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import EssentialButton from "../../src/ui/components/EssentialButton";

test("only a navigation destination receives the forward accent glyph", () => {
  const onClick = vi.fn();
  const { container } = render(
    <MemoryRouter>
      <EssentialButton to="/library">View library</EssentialButton>
      <EssentialButton onClick={onClick}>Save changes</EssentialButton>
      <EssentialButton variant="secondary" onClick={onClick}>Review paper</EssentialButton>
      <EssentialButton variant="quiet" onClick={onClick}>Not now</EssentialButton>
    </MemoryRouter>,
  );

  const nav = screen.getByRole("link", { name: "View library" });
  expect(nav.getAttribute("href")).toBe("/library");
  expect(nav.querySelector(".essential-button__arrow")).toBeTruthy();
  for (const label of ["Save changes", "Review paper", "Not now"]) {
    expect(screen.getByRole("button", { name: label }).querySelector(".essential-button__arrow")).toBeNull();
  }
  expect(container.querySelectorAll(".essential-button")).toHaveLength(4);
});

test("B5 action size, disabled, loading and event behavior", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  const { rerender } = render(
    <EssentialButton variant="primary" size="compact" onClick={onClick}>Save</EssentialButton>,
  );
  const button = screen.getByRole("button", { name: "Save" });
  expect(button.className).toContain("essential-button--compact");
  await user.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);

  rerender(<EssentialButton variant="primary" size="large" fullWidth loading onClick={onClick}>Save</EssentialButton>);
  expect(button.className).toContain("essential-button--large");
  expect(button.className).toContain("essential-button--full");
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(button.hasAttribute("disabled")).toBe(true);
  expect(button.querySelector(".essential-button__spinner")).toBeTruthy();
  await user.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);

  rerender(<EssentialButton disabled onClick={onClick}>Save</EssentialButton>);
  expect(button.hasAttribute("disabled")).toBe(true);
  expect(button.getAttribute("aria-busy")).toBeNull();
  await user.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
});
