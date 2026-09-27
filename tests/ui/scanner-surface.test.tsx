import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ captures: [] as any[], handlers: [] as any[] }));
vi.mock('../../src/scan/capture.js', () => ({
  createCapture: (options: any) => {
    const capture = { stop: vi.fn(), setAutoCapture: vi.fn(), setProcessing: vi.fn() };
    fixture.captures.push(capture);
    fixture.handlers.push(options);
    return capture;
  },
}));
import { attachSurface, detachSurface, resetScan, setAutoCapture, setScanContext } from '../../src/scan/ui.js';
beforeEach(() => {
  setScanContext({ student: { id: 'surface-test' } });
  fixture.captures.length = fixture.handlers.length = 0;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as any);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,fixture');
});
afterEach(() => { resetScan(); vi.restoreAllMocks(); });
const attach = (autoCapture?: boolean) => attachSurface(document.createElement('video'), document.createElement('canvas'), autoCapture === undefined ? undefined : { autoCapture });
test('Auto remains off through reattachment and the provider can explicitly restore its own preference', () => {
  attach(true);
  setAutoCapture(false);
  detachSurface();
  attach();
  expect(fixture.captures[1].setAutoCapture).toHaveBeenLastCalledWith(false);
  detachSurface();
  attach(true);
  expect(fixture.captures[2].setAutoCapture).toHaveBeenLastCalledWith(true);
});
test('reattaching while two pages are queued preserves processing pressure', async () => {
  attach();
  const first = fixture.handlers[0];
  const makeShot = () => ({ bitmap: { width: 100, height: 100, close: vi.fn() } });
  first.onShot(makeShot());
  first.onShot(makeShot());
  expect(fixture.captures[0].setProcessing).toHaveBeenLastCalledWith(true);
  detachSurface();
  attach();
  expect(fixture.captures[1].setProcessing).toHaveBeenLastCalledWith(true);
  // Cancel the queued work before it reaches persistence; this test exercises
  // controller ownership/backpressure, not conditioning or IndexedDB.
  resetScan();
  await Promise.resolve();
});
