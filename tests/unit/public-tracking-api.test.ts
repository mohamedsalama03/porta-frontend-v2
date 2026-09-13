import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@/lib/api/client';
import { createPublicTrackingApi, type TrackingData } from '@/features/public-tracking/api';

vi.mock('@/lib/config', () => ({ config: { apiBaseUrl: null } }));

// Synthetic generated-contract fixtures, consumed only by injected fetch.
const base = 'https://api.example.test';
const number = 'PTA-260913-TRACKTEST01';
const requestId = '123e4567-e89b-42d3-a456-426614174000';
const data: TrackingData = {
  tracking_number: number,
  origin_city: { name_ar: 'مدينة الانطلاق', name_en: 'Origin test city' },
  destination_city: { name_ar: 'مدينة الوصول', name_en: 'Destination test city' },
  shipment_type: 'طرد اختبار',
  current_status: 'PREPARING',
  status_label: 'جاري التجهيز',
  created_at: '2026-09-13T12:00:00Z',
  estimated_delivery: null,
  // Deliberately nonchronological. The contract does not authorize reordering.
  tracking_timeline: [
    { status: 'PREPARING', status_label: 'جاري التجهيز', occurred_at: '2026-09-13T13:00:00Z' },
    { status: 'RECEIVED', status_label: 'تم الاستلام', occurred_at: '2026-09-13T12:00:00Z' },
  ],
};
const envelope = (body: unknown = data) => ({
  data: body,
  meta: { private_fixture: 'Do not retain arbitrary envelope metadata' },
  request_id: requestId,
});

describe('public tracking generated-contract transport', () => {
  it('uses one no-store public GET without staff, CSRF bootstrap, mutations or envelope metadata', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(envelope()));
    const client = createPublicTrackingApi(createApiClient({ baseUrl: base, fetch: fetcher }));
    const result = await client.getPublicTracking(` ${number} `);
    expect(result).toEqual(data);
    expect(result.tracking_timeline.map((event) => event.status)).toEqual([
      'PREPARING',
      'RECEIVED',
    ]);
    expect(result).not.toHaveProperty('meta');
    expect(result).not.toHaveProperty('request_id');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(`${base}/api/v1/tracking/${number}`);
    expect(init).toMatchObject({ method: 'GET', credentials: 'include', cache: 'no-store' });
    expect(init?.body).toBeUndefined();
    expect(new Headers(init?.headers).get('Accept')).toBe('application/json');
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
    expect(new Headers(init?.headers).has('X-XSRF-TOKEN')).toBe(false);
    expect(new Headers(init?.headers).has('Idempotency-Key')).toBe(false);
  });

  it('rejects unknown private fields at data, city, event and envelope boundaries', async () => {
    const forbidden = {
      sender_phone: 'private-sender-phone',
      recipient_phone: 'private-recipient-phone',
      sender_name: 'private-sender-name',
      recipient_name: 'private-recipient-name',
      id: 'private-internal-id',
      driver: { name: 'private-driver', phone: 'private-driver-phone' },
      staff: 'private-staff',
      notes: 'private-internal-notes',
      payment_ledger: ['private-ledger'],
      audit_metadata: 'private-audit',
    };
    const payloads = [
      ...Object.entries(forbidden).map(([key, value]) => envelope({ ...data, [key]: value })),
      envelope({ ...data, origin_city: { ...data.origin_city, id: 'private-city-id' } }),
      envelope({
        ...data,
        tracking_timeline: [{ ...data.tracking_timeline[0], actor: 'private-staff' }],
      }),
      { ...envelope(), authorization: 'private-authorization' },
    ];
    const fetcher = vi.fn<typeof fetch>();
    for (const payload of payloads) fetcher.mockResolvedValueOnce(Response.json(payload));
    const client = createPublicTrackingApi(createApiClient({ baseUrl: base, fetch: fetcher }));
    for (let index = 0; index < payloads.length; index++) {
      await expect(client.getPublicTracking(number)).rejects.toMatchObject({
        code: 'invalid_response',
      });
    }
    expect(fetcher).toHaveBeenCalledTimes(payloads.length);
  });

  it('rejects invalid status, missing fields, nonabsolute timestamp and a different returned identifier', async () => {
    const payloads = [
      { ...data, current_status: 'ARRIVED' },
      { ...data, shipment_type: undefined },
      { ...data, created_at: '2026-09-13T12:00:00' },
      { ...data, tracking_timeline: [{ ...data.tracking_timeline[0], occurred_at: 'yesterday' }] },
      { ...data, tracking_number: 'PTA-260913-OTHERTEST01' },
    ];
    const fetcher = vi.fn<typeof fetch>();
    for (const payload of payloads) fetcher.mockResolvedValueOnce(Response.json(envelope(payload)));
    const client = createPublicTrackingApi(createApiClient({ baseUrl: base, fetch: fetcher }));
    for (let index = 0; index < payloads.length; index++) {
      await expect(client.getPublicTracking(number)).rejects.toMatchObject({
        code: 'invalid_response',
      });
    }
  });

  it('accepts documented nullable estimates, empty history and explicit offset instants', async () => {
    const safe = {
      ...data,
      created_at: '2026-09-13T14:00:00+02:00',
      estimated_delivery: '2026-09-14T18:00:00+02:00',
      tracking_timeline: [],
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(envelope(safe)));
    const client = createPublicTrackingApi(createApiClient({ baseUrl: base, fetch: fetcher }));
    expect(await client.getPublicTracking(number)).toEqual(safe);
  });

  it('rejects invalid identifiers before transport without case normalization or path injection', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createPublicTrackingApi(createApiClient({ baseUrl: base, fetch: fetcher }));
    for (const invalid of [
      '',
      '   ',
      number.toLowerCase(),
      `${number}/../admin`,
      `${number}?id=1`,
    ]) {
      await expect(client.getPublicTracking(invalid)).rejects.toMatchObject({
        code: 'invalid_request',
      });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('preserves public 404, Retry-After, 500/503, network and safe request references without retries', async () => {
    const fetcher = vi.fn<typeof fetch>();
    for (const status of [404, 429, 500, 503]) {
      fetcher.mockResolvedValueOnce(
        Response.json(
          { request_id: requestId, message: 'private server stack trace' },
          { status, headers: { 'Retry-After': '12', 'X-Request-ID': requestId } },
        ),
      );
    }
    fetcher.mockRejectedValueOnce(new Error('private network detail'));
    const client = createPublicTrackingApi(createApiClient({ baseUrl: base, fetch: fetcher }));
    for (const status of [404, 429, 500, 503]) {
      await expect(client.getPublicTracking(number)).rejects.toMatchObject({
        status,
        requestId,
        retryAfter: 12000,
      });
    }
    await expect(client.getPublicTracking(number)).rejects.toMatchObject({ code: 'network' });
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it('does not expire the staff session when the public service returns 401', async () => {
    const onUnauthorized = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({}, { status: 401 }));
    const client = createPublicTrackingApi(
      createApiClient({ baseUrl: base, fetch: fetcher, onUnauthorized }),
    );
    await expect(client.getPublicTracking(number)).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('forwards cancellation and ignores a stale response even if the transport completes after abort', async () => {
    const controller = new AbortController();
    let finish: (value: Response) => void = () => {};
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const client = createPublicTrackingApi(createApiClient({ baseUrl: base, fetch: fetcher }));
    const request = client.getPublicTracking(number, controller.signal);
    const rejection = expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher.mock.calls[0][1]?.signal).toBe(controller.signal);
    controller.abort();
    finish(Response.json(envelope()));
    await rejection;
    await expect(client.getPublicTracking(number, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
