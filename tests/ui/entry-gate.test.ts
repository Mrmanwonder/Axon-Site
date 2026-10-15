import { beforeEach, expect, test } from "vitest";
import { needsApplication } from "../../src/ui/app/entryGate";
const home = { pathname: '/', search: '', hash: '' };
beforeEach(() => localStorage.clear());
test('signed-out landing stays independent of auth; returning sessions boot the app', () => {
  expect(needsApplication(home)).toBe(false);
  localStorage.setItem('sb-project-auth-token', '{}');
  expect(needsApplication(home)).toBe(true);
});
test.each([
  { ...home, pathname: '/library/paper' }, { ...home, pathname: '/share' },
  { ...home, search: '?code=callback' }, { ...home, hash: '#access_token=callback&type=recovery' },
  { ...home, search: '?start=account' },
])('deep links and auth callbacks boot the app: %j', route => expect(needsApplication(route)).toBe(true));
test('blocked storage takes the app recovery path', () => {
  expect(needsApplication(home, () => { throw new DOMException('blocked', 'SecurityError'); })).toBe(true);
});
