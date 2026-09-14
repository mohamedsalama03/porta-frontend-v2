import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readDriverResource,
  revokeDriverResource,
  useDriverRead,
} from '@/features/driver-workspace/use-driver-read';
import { driverKeys } from '@/features/driver-workspace/model';
import { ApiError } from '@/lib/api/errors';

type PrivateData = { id: string; recipient: string };
const first = { id: '01arz3ndektsv4rrffq69g5fad', recipient: 'PRIVATE_TEST_RECIPIENT_A' };
const second = { id: '01ARZ3NDEKTSV4RRFFQ69G5FAZ', recipient: 'PRIVATE_TEST_RECIPIENT_B' };
const clients: QueryClient[] = [];
const read = vi.fn<(id: string, signal: AbortSignal) => Promise<PrivateData>>();

function deferred<T>() {
  let resolve!: (data: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function setup({ id = first.id, enabled = true, strict = false } = {}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: 2, refetchOnWindowFocus: true, refetchOnReconnect: true },
    },
  });
  clients.push(client);
  function Wrapper({ children }: { children: ReactNode }) {
    const content = <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    return strict ? <StrictMode>{content}</StrictMode> : content;
  }
  return {
    client,
    ...renderHook(
      ({ id, enabled }: { id: string; enabled: boolean }) =>
        useDriverRead({
          queryKey: driverKeys.shipment(id),
          queryFn: (signal) => read(id, signal),
          enabled,
        }),
      { initialProps: { id, enabled }, wrapper: Wrapper },
    ),
  };
}

async function advance(milliseconds = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  read.mockReset();
  onlineManager.setOnline(true);
  focusManager.setFocused(true);
});

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

describe('driver read ownership and request policy', () => {
  it('does not fetch while disabled and performs one initial authorized read under StrictMode', async () => {
    read.mockResolvedValue(first);
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    const { result, rerender } = setup({ enabled: false, strict: true });
    act(() => void result.current.refresh());
    await advance();
    expect(read).not.toHaveBeenCalled();
    rerender({ id: first.id, enabled: true });
    await advance();
    expect(read).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(first);
    expect(storage).not.toHaveBeenCalled();
  });

  it.each([
    new ApiError({ code: 'network' }),
    new ApiError({ status: 500 }),
    new ApiError({ status: 503 }),
    new ApiError({ status: 429, retryAfter: 2000 }),
  ])(
    'retains the last successful read on a transient failure without background requests: %s',
    async (error) => {
      read.mockResolvedValueOnce(first).mockRejectedValueOnce(error);
      const { result } = setup();
      await advance();
      act(() => void result.current.refresh());
      await advance();
      expect(result.current.data).toEqual(first);
      expect(result.current.error).toBe(error);
      act(() => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
        onlineManager.setOnline(false);
        onlineManager.setOnline(true);
      });
      await advance(60_000);
      expect(read).toHaveBeenCalledTimes(2);
      expect(result.current.data).toEqual(first);
    },
  );

  it('deduplicates repeated refresh clicks while preserving data during an in-flight refresh', async () => {
    const pending = deferred<PrivateData>();
    read.mockResolvedValueOnce(first).mockReturnValueOnce(pending.promise);
    const { result } = setup();
    await advance();
    act(() => {
      void result.current.refresh();
      void result.current.refresh();
    });
    await advance();
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(first);
    expect(result.current.isFetching).toBe(true);
    await act(async () => pending.resolve({ ...first, recipient: 'UPDATED_TEST_RECIPIENT' }));
    await advance();
    expect(result.current.data?.recipient).toBe('UPDATED_TEST_RECIPIENT');
  });

  it('cancels an obsolete resource read and cannot replace the newly selected resource with its response', async () => {
    const old = deferred<PrivateData>();
    const current = deferred<PrivateData>();
    read.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const { result, rerender, client } = setup();
    await advance();
    rerender({ id: second.id, enabled: true });
    await advance();
    expect(read.mock.calls[0][1].aborted).toBe(true);
    expect(result.current.data).toBeUndefined();
    await act(async () => old.resolve(first));
    await advance();
    expect(result.current.data).toBeUndefined();
    expect(client.getQueryData(driverKeys.shipment(first.id))).toBeUndefined();
    await act(async () => current.resolve(second));
    await advance();
    expect(result.current.data).toEqual(second);
  });

  it('cannot repopulate cleared private cache after the observer unmounts at session end', async () => {
    const pending = deferred<PrivateData>();
    read.mockReturnValueOnce(pending.promise);
    const { unmount, client } = setup();
    await advance();
    unmount();
    client.clear();
    expect(read.mock.calls[0][1].aborted).toBe(true);
    await act(async () => pending.resolve(first));
    await advance();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it.each([401, 403, 404])(
    'hides previously displayed private data once the resource returns %i',
    async (status) => {
      read.mockResolvedValueOnce(first).mockRejectedValueOnce(new ApiError({ status }));
      const { result } = setup();
      await advance();
      act(() => void result.current.refresh());
      await advance();
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toMatchObject({ status });
    },
  );

  it.each([
    [403, new ApiError({ code: 'network' })],
    [404, new ApiError({ code: 'network' })],
    [403, new ApiError({ status: 503 })],
    [404, new ApiError({ status: 503 })],
  ])(
    'does not restore denied %i data when the next scoped recheck fails transiently: %s',
    async (status, transient) => {
      read
        .mockResolvedValueOnce(first)
        .mockRejectedValueOnce(new ApiError({ status }))
        .mockRejectedValueOnce(transient)
        .mockResolvedValueOnce(first);
      const { result, client } = setup();
      await advance();
      act(() => void result.current.refresh());
      await advance();
      expect(result.current.data).toBeUndefined();
      expect(client.getQueryData(driverKeys.shipment(first.id))).toBeUndefined();
      act(() => void result.current.refresh());
      await advance();
      expect(result.current.error).toBe(transient);
      expect(result.current.data).toBeUndefined();
      act(() => void result.current.refresh());
      await advance();
      expect(result.current.data).toEqual(first);
    },
  );

  it('revokes cached detail after a forbidden mutation and cancels any older read before it can restore access', async () => {
    const pending = deferred<PrivateData>();
    read
      .mockResolvedValueOnce(first)
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(first);
    const { result, client } = setup();
    await advance();
    act(() => void result.current.refresh());
    await advance();
    const denial = new ApiError({ status: 403 });
    await act(async () => revokeDriverResource(client, driverKeys.shipment(first.id), denial));
    await advance();
    expect(read.mock.calls[1][1].aborted).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBe(denial);
    expect(client.getQueryData(driverKeys.shipment(first.id))).toBeUndefined();
    await act(async () => pending.resolve(first));
    await advance();
    expect(result.current.data).toBeUndefined();
    expect(read).toHaveBeenCalledTimes(2);
    act(() => void result.current.refresh());
    await advance();
    expect(result.current.data).toEqual(first);
  });

  it('does not recreate a resource when revocation overlaps session-end cache clearing', async () => {
    read.mockResolvedValue(first);
    const { client, unmount } = setup();
    await advance();
    let revoked: Promise<void>;
    act(() => {
      revoked = revokeDriverResource(
        client,
        driverKeys.shipment(first.id),
        new ApiError({ status: 403 }),
      );
      client.clear();
    });
    unmount();
    await act(async () => revoked);
    await advance();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('keeps one Retry-After deadline across resource/filter changes and never queues a read on expiry', async () => {
    read
      .mockRejectedValueOnce(new ApiError({ status: 429, retryAfter: 5000 }))
      .mockResolvedValueOnce(second);
    const { result, rerender } = setup();
    await advance();
    expect(result.current.remainingMs).toBe(5000);
    await advance(1000);
    rerender({ id: second.id, enabled: true });
    await advance();
    expect(read).toHaveBeenCalledTimes(1);
    expect(result.current.remainingMs).toBe(4000);
    act(() => void result.current.refresh());
    await advance(4000);
    expect(result.current.remainingMs).toBe(0);
    await advance(60_000);
    expect(read).toHaveBeenCalledTimes(1);
    act(() => void result.current.refresh());
    await advance();
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(second);
  });

  it('does not silently queue an offline request for automatic reconnect', async () => {
    read.mockRejectedValue(new ApiError({ code: 'network' }));
    onlineManager.setOnline(false);
    const { result } = setup();
    await advance();
    expect(read).toHaveBeenCalledTimes(1);
    expect(result.current.fetchStatus).toBe('idle');
    act(() => onlineManager.setOnline(true));
    await advance(60_000);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('retains a long Retry-After deadline past ordinary unused-query garbage collection', async () => {
    read
      .mockRejectedValueOnce(new ApiError({ status: 429, retryAfter: 600_000 }))
      .mockResolvedValueOnce(second);
    const { result, rerender } = setup();
    await advance();
    await advance(300_001);
    rerender({ id: second.id, enabled: true });
    await advance();
    expect(read).toHaveBeenCalledTimes(1);
    expect(result.current.remainingMs).toBeGreaterThan(299_000);
  });

  it('does not shorten an existing Retry-After deadline when another in-flight read is rate limited', async () => {
    const firstReply = deferred<PrivateData>();
    const secondReply = deferred<PrivateData>();
    read.mockReturnValueOnce(firstReply.promise).mockReturnValueOnce(secondReply.promise);
    const client = new QueryClient();
    clients.push(client);
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result, rerender } = renderHook(
      ({ thirdEnabled }: { thirdEnabled: boolean }) => {
        useDriverRead({
          queryKey: driverKeys.shipment(first.id),
          queryFn: (signal) => read(first.id, signal),
        });
        useDriverRead({
          queryKey: driverKeys.shipment(second.id),
          queryFn: (signal) => read(second.id, signal),
        });
        return useDriverRead({
          queryKey: driverKeys.shipment('third'),
          queryFn: (signal) => read('third', signal),
          enabled: thirdEnabled,
        });
      },
      { initialProps: { thirdEnabled: false }, wrapper: Wrapper },
    );
    await advance();
    expect(read).toHaveBeenCalledTimes(2);
    await act(async () => firstReply.reject(new ApiError({ status: 429, retryAfter: 10_000 })));
    await advance(1000);
    await act(async () => secondReply.reject(new ApiError({ status: 429, retryAfter: 2000 })));
    await advance();
    rerender({ thirdEnabled: true });
    await advance();
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.current.remainingMs).toBe(9000);
  });

  it.each([403, 404])(
    'removes known-denied %i shipment copies from every cached page while keeping other assigned rows',
    async (status) => {
      read.mockRejectedValueOnce(new ApiError({ status }));
      const { result, client } = setup();
      const shipmentLists = [
        driverKeys.shipments(),
        driverKeys.shipments({ trip_id: 'assigned-trip' }),
        driverKeys.shipments({ cursor: 'next-page', status: 'ARRIVED_CITY' }),
      ];
      const page = {
        data: [{ ...first, id: first.id.toUpperCase() }, second],
        meta: { next_cursor: 'next' },
      };
      const unrelatedPage = { data: [second], meta: { next_cursor: null } };
      const scopeKey = driverKeys.trips({ per_page: 20 });
      for (const key of shipmentLists) client.setQueryData(key, page);
      client.setQueryData(driverKeys.shipments({ status: 'DELIVERED' }), unrelatedPage);
      client.setQueryData(scopeKey, unrelatedPage);
      await advance();
      expect(result.current.error).toMatchObject({ status });
      expect(result.current.data).toBeUndefined();
      for (const key of shipmentLists) {
        expect(client.getQueryData(key)).toEqual({ data: [second], meta: page.meta });
        expect(client.getQueryState(key)?.status).toBe('success');
      }
      expect(client.getQueryData(driverKeys.shipments({ status: 'DELIVERED' }))).toEqual(
        unrelatedPage,
      );
      expect(client.getQueryData(scopeKey)).toEqual(unrelatedPage);
      expect(client.getQueryState(scopeKey)?.status).toBe('success');
    },
  );

  it('keeps the successful trip scope usable while a revoked trip cancels a late list response', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 60_000 } } });
    clients.push(client);
    const scopeKey = driverKeys.trips({ per_page: 20 });
    const page = { data: [first, second], meta: { next_cursor: null } };
    client.setQueryData(scopeKey, page);
    client.setQueryData(driverKeys.trip(first.id), first);
    const delayed = deferred<typeof page>();
    const listRead = vi
      .fn<(_: AbortSignal) => Promise<typeof page>>()
      .mockReturnValue(delayed.promise);
    const refresh = client
      .fetchQuery({
        queryKey: scopeKey,
        queryFn: ({ signal }) => readDriverResource(client, scopeKey, listRead, signal),
        staleTime: 0,
        retry: false,
      })
      .catch(() => undefined);
    await advance();
    expect(listRead).toHaveBeenCalledOnce();
    await act(async () =>
      revokeDriverResource(client, driverKeys.trip(first.id), new ApiError({ status: 404 })),
    );
    await advance();
    expect(listRead.mock.calls[0][0].aborted).toBe(true);
    expect(client.getQueryData(scopeKey)).toEqual({ data: [second], meta: page.meta });
    // DriverScope must not interpret the locally cancelled list as rejected access.
    expect(client.getQueryState(scopeKey)).toMatchObject({
      status: 'success',
      error: null,
      fetchStatus: 'idle',
    });
    await act(async () => delayed.resolve(page));
    await refresh;
    await advance();
    expect(client.getQueryData(scopeKey)).toEqual({ data: [second], meta: page.meta });
    expect(client.getQueryData(driverKeys.trip(first.id))).toBeUndefined();
    expect(listRead).toHaveBeenCalledOnce();
  });
});
