import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const deferred = () => {
  let resolve!: (value?: any) => void;
  let reject!: (error: any) => void;
  const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const caps = { imageWidth: { max: 4032 }, imageHeight: { max: 3024 } };
let controllers: any[];
let workers: any[];
let context: any;
let bitmap: () => any;

const noPage = { status: 'none', source: 'ml', quad: null, score: 0.01, degraded: false, error: null, ms: 3 };
function replyTo(message: any) {
  if (message.kind === 'init') return { id: message.id, ok: true, ml: true, error: null };
  if (message.kind === 'detect') {
    return { id: message.id, ok: true, detection: noPage, width: 100, height: 100,
      signals: { luma: { median: 150, p95: 230 }, motion: 0, edgeContrast: null }, exposure: null };
  }
  if (message.kind === 'focus') return { id: message.id, ok: true, sharpness: 1 };
  return { id: message.id, ok: true };
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  controllers = [];
  workers = [];
  context = new Proxy({}, { get: (target: any, key) => target[key] ??= vi.fn(() => ({ data: new Uint8ClampedArray(40000), width: 100, height: 100 })) });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['frame'])));
  bitmap = () => ({ width: 100, height: 100, close: vi.fn() });
  vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap()));
  vi.stubGlobal('ImageCapture', undefined);
  vi.stubGlobal('Worker', class {
    onmessage: any;
    onerror: any;
    messages: any[] = [];
    terminate = vi.fn();
    // Answers like the real worker (src/scan/detect-worker.js): every request gets
    // exactly one reply. Tests override postMessage to hold or break replies.
    postMessage = vi.fn((message) => {
      this.messages.push(message);
      queueMicrotask(() => this.onmessage?.({ data: replyTo(message) }));
    });
    constructor() { workers.push(this); }
  });
});
afterEach(() => {
  controllers.forEach((capture) => capture.stop());
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function fixture() {
  const { createCapture } = await import('../../src/scan/capture.js');
  const video = document.createElement('video');
  Object.defineProperties(video, {
    srcObject: { value: null, writable: true },
    readyState: { value: 4 },
    videoWidth: { value: 0, writable: true },
    videoHeight: { value: 0, writable: true },
  });
  video.play = vi.fn(async () => {});
  video.requestVideoFrameCallback = vi.fn(() => 1);
  video.cancelVideoFrameCallback = vi.fn();
  const track = { stop: vi.fn(), applyConstraints: vi.fn(async () => {}), getCapabilities: () => ({ focusMode: ['continuous'] }) };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const onState = vi.fn();
  const onShot = vi.fn();
  const capture = createCapture({ video, overlay: document.createElement('canvas'), onState, onShot });
  controllers.push(capture);
  return { capture, video, track, stream, onState, onShot };
}
const flush = () => vi.advanceTimersByTimeAsync(0);
const showFrame = (video: HTMLVideoElement) => {
  Object.assign(video, { videoWidth: 100, videoHeight: 100 });
};

// These drive the production controller; only the browser/hardware boundary is stubbed.
test('a stalled photo capability probe and stalled optional controls cannot hang startup', async () => {
  vi.stubGlobal('ImageCapture', class { getPhotoCapabilities() { return new Promise(() => {}); } });
  const f = await fixture();
  f.track.applyConstraints.mockImplementation(() => new Promise(() => {}));
  const started = vi.fn();
  const operation = f.capture.start(f.stream).then(started);
  await vi.advanceTimersByTimeAsync(3601);
  expect(started).toHaveBeenCalledOnce();
  await operation;
  expect(f.capture.capturePath).toBe('canvas-grab');
  expect(f.video.requestVideoFrameCallback).toHaveBeenCalledOnce();
});

test('concurrent starts share setup and an already-running start preserves ownership', async () => {
  const permission = deferred();
  const f = await fixture();
  const first = f.capture.start(permission.promise);
  const second = f.capture.start(permission.promise);
  expect(first).toBe(second);
  permission.resolve(f.stream);
  await first;
  await f.capture.start(f.stream);
  expect(f.video.play).toHaveBeenCalledOnce();
  expect(f.video.requestVideoFrameCallback).toHaveBeenCalledOnce();
});

test('late capability rejection cannot demote the next activation', async () => {
  const old = deferred();
  let instances = 0;
  vi.stubGlobal('ImageCapture', class { getPhotoCapabilities() { return ++instances === 1 ? old.promise : Promise.resolve(caps); } });
  const f = await fixture();
  const first = f.capture.start(f.stream);
  await flush();
  f.capture.stop();
  await f.capture.start(f.stream);
  old.reject(new Error('old camera closed'));
  await first;
  expect(f.capture.capturePath).toBe('image-capture');
  expect(f.video.requestVideoFrameCallback).toHaveBeenCalledOnce();
});

test('a failed playback releases its stream and startup can be retried', async () => {
  const f = await fixture();
  f.video.play = vi.fn().mockRejectedValueOnce(new Error('play failed')).mockResolvedValue(undefined);
  await expect(f.capture.start(f.stream)).rejects.toThrow('play failed');
  expect(f.track.stop).toHaveBeenCalledOnce();
  expect(f.video.srcObject).toBeNull();
  await f.capture.start(f.stream);
  expect(f.video.requestVideoFrameCallback).toHaveBeenCalledOnce();
});

test('a stalled playback fails visibly and releases the camera', async () => {
  const f = await fixture();
  f.video.play = vi.fn(() => new Promise(() => {}));
  const failure = expect(f.capture.start(f.stream)).rejects.toMatchObject({ name: 'TimeoutError' });
  await vi.advanceTimersByTimeAsync(5001);
  await failure;
  expect(f.track.stop).toHaveBeenCalledOnce();
  expect(f.video.srcObject).toBeNull();
});

test('old permission rejection does not clear a newer shared camera request', async () => {
  const old = deferred();
  const fresh = deferred();
  const getUserMedia = vi.fn().mockReturnValueOnce(old.promise).mockReturnValue(fresh.promise);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  const camera = await import('../../src/scan/camera.js');
  const first = camera.requestCamera().catch(() => null);
  camera.releaseCamera();
  const second = camera.requestCamera();
  old.reject(new Error('old permission denied'));
  await first;
  expect(camera.requestCamera()).toBe(second);
  expect(getUserMedia).toHaveBeenCalledTimes(2);
  fresh.resolve({ getTracks: () => [] });
  await second;
  camera.releaseCamera();
});

const workerOf = async (f: any) => { await f.capture.start(f.stream); await flush(); return workers[0]; };

test('a detection answered after stop cannot publish state or start another loop', async () => {
  const f = await fixture();
  showFrame(f.video);
  // Hold every detect reply; init is answered so the search loop starts.
  const held: any[] = [];
  let w: any;
  const originalWorker = (globalThis as any).Worker;
  vi.stubGlobal('Worker', class extends originalWorker {
    constructor() {
      super();
      w = this;
      (this as any).postMessage = vi.fn((message: any) => {
        (this as any).messages.push(message);
        if (message.kind === 'detect') held.push(message);
        else queueMicrotask(() => (this as any).onmessage?.({ data: replyTo(message) }));
      });
    }
  });
  vi.resetModules();
  const fresh = await fixture();
  showFrame(fresh.video);
  await fresh.capture.start(fresh.stream);
  await flush();
  expect(held.length).toBe(1);
  fresh.capture.stop();
  fresh.onState.mockClear();
  const timersBefore = vi.getTimerCount();
  w.onmessage({ data: { ...replyTo(held[0]) } });
  await flush();
  expect(fresh.onState).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBeLessThanOrEqual(timersBefore);
});

test('a page finder that cannot take a frame is reported, and the shutter still works', async () => {
  const f = await fixture();
  showFrame(f.video);
  await f.capture.start(f.stream);
  await flush();
  const close = vi.fn();
  bitmap = () => ({ width: 100, height: 100, close });
  workers[0].postMessage.mockImplementation(() => { throw new Error('DataCloneError'); });
  await vi.advanceTimersByTimeAsync(2000);
  // The frame handed to a worker that refused it is released, not leaked.
  expect(close).toHaveBeenCalled();
  const last = f.onState.mock.calls.at(-1)![0];
  expect(last.engine.status).toBe('unavailable');
  expect(last.reason).toBe('engine');
  expect(last.hint).toMatch(/drag the corners/i);
  // Capture never depends on detection.
  const taken = f.capture.shoot();
  await vi.advanceTimersByTimeAsync(1500);
  expect(await taken).toMatchObject({ auto: false, quad: null });
  expect(f.onShot).toHaveBeenCalledOnce();
});

test('a worker crash is surfaced to the student, not swallowed', async () => {
  const f = await fixture();
  showFrame(f.video);
  await f.capture.start(f.stream);
  await flush();
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  workers[0].onerror({ message: 'wasm compile failed', filename: 'detect-worker.js', lineno: 1 });
  await vi.advanceTimersByTimeAsync(5000);
  const last = f.onState.mock.calls.at(-1)![0];
  expect(last.engine.status).toBe('unavailable');
  expect(last.engine.error).toMatch(/wasm compile failed/);
  expect(consoleError).toHaveBeenCalled();
});

test('a frame that cannot be read is reported after repeated failures', async () => {
  const f = await fixture();
  showFrame(f.video);
  vi.mocked(createImageBitmap).mockRejectedValue(new Error('decode failed'));
  await f.capture.start(f.stream);
  await vi.advanceTimersByTimeAsync(3000);
  const last = f.onState.mock.calls.at(-1)![0];
  expect(last.engine.status).toBe('unavailable');
  expect(last.engine.error).toMatch(/camera frames/);
});

test('torch is offered only where the camera exposes it, and a refusal is shown, not hidden', async () => {
  // No torch capability: the mode setter changes nothing on the track.
  const none = await fixture();
  showFrame(none.video);
  await none.capture.start(none.stream);
  await none.capture.setTorchMode('on');
  expect(none.capture.torch).toMatchObject({ supported: false, on: false });
  expect(none.track.applyConstraints).not.toHaveBeenCalledWith({ advanced: [{ torch: true }] });
  none.capture.stop();

  // With torch: On lights it, Off darkens it, a refusal leaves it off with the reason.
  const f = await fixture();
  showFrame(f.video);
  f.track.getCapabilities = () => ({ focusMode: ['continuous'], torch: true });
  await f.capture.start(f.stream);
  expect(f.capture.torch.supported).toBe(true);
  await f.capture.setTorchMode('on');
  expect(f.track.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
  expect(f.capture.torch).toMatchObject({ mode: 'on', on: true, error: null });
  await f.capture.setTorchMode('off');
  expect(f.capture.torch).toMatchObject({ mode: 'off', on: false });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  f.track.applyConstraints.mockRejectedValueOnce(new Error('torch busy'));
  await f.capture.setTorchMode('on');
  expect(f.capture.torch).toMatchObject({ mode: 'on', on: false });
  expect(f.capture.torch.error).toMatch(/torch busy/);
});

test('one slow native still falls back for that shot only; a second stall demotes the session', async () => {
  const takePhoto = vi.fn(() => new Promise<Blob>(() => {}));
  vi.stubGlobal('ImageCapture', class { getPhotoCapabilities() { return Promise.resolve(caps); } takePhoto = takePhoto; });
  const f = await fixture();
  await f.capture.start(f.stream);
  showFrame(f.video);
  const first = f.capture.shoot();
  await vi.advanceTimersByTimeAsync(4500);
  expect(await first).toMatchObject({ capturePath: 'canvas-grab', auto: false });
  expect(f.capture.capturePath).toBe('image-capture');
  const afterFirst = takePhoto.mock.calls.length;
  const second = f.capture.shoot();
  await vi.advanceTimersByTimeAsync(4500);
  expect(await second).toMatchObject({ capturePath: 'canvas-grab' });
  expect(takePhoto.mock.calls.length).toBeGreaterThan(afterFirst);
  expect(f.capture.capturePath).toBe('canvas-grab');
  const afterSecond = takePhoto.mock.calls.length;
  const third = f.capture.shoot();
  await vi.advanceTimersByTimeAsync(250);
  expect(await third).toMatchObject({ capturePath: 'canvas-grab' });
  expect(takePhoto).toHaveBeenCalledTimes(afterSecond);
});

for (const failure of ['throw', 'decode']) {
  test(`native still ${failure} demotes once; the next manual shot uses canvas without repeating the failure`, async () => {
    const takePhoto = vi.fn(() => {
      if (failure === 'stall') return new Promise(() => {});
      if (failure === 'throw') throw new Error('native failure');
      return Promise.resolve(new Blob(['invalid-native']));
    });
    vi.stubGlobal('ImageCapture', class { getPhotoCapabilities() { return Promise.resolve(caps); } takePhoto = takePhoto; });
    const f = await fixture();
    await f.capture.start(f.stream);
    showFrame(f.video);
    if (failure === 'decode') vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error('decode failed'));
    const first = f.capture.shoot();
    await vi.advanceTimersByTimeAsync(1500);
    expect(await first).toMatchObject({ capturePath: 'canvas-grab', auto: false });
        const calls = takePhoto.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    const second = f.capture.shoot();
    await vi.advanceTimersByTimeAsync(250);
    expect(await second).toMatchObject({ capturePath: 'canvas-grab' });
    expect(takePhoto).toHaveBeenCalledTimes(calls);
    expect(f.onShot).toHaveBeenCalledTimes(2);
  });
}

test('a native still completing after restart cannot demote or capture from the new camera', async () => {
  const old = deferred();
  const takePhoto = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(null);
  vi.stubGlobal('ImageCapture', class { getPhotoCapabilities() { return Promise.resolve(caps); } takePhoto = takePhoto; });
  const f = await fixture();
  await f.capture.start(f.stream);
  showFrame(f.video);
  const shot = f.capture.shoot();
  await flush();
  f.capture.stop();
  await f.capture.start(f.stream);
  old.reject(new Error('old capture failed'));
  await shot;
  expect(takePhoto).toHaveBeenCalledOnce();
  expect(f.capture.capturePath).toBe('image-capture');
  expect(f.onShot).not.toHaveBeenCalled();
});
