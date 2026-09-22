import { test, expect } from '@playwright/test';

test('deleting schoolwork purges cached results and student drafts, and rejects late writes', async ({ page }) => {
  await page.goto('/tests/browser/index.html');
  const result = await page.evaluate(async () => {
    const cache = await import('/src/cache.js');
    const drafts = await import('/src/scan/drafts.js');
    const { LocalDataService } = await import('/src/local-data.js');
    await cache.putCached('paper:student:paper', { answer: 'private schoolwork' });
    const draft = await drafts.createDraft({ id: crypto.randomUUID(), studentId: 'student', paperType: null });
    draft.pages.push({ page_number: 1, blob: new Uint8Array([1, 2, 3]).buffer }); await drafts.saveDraft(draft);
    await LocalDataService.clearStudent('student');
    let rejected = false; try { await drafts.saveDraft(draft); } catch { rejected = true; }
    return { cached: await cache.getCached('paper:student:paper'), drafts: (await drafts.listDrafts('student')).length, rejected };
  });
  expect(result).toEqual({ cached: null, drafts: 0, rejected: true });
});

test('cross-tab sign-out cleanup closes handles and removes previous student schoolwork', async ({ page, context }) => {
  await page.goto('/tests/browser/index.html');
  const sibling = await context.newPage(); await sibling.goto('/tests/browser/index.html');
  await sibling.evaluate(async () => {
    const local = await import('/src/local-data.js');
    await local.openDraftDatabase(); // deliberately hold a handle open
    const cache = await import('/src/cache.js'); await cache.putCached('paper:first-student:paper', { answer: 'private' });
  });
  await page.evaluate(async () => { const { LocalDataService } = await import('/src/local-data.js'); await LocalDataService.clearAll(); });
  await sibling.reload();
  expect(await sibling.evaluate(async () => (await import('/src/cache.js')).getCached('paper:first-student:paper'))).toBeNull();
});

test('an uncancellable live read cannot recreate cache after deletion', async ({ page }) => {
  await page.goto('/tests/browser/index.html');
  const result = await page.evaluate(async () => {
    const { readThrough, getCached } = await import('/src/cache.js');
    const { LocalDataService } = await import('/src/local-data.js');
    let resolve: (value: unknown) => void = () => {};
    const pending = readThrough('paper:old', () => new Promise(done => { resolve = done; })).catch(() => null);
    await LocalDataService.clearAll(); resolve({ private: true }); await pending;
    return getCached('paper:old');
  });
  expect(result).toBeNull();
});

test('abandoned drafts expire after the explicit retention period', async ({ page }) => {
  await page.goto('/tests/browser/index.html');
  const count = await page.evaluate(async () => {
    const local = await import('/src/local-data.js'); const { listDrafts } = await import('/src/scan/drafts.js');
    const db = await local.openDraftDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      tx.objectStore('drafts').put({ id: 'expired', student_id: 'student', updated_at: Date.now() - 31 * 86400000, pages: [{ blob: new Uint8Array([1]).buffer }] });
      tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Draft fixture could not be stored.'));
    }); local.closeLocalDatabase(db);
    return (await listDrafts('student')).length;
  });
  expect(count).toBe(0);
});
