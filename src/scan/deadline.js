// Bound optional browser/hardware operations, including synchronous throws.
// A timeout does not cancel the hardware call. Callers must still check their
// activation before using results or starting another operation.
export function withDeadline(operation, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error('Camera operation timed out'), { name: 'TimeoutError' }));
    }, timeoutMs);
    Promise.resolve().then(operation).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}
