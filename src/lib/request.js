/** Bound frontend waits while preserving caller cancellation. */
export async function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const caller = init.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : null);
  const cancel = () => controller.abort(caller?.reason);
  if (caller?.aborted) cancel();
  else caller?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('The request took too long. Please try again.', 'TimeoutError')), 30000);
  try {
    return await globalThis.fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    caller?.removeEventListener('abort', cancel);
  }
}
