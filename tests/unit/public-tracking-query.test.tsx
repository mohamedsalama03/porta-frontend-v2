import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicTracking, type TrackingData } from '@/features/public-tracking/api';
import { parseTrackingSearch } from '@/features/public-tracking/model';
import { useTracking } from '@/features/public-tracking/use-tracking';
import { ApiError } from '@/lib/api/errors';

vi.mock('@/features/public-tracking/api', () => ({ getPublicTracking: vi.fn() }));
const getTracking = vi.mocked(getPublicTracking);
const firstNumber = 'PTA-260913-ABCDEF';
const secondNumber = 'PTA-260913-UVWXYZ';
const thirdNumber = 'PTA-260913-123456';
const clients: QueryClient[] = [];

function tracking(
  number = firstNumber,
  status: TrackingData['current_status'] = 'RECEIVED',
): TrackingData {
  return {
    tracking_number: number,
    origin_city: { name_ar: 'مدينة اختبار أ', name_en: 'QA city A' },
    destination_city: { name_ar: 'مدينة اختبار ب', name_en: 'QA city B' },
    shipment_type: 'نوع اختبار',
    current_status: status,
    status_label: 'حالة اختبار',
    created_at: '2026-09-13T08:00:00Z',
    estimated_delivery: null,
    tracking_timeline: [
      { status, status_label: 'حالة اختبار', occurred_at: '2026-09-13T08:00:00Z' },
    ],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function setup(number: string | null = null, strict = false) {
  const client = new QueryClient();
  clients.push(client);
  function Wrapper({ children }: { children: ReactNode }) {
    const content = <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    return strict ? <StrictMode>{content}</StrictMode> : content;
  }
  return {
    ...renderHook(({ number }: { number: string | null }) => useTracking(number), {
      initialProps: { number },
      wrapper: Wrapper,
    }),
    client,
  };
}

async function advance(milliseconds = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  getTracking.mockReset();
  window.history.replaceState(null, '', '/track');
});

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  vi.useRealTimers();
});

describe('public tracking query ownership and request policy', () => {
  it('does not query while typing and validates empty and contract-invalid identifiers without altering case', async () => {
    const { result } = setup();
    await advance();
    expect(getTracking).not.toHaveBeenCalled();
    act(() => expect(result.current.submit()).toBe(false));
    expect(result.current.validationError).toBe('أدخل رقم التتبع.');
    act(() => result.current.changeInput(firstNumber.toLowerCase()));
    act(() => expect(result.current.submit()).toBe(false));
    expect(result.current.input).toBe(firstNumber.toLowerCase());
    expect(result.current.validationError).toContain('تحقق من رقم التتبع');
    act(() => result.current.changeInput(firstNumber));
    await advance(60_000);
    expect(result.current.validationError).toBeNull();
    expect(getTracking).not.toHaveBeenCalled();
  });

  it('trims harmless whitespace on explicit submit and writes only the identifier to the sharing URL', async () => {
    getTracking.mockResolvedValue(tracking());
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const { result, rerender } = setup();
    act(() => result.current.changeInput(`  ${firstNumber}  `));
    act(() => expect(result.current.submit()).toBe(true));
    rerender({ number: firstNumber });
    await advance();
    expect(getTracking).toHaveBeenCalledTimes(1);
    expect(getTracking.mock.calls[0][0]).toBe(firstNumber);
    expect(result.current.input).toBe(firstNumber);
    expect(result.current.data?.tracking_number).toBe(firstNumber);
    expect(window.location.pathname + window.location.search).toBe(`/track?number=${firstNumber}`);
    expect(storage).not.toHaveBeenCalled();
  });

  it('performs one initial valid deep-link HTTP lookup under StrictMode and none for invalid or duplicate URL values', async () => {
    getTracking.mockResolvedValue(tracking());
    const valid = setup(firstNumber, true);
    await advance();
    expect(getTracking).toHaveBeenCalledTimes(1);
    expect(valid.result.current.data?.tracking_number).toBe(firstNumber);
    valid.unmount();
    const invalid = setup('not/a/tracking-number', true);
    await advance();
    expect(invalid.result.current.validationError).toContain('تحقق من رقم التتبع');
    invalid.unmount();
    setup(
      parseTrackingSearch(new URLSearchParams(`number=${firstNumber}&number=${secondNumber}`)),
      true,
    );
    await advance();
    expect(getTracking).toHaveBeenCalledTimes(1);
  });

  it('cancels on input editing and an obsolete A response cannot overwrite B or a later A attempt', async () => {
    const oldA = deferred<TrackingData>();
    const oldB = deferred<TrackingData>();
    const latestA = deferred<TrackingData>();
    getTracking
      .mockReturnValueOnce(oldA.promise)
      .mockReturnValueOnce(oldB.promise)
      .mockReturnValueOnce(latestA.promise);
    const { result } = setup(firstNumber);
    await advance();
    expect(result.current.isFetching).toBe(true);
    act(() => result.current.changeInput(secondNumber));
    expect(getTracking.mock.calls[0][1]?.aborted).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(false);
    act(() => result.current.submit());
    await advance();
    act(() => result.current.changeInput(firstNumber));
    expect(getTracking.mock.calls[1][1]?.aborted).toBe(true);
    act(() => result.current.submit());
    await advance();
    await act(async () => {
      oldA.resolve(tracking(firstNumber, 'DELIVERED'));
      oldB.reject(new ApiError({ status: 503 }));
    });
    await advance();
    expect(result.current.number).toBe(firstNumber);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
    await act(async () => latestA.resolve(tracking()));
    await advance();
    expect(result.current.data?.current_status).toBe('RECEIVED');
  });

  it('honors URL navigation and cancels a previous URL request immediately', async () => {
    const old = deferred<TrackingData>();
    getTracking.mockReturnValueOnce(old.promise).mockResolvedValueOnce(tracking(secondNumber));
    const { result, rerender } = setup(firstNumber);
    await advance();
    rerender({ number: secondNumber });
    expect(result.current.input).toBe(secondNumber);
    expect(result.current.data).toBeUndefined();
    await advance();
    expect(getTracking.mock.calls[0][1]?.aborted).toBe(true);
    await act(async () => old.resolve(tracking()));
    await advance();
    expect(result.current.data?.tracking_number).toBe(secondNumber);
    rerender({ number: null });
    expect(result.current.input).toBe('');
    expect(result.current.number).toBeNull();
    expect(result.current.data).toBeUndefined();
  });

  it('retains same-identifier data during refresh and network failure, with no automatic retries or reconnect requests', async () => {
    const refresh = deferred<TrackingData>();
    getTracking.mockResolvedValueOnce(tracking()).mockReturnValueOnce(refresh.promise);
    const { result } = setup(firstNumber);
    await advance();
    act(() => {
      result.current.refresh();
      result.current.refresh();
    });
    await advance();
    expect(getTracking).toHaveBeenCalledTimes(2);
    expect(result.current.data?.tracking_number).toBe(firstNumber);
    expect(result.current.isFetching).toBe(true);
    const network = new ApiError({ code: 'network' });
    await act(async () => refresh.reject(network));
    await advance();
    expect(result.current.data?.tracking_number).toBe(firstNumber);
    expect(result.current.error).toBe(network);
    expect(result.current.input).toBe(firstNumber);
    act(() => {
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('online'));
    });
    await advance(60_000);
    expect(getTracking).toHaveBeenCalledTimes(2);
    act(() => result.current.changeInput(secondNumber));
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it('holds one absolute 429 deadline across input and URL changes and never queues a request on expiry', async () => {
    const limited = new ApiError({ status: 429, retryAfter: 5000 });
    getTracking.mockRejectedValueOnce(limited).mockResolvedValueOnce(tracking(thirdNumber));
    const { result, rerender } = setup(firstNumber);
    await advance();
    expect(result.current.remainingMs).toBe(5000);
    await advance(1000);
    act(() => result.current.changeInput(secondNumber));
    act(() => {
      expect(result.current.submit()).toBe(false);
      result.current.refresh();
    });
    expect(result.current.error).toBe(limited);
    expect(result.current.remainingMs).toBe(4000);
    rerender({ number: thirdNumber });
    await advance(3999);
    expect(result.current.input).toBe(thirdNumber);
    expect(result.current.number).toBe(thirdNumber);
    expect(getTracking).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(result.current.remainingMs).toBe(0);
    await advance(60_000);
    expect(getTracking).toHaveBeenCalledTimes(1);
    act(() => expect(result.current.submit()).toBe(true));
    await advance();
    expect(getTracking).toHaveBeenCalledTimes(2);
    expect(result.current.data?.tracking_number).toBe(thirdNumber);
    expect(result.current.error).toBeNull();
  });

  it('keeps a loaded result visible during a rate-limited refresh and permits only deliberate retry after expiry', async () => {
    getTracking
      .mockResolvedValueOnce(tracking())
      .mockRejectedValueOnce(new ApiError({ status: 429, retryAfter: 2000 }))
      .mockResolvedValueOnce(tracking(firstNumber, 'DELIVERED'));
    const { result } = setup(firstNumber);
    await advance();
    act(() => result.current.refresh());
    await advance();
    expect(result.current.data?.current_status).toBe('RECEIVED');
    act(() => result.current.refresh());
    await advance(2000);
    expect(getTracking).toHaveBeenCalledTimes(2);
    act(() => result.current.refresh());
    await advance();
    expect(getTracking).toHaveBeenCalledTimes(3);
    expect(result.current.data?.current_status).toBe('DELIVERED');
    expect(result.current.error).toBeNull();
  });

  it('does not repeat an immediate failed explicit lookup when Next synchronizes its URL', async () => {
    const missing = new ApiError({ status: 404 });
    getTracking.mockRejectedValueOnce(missing).mockResolvedValueOnce(tracking());
    const { result, rerender } = setup();
    act(() => result.current.changeInput(firstNumber));
    act(() => result.current.submit());
    await advance();
    expect(result.current.error).toBe(missing);
    rerender({ number: firstNumber });
    await advance(60_000);
    expect(getTracking).toHaveBeenCalledTimes(1);
    act(() => result.current.submit());
    await advance();
    expect(getTracking).toHaveBeenCalledTimes(2);
    expect(result.current.data?.tracking_number).toBe(firstNumber);
  });

  it('uses a short memory cache for repeated searches while manual refresh always requests current status', async () => {
    getTracking.mockImplementation(async (number) => tracking(number));
    const { result } = setup(firstNumber);
    await advance();
    act(() => result.current.changeInput(secondNumber));
    act(() => result.current.submit());
    await advance();
    act(() => result.current.changeInput(firstNumber));
    act(() => result.current.submit());
    await advance();
    expect(getTracking).toHaveBeenCalledTimes(2);
    expect(result.current.data?.tracking_number).toBe(firstNumber);
    act(() => result.current.refresh());
    await advance();
    expect(getTracking).toHaveBeenCalledTimes(3);
    await advance(30_001);
    expect(getTracking).toHaveBeenCalledTimes(3);
    act(() => result.current.submit());
    await advance();
    expect(getTracking).toHaveBeenCalledTimes(4);
  });
});
