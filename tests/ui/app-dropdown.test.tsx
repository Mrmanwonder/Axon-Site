import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import AppDropdown from "../../src/ui/components/AppDropdown";

const options = [{ value: "a", label: "All" }, { value: "b", label: "Biology" }, { value: "c", label: "Chemistry" }];
function setup(value = "b") {
  const onChange = vi.fn();
  render(<><button>Before</button><AppDropdown ariaLabel="Subject" value={value} options={options} onChange={onChange} /><button>After</button></>);
  return { user: userEvent.setup(), onChange, trigger: screen.getByRole("button", { name: "Subject" }) };
}
const active = () => document.getElementById(screen.getByRole("listbox").getAttribute("aria-activedescendant")!);
test("opens on the selected option, navigates without selecting, and commits with Enter", async () => {
  const { user, trigger, onChange } = setup();
  trigger.focus(); await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(screen.getByRole("listbox"));
  expect(active()?.textContent).toBe("Biology");
  await user.keyboard("{End}{ArrowUp}{Home}{ArrowDown}{ArrowDown}");
  expect(active()?.textContent).toBe("Chemistry");
  expect(onChange).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  expect(onChange).toHaveBeenCalledWith("c");
  expect(document.activeElement).toBe(trigger);
  expect(screen.queryByRole("listbox")).toBeNull();
});
test("typeahead and Space choose; Escape dismisses without changing the value", async () => {
  const { user, trigger, onChange } = setup();
  await user.click(trigger); await user.keyboard("c ");
  expect(onChange).toHaveBeenCalledWith("c");
  onChange.mockClear();
  await user.click(trigger); await user.keyboard("{Home}{Escape}");
  expect(onChange).not.toHaveBeenCalled(); expect(document.activeElement).toBe(trigger);
});
test("Tab and Shift-Tab continue relative to the trigger despite the portal", async () => {
  const { user, trigger } = setup();
  await user.click(trigger); await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
  await user.click(trigger); await user.tab({ shift: true });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Before" }));
  expect(screen.queryByRole("listbox")).toBeNull();
});
test("pointer selection and outside dismissal retain their behavior", async () => {
  const { user, trigger, onChange } = setup();
  await user.click(trigger); await user.click(screen.getByRole("option", { name: "All" }));
  expect(onChange).toHaveBeenCalledWith("a");
  await user.click(trigger); await user.click(screen.getByRole("button", { name: "After" }));
  expect(screen.queryByRole("listbox")).toBeNull();
});
