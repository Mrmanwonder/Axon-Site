import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import Disclose from "../../src/ui/components/Disclose";
import { seed, spring, releaseSpring } from "../../src/ui/lib/spring";
vi.mock("../../src/ui/data/AppProvider", () => ({ useApp: () => ({ prefs: { always_show_reasoning: true } }) }));
afterEach(() => vi.restoreAllMocks());

test("an open disclosure follows content reflow and stops observing on unmount", () => {
  let notify!: () => void;
  const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class {
    constructor(cb: () => void) { notify = cb; }
    observe() {}
    disconnect = disconnect;
  });
  const view = render(<Disclose label="Reasoning">Long mathematical explanation</Disclose>);
  const inner = screen.getByText("Long mathematical explanation");
  let height = 200;
  Object.defineProperty(inner, "offsetHeight", { get: () => height });
  act(() => notify());
  expect(inner.parentElement?.style.height).toBe("200px");
  height = 420;
  act(() => notify());
  expect(inner.parentElement?.style.height).toBe("420px");
  view.unmount();
  expect(disconnect).toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test("spring position and velocity agree at the same elapsed time on 30/60/120Hz displays", () => {
  vi.spyOn(performance, "now").mockReturnValue(0);
  const samples: { pos: number; vel: number }[] = [];
  for (const hz of [30, 60, 120]) {
    let callback: FrameRequestCallback | null = null;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { callback = cb; return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const key = `audit-${hz}`;
    seed(key, 0);
    let sample = { pos: 0, vel: 0 };
    spring(key, { to: 1, onUpdate: (pos, vel) => { sample = { pos, vel }; } });
    for (let n = 1; n <= hz / 10; n++) { const cb = callback!; callback = null; cb(n * 1000 / hz); }
    samples.push(sample);
    releaseSpring(key);
  }
  expect(Math.max(...samples.map(s => s.pos)) - Math.min(...samples.map(s => s.pos))).toBeLessThan(0.015);
  expect(Math.max(...samples.map(s => s.vel)) - Math.min(...samples.map(s => s.vel))).toBeLessThan(0.05);
  vi.unstubAllGlobals();
});
