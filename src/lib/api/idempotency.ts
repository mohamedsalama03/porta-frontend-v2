import { ApiError } from './errors';

/** One instance per logical action. Explicit retries reuse its original key. */
export function createIdempotentAction<T>(
  execute: (key: string) => Promise<T>,
  options: { now?: () => number } = {},
) {
  const key = globalThis.crypto.randomUUID();
  const now = options.now ?? Date.now;
  let current: Promise<T> | null = null;
  let retryAt: number | null = null;
  let rateLimitError: ApiError | null = null;

  function run(): Promise<T> {
    if (current) return current;
    if (retryAt !== null && now() < retryAt && rateLimitError)
      return Promise.reject(rateLimitError);
    retryAt = null;
    rateLimitError = null;
    current = Promise.resolve()
      .then(() => execute(key))
      .catch((error: unknown) => {
        current = null;
        if (error instanceof ApiError && error.retryAfter !== null && error.retryAfter > 0) {
          retryAt = now() + error.retryAfter;
          rateLimitError = error;
        }
        throw error;
      });
    // Successful calls stay settled; a new logical action needs a new instance.
    return current;
  }

  return {
    key,
    run,
    get retryAt() {
      return retryAt;
    },
  };
}
