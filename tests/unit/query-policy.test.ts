import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import {
  clearPrivateQueryCache,
  createQueryClient,
  queryRetryDelay,
  shouldRetryQuery,
} from '@/lib/query/client';
import { shipmentKeys, tripKeys } from '@/lib/query/keys';

describe('operational query policy', () => {
  it('limits retries to safe transient reads and honors the full Retry-After delay', () => {
    const error = new ApiError({ status: 429, retryAfter: 120_000 });
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(true);
    expect(shouldRetryQuery(2, error)).toBe(false);
    expect(queryRetryDelay(0, error)).toBe(120_000);
    expect(shouldRetryQuery(0, new ApiError({ status: 429 }))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError({ status: 429, retryAfter: 3_000_000_000 }))).toBe(
      false,
    );
    expect(shouldRetryQuery(0, new ApiError({ code: 'network' }))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError({ code: 'invalid_response', status: 503 }))).toBe(
      false,
    );
    for (const status of [401, 403, 404, 409, 419, 422]) {
      expect(shouldRetryQuery(0, new ApiError({ status }))).toBe(false);
    }
    expect(shouldRetryQuery(0, new DOMException('Aborted', 'AbortError'))).toBe(false);
  });

  it('disables mutation retries and purges private session data', () => {
    const client = createQueryClient();
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
    client.setQueryData(shipmentKeys.list({ status: 'IN_TRANSIT' }), { private: 'shipments' });
    client.setQueryData(tripKeys.detail('private-reference'), { private: 'trip' });
    expect(client.getQueryCache().getAll()).toHaveLength(2);
    clearPrivateQueryCache(client);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
