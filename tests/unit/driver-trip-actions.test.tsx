import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, QueryObserver, useQuery } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { createIdempotentAction } from '@/lib/api/idempotency';
import { driverShipmentSchema, getDriverTripsTripResponseSchema } from '@/lib/api/generated';
import * as driverApi from '@/features/driver-workspace/api';
import {
  driverTripAttemptKey,
  useDriverTripAction,
} from '@/features/driver-workspace/trip-action-state';
import { refreshTripAfterShipment } from '@/features/driver-workspace/trip-queries';
import { revokeDriverResource } from '@/features/driver-workspace/use-driver-read';
import {
  driverKeys,
  type DriverTripAction,
  type DriverTripDetail,
} from '@/features/driver-workspace/model';
import {
  driverEnvelope,
  driverShipmentFixture,
  driverTripFixture,
} from '../../scripts/driver-check-fixtures.mjs';

vi.mock('@/lib/api/client', () => ({ api: { request: vi.fn() } }));
const clients: QueryClient[] = [];
const makeDetail = (
  actions: DriverTripAction[] = ['START'],
  status: DriverTripDetail['data']['status'] = 'LOADING',
) =>
  getDriverTripsTripResponseSchema.parse(
    driverEnvelope({ ...driverTripFixture(), status }, { allowed_actions: actions }),
  );
const initial = makeDetail();
const key = driverKeys.trip(initial.data.id);
const shipment = driverShipmentSchema.parse(driverShipmentFixture());

function deferred<T>() {
  let resolve!: (data: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function setup(detail = initial, existingClient?: QueryClient, routeId = initial.data.id) {
  const client =
    existingClient ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const routeKey = driverKeys.trip(routeId);
  if (!existingClient) {
    clients.push(client);
    client.setQueryData(routeKey, detail);
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return {
    client,
    ...renderHook(
      () => {
        const query = useQuery({ queryKey: routeKey, queryFn: async () => detail, enabled: false });
        return {
          controller: useDriverTripAction(query.data ?? detail),
          detail: query.data,
        };
      },
      { wrapper },
    ),
  };
}
async function tick(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(driverApi, 'getDriverTrip').mockResolvedValue(makeDetail([], 'COMPLETED'));
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('driver trip action controller', () => {
  it('uses one trip identity for a lowercase route and the canonical uppercase response', async () => {
    const create = vi
      .spyOn(driverApi, 'createDriverTripAction')
      .mockImplementation(() => createIdempotentAction(async () => makeDetail([], 'DEPARTED')));
    const lowercaseId = initial.data.id.toLowerCase();
    const view = setup(initial, undefined, lowercaseId);
    expect(driverKeys.trip(lowercaseId)).toEqual(driverKeys.trip(initial.data.id));
    await act(async () => {
      await view.result.current.controller.run('START');
    });
    await tick();
    expect(create).toHaveBeenCalledExactlyOnceWith(initial.data.id, 'START');
    expect(driverApi.getDriverTrip).toHaveBeenCalledExactlyOnceWith(
      initial.data.id,
      expect.any(AbortSignal),
    );
    expect(view.result.current.controller.phase).toBe('confirmed');
    expect(view.result.current.detail?.meta.allowed_actions).toEqual([]);
  });

  it('retains the same uncertain request when a later response changes the ULID casing', async () => {
    const keys: string[] = [];
    const create = vi.spyOn(driverApi, 'createDriverTripAction').mockImplementation(() =>
      createIdempotentAction(async (idempotencyKey) => {
        keys.push(idempotencyKey);
        if (keys.length === 1) throw new ApiError({ code: 'network' });
        return makeDetail([], 'DEPARTED');
      }),
    );
    const lowercaseId = initial.data.id.toLowerCase();
    const lowercaseDetail = getDriverTripsTripResponseSchema.parse({
      ...initial,
      data: { ...initial.data, id: lowercaseId },
    });
    const view = setup(lowercaseDetail, undefined, lowercaseId);
    await act(async () => {
      await view.result.current.controller.run('START');
    });
    await tick();
    const retained = view.client.getQueryCache().find({
      queryKey: driverTripAttemptKey(lowercaseId),
      exact: true,
    });
    act(() => view.client.setQueryData(driverKeys.trip(lowercaseId), initial));
    await tick();
    expect(view.result.current.controller.phase).toBe('uncertain');
    expect(view.result.current.controller.attemptAction).toBe('START');
    expect(
      view.client.getQueryCache().find({
        queryKey: driverTripAttemptKey(initial.data.id),
        exact: true,
      }),
    ).toBe(retained);
    expect(keys).toHaveLength(1);
    await act(async () => {
      await view.result.current.controller.retry();
    });
    await tick();
    expect(create).toHaveBeenCalledExactlyOnceWith(initial.data.id, 'START');
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(view.result.current.controller.phase).toBe('confirmed');
  });

  it('does not authorize by status, cached list rows, or a previously displayed capability', async () => {
    const create = vi.spyOn(driverApi, 'createDriverTripAction');
    const view = setup(makeDetail([], 'LOADING'));
    view.client.setQueryData(driverKeys.shipments(), {
      data: [{ ...shipment, current_status: 'DELIVERED' }],
      meta: { next_cursor: null },
    });
    await act(async () => {
      await view.result.current.controller.run('START');
      await view.result.current.controller.run('COMPLETE');
    });
    expect(create).not.toHaveBeenCalled();
    act(() => view.client.setQueryData(key, makeDetail(['START'])));
    await tick();
    const oldRun = view.result.current.controller.run;
    act(() => view.client.setQueryData(key, makeDetail([])));
    await act(async () => {
      await oldRun('START');
    });
    expect(create).not.toHaveBeenCalled();
  });

  it.each<DriverTripAction>(['START', 'CONFIRM_ARRIVAL', 'COMPLETE'])(
    'accepts only supplied %s metadata, holds pending once, and always gets fresh capabilities after success',
    async (action) => {
      const post = deferred<DriverTripDetail>();
      const read = deferred<DriverTripDetail>();
      const submit = vi.fn(() => post.promise);
      const create = vi
        .spyOn(driverApi, 'createDriverTripAction')
        .mockImplementation(() => createIdempotentAction(submit));
      vi.mocked(driverApi.getDriverTrip).mockReturnValue(read.promise);
      // Deliberately unrelated status proves action metadata, not status, controls availability.
      const view = setup(makeDetail([action], 'SCHEDULED'));
      let execution!: Promise<void>;
      act(() => {
        execution = view.result.current.controller.run(action);
        void view.result.current.controller.run(action);
      });
      await tick();
      expect(create).toHaveBeenCalledExactlyOnceWith(initial.data.id, action);
      expect(submit).toHaveBeenCalledOnce();
      expect(view.result.current.controller.phase).toBe('pending');
      expect(view.result.current.detail?.data.status).toBe('SCHEDULED');
      const returned = makeDetail(['START'], 'DEPARTED');
      await act(async () => post.resolve(returned));
      await tick();
      expect(view.result.current.detail).toEqual(returned);
      expect(view.result.current.controller.successAction).toBe(action);
      expect(view.result.current.controller.blocked).toBe(true);
      expect(driverApi.getDriverTrip).toHaveBeenCalledOnce();
      await act(async () => {
        await view.result.current.controller.run('START');
      });
      expect(create).toHaveBeenCalledOnce();
      await act(async () => read.resolve(makeDetail([], 'COMPLETED')));
      await execution;
      await tick();
      expect(view.result.current.controller.phase).toBe('confirmed');
      expect(view.result.current.detail?.meta.allowed_actions).toEqual([]);
    },
  );

  it('does not trust an older successful replay capability when its mandatory fresh read fails', async () => {
    const create = vi
      .spyOn(driverApi, 'createDriverTripAction')
      .mockImplementation(() =>
        createIdempotentAction(async () => makeDetail(['START'], 'DEPARTED')),
      );
    vi.mocked(driverApi.getDriverTrip)
      .mockRejectedValueOnce(new ApiError({ status: 503 }))
      .mockResolvedValue(makeDetail(['CONFIRM_ARRIVAL'], 'DEPARTED'));
    const view = setup();
    await act(async () => {
      await view.result.current.controller.run('START');
    });
    await tick();
    expect(view.result.current.controller.successAction).toBe('START');
    expect(view.result.current.controller.phase).toBe('review');
    expect(view.result.current.controller.blocked).toBe(true);
    await act(async () => {
      await view.result.current.controller.run('START');
    });
    expect(create).toHaveBeenCalledOnce();
    await act(async () => {
      await view.result.current.controller.review();
    });
    await tick();
    expect(view.result.current.controller.phase).toBe('confirmed');
    expect(view.result.current.controller.error).toBeNull();
    expect(view.result.current.detail?.meta.allowed_actions).toEqual(['CONFIRM_ARRIVAL']);
    expect(driverApi.getDriverTrip).toHaveBeenCalledTimes(2);
  });

  it('retires a 409 attempt and removes stale action using immediate fresh metadata without resubmitting', async () => {
    const conflict = new ApiError({ status: 409, requestId: 'SAFE_CONFLICT_REFERENCE' });
    const post = vi.fn(async () => {
      throw conflict;
    });
    const create = vi
      .spyOn(driverApi, 'createDriverTripAction')
      .mockImplementation(() => createIdempotentAction(post));
    const view = setup();
    await act(async () => {
      await view.result.current.controller.run('START');
    });
    await tick();
    expect(view.result.current.controller.error).toBe(conflict);
    expect(view.result.current.controller.attemptAction).toBeNull();
    expect(view.result.current.detail?.meta.allowed_actions).toEqual([]);
    await tick(60_000);
    await act(async () => {
      await view.result.current.controller.retry();
    });
    expect(post).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    expect(driverApi.getDriverTrip).toHaveBeenCalledOnce();
  });

  it.each([403, 404])(
    'revokes detail and all trip list copies after %s and keeps other namespaces',
    async (status) => {
      vi.spyOn(driverApi, 'createDriverTripAction').mockImplementation(() =>
        createIdempotentAction(async () => {
          throw new ApiError({ status });
        }),
      );
      const view = setup();
      const other = { ...initial.data, id: '01ARZ3NDEKTSV4RRFFQ69G5FAC' };
      const listKey = driverKeys.trips();
      const secondListKey = driverKeys.trips({ status: 'LOADING' });
      const page = { data: [initial.data, other], meta: { next_cursor: null } };
      view.client.setQueryData(listKey, page);
      view.client.setQueryData(secondListKey, page);
      view.client.setQueryData(['admin', 'trips'], page);
      view.client.setQueryData(['public-tracking'], { data: 'PUBLIC' });
      await act(async () => {
        await view.result.current.controller.run('START');
      });
      await tick();
      expect(view.client.getQueryData(key)).toBeUndefined();
      expect(view.client.getQueryData(listKey)).toEqual({ ...page, data: [other] });
      expect(view.client.getQueryData(secondListKey)).toEqual({ ...page, data: [other] });
      expect(view.client.getQueryState(listKey)?.isInvalidated).toBe(true);
      expect(view.client.getQueryData(['admin', 'trips'])).toEqual(page);
      expect(view.client.getQueryState(['admin', 'trips'])?.isInvalidated).toBe(false);
      expect(view.client.getQueryState(['public-tracking'])?.isInvalidated).toBe(false);
      expect(driverApi.getDriverTrip).not.toHaveBeenCalled();
    },
  );

  it.each([
    new ApiError({ code: 'network' }),
    new ApiError({ status: 500 }),
    new ApiError({ status: 503 }),
  ])(
    'retains the exact uncertain logical attempt through navigation without automatic retry: %s',
    async (failure) => {
      const keys: string[] = [];
      const create = vi.spyOn(driverApi, 'createDriverTripAction').mockImplementation(() =>
        createIdempotentAction(async (key) => {
          keys.push(key);
          if (keys.length === 1) throw failure;
          return makeDetail([], 'COMPLETED');
        }),
      );
      const first = setup();
      await act(async () => {
        await first.result.current.controller.run('START');
      });
      await tick();
      first.unmount();
      await tick(600_000);
      const second = setup(initial, first.client);
      await tick();
      expect(second.result.current.controller.phase).toBe('uncertain');
      expect(second.result.current.controller.attemptAction).toBe('START');
      expect(keys).toHaveLength(1);
      // A retry resolves the original uncertain outcome even if a refreshed snapshot changed.
      act(() => first.client.setQueryData(key, makeDetail([])));
      await act(async () => {
        await second.result.current.controller.retry();
      });
      await tick();
      expect(create).toHaveBeenCalledOnce();
      expect(keys).toHaveLength(2);
      expect(keys[0]).toBe(keys[1]);
      expect(second.result.current.controller.phase).toBe('confirmed');
    },
  );

  it('preserves an absolute 429 deadline through navigation and requires explicit retry after expiry', async () => {
    const keys: string[] = [];
    vi.spyOn(driverApi, 'createDriverTripAction').mockImplementation(() =>
      createIdempotentAction(async (key) => {
        keys.push(key);
        if (keys.length === 1) throw new ApiError({ status: 429, retryAfter: 5000 });
        return makeDetail([]);
      }),
    );
    const first = setup();
    await act(async () => {
      await first.result.current.controller.run('START');
    });
    await tick(1000);
    first.unmount();
    const second = setup(initial, first.client);
    await tick();
    expect(second.result.current.controller.remainingMs).toBe(4000);
    await act(async () => {
      await second.result.current.controller.retry();
    });
    expect(keys).toHaveLength(1);
    await tick(4000);
    expect(second.result.current.controller.remainingMs).toBe(0);
    expect(keys).toHaveLength(1);
    await act(async () => {
      await second.result.current.controller.retry();
    });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('uses the shared read cooldown during mandatory review and does not queue a GET on expiry', async () => {
    vi.spyOn(driverApi, 'createDriverTripAction').mockImplementation(() =>
      createIdempotentAction(async () => {
        throw new ApiError({ status: 409 });
      }),
    );
    const view = setup();
    view.client.setQueryData(['driver-workspace', 'read-cooldown'], {
      deadline: Date.now() + 5000,
      error: new ApiError({ status: 429, retryAfter: 5000 }),
    });
    await act(async () => {
      await view.result.current.controller.run('START');
    });
    await tick();
    expect(view.result.current.controller.phase).toBe('review');
    expect(driverApi.getDriverTrip).not.toHaveBeenCalled();
    await act(async () => {
      await view.result.current.controller.review();
    });
    expect(driverApi.getDriverTrip).not.toHaveBeenCalled();
    await tick(5000);
    expect(driverApi.getDriverTrip).not.toHaveBeenCalled();
    await act(async () => {
      await view.result.current.controller.review();
    });
    expect(driverApi.getDriverTrip).toHaveBeenCalledOnce();
  });

  it('retires definitive 422 rejection, leaving the next deliberate operation a new key', async () => {
    const keys: string[] = [];
    vi.spyOn(driverApi, 'createDriverTripAction').mockImplementation(() =>
      createIdempotentAction(async (key) => {
        keys.push(key);
        throw new ApiError({ status: 422 });
      }),
    );
    const view = setup();
    await act(async () => {
      await view.result.current.controller.run('START');
    });
    await tick();
    expect(view.result.current.controller.attemptAction).toBeNull();
    expect(view.result.current.controller.phase).toBe('idle');
    await act(async () => {
      await view.result.current.controller.retry();
    });
    expect(keys).toHaveLength(1);
    await act(async () => {
      await view.result.current.controller.run('START');
    });
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('does not carry a retained uncertain request into the next session', async () => {
    vi.spyOn(driverApi, 'createDriverTripAction').mockImplementation(() =>
      createIdempotentAction(async () => {
        throw new ApiError({ code: 'network' });
      }),
    );
    const first = setup();
    await act(async () => {
      await first.result.current.controller.run('START');
    });
    await tick();
    expect(first.client.getQueryData(driverTripAttemptKey(initial.data.id))).toBeDefined();
    first.unmount();
    first.client.clear();
    first.client.setQueryData(key, initial);
    const second = setup(initial, first.client);
    await tick();
    expect(second.result.current.controller.phase).toBe('idle');
    expect(second.result.current.controller.attemptAction).toBeNull();
  });

  it('ignores late success after session clearing even when a new session has recreated identical keys', async () => {
    const post = deferred<DriverTripDetail>();
    vi.spyOn(driverApi, 'createDriverTripAction').mockImplementation(() =>
      createIdempotentAction(() => post.promise),
    );
    const first = setup();
    let execution!: Promise<void>;
    act(() => {
      execution = first.result.current.controller.run('START');
    });
    await tick();
    first.unmount();
    first.client.clear();
    const newDetail = makeDetail(['COMPLETE'], 'ARRIVED');
    first.client.setQueryData(key, newDetail);
    const second = setup(newDetail, first.client);
    await act(async () => post.resolve(makeDetail([], 'DEPARTED')));
    await execution;
    await tick();
    expect(second.result.current.detail).toEqual(newDetail);
    expect(second.result.current.controller.phase).toBe('idle');
    expect(second.result.current.controller.successAction).toBeNull();
    expect(driverApi.getDriverTrip).not.toHaveBeenCalled();
  });

  it('finishes a pending same-session request safely after navigation without submitting again on return', async () => {
    const post = deferred<DriverTripDetail>();
    const submit = vi.fn(() => post.promise);
    vi.spyOn(driverApi, 'createDriverTripAction').mockImplementation(() =>
      createIdempotentAction(submit),
    );
    const first = setup();
    let execution!: Promise<void>;
    act(() => {
      execution = first.result.current.controller.run('START');
    });
    await tick();
    first.unmount();
    await act(async () => post.resolve(makeDetail(['START'], 'DEPARTED')));
    await execution;
    const second = setup(initial, first.client);
    await tick();
    expect(submit).toHaveBeenCalledOnce();
    expect(second.result.current.controller.phase).toBe('confirmed');
    expect(second.result.current.detail?.meta.allowed_actions).toEqual([]);
    expect(driverApi.getDriverTrip).toHaveBeenCalledOnce();
  });

  it('actually refetches active driver trip and shipment lists after START', async () => {
    vi.spyOn(driverApi, 'createDriverTripAction').mockImplementation(() =>
      createIdempotentAction(async () => makeDetail([], 'DEPARTED')),
    );
    const view = setup();
    const trips = vi.fn(async () => ({
      data: [makeDetail([], 'DEPARTED').data],
      meta: { next_cursor: null },
    }));
    const shipments = vi.fn(async () => ({
      data: [{ ...shipment, current_status: 'IN_TRANSIT' }],
      meta: { next_cursor: null },
    }));
    const tripsObserver = new QueryObserver(view.client, {
      queryKey: driverKeys.trips(),
      queryFn: trips,
      initialData: { data: [initial.data], meta: { next_cursor: null } },
      staleTime: Infinity,
    });
    const shipmentsObserver = new QueryObserver(view.client, {
      queryKey: driverKeys.shipments(),
      queryFn: shipments,
      initialData: { data: [shipment], meta: { next_cursor: null } },
      staleTime: Infinity,
    });
    const untrip = tripsObserver.subscribe(() => undefined);
    const unshipment = shipmentsObserver.subscribe(() => undefined);
    await act(async () => {
      await view.result.current.controller.run('START');
    });
    await tick();
    expect(trips).toHaveBeenCalledOnce();
    expect(shipments).toHaveBeenCalledOnce();
    expect(view.client.getQueryData(driverKeys.shipments())).toEqual({
      data: [{ ...shipment, current_status: 'IN_TRANSIT' }],
      meta: { next_cursor: null },
    });
    untrip();
    unshipment();
  });

  it.each<DriverTripAction>(['START', 'CONFIRM_ARRIVAL'])(
    'invalidates driver shipment snapshots after %s without optimistic row updates or unrelated invalidation',
    async (action) => {
      vi.spyOn(driverApi, 'createDriverTripAction').mockImplementation(() =>
        createIdempotentAction(async () => makeDetail([])),
      );
      const view = setup(makeDetail([action]));
      const listKeys = [
        driverKeys.shipments(),
        driverKeys.shipments({ trip_id: initial.data.id }),
        driverKeys.shipment(shipment.id),
      ];
      for (const queryKey of listKeys) view.client.setQueryData(queryKey, { data: [shipment] });
      view.client.setQueryData(['public-order'], { safe: true });
      view.client.setQueryData(['dashboard'], { safe: true });
      await act(async () => {
        await view.result.current.controller.run(action);
      });
      for (const queryKey of listKeys) {
        expect(view.client.getQueryData(queryKey)).toEqual({ data: [shipment] });
        expect(view.client.getQueryState(queryKey)?.isInvalidated).toBe(true);
      }
      expect(view.client.getQueryState(['public-order'])?.isInvalidated).toBe(false);
      expect(view.client.getQueryState(['dashboard'])?.isInvalidated).toBe(false);
    },
  );
});

describe('trip reassignment after detail garbage collection', () => {
  it('prunes cached trip list copies when the detail no longer exists', async () => {
    const client = new QueryClient();
    clients.push(client);
    const listKey = driverKeys.trips();
    const other = { ...initial.data, id: '01ARZ3NDEKTSV4RRFFQ69G5FAC' };
    const page = { data: [initial.data, other], meta: { next_cursor: null } };
    client.setQueryData(listKey, page);
    await revokeDriverResource(client, key, new ApiError({ status: 404 }));
    expect(client.getQueryData(key)).toBeUndefined();
    expect(client.getQueryData(listKey)).toEqual({ ...page, data: [other] });
  });
  it('does not prune replacement-session list queries while absent-detail revocation settles', async () => {
    const client = new QueryClient();
    clients.push(client);
    const listKey = driverKeys.trips();
    const page = { data: [initial.data], meta: { next_cursor: null } };
    client.setQueryData(listKey, page);
    const cancel = deferred<void>();
    vi.spyOn(client, 'cancelQueries').mockReturnValue(cancel.promise);
    const revocation = revokeDriverResource(client, key, new ApiError({ status: 404 }));
    client.clear();
    client.setQueryData(listKey, page);
    cancel.resolve();
    await revocation;
    expect(client.getQueryData(listKey)).toEqual(page);
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(false);
    expect(client.getQueryData(key)).toBeUndefined();
  });
});

describe('shipment action capability discovery', () => {
  it('forces an inactive known trip and current shipment read while invalidating driver lists', async () => {
    const view = setup(makeDetail([]));
    view.unmount();
    vi.mocked(driverApi.getDriverTrip).mockResolvedValue(makeDetail(['COMPLETE'], 'ARRIVED'));
    vi.spyOn(driverApi, 'getDriverShipment').mockResolvedValue({
      ...shipment,
      current_status: 'DELIVERED',
    });
    view.client.setQueryData(driverKeys.shipments(), {
      data: [shipment],
      meta: { next_cursor: null },
    });
    await refreshTripAfterShipment(view.client, initial.data.id, () => true, shipment.id);
    expect(driverApi.getDriverTrip).toHaveBeenCalledOnce();
    expect(driverApi.getDriverShipment).toHaveBeenCalledOnce();
    expect(view.client.getQueryData<DriverTripDetail>(key)?.meta.allowed_actions).toEqual([
      'COMPLETE',
    ]);
    expect(view.client.getQueryState(driverKeys.shipments())?.isInvalidated).toBe(true);
  });
  it('does not invent a trip when no trip ID is supplied', async () => {
    const view = setup();
    await refreshTripAfterShipment(view.client, null, () => true);
    expect(driverApi.getDriverTrip).not.toHaveBeenCalled();
  });

  it('forces current shipment exactly once even when its detail observer is active', async () => {
    const view = setup(makeDetail([]));
    const read = vi
      .spyOn(driverApi, 'getDriverShipment')
      .mockResolvedValue({ ...shipment, current_status: 'DELIVERED' });
    const observer = new QueryObserver(view.client, {
      queryKey: driverKeys.shipment(shipment.id),
      queryFn: () => driverApi.getDriverShipment(shipment.id),
      initialData: shipment,
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => undefined);
    await refreshTripAfterShipment(view.client, initial.data.id, () => true, shipment.id);
    expect(read).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('does not recreate detail queries when session cleanup overlaps cancellation', async () => {
    const view = setup(makeDetail([]));
    view.unmount();
    let current = true;
    const cancel = deferred<void>();
    vi.spyOn(view.client, 'cancelQueries').mockReturnValue(cancel.promise);
    const refresh = refreshTripAfterShipment(
      view.client,
      initial.data.id,
      () => current,
      shipment.id,
    );
    current = false;
    view.client.clear();
    cancel.resolve();
    await refresh;
    expect(view.client.getQueryCache().getAll()).toHaveLength(0);
    expect(driverApi.getDriverTrip).not.toHaveBeenCalled();
  });
});
