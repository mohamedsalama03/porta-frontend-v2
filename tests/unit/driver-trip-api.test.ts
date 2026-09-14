import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@/lib/api/client';
import { createDriverWorkspaceApi } from '@/features/driver-workspace/api';
import type {
  DriverTrip,
  DriverTripAction,
  DriverTripDetail,
} from '@/features/driver-workspace/model';
import {
  approvedOperations,
  driverTripActionInputSchema,
  driverTripActionMetaSchema,
  getDriverTripsTripResponseSchema,
  postDriverTripsTripStartResponseSchema,
  postDriverTripsTripArriveResponseSchema,
  postDriverTripsTripCompleteResponseSchema,
} from '@/lib/api/generated';

vi.mock('@/lib/config', () => ({ config: { apiBaseUrl: null } }));

// Synthetic contract fixtures only. This transport never reaches the local backend.
const base = 'https://api.example.test';
const tripId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const otherTripId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const requestId = '123e4567-e89b-42d3-a456-426614174000';
const trip: DriverTrip = {
  id: tripId,
  departure_at: '2026-09-14T10:00:00+02:00',
  estimated_arrival_at: null,
  status: 'LOADING',
};
const detail = (
  allowedActions: DriverTripAction[] = [],
  data: DriverTrip = trip,
): DriverTripDetail => ({ data, meta: { allowed_actions: allowedActions }, request_id: requestId });
const actions = [
  { action: 'START', suffix: 'start', operation: approvedOperations.postDriverTripsTripStart },
  {
    action: 'CONFIRM_ARRIVAL',
    suffix: 'arrive',
    operation: approvedOperations.postDriverTripsTripArrive,
  },
  {
    action: 'COMPLETE',
    suffix: 'complete',
    operation: approvedOperations.postDriverTripsTripComplete,
  },
] as const;
const responseSchemas = [
  { name: 'GET detail', schema: getDriverTripsTripResponseSchema },
  { name: 'START', schema: postDriverTripsTripStartResponseSchema },
  { name: 'CONFIRM_ARRIVAL', schema: postDriverTripsTripArriveResponseSchema },
  { name: 'COMPLETE', schema: postDriverTripsTripCompleteResponseSchema },
];
const workspace = (fetcher: typeof fetch, onUnauthorized?: () => void) =>
  createDriverWorkspaceApi(
    createApiClient({
      baseUrl: base,
      fetch: fetcher,
      readCookie: () => 'XSRF-TOKEN=driver-trip-xsrf',
      onUnauthorized,
    }),
  );

afterEach(() => vi.useRealTimers());

describe('generated driver trip action contract', () => {
  it('accepts only the explicit empty JSON object body', () => {
    expect(driverTripActionInputSchema.parse({})).toEqual({});
    for (const value of [
      null,
      [],
      '',
      0,
      undefined,
      { driver_id: tripId },
      { status: 'DEPARTED' },
      { trip_status: 'DEPARTED' },
      { shipment_status: 'IN_TRANSIT' },
      { notes: '' },
    ]) {
      expect(driverTripActionInputSchema.safeParse(value).success).toBe(false);
    }
  });

  it('accepts empty, single and multiple unique approved capabilities without status inference', () => {
    for (const allowed_actions of [
      [],
      ['START'],
      ['CONFIRM_ARRIVAL'],
      ['COMPLETE'],
      ['COMPLETE', 'START', 'CONFIRM_ARRIVAL'],
    ]) {
      expect(driverTripActionMetaSchema.parse({ allowed_actions })).toEqual({ allowed_actions });
    }
    // The OpenAPI deliberately permits extra metadata, which must never become UI fields.
    expect(driverTripActionMetaSchema.parse({ allowed_actions: [], extra: true })).toEqual({
      allowed_actions: [],
      extra: true,
    });
  });

  it('rejects missing, duplicate, unknown and malformed capabilities', () => {
    for (const meta of [
      {},
      null,
      { allowed_actions: null },
      { allowed_actions: 'START' },
      { allowed_actions: ['START', 'START'] },
      { allowed_actions: ['START', 'CONFIRM_ARRIVAL', 'COMPLETE', 'START'] },
      { allowed_actions: ['CANCEL'] },
      { allowed_actions: ['start'] },
      { allowed_actions: ['START', 1] },
    ]) {
      expect(driverTripActionMetaSchema.safeParse(meta).success).toBe(false);
    }
  });

  it.each(responseSchemas)(
    '$name requires validated capability metadata and driver-safe data',
    ({ schema }) => {
      expect(schema.parse(detail(['START']))).toEqual(detail(['START']));
      const invalidResponses = [
        { ...detail(), meta: {} },
        { ...detail(), meta: { allowed_actions: ['CANCEL'] } },
        { ...detail(), meta: { allowed_actions: ['START', 'START'] } },
        { ...detail(), data: { ...trip, financial_total: 100 } },
        { ...detail(), data: { ...trip, staff: 'PRIVATE_STAFF' } },
        { ...detail(), data: { ...trip, notes: 'PRIVATE_NOTES' } },
        { ...detail(), request_id: 'PRIVATE_TRACE' },
        { ...detail(), audit: 'PRIVATE_AUDIT' },
      ];
      for (const payload of invalidResponses) expect(schema.safeParse(payload).success).toBe(false);
    },
  );
});

describe('dedicated trip detail and explicit action transport', () => {
  it('preserves validated data, allowed_actions and request correlation from detail', async () => {
    const response = detail(['COMPLETE'], { ...trip, status: 'ARRIVED' });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(response));
    await expect(workspace(fetcher).getDriverTrip(tripId)).resolves.toEqual(response);
    expect(fetcher.mock.calls[0][0]).toBe(`${base}/api/v1/driver/trips/${tripId}`);
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
    });
  });

  it.each(actions)(
    '$action sends one exact empty, cookie-authenticated, idempotent POST',
    async ({ action, suffix, operation }) => {
      let finish!: (response: Response) => void;
      const fetcher = vi.fn<typeof fetch>().mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const attempt = workspace(fetcher).createDriverTripAction(tripId, action);
      expect(operation.permission).toBeNull();
      expect(operation.idempotent).toBe(true);
      const pending = attempt.run();
      expect(attempt.run()).toBe(pending);
      await Promise.resolve();
      expect(fetcher).toHaveBeenCalledOnce();
      const [url, init] = fetcher.mock.calls[0];
      expect(url).toBe(`${base}/api/v1/driver/trips/${tripId}/${suffix}`);
      expect(init).toMatchObject({
        method: 'POST',
        body: '{}',
        credentials: 'include',
        cache: 'no-store',
      });
      expect(init?.signal).toBeUndefined();
      const headers = new Headers(init?.headers);
      expect(headers.get('Idempotency-Key')).toBe(attempt.key);
      expect(attempt.key).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
      expect(headers.get('X-XSRF-TOKEN')).toBe('driver-trip-xsrf');
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.has('Authorization')).toBe(false);
      const result = detail([], { ...trip, status: 'COMPLETED' });
      finish(Response.json(result));
      await expect(pending).resolves.toEqual(result);
      await expect(attempt.run()).resolves.toEqual(result);
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it.each(actions)(
    '$action does not second-guess valid saved replay status or capabilities',
    async ({ action }) => {
      const saved = detail(['START'], { ...trip, status: 'SCHEDULED' });
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(saved, { headers: { 'Idempotency-Replayed': 'true' } }));
      await expect(
        workspace(fetcher).createDriverTripAction(tripId, action).run(),
      ).resolves.toEqual(saved);
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it('allocates a fresh key for each deliberate action and different trip', () => {
    const api = workspace(vi.fn<typeof fetch>());
    const keys = [
      api.createDriverTripAction(tripId, 'START').key,
      api.createDriverTripAction(tripId, 'START').key,
      api.createDriverTripAction(tripId, 'CONFIRM_ARRIVAL').key,
      api.createDriverTripAction(tripId, 'COMPLETE').key,
      api.createDriverTripAction(otherTripId, 'START').key,
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('rejects invalid identifiers or unsupported actions before sending anything', () => {
    const fetcher = vi.fn<typeof fetch>();
    const api = workspace(fetcher);
    expect(() => api.createDriverTripAction('../admin', 'START')).toThrow();
    expect(() => api.createDriverTripAction(`${tripId}?status=DEPARTED`, 'START')).toThrow();
    for (const action of ['CANCEL', 'status', '__proto__', 'toString']) {
      expect(() => api.createDriverTripAction(tripId, action as DriverTripAction)).toThrow();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(actions)(
    '$action rejects wrong-resource and unapproved-metadata responses',
    async ({ action }) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json(detail([], { ...trip, id: otherTripId })))
        .mockResolvedValueOnce(
          Response.json({ ...detail(), meta: { allowed_actions: ['CANCEL'] } }),
        );
      const api = workspace(fetcher);
      await expect(api.createDriverTripAction(tripId, action).run()).rejects.toMatchObject({
        code: 'invalid_response',
      });
      await expect(api.createDriverTripAction(tripId, action).run()).rejects.toMatchObject({
        code: 'invalid_response',
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );

  it('accepts canonical case-insensitive matching trip identifiers', async () => {
    const response = detail([], { ...trip, id: tripId.toLowerCase() });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(response));
    await expect(workspace(fetcher).createDriverTripAction(tripId, 'START').run()).resolves.toEqual(
      response,
    );
  });
});

describe('uncertain trip action attempts', () => {
  it.each(actions)(
    '$action retains the exact method/path/body/key through an explicit network retry',
    async ({ action, suffix }) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockRejectedValueOnce(new Error('Network disconnected'))
        .mockResolvedValueOnce(Response.json(detail()));
      const attempt = workspace(fetcher).createDriverTripAction(tripId, action);
      await expect(attempt.run()).rejects.toMatchObject({ code: 'network' });
      await Promise.resolve();
      expect(fetcher).toHaveBeenCalledOnce();
      await expect(attempt.run()).resolves.toEqual(detail());
      expect(fetcher).toHaveBeenCalledTimes(2);
      for (const [url, init] of fetcher.mock.calls) {
        expect(url).toBe(`${base}/api/v1/driver/trips/${tripId}/${suffix}`);
        expect(init).toMatchObject({ method: 'POST', body: '{}' });
        expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(attempt.key);
      }
    },
  );

  it.each([500, 503])(
    'retains a deliberate retry after uncertain HTTP %i without auto retry',
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({ message: 'PRIVATE_FAILURE' }, { status }))
        .mockResolvedValueOnce(Response.json(detail()));
      const attempt = workspace(fetcher).createDriverTripAction(tripId, 'START');
      await expect(attempt.run()).rejects.toMatchObject({ status });
      expect(fetcher).toHaveBeenCalledOnce();
      await expect(attempt.run()).resolves.toEqual(detail());
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(
        fetcher.mock.calls.map(([, init]) => new Headers(init?.headers).get('Idempotency-Key')),
      ).toEqual([attempt.key, attempt.key]);
    },
  );

  it.each([403, 404, 409, 422])(
    'returns safe HTTP %i feedback without implicit retry or confirmation',
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          Response.json(
            { message: 'PRIVATE_SQL_FAILURE' },
            { status, headers: { 'X-Request-ID': requestId } },
          ),
        );
      const attempt = workspace(fetcher).createDriverTripAction(tripId, 'START');
      const error = await attempt.run().catch((value: unknown) => value);
      expect(error).toMatchObject({ status, requestId });
      expect(JSON.stringify(error)).not.toContain('PRIVATE_');
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it('uses the existing session-expiry notification for a trip action 401', async () => {
    const expired = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, { status: 401 }));
    await expect(
      workspace(fetcher, expired).createDriverTripAction(tripId, 'START').run(),
    ).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
  });

  it('waits through Retry-After without automatically submitting when it expires', async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}, { status: 429, headers: { 'Retry-After': '5' } }))
      .mockResolvedValueOnce(Response.json(detail()));
    const attempt = workspace(fetcher).createDriverTripAction(tripId, 'CONFIRM_ARRIVAL');
    await expect(attempt.run()).rejects.toMatchObject({ status: 429, retryAfter: 5000 });
    await expect(attempt.run()).rejects.toMatchObject({ status: 429 });
    expect(fetcher).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetcher).toHaveBeenCalledOnce();
    await expect(attempt.run()).resolves.toEqual(detail());
    expect(
      fetcher.mock.calls.map(([, init]) => new Headers(init?.headers).get('Idempotency-Key')),
    ).toEqual([attempt.key, attempt.key]);
  });
});
