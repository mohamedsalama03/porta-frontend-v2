import { describe, expect, it, vi } from 'vitest';
import { createIdempotentAction } from '@/lib/api/idempotency';
import { ApiError } from '@/lib/api/errors';

describe('logical mutation actions', () => {
  it('reuses the original key on explicit retry and creates a new key for a new action', async () => {
    const execute = vi
      .fn<(key: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValue('confirmed');
    const action = createIdempotentAction(execute);
    await expect(action.run()).rejects.toThrow('Temporary failure');
    expect(execute).toHaveBeenCalledTimes(1);
    await expect(action.run()).resolves.toBe('confirmed');
    expect(execute.mock.calls.map(([key]) => key)).toEqual([action.key, action.key]);
    expect(createIdempotentAction(execute).key).not.toBe(action.key);
  });

  it('shares an in-flight request and does not repeat a confirmed action', async () => {
    const execute = vi.fn<(key: string) => Promise<string>>().mockResolvedValue('confirmed');
    const action = createIdempotentAction(execute);
    const first = action.run();
    expect(action.run()).toBe(first);
    await first;
    await action.run();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('prevents even an explicit retry from preceding Retry-After', async () => {
    let now = 1_000;
    const error = new ApiError({ status: 429, retryAfter: 60_000 });
    const execute = vi
      .fn<(key: string) => Promise<string>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('confirmed');
    const action = createIdempotentAction(execute, { now: () => now });
    await expect(action.run()).rejects.toBe(error);
    expect(action.retryAt).toBe(61_000);
    now = 60_999;
    await expect(action.run()).rejects.toBe(error);
    expect(execute).toHaveBeenCalledTimes(1);
    now = 61_000;
    await expect(action.run()).resolves.toBe('confirmed');
    expect(execute.mock.calls.map(([key]) => key)).toEqual([action.key, action.key]);
  });
});
