import { afterEach, beforeEach, expect, test, vi } from 'vitest';

let sent: any[];
let w: any;
let cloned: any;
let source: any;
let context: any;
let canvases: any[];
beforeEach(() => {
  vi.resetModules();
  sent = [];
  canvases = [];
  source = { width: 2400, height: 3200, close: vi.fn() };
  cloned = { ...source, close: vi.fn() };
  context = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ width: 100, height: 100, data: new Uint8ClampedArray(40000) })) };
  vi.stubGlobal('createImageBitmap', vi.fn(async () => cloned));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['fallback'])));
  vi.stubGlobal('OffscreenCanvas', class {
    width: number; height: number;
    constructor(width: number, height: number) { this.width = width; this.height = height; canvases.push(this); }
    getContext = vi.fn(() => context);
    async convertToBlob() { return new Blob(['original']); }
  });
  vi.stubGlobal('Worker', class {
    onmessage: any; onerror: any; onmessageerror: any;
    terminate = vi.fn();
    constructor() { w = this; }
    postMessage = vi.fn((message, transfer) => { sent.push({ message, transfer }); });
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('worker encoding transfers only a clone and never draws the original on the UI thread', async () => {
  const { encodeStill } = await import('../../src/scan/still-encoder.js');
  const encoded = encodeStill(source);
  await vi.waitFor(() => expect(sent).toHaveLength(1));
  expect(sent).toHaveLength(1);
  expect(sent[0].message.bitmap).toBe(cloned);
  expect(sent[0].transfer).toEqual([cloned]);
  expect(context.drawImage).not.toHaveBeenCalled();
  const blob = new Blob(['encoded-worker']);
  w.onmessage({ data: { id: sent[0].message.id, ok: true, blob } });
  expect(await encoded).toBe(blob);
  expect(source.close).not.toHaveBeenCalled();
});

test('an encoder crash settles pending work and preserves the source for canvas fallback', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { encodeStill } = await import('../../src/scan/still-encoder.js');
  const encoded = encodeStill(source);
  await vi.waitFor(() => expect(sent).toHaveLength(1));
  w.onerror({ message: 'encoder failed' });
  expect((await encoded as Blob).size).toBeGreaterThan(0);
  expect(w.terminate).toHaveBeenCalledOnce();
  expect(context.drawImage).toHaveBeenCalledWith(source, 0, 0);
  expect(source.close).not.toHaveBeenCalled();
});

test('unsupported workers use the same original dimensions and JPEG quality', async () => {
  vi.stubGlobal('Worker', undefined);
  const { encodeStill } = await import('../../src/scan/still-encoder.js');
  expect((await encodeStill(source) as Blob).size).toBeGreaterThan(0);
  expect(context.drawImage).toHaveBeenCalledWith(source, 0, 0);
  expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.95);
});

for (const fails of [false, true]) {
  test(`worker releases transferred bitmap and canvas on ${fails ? 'encode failure' : 'success'}`, async () => {
    if (fails) context.drawImage.mockImplementation(() => { throw new Error('draw failed'); });
    const { encodeTransferredStill } = await import('../../src/scan/still-encoder-worker.js');
    if (fails) await expect(encodeTransferredStill(cloned)).rejects.toThrow('draw failed');
    else expect((await encodeTransferredStill(cloned)).size).toBeGreaterThan(0);
    expect(cloned.close).toHaveBeenCalledOnce();
    expect(canvases[0]).toMatchObject({ width: 1, height: 1 });
    expect(source.close).not.toHaveBeenCalled();
  });
}

test('conditioning releases its temporary resize even when readback fails', async () => {
  context.getImageData.mockImplementation(() => { throw new Error('read failed'); });
  const { resampledImageData } = await import('../../src/scan/conditioning.js');
  await expect(resampledImageData(source, { width: 100, height: 100 })).rejects.toThrow('read failed');
  expect(cloned.close).toHaveBeenCalledOnce();
  expect(source.close).not.toHaveBeenCalled();
});
