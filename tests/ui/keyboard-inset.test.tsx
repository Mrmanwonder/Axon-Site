import { render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import Dialog from "../../src/ui/components/Dialog";
import { keyboardInset } from "../../src/ui/lib/keyboardInset";

/*
 * The sheet is lifted by however much of the layout viewport the keyboard
 * hides. jsdom has no keyboard and no visualViewport, so both are mocked; this
 * proves the arithmetic and the wiring, not behaviour on a phone.
 */

test("no keyboard: nothing is hidden and the sheet stays on the bottom edge", () => {
  expect(keyboardInset({ layoutHeight: 800, viewportHeight: 800, offsetTop: 0 })).toBe(0);
});

test("Android Chrome keyboard: the visual viewport shrinks and the sheet lifts by the difference", () => {
  expect(keyboardInset({ layoutHeight: 800, viewportHeight: 480, offsetTop: 0 })).toBe(320);
});

test("iOS Safari keyboard with the visual viewport panned down: only what is below the visible area counts", () => {
  expect(keyboardInset({ layoutHeight: 800, viewportHeight: 450, offsetTop: 40 })).toBe(310);
});

test("pinch-zoom shrinks the visual viewport but is not a keyboard", () => {
  expect(keyboardInset({ layoutHeight: 800, viewportHeight: 400, offsetTop: 100, scale: 2 })).toBe(0);
});

test("sub-pixel differences and bad numbers are ignored", () => {
  expect(keyboardInset({ layoutHeight: 800, viewportHeight: 799.4, offsetTop: 0 })).toBe(0);
  expect(keyboardInset({ layoutHeight: Number.NaN, viewportHeight: 400, offsetTop: 0 })).toBe(0);
});

class FakeVisualViewport extends EventTarget {
  height = 800;
  offsetTop = 0;
  scale = 1;
}

let viewport: FakeVisualViewport;
const original = Object.getOwnPropertyDescriptor(window, "visualViewport");
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

beforeEach(() => {
  viewport = new FakeVisualViewport();
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
});

afterEach(() => {
  if (original) Object.defineProperty(window, "visualViewport", original);
  else delete (window as { visualViewport?: unknown }).visualViewport;
});

test("a sheet with a text field follows the keyboard open and closed", async () => {
  const { container, unmount } = render(
    <Dialog title="Fix this" onClose={() => {}}>
      <input aria-label="Answer" />
    </Dialog>,
  );
  const dialog = container.ownerDocument.querySelector("dialog")!;
  expect(dialog.style.getPropertyValue("--kb")).toBe("0px");
  expect(dialog.style.getPropertyValue("--vvh")).toBe("");

  viewport.height = 470;
  viewport.dispatchEvent(new Event("resize"));
  await frame();
  expect(dialog.style.getPropertyValue("--kb")).toBe("330px");
  expect(dialog.style.getPropertyValue("--vvh")).toBe("470px");

  // Safari pans the visual viewport while the keyboard is up.
  viewport.offsetTop = 30;
  viewport.dispatchEvent(new Event("scroll"));
  await frame();
  expect(dialog.style.getPropertyValue("--kb")).toBe("300px");

  viewport.height = 800;
  viewport.offsetTop = 0;
  viewport.dispatchEvent(new Event("resize"));
  await frame();
  expect(dialog.style.getPropertyValue("--kb")).toBe("0px");
  expect(dialog.style.getPropertyValue("--vvh")).toBe("");

  unmount();
});

test("without visualViewport the sheet is left exactly as before", () => {
  delete (window as { visualViewport?: unknown }).visualViewport;
  render(<Dialog title="Rename" onClose={() => {}}><input aria-label="Name" /></Dialog>);
  const dialog = document.querySelector("dialog")!;
  expect(dialog.style.getPropertyValue("--kb")).toBe("");
});
