import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import AvatarPicker from "../../src/ui/components/AvatarPicker";

function Harness() {
  const [value, setValue] = useState("frostCobalt");
  return <AvatarPicker value={value} label="Student" onChange={setValue} />;
}

test("profile picture is the only picker trigger and opens the complete dialog", async () => {
  const user = userEvent.setup();
  render(<Harness />);

  expect(screen.queryByText("More")).toBeNull();
  expect(screen.queryByRole("group", { name: "Profile pictures" })).toBeNull();

  await user.click(screen.getByRole("button", { name: "Change profile picture" }));

  const group = screen.getByRole("group", { name: "Profile pictures" });
  expect(within(group).getAllByRole("button")).toHaveLength(25);
  expect(screen.getByText("Frost cobalt")).toBeTruthy();
});

test("the dialog accent follows the newly selected preset", async () => {
  const user = userEvent.setup();
  const { container } = render(<Harness />);

  await user.click(screen.getByRole("button", { name: "Change profile picture" }));
  await user.click(screen.getByRole("button", { name: "Pensive" }));

  expect(screen.getByText("Pensive")).toBeTruthy();
  const picker = container.querySelector<HTMLElement>(".avatar-picker");
  expect(picker?.dataset.ambientPreset).toBe("pensive");
  expect(picker?.style.getPropertyValue("--avatar-wash-1")).toBe("#809bd6");
  expect(picker?.style.getPropertyValue("--avatar-wash-2")).toBe("#910aff");
  expect(picker?.style.getPropertyValue("--avatar-wash-3")).toBe("#af38ff");
  expect(container.querySelector(".avatar-ambient")).toBeTruthy();
  expect(container.querySelector(".avatar-drip")).toBeNull();
  expect(screen.getByRole("button", { name: "Pensive" }).getAttribute("aria-pressed")).toBe("true");
});


test("dot portraits use the fine monochrome reference treatment", async () => {
  const user = userEvent.setup();
  const { container } = render(<Harness />);

  await user.click(screen.getByRole("button", { name: "Change profile picture" }));
  await user.click(screen.getByRole("button", { name: "Dot portrait 1" }));

  const selected = container.querySelector('[data-preset="dotFace01"]');
  expect(selected?.getAttribute("data-kind")).toBe("dot-face");
  const dots = selected?.querySelectorAll("circle") ?? [];
  expect(dots.length).toBeGreaterThan(60);
  expect(Array.from(dots).every(dot => dot.getAttribute("r") === ".28")).toBe(true);
  expect(Array.from(dots).every(dot => dot.getAttribute("fill") === "currentColor")).toBe(true);
});


test("dot portrait ambience follows its underlying gradient palette", async () => {
  const user = userEvent.setup();
  const { container } = render(<Harness />);

  await user.click(screen.getByRole("button", { name: "Change profile picture" }));
  await user.click(screen.getByRole("button", { name: "Dot portrait 1" }));

  const picker = container.querySelector<HTMLElement>(".avatar-picker");
  expect(picker?.dataset.ambientPreset).toBe("dotFace01");
  expect(picker?.style.getPropertyValue("--avatar-wash-1")).toBe("#f5e8ff");
  expect(picker?.style.getPropertyValue("--avatar-wash-2")).toBe("#7f67ff");
  expect(picker?.style.getPropertyValue("--avatar-wash-3")).toBe("#2d1c68");
  expect(picker?.style.getPropertyValue("--avatar-wash-4")).toBe("#8ff3df");
});
