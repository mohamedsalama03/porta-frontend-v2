import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@/lib/api/client';
import { createDriverWorkspaceApi, driverStatusPermission } from '@/features/driver-workspace/api';
import type {
  DriverShipment,
  DriverShipmentsQuery,
  DriverTrip,
} from '@/features/driver-workspace/model';
import type { DriverStatusTarget } from '@/features/driver-workspace/status';

vi.mock('@/lib/config', () => ({ config: { apiBaseUrl: null } }));

// Synthetic approved-contract fixtures, used only by an injected in-memory transport.
const base = 'https://api.example.test';
const tripId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const shipmentId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const otherId = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
const requestId = '123e4567-e89b-42d3-a456-426614174000';
const trip: DriverTrip = {
  id: tripId,
  departure_at: '2026-09-14T10:00:00+02:00',
  estimated_arrival_at: null,
  status: 'ARRIVED',
  origin_city: { name_ar: 'مدينة الاختبار الأولى', name_en: 'Test origin', code: 'TEST1' },
  destination_city: {
    name_ar: 'مدينة الاختبار الثانية',
    name_en: 'Test destination',
    code: 'TEST2',
  },
  shipments_count: 1,
};
const shipment: DriverShipment = {
  id: shipmentId,
  tracking_number: 'PTA-260914-DRIVERTEST01',
  trip_id: tripId,
  current_status: 'ARRIVED_CITY',
  origin_city: trip.origin_city,
  destination_city: trip.destination_city,
  sender_name: 'مرسل تجريبي',
  sender_phone: '+218911234567',
  recipient_name: 'مستلم تجريبي',
  recipient_phone: '+218921234567',
  delivery_method: 'DOOR_DELIVERY',
  delivery_address: 'عنوان اصطناعي للاختبار',
  shipment_size: 'SMALL',
};
const detail = (data: unknown) => ({
  data,
  meta: { allowed_actions: [], private_fixture: 'Never render loose detail metadata' },
  request_id: requestId,
});
const list = (data: unknown[], nextCursor: string | null = null) => ({
  data,
  meta: { next_cursor: nextCursor },
  request_id: requestId,
});
const workspace = (fetcher: typeof fetch, onUnauthorized?: () => void) =>
  createDriverWorkspaceApi(
    createApiClient({
      baseUrl: base,
      fetch: fetcher,
      readCookie: () => 'XSRF-TOKEN=driver-xsrf',
      onUnauthorized,
    }),
  );

describe('approved driver transport and privacy', () => {
  it('uses only dedicated bounded reads, cookies, no-store and the supplied cursor filters', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(list([trip], 'next/+page')))
      .mockResolvedValueOnce(Response.json(detail(trip)))
      .mockResolvedValueOnce(Response.json(list([shipment])))
      .mockResolvedValueOnce(Response.json(detail(shipment)));
    const client = workspace(fetcher);
    expect(await client.getDriverTrips()).toEqual({
      data: [trip],
      meta: { next_cursor: 'next/+page' },
    });
    expect(await client.getDriverTrip(tripId)).toEqual(detail(trip));
    expect(
      await client.getDriverShipments({
        trip_id: tripId,
        status: 'ARRIVED_CITY',
        cursor: 'page/+2',
      }),
    ).toEqual({ data: [shipment], meta: { next_cursor: null } });
    expect(await client.getDriverShipment(shipmentId)).toEqual(shipment);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      `${base}/api/v1/driver/trips?per_page=20`,
      `${base}/api/v1/driver/trips/${tripId}`,
      `${base}/api/v1/driver/shipments?cursor=page%2F%2B2&per_page=20&status=ARRIVED_CITY&trip_id=${tripId}`,
      `${base}/api/v1/driver/shipments/${shipmentId}`,
    ]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init).toMatchObject({ method: 'GET', credentials: 'include', cache: 'no-store' });
      expect(init?.body).toBeUndefined();
      expect(new Headers(init?.headers).has('Authorization')).toBe(false);
      expect(new Headers(init?.headers).has('Idempotency-Key')).toBe(false);
    }
  });

  it('accepts missing optional route/count context without enriching it through another resource', async () => {
    const minimalTrip = {
      id: tripId,
      departure_at: '2026-09-14T08:00:00Z',
      estimated_arrival_at: null,
      status: 'SCHEDULED',
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(detail(minimalTrip)));
    expect(await workspace(fetcher).getDriverTrip(tripId)).toEqual(detail(minimalTrip));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects unexpected Admin/private fields, nested city fields and extra list metadata', async () => {
    const payloads = [
      ...['price', 'payment_ledger', 'staff', 'notes', 'audit', 'assigned_driver_id'].map((field) =>
        detail({ ...shipment, [field]: 'PRIVATE_FIXTURE' }),
      ),
      detail({ ...shipment, origin_city: { ...shipment.origin_city, id: otherId } }),
      { ...detail(shipment), private_account: 'PRIVATE_FIXTURE' },
    ];
    const fetcher = vi.fn<typeof fetch>();
    for (const payload of payloads) fetcher.mockResolvedValueOnce(Response.json(payload));
    const client = workspace(fetcher);
    for (let index = 0; index < payloads.length; index++) {
      await expect(client.getDriverShipment(shipmentId)).rejects.toMatchObject({
        code: 'invalid_response',
      });
    }
    fetcher.mockResolvedValueOnce(
      Response.json({
        ...list([shipment]),
        meta: { next_cursor: null, account: 'PRIVATE_FIXTURE' },
      }),
    );
    await expect(client.getDriverShipments()).rejects.toMatchObject({ code: 'invalid_response' });
    fetcher.mockResolvedValueOnce(Response.json(detail({ ...trip, driver: 'PRIVATE_FIXTURE' })));
    await expect(client.getDriverTrip(tripId)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('rejects invalid schemas and mismatched detail IDs while allowing canonical ULID casing', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(detail({ ...trip, id: otherId })))
      .mockResolvedValueOnce(Response.json(detail({ ...shipment, id: otherId })))
      .mockResolvedValueOnce(
        Response.json(detail({ ...trip, departure_at: '2026-09-14T10:00:00' })),
      )
      .mockResolvedValueOnce(Response.json(detail({ ...shipment, current_status: 'DEPARTED' })))
      .mockResolvedValueOnce(Response.json(detail({ ...shipment, id: shipmentId.toLowerCase() })));
    const client = workspace(fetcher);
    await expect(client.getDriverTrip(tripId)).rejects.toMatchObject({ code: 'invalid_response' });
    await expect(client.getDriverShipment(shipmentId)).rejects.toMatchObject({
      code: 'invalid_response',
    });
    await expect(client.getDriverTrip(tripId)).rejects.toMatchObject({ code: 'invalid_response' });
    await expect(client.getDriverShipment(shipmentId)).rejects.toMatchObject({
      code: 'invalid_response',
    });
    expect((await client.getDriverShipment(shipmentId)).id).toBe(shipmentId.toLowerCase());
  });

  it('fails closed when response items violate the requested trip or status filter', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(list([{ ...shipment, trip_id: otherId }])))
      .mockResolvedValueOnce(Response.json(list([{ ...shipment, current_status: 'DELIVERED' }])))
      .mockResolvedValueOnce(Response.json(list([{ ...trip, status: 'DEPARTED' }])));
    const client = workspace(fetcher);
    await expect(client.getDriverShipments({ trip_id: tripId })).rejects.toMatchObject({
      code: 'invalid_response',
    });
    await expect(client.getDriverShipments({ status: 'ARRIVED_CITY' })).rejects.toMatchObject({
      code: 'invalid_response',
    });
    await expect(client.getDriverTrips({ status: 'ARRIVED' })).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('validates identifiers, query keys and targets before any request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = workspace(fetcher);
    await expect(client.getDriverTrip('../admin/trips')).rejects.toMatchObject({
      code: 'invalid_request',
    });
    await expect(client.getDriverShipment(`${shipmentId}?driver=other`)).rejects.toMatchObject({
      code: 'invalid_request',
    });
    await expect(client.getDriverTrips({ per_page: 101 })).rejects.toMatchObject({
      code: 'invalid_request',
    });
    await expect(
      client.getDriverShipments({ driver_id: otherId } as DriverShipmentsQuery),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    expect(() =>
      client.createDriverStatusAction(shipmentId, 'DEPARTED' as DriverStatusTarget),
    ).toThrow();
    expect(() => client.createDriverStatusAction('../admin', 'DELIVERED')).toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('preserves safe 403/404, 409, 422, 429, 500/503 and network errors without implicit retry', async () => {
    const statuses = [403, 404, 409, 422, 429, 500, 503];
    const fetcher = vi.fn<typeof fetch>();
    for (const status of statuses) {
      fetcher.mockResolvedValueOnce(
        Response.json(
          { message: 'PRIVATE_SQL_STACK', errors: { status: ['PRIVATE_DOMAIN_RULE'] } },
          { status, headers: { 'Retry-After': '12', 'X-Request-ID': requestId } },
        ),
      );
    }
    fetcher.mockRejectedValueOnce(new Error('PRIVATE_NETWORK_DETAIL'));
    const client = workspace(fetcher);
    for (const status of statuses) {
      const error = await client.getDriverShipment(shipmentId).catch((failure: unknown) => failure);
      expect(error).toMatchObject({ status, retryAfter: 12_000, requestId });
      expect(JSON.stringify(error)).not.toContain('PRIVATE_');
      if (status === 422) {
        expect(error).toMatchObject({ validationErrors: { status: ['تحقق من قيمة هذا الحقل.'] } });
      }
    }
    await expect(client.getDriverShipment(shipmentId)).rejects.toMatchObject({ code: 'network' });
    expect(fetcher).toHaveBeenCalledTimes(statuses.length + 1);
  });

  it('notifies session expiry on a private 401', async () => {
    const expired = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, { status: 401 }));
    await expect(workspace(fetcher, expired).getDriverTrips()).rejects.toMatchObject({
      status: 401,
    });
    expect(expired).toHaveBeenCalledOnce();
  });

  it('forwards read cancellation and ignores a transport response arriving after cancellation', async () => {
    const controller = new AbortController();
    let finish: (response: Response) => void = () => {};
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const client = workspace(fetcher);
    const pending = client.getDriverTrips({}, controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher.mock.calls[0][1]?.signal).toBe(controller.signal);
    controller.abort();
    finish(Response.json(list([trip])));
    await rejected;
    await expect(client.getDriverTrips({}, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('authoritative driver status actions', () => {
  it('captures a single body/key, deduplicates pending calls, retries deliberately and retains confirmed results', async () => {
    const updated = { ...shipment, current_status: 'READY_FOR_PICKUP' };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('Lost connection'))
      .mockResolvedValue(Response.json(detail(updated)));
    const client = workspace(fetcher);
    const action = client.createDriverStatusAction(shipmentId, 'READY_FOR_PICKUP');
    const pending = action.run();
    expect(action.run()).toBe(pending);
    await expect(pending).rejects.toMatchObject({ code: 'network' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(action.run()).resolves.toEqual(updated);
    await expect(action.run()).resolves.toEqual(updated);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(driverStatusPermission).toBe('shipments.change_status');
    for (const [url, init] of fetcher.mock.calls) {
      expect(url).toBe(`${base}/api/v1/driver/shipments/${shipmentId}/status`);
      expect(init).toMatchObject({
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        body: '{"status":"READY_FOR_PICKUP"}',
      });
      expect(init?.signal).toBeUndefined();
      const headers = new Headers(init?.headers);
      expect(headers.get('Idempotency-Key')).toBe(action.key);
      expect(headers.get('X-XSRF-TOKEN')).toBe('driver-xsrf');
      expect(headers.has('Authorization')).toBe(false);
    }
    expect(client.createDriverStatusAction(shipmentId, 'DELIVERED').key).not.toBe(action.key);
  });

  it('waits for authoritative confirmation and rejects a mismatched mutation resource or target', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(detail({ ...shipment, id: otherId, current_status: 'DELIVERED' })),
      )
      .mockResolvedValueOnce(Response.json(detail(shipment)));
    const client = workspace(fetcher);
    await expect(
      client.createDriverStatusAction(shipmentId, 'DELIVERED').run(),
    ).rejects.toMatchObject({
      code: 'invalid_response',
    });
    await expect(
      client.createDriverStatusAction(shipmentId, 'DELIVERED').run(),
    ).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('honors Retry-After even on an explicit action retry', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(Response.json({}, { status: 429, headers: { 'Retry-After': '5' } }))
        .mockResolvedValueOnce(Response.json(detail({ ...shipment, current_status: 'DELIVERED' })));
      const action = workspace(fetcher).createDriverStatusAction(shipmentId, 'DELIVERED');
      await expect(action.run()).rejects.toMatchObject({ status: 429, retryAfter: 5000 });
      await expect(action.run()).rejects.toMatchObject({ status: 429 });
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(5000);
      await expect(action.run()).resolves.toMatchObject({ current_status: 'DELIVERED' });
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(
        fetcher.mock.calls.map(([, init]) => new Headers(init?.headers).get('Idempotency-Key')),
      ).toEqual([action.key, action.key]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry conflicts automatically or interpret backend errors as confirmation', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, { status: 409 }));
    const action = workspace(fetcher).createDriverStatusAction(shipmentId, 'DELIVERED');
    await expect(action.run()).rejects.toMatchObject({ status: 409 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
