import { expect, test, vi } from "vitest";
vi.mock("../../src/papers.js", () => ({ pageAssetUrl: vi.fn() }));
import { cropStyles, paddedBox } from "../../src/scan/crops.js";

test("a short region gets at least a ruled line of context above and below", () => {
  const b = paddedBox({ x: 100, y: 1000, w: 1400, h: 100 }, 1900, 2400)!;
  expect(1000 - b.y).toBeGreaterThanOrEqual(36);
  expect(b.h).toBeGreaterThanOrEqual(100 + 72);
});

test("the crop frame carries its own aspect ratio so it can shrink to fit instead of being sliced", () => {
  const styles = cropStyles({ x: 137, y: 120, w: 1471, h: 1044 }, 1894, 2400)!;
  const ar = Number((styles.frame as Record<string, string>)["--crop-ar"]);
  expect(ar).toBeGreaterThan(1.2);
  expect(ar).toBeLessThan(1.6);
});
