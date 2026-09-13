import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import {
  requestPublicOrderQuote,
  type PublicOrderQuoteResponse,
} from '@/features/public-order/api';
import { usePublicOrderQuote } from '@/features/public-order/use-quote';
import { publicOrderDefaults, type PublicOrderFormValues } from '@/features/public-order/schema';

vi.mock('@/features/public-order/api', () => ({ requestPublicOrderQuote: vi.fn() }));
const requestQuote = vi.mocked(requestPublicOrderQuote);
const values: PublicOrderFormValues = {
  ...publicOrderDefaults,
  origin_city_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  destination_city_id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  shipment_type_id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
};
const response = (price: number): PublicOrderQuoteResponse => ({
  data: { calculated_price: price, final_price: price, currency: 'LYD', minor_unit_scale: 3 },
  meta: {},
  request_id: '123e4567-e89b-42d3-a456-426614174000',
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function advance(milliseconds = 350) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  requestQuote.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('public quote ownership and cancellation', () => {
  it('debounces the request and immediately hides the previous price for every quote-input change', async () => {
    requestQuote.mockImplementation(async () => response(1235));
    const { result, rerender } = renderHook(
      (selection: PublicOrderFormValues) => usePublicOrderQuote(selection),
      { initialProps: values },
    );
    expect(result.current.status).toBe('loading');
    await advance(349);
    expect(requestQuote).not.toHaveBeenCalled();
    await advance(1);
    expect(result.current.data?.final_price).toBe(1235);
    let selection = { ...values };
    const changes: Partial<PublicOrderFormValues>[] = [
      { origin_city_id: values.destination_city_id },
      { destination_city_id: values.origin_city_id },
      { shipment_type_id: values.origin_city_id },
      { shipment_size: 'LARGE' },
      { delivery_method: 'DOOR_DELIVERY' },
    ];
    for (const change of changes) {
      selection = { ...selection, ...change };
      const oldSignal = requestQuote.mock.lastCall?.[1];
      rerender(selection);
      expect(result.current.status).toBe('loading');
      expect(result.current.data).toBeNull();
      expect(oldSignal?.aborted).toBe(true);
      await advance();
      expect(result.current.status).toBe('ready');
    }
    expect(requestQuote).toHaveBeenCalledTimes(6);
  });

  it('never revives an obsolete response, including an earlier attempt for the same selections', async () => {
    const old = deferred<PublicOrderQuoteResponse>();
    const other = deferred<PublicOrderQuoteResponse>();
    const current = deferred<PublicOrderQuoteResponse>();
    requestQuote
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(other.promise)
      .mockReturnValueOnce(current.promise);
    const { result, rerender } = renderHook(
      (selection: PublicOrderFormValues) => usePublicOrderQuote(selection),
      { initialProps: values },
    );
    await advance();
    rerender({ ...values, shipment_size: 'MEDIUM' });
    await advance();
    rerender(values);
    await advance();
    expect(requestQuote.mock.calls[0][1]?.aborted).toBe(true);
    expect(requestQuote.mock.calls[1][1]?.aborted).toBe(true);
    await act(async () => {
      old.resolve(response(9999));
      other.reject(new Error('obsolete failure'));
    });
    expect(result.current.status).toBe('loading');
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    await act(async () => current.resolve(response(1235)));
    expect(result.current.data?.final_price).toBe(1235);
  });

  it('cancels queued and pending quotes when unavailable and leaves incomplete input without a price', async () => {
    const pending = deferred<PublicOrderQuoteResponse>();
    requestQuote.mockReturnValue(pending.promise);
    const { result, rerender, unmount } = renderHook(
      ({ enabled, selection }) => usePublicOrderQuote(selection, enabled),
      {
        initialProps: { enabled: true, selection: values },
      },
    );
    rerender({ enabled: false, selection: values });
    await advance();
    expect(requestQuote).not.toHaveBeenCalled();
    expect(result.current.status).toBe('incomplete');
    rerender({ enabled: true, selection: values });
    await advance();
    rerender({ enabled: true, selection: { ...values, origin_city_id: '' } });
    expect(requestQuote.mock.calls[0][1]?.aborted).toBe(true);
    await act(async () => pending.resolve(response(1235)));
    expect(result.current.status).toBe('incomplete');
    expect(result.current.data).toBeNull();
    unmount();
  });

  it('does not refetch for personal details or weight and never includes them in the request', async () => {
    requestQuote.mockResolvedValue(response(0));
    const { result, rerender } = renderHook(
      (selection: PublicOrderFormValues) => usePublicOrderQuote(selection),
      { initialProps: values },
    );
    await advance();
    rerender({
      ...values,
      sender_name: 'اسم خاص',
      sender_phone: '0910000001',
      notes: 'ملاحظة خاصة',
      weight: '2.500',
    });
    await advance(1000);
    expect(requestQuote).toHaveBeenCalledTimes(1);
    expect(result.current.data?.final_price).toBe(0);
    expect(requestQuote.mock.calls[0][0]).not.toHaveProperty('sender_name');
    expect(requestQuote.mock.calls[0][0]).not.toHaveProperty('weight');
  });

  it('keeps an error without automatic retries and retries only on an explicit action', async () => {
    const error = new ApiError({ status: 429, retryAfter: 2000 });
    requestQuote.mockRejectedValueOnce(error).mockResolvedValueOnce(response(1235));
    const { result } = renderHook(() => usePublicOrderQuote(values));
    await advance();
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(error);
    await advance(10000);
    expect(requestQuote).toHaveBeenCalledTimes(1);
    act(() => result.current.retry());
    expect(result.current.status).toBe('loading');
    expect(result.current.data).toBeNull();
    await advance();
    expect(requestQuote).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('ready');
  });

  it('preserves the original absolute 429 deadline across all five selection changes', async () => {
    const error = new ApiError({ status: 429, retryAfter: 5000 });
    requestQuote.mockRejectedValueOnce(error).mockResolvedValueOnce(response(1235));
    const { result, rerender } = renderHook(
      (selection: PublicOrderFormValues) => usePublicOrderQuote(selection),
      { initialProps: values },
    );
    await advance();
    expect(result.current.status).toBe('error');
    let selection = { ...values };
    const changes: Partial<PublicOrderFormValues>[] = [
      { origin_city_id: values.destination_city_id },
      { destination_city_id: values.origin_city_id },
      { shipment_type_id: values.origin_city_id },
      { shipment_size: 'LARGE' },
      { delivery_method: 'DOOR_DELIVERY' },
    ];
    for (const change of changes) {
      selection = { ...selection, ...change };
      rerender(selection);
      expect(result.current.status).toBe('loading');
      expect(result.current.data).toBeNull();
      expect(result.current.cooldownError).toBe(error);
      await advance();
      expect(requestQuote).toHaveBeenCalledTimes(1);
    }
    // Five changes consumed 1750ms, so only 3250ms of the original deadline remain.
    await advance(3249);
    expect(requestQuote).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(requestQuote).toHaveBeenCalledTimes(2);
    expect(requestQuote.mock.calls[1][0]).toEqual({
      origin_city_id: selection.origin_city_id,
      destination_city_id: selection.destination_city_id,
      shipment_type_id: selection.shipment_type_id,
      shipment_size: selection.shipment_size,
      delivery_method: selection.delivery_method,
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.cooldownError).toBeNull();
  });

  it('ignores an early explicit retry without clearing its error or queuing a retry at the deadline', async () => {
    const error = new ApiError({ status: 429, retryAfter: 5000 });
    requestQuote.mockRejectedValueOnce(error).mockResolvedValueOnce(response(1235));
    const { result } = renderHook(() => usePublicOrderQuote(values));
    await advance();
    await advance(1000);
    act(() => result.current.retry());
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe(error);
    await advance(4000);
    expect(requestQuote).toHaveBeenCalledTimes(1);
    act(() => result.current.retry());
    expect(result.current.status).toBe('loading');
    await advance();
    expect(requestQuote).toHaveBeenCalledTimes(2);
  });

  it('retains the same cooldown when catalogs or required selections temporarily disable quoting', async () => {
    const error = new ApiError({ status: 429, retryAfter: 2000 });
    requestQuote.mockRejectedValueOnce(error).mockResolvedValueOnce(response(1235));
    const { result, rerender } = renderHook(
      ({ enabled, selection }) => usePublicOrderQuote(selection, enabled),
      { initialProps: { enabled: true, selection: values } },
    );
    await advance();
    rerender({ enabled: false, selection: { ...values, origin_city_id: '' } });
    expect(result.current.status).toBe('incomplete');
    expect(result.current.data).toBeNull();
    expect(result.current.cooldownError).toBe(error);
    await advance(1500);
    rerender({ enabled: true, selection: values });
    expect(result.current.cooldownError).toBe(error);
    await advance(499);
    expect(requestQuote).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(requestQuote).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('ready');
  });
});
