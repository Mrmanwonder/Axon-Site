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
    postMessage = vi.fn((message) => {
      this.messages.push(message);
      queueMicrotask(() => this.onmessage?.({ data: { id: message.id, found: null } }));
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

test('a stale global detector result cannot publish state or spawn a second detection loop', async () => {
  const f = await fixture();
  workers[0].postMessage.mockImplementation((message: any) => workers[0].messages.push(message));
  showFrame(f.video);
  await f.capture.start(f.stream);
  await flush();
  const oldMessage = workers[0].messages[0];
  expect(oldMessage.kind).toBe('search');
  f.capture.stop();
  Object.assign(f.video, { videoWidth: 0, videoHeight: 0 });
  await f.capture.start(f.stream);
  const timersBefore = vi.getTimerCount();
  workers[0].onmessage({ data: { id: oldMessage.id, found: null } });
  await flush();
  expect(f.onState).not.toHaveBeenCalled();
  // The old worker deadline disappears; no new detector timer replaces it.
  expect(vi.getTimerCount()).toBe(timersBefore - 1);
});

test('a worker transfer failure immediately terminates the broken worker', async () => {
  const f = await fixture();
  workers[0].postMessage.mockImplementation(() => { throw new Error('DataCloneError'); });
  const close = vi.fn();
  bitmap = () => ({ width: 100, height: 100, close });
  showFrame(f.video);
  await f.capture.start(f.stream);
  await flush();
  expect(close).toHaveBeenCalledOnce();
  expect(workers[0].terminate).toHaveBeenCalledOnce();
});

for (const failure of ['stall', 'throw', 'decode']) {
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
    expect(f.capture.overlayPhase).not.toBe('captured-confirm');
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
