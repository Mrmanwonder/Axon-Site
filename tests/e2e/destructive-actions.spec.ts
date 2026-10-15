import { expect, test, type Locator } from '@playwright/test';
async function expectHazard(button: Locator) {
  await expect(button).toBeVisible();
  const glyph = button.locator('svg[data-symbol="warning"]');
  await expect(glyph).toHaveAttribute('aria-hidden', 'true');
  const colors = await button.evaluate(el => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--danger)'; el.append(probe);
    const expected = getComputedStyle(probe).color;
    probe.remove();
    const icon = el.querySelector('svg')!;
    return { expected, text: getComputedStyle(el).color, icon: getComputedStyle(icon).color, fill: getComputedStyle(icon).fill, stroke: getComputedStyle(icon).stroke };
  });
  expect(colors.text).toBe(colors.expected);
  expect(colors.icon).toBe(colors.expected);
  expect(colors.fill).toBe(colors.expected);
  expect(colors.stroke).toBe('none');
}
for (const theme of ['light', 'dark']) {
  test(`delete controls keep red hazard styling after component styles load: ${theme}`, async ({ page }) => {
    await page.goto(`/tests/browser/index.html?view=paper&route=/library/paper-1&theme=${theme}`);
    await page.addStyleTag({ content: '* { transition: none !important; animation: none !important; }' });
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    const remove = page.getByRole('button', { name: 'Delete paper', exact: true });
    await expectHazard(remove);
    await remove.click();
    await expectHazard(page.getByRole('dialog').getByRole('button', { name: 'Delete paper', exact: true }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/tests/browser/index.html?view=scan-screen&state=saved&theme=${theme}`);
    await page.getByRole('button', { name: /Saved drafts/ }).first().click();
    const draft = page.getByRole('button', { name: 'Delete draft, 3 pages', exact: true });
    await expectHazard(draft);
    await draft.click();
    await expectHazard(page.getByRole('button', { name: 'Delete 3 pages from this phone', exact: true }));
  });
}
