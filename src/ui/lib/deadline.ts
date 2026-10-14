/** Settle `promise` or reject after `ms`, so a hung read becomes a visible
    "could not load" with a retry instead of a loader that never ends. The
    underlying request is not cancelled; its late answer is simply ignored. */
export function withDeadline<T>(promise: Promise<T>, ms: number, message = "This is taking too long. Try again."): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}
