import { QueryClient } from '@tanstack/react-query';
import { ApiError, isAbortError } from '@/lib/api/errors';

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2 || isAbortError(error)) return false;
  if (!(error instanceof ApiError)) return false;
  if (error.code === 'network') return true;
  if (error.code !== 'http') return false;
  // Timers cannot honor values larger than this; leave the retry to explicit UI.
  if (error.retryAfter !== null && error.retryAfter > 2_147_483_647) return false;
  // CORS may hide Retry-After. Without a readable delay, do not guess a retry window.
  return (
    (error.status === 429 && error.retryAfter !== null) ||
    [500, 502, 503, 504].includes(error.status)
  );
}

export function queryRetryDelay(attempt: number, error: unknown): number {
  const backoff = Math.min(1_000 * 2 ** attempt, 30_000);
  return error instanceof ApiError && error.retryAfter !== null
    ? Math.max(backoff, error.retryAfter)
    : backoff;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryQuery,
        retryDelay: queryRetryDelay,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}

export function clearPrivateQueryCache(client: QueryClient): void {
  void client.cancelQueries();
  client.clear();
}
