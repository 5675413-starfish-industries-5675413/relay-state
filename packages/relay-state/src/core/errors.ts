import type { RelayErrorCode } from './types';

export class RelayError extends Error {
  constructor(
    public readonly code: RelayErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'RelayError';
  }
}

export function asRelayError(error: unknown, fallback: RelayErrorCode): RelayError {
  return error instanceof RelayError
    ? error
    : new RelayError(fallback, 'Operation failed', { cause: error });
}
