import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@/lib/api/client';
import { createPublicOrderApi } from '@/features/public-order/api';
import type { PublicOrderPayload, PublicOrderQuoteInput } from '@/features/public-order/schema';

vi.mock('@/lib/config', () => ({ config: { apiBaseUrl: null } }));

// Generated-contract fixtures for injected fetch only; not live customer records.
const base = 'https://api.example.test';
const requestId = '123e4567-e89b-42d3-a456-426614174000';
const city = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  name_ar: 'مدينة اختبار',
  name_en: 'Test City',
  code: 'TEST',
};
const type = { ...city, id: '01ARZ3NDEKTSV4RRFFQ69G5FAX', description: 'نوع اختبار' };
const quote: PublicOrderQuoteInput = {
  origin_city_id: city.id,
  destination_city_id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  shipment_type_id: type.id,
  shipment_size: 'SMALL',
  delivery_method: 'OFFICE_PICKUP',
};
const body: PublicOrderPayload = {
  ...quote,
  sender_name: 'مرسل اختبار',
  sender_phone: '0910000001',
  recipient_name: 'مستلم اختبار',
  recipient_phone: '0920000002',
  payment_method: 'CASH_ON_DELIVERY',
  notes: 'طلب تجريبي',
};
const price = { calculated_price: 1235, final_price: 1335, currency: 'LYD', minor_unit_scale: 3 };
const created = {
  tracking_number: 'PTA-260913-TEST123456',
  current_status: 'RECEIVED',
  final_price: 1335,
  currency: 'LYD',
  minor_unit_scale: 3,
};
const envelope = (data: unknown) => ({ data, meta: {}, request_id: requestId });

afterEach(() => vi.useRealTimers());

describe('public order generated-contract transport', () => {
  it('validates public catalogs, quote and creation through CSRF without any admin or identity request', async () => {
    let cookie = '';
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === '/sanctum/csrf-cookie') {
        cookie = 'XSRF-TOKEN=test%2Bcsrf%3D';
        return new Response(null, { status: 204 });
      }
      const data = path.endsWith('/cities')
        ? [city]
        : path.endsWith('/shipment-types')
          ? [type]
          : path.endsWith('/quotes')
            ? price
            : created;
      return Response.json(envelope(data), { status: path.endsWith('/orders') ? 201 : 200 });
    });
    const client = createPublicOrderApi(
      createApiClient({ baseUrl: base, fetch: fetcher, readCookie: () => cookie }),
    );
    expect((await client.getPublicOrderCities()).data).toEqual([city]);
    expect((await client.getPublicOrderTypes()).data).toEqual([type]);
    expect((await client.requestPublicOrderQuote(quote)).data).toEqual(price);
    expect((await client.createPublicOrderAction(body).run()).data).toEqual(created);
    expect(fetcher.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/api/v1/cities',
      '/api/v1/shipment-types',
      '/sanctum/csrf-cookie',
      '/api/v1/quotes',
      '/api/v1/orders',
    ]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.credentials).toBe('include');
      expect(init?.cache).toBe('no-store');
      expect(new Headers(init?.headers).has('Authorization')).toBe(false);
      if (init?.method === 'POST')
        expect(new Headers(init.headers).get('X-XSRF-TOKEN')).toBe('test+csrf=');
    }
  });

  it('accepts genuinely empty public catalogs and rejects unapproved response shapes', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(envelope([])))
      .mockResolvedValueOnce(Response.json(envelope([])))
      .mockResolvedValueOnce(Response.json(envelope({ ...price, final_price: 1.235 })))
      .mockResolvedValueOnce(Response.json(envelope({ ...created, id: city.id }), { status: 201 }));
    const client = createPublicOrderApi(
      createApiClient({ baseUrl: base, fetch: fetcher, readCookie: () => 'XSRF-TOKEN=csrf' }),
    );
    expect((await client.getPublicOrderCities()).data).toEqual([]);
    expect((await client.getPublicOrderTypes()).data).toEqual([]);
    await expect(client.requestPublicOrderQuote(quote)).rejects.toMatchObject({
      code: 'invalid_response',
    });
    await expect(client.createPublicOrderAction(body).run()).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('keeps one immutable request and key across duplicate clicks and a controlled transport retry', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('private network detail'))
      .mockResolvedValueOnce(Response.json(envelope(created), { status: 201 }));
    const client = createPublicOrderApi(
      createApiClient({ baseUrl: base, fetch: fetcher, readCookie: () => 'XSRF-TOKEN=csrf' }),
    );
    const input = { ...body };
    const action = client.createPublicOrderAction(input);
    const first = action.run();
    expect(action.run()).toBe(first);
    await expect(first).rejects.toMatchObject({ code: 'network' });
    input.sender_name = 'تغيير بعد الإرسال';
    await action.run();
    await action.run();
    expect(fetcher).toHaveBeenCalledTimes(2);
    const sentBodies = fetcher.mock.calls.map(([, init]) => init?.body);
    expect(sentBodies[1]).toBe(sentBodies[0]);
    expect(sentBodies.map((value) => JSON.parse(String(value)))).toEqual([body, body]);
    expect(
      fetcher.mock.calls.map(([, init]) => new Headers(init?.headers).get('Idempotency-Key')),
    ).toEqual([action.key, action.key]);
    expect(fetcher.mock.calls.every(([, init]) => init?.signal === undefined)).toBe(true);
  });

  it('honors Retry-After on explicit same-key retries without scheduling an order automatically', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T12:00:00Z'));
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ request_id: requestId }, { status: 429, headers: { 'Retry-After': '10' } }),
      )
      .mockResolvedValueOnce(Response.json(envelope(created), { status: 201 }));
    const client = createPublicOrderApi(
      createApiClient({ baseUrl: base, fetch: fetcher, readCookie: () => 'XSRF-TOKEN=csrf' }),
    );
    const action = client.createPublicOrderAction(body);
    await expect(action.run()).rejects.toMatchObject({ status: 429, retryAfter: 10000 });
    await expect(action.run()).rejects.toMatchObject({ status: 429 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await action.run();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(new Headers(fetcher.mock.calls[1][1]?.headers).get('Idempotency-Key')).toBe(action.key);
  });

  it('rejects private/price injection and suppresses staff expiry events for public failures', async () => {
    const onUnauthorized = vi.fn();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ request_id: requestId }, { status: 401 }));
    const client = createPublicOrderApi(
      createApiClient({
        baseUrl: base,
        fetch: fetcher,
        onUnauthorized,
        readCookie: () => 'XSRF-TOKEN=csrf',
      }),
    );
    expect(() =>
      client.createPublicOrderAction({ ...body, branch_id: city.id } as PublicOrderPayload),
    ).toThrow();
    expect(() =>
      client.createPublicOrderAction({ ...body, final_price: 1 } as PublicOrderPayload),
    ).toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await expect(client.getPublicOrderCities()).rejects.toMatchObject({ status: 401 });
    await expect(client.requestPublicOrderQuote(quote)).rejects.toMatchObject({ status: 401 });
    await expect(client.createPublicOrderAction(body).run()).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('projects quote-only fields and forwards cancellation only to public reads/quotes', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(envelope(price)));
    const client = createPublicOrderApi(
      createApiClient({ baseUrl: base, fetch: fetcher, readCookie: () => 'XSRF-TOKEN=csrf' }),
    );
    const controller = new AbortController();
    await client.requestPublicOrderQuote(
      { ...quote, sender_phone: 'private', final_price: 1 } as PublicOrderQuoteInput,
      controller.signal,
    );
    expect(fetcher.mock.calls[0][1]?.body).toBe(JSON.stringify(quote));
    expect(fetcher.mock.calls[0][1]?.signal).toBe(controller.signal);
    controller.abort();
    await expect(client.requestPublicOrderQuote(quote, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
