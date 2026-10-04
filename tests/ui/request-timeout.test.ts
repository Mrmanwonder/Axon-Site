import { afterEach, expect, test, vi } from "vitest";
import { fetchWithTimeout } from "../../src/lib/request.js";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

test("stalled frontend requests fail within 30 seconds", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason));
  })));
  const result = fetchWithTimeout("https://example.test").catch(error => error);
  await vi.advanceTimersByTimeAsync(30000);
  expect((await result).name).toBe("TimeoutError");
  expect(vi.getTimerCount()).toBe(0);
});

test("caller cancellation stays intact and successful requests clear timeout timers", async () => {
  vi.useFakeTimers();
  const response = new Response("ok");
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetch);
  const controller = new AbortController();
  controller.abort();
  await fetchWithTimeout("https://example.test", { signal: controller.signal });
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
  expect(await fetchWithTimeout("https://example.test")).toBe(response);
  expect(vi.getTimerCount()).toBe(0);
});
