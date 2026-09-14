/** Errors which may cross the scanner's main-thread/worker boundary. */
export class ScanError extends Error {
  constructor(code, publicMessage, options = {}) {
    super(options.debugMessage ?? publicMessage, { cause: options.cause });
    this.name = 'ScanError';
    this.code = code;
    this.publicMessage = publicMessage;
    this.refused = !!options.refused;
    this.retryable = options.retryable !== false;
    this.details = options.details ?? null;
  }
}

export function scanError(code, publicMessage, options) {
  return new ScanError(code, publicMessage, options);
}

export function serializeScanError(error) {
  const known = error instanceof ScanError;
  return {
    code: known ? error.code : 'SCAN_CAPTURE_FAILED',
    publicMessage: known
      ? error.publicMessage
      : 'That page could not be prepared. Try taking it again.',
    refused: !!error?.refused,
    retryable: error?.retryable !== false,
    details: known ? error.details : null,
    debugMessage: error?.message ?? String(error),
  };
}

export function deserializeScanError(value) {
  return new ScanError(
    value?.code ?? 'SCAN_WORKER_FAILED',
    value?.publicMessage ?? 'That page could not be prepared. Try taking it again.',
    {
      debugMessage: value?.debugMessage,
      refused: value?.refused,
      retryable: value?.retryable,
      details: value?.details,
    },
  );
}

export function publicScanMessage(error) {
  return error instanceof ScanError
    ? error.publicMessage
    : 'That page could not be prepared. Try taking it again.';
}
