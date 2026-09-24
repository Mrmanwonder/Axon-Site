import { expect, test } from "@playwright/test";

test("Insights filter rail paints directly below the sticky header after scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/browser/index.html");

  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <link rel="stylesheet" href="/src/ui/styles/system.css">
        <style>
          :root {
            --top-inset: 24px;
            --view-top: 44px;
            --view-bottom: 0px;
            --rail-w: 0px;
            --vmax: 100%;
            --gutter: 16px;
            --bg: #000;
            --nav-bg: #18181a;
            --surface: #171719;
            --hairline: rgba(255,255,255,.12);
            --label: #fff;
            --label-2: #c9c9ce;
            --label-3: #77777e;
            --accent: #5d8cff;
            --accent-wash: rgba(93,140,255,.15);
            --d-state: 120ms;
            --d-disclose: 160ms;
            --spring: cubic-bezier(.1,.9,.2,1);
          }
          * { box-sizing: border-box; }
          html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: var(--bg); }
          .app { position: fixed; inset: 0; }
          .header.stuck .plate { opacity: 1; }
          .header.stuck .t span { opacity: 1; transform: none; }
          .fixture-card {
            margin: 0 16px;
            height: 240px;
            background: var(--surface);
          }
          .fixture-spacer { height: 520px; }
        </style>
      </head>
      <body>
        <div class="app">
          <div class="header stuck">
            <div class="plate"></div>
            <div class="t"><span>Insights</span></div>
          </div>
          <main class="view on">
            <div class="fixture-spacer"></div>
            <div class="fixture-card">content that must never show between header and filters</div>
            <div class="filterbar insightfilters">
              <button class="fchip app-dropdown-trigger">All subjects</button>
              <button class="fchip app-dropdown-trigger">All papers</button>
              <button class="fchip app-dropdown-trigger">Any date</button>
            </div>
            <div class="fixture-spacer"></div>
          </main>
        </div>
      </body>
    </html>
  `);

  const view = page.locator(".view");
  await view.evaluate((node) => { node.scrollTop = 900; });
  await page.waitForTimeout(50);

  const geometry = await page.evaluate(() => {
    const header = document.querySelector(".header")!.getBoundingClientRect();
    const rail = document.querySelector(".insightfilters")!.getBoundingClientRect();
    const firstChip = document.querySelector(".insightfilters .fchip")!.getBoundingClientRect();
    return {
      headerBottom: header.bottom,
      railTop: rail.top,
      railBottom: rail.bottom,
      chipTop: firstChip.top,
    };
  });

  expect(Math.abs(geometry.railTop - geometry.headerBottom)).toBeLessThanOrEqual(1);
  expect(geometry.chipTop).toBeGreaterThan(geometry.headerBottom);
  expect(geometry.railBottom).toBeGreaterThan(geometry.chipTop);
});
