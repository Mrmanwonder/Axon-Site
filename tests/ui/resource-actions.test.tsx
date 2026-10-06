import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import ResourceActions from "../../src/ui/components/ResourceActions";
import MaterialSymbol from "../../src/ui/components/MaterialSymbol";

test("labelled native actions dispatch their existing callbacks through the keyboard", async () => {
  const user = userEvent.setup();
  const onShare = vi.fn();
  const onDelete = vi.fn();
  render(<ResourceActions resourceLabel="paper" onShare={onShare} onDelete={onDelete} />);
  expect(screen.getByRole("group", { name: "paper actions" })).toBeTruthy();
  const share = screen.getByRole("button", { name: "Share paper" });
  const remove = screen.getByRole("button", { name: "Delete paper" });
  expect(share.textContent).toBe("Share");
  expect(remove.textContent).toBe("Delete");
  await user.tab();
  expect(document.activeElement).toBe(share);
  await user.keyboard("{Enter}");
  expect(onShare).toHaveBeenCalledTimes(1);
  await user.tab();
  expect(document.activeElement).toBe(remove);
  await user.keyboard(" ");
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onShare).toHaveBeenCalledTimes(1);
});

test("unknown share state stays available for the authoritative check and never claims sharing succeeded", async () => {
  const user = userEvent.setup();
  const onShare = vi.fn();
  const { rerender } = render(<ResourceActions resourceLabel="question" shareActive={null} onShare={onShare} />);
  const share = screen.getByRole("button", { name: "Share question" });
  expect(share.getAttribute("aria-pressed")).toBe("mixed");
  expect(share.textContent).toBe("Share");
  expect(share.getAttribute("title")).toContain("will be checked");
  expect((share as HTMLButtonElement).disabled).toBe(false);
  await user.click(share);
  expect(onShare).toHaveBeenCalledTimes(1);
  expect(share.textContent).toBe("Share");
  rerender(<ResourceActions resourceLabel="question" shareActive onShare={onShare} />);
  expect(share.getAttribute("aria-pressed")).toBe("true");
  expect(share.textContent).toBe("Shared");
});

test.each(["share", "delete"] as const)("caller-supplied %s busy state prevents duplicate/conflicting commands", async (busy) => {
  const user = userEvent.setup();
  const onShare = vi.fn();
  const onDelete = vi.fn();
  const { rerender } = render(<ResourceActions resourceLabel="paper" onShare={onShare} onDelete={onDelete} shareBusy={busy === "share"} deleteBusy={busy === "delete"} />);
  const share = screen.getByRole("button", { name: "Share paper" });
  const remove = screen.getByRole("button", { name: "Delete paper" });
  expect((share as HTMLButtonElement).disabled).toBe(true);
  expect((remove as HTMLButtonElement).disabled).toBe(true);
  const active = busy === "share" ? share : remove;
  expect(active.getAttribute("aria-busy")).toBe("true");
  expect(active.textContent).toBe(busy === "share" ? "Sharing…" : "Deleting…");
  await user.click(share);
  await user.click(remove);
  expect(onShare).not.toHaveBeenCalled();
  expect(onDelete).not.toHaveBeenCalled();
  rerender(<ResourceActions resourceLabel="paper" onShare={onShare} onDelete={onDelete} />);
  await user.click(share);
  expect(onShare).toHaveBeenCalledTimes(1);
});

test("optional capability and caller disabled state remain authoritative", async () => {
  const onDelete = vi.fn();
  render(<ResourceActions resourceLabel="question" onDelete={onDelete} disabled />);
  expect(screen.queryByRole("button", { name: "Share question" })).toBeNull();
  const remove = screen.getByRole("button", { name: "Delete question" });
  await userEvent.click(remove);
  expect(onDelete).not.toHaveBeenCalled();
});

test("local decorative SVGs carry no competing accessible name or font dependency", () => {
  const { container } = render(<><MaterialSymbol name="back" size={20} /><MaterialSymbol name="zoom" size={24} /></>);
  expect(screen.queryByRole("img")).toBeNull();
  const icons = container.querySelectorAll("svg");
  expect(icons[0].getAttribute("width")).toBe("20");
  expect(icons[1].getAttribute("width")).toBe("24");
  for (const icon of icons) {
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.getAttribute("focusable")).toBe("false");
    expect(icon.getAttribute("viewBox")).toBe("0 -960 960 960");
    expect(icon.querySelector("path")?.getAttribute("d")).toBeTruthy();
  }
  expect(container.querySelector("use, text, image")).toBeNull();
});
