import { expect, test } from "@playwright/test";

test("Library replaces document lines with the real paper count", async ({ page }) => {
  await page.goto("/tests/browser/index.html");
  await page.evaluate(async () => {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "/src/ui/styles/system.css";
    const loaded = new Promise<void>((resolve, reject) => {
      stylesheet.onload = () => resolve();
      stylesheet.onerror = () => reject(new Error("navigation styles did not load"));
    });
    document.head.append(stylesheet);
    await loaded;

    const root = document.createElement("div");
    document.body.append(root);
    const { mountNavGlyphsTest } = await import("/tests/browser/nav-glyphs.tsx");
    mountNavGlyphsTest(root);
  });

  const empty = page.locator('[data-paper-count="0"] svg');
  await expect(empty.locator("path")).toHaveCount(1);
  await expect(empty.locator("text")).toHaveCount(0);

  for (const [count, label] of [[7, "7"], [12, "12"], [123, "99+"]] as const) {
    const glyph = page.locator(`[data-paper-count="${count}"] svg`);
    await expect(glyph.locator("rect")).toHaveCount(1);
    await expect(glyph.locator("path")).toHaveCount(0);
    await expect(glyph.locator("text.library-count")).toHaveText(label);
    const boxes = await glyph.evaluate((svg) => {
      const outline = svg.querySelector("rect")!.getBBox();
      const text = svg.querySelector("text")!.getBBox();
      return { outline: { x: outline.x, width: outline.width }, text: { x: text.x, width: text.width } };
    });
    expect(boxes.text.x).toBeGreaterThanOrEqual(boxes.outline.x);
    expect(boxes.text.x + boxes.text.width).toBeLessThanOrEqual(boxes.outline.x + boxes.outline.width);
  }

  const insights = page.locator('[data-nav-icon="insights"] svg');
  await expect(insights.locator("path")).toHaveCount(2);
  await expect(insights.locator("circle.insights-endpoint")).toHaveCount(1);
});
