import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@/lib/api/client';
import { createCatalogAction } from '@/features/catalog/api';

vi.mock('@/lib/config', () => ({
  config: { apiBaseUrl: null, loginPath: null, logoutPath: null },
}));
const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const city = { name_ar: 'مدينة اختبار', name_en: 'Test City', code: 'TEST' };
const response = {
  data: { id, ...city },
  meta: {},
  request_id: '123e4567-e89b-42d3-a456-426614174000',
};

describe('approved catalog mutations with injected transport only', () => {
  it('keeps the original validated payload and key during controlled retry', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('Network interrupted'))
      .mockResolvedValueOnce(Response.json(response));
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      fetch: fetcher,
      readCookie: () => 'XSRF-TOKEN=csrf',
    });
    const payload = { ...city };
    const action = createCatalogAction({
      module: 'cities',
      payload,
      subject: { permissions: ['cities.manage'] },
      client,
    });
    await expect(action.run()).rejects.toMatchObject({ code: 'network' });
    payload.name_ar = 'Changed after submission';
    await action.run();
    expect(fetcher).toHaveBeenCalledTimes(2);
    const bodies = fetcher.mock.calls.map(([, init]) => init?.body);
    expect(bodies).toEqual([JSON.stringify(city), JSON.stringify(city)]);
    const keys = fetcher.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get('Idempotency-Key'),
    );
    expect(keys).toEqual([action.key, action.key]);
    expect(action.key).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
  });

  it('uses the approved PATCH path and does not replay unchanged fields', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ...response, data: { ...response.data, active: false } }));
    const client = createApiClient({
      baseUrl: 'https://api.example.test',
      fetch: fetcher,
      readCookie: () => 'XSRF-TOKEN=csrf',
    });
    await createCatalogAction({
      module: 'cities',
      id,
      payload: { active: false },
      subject: { permissions: ['cities.manage'] },
      client,
    }).run();
    expect(fetcher).toHaveBeenCalledWith(
      `https://api.example.test/api/v1/admin/cities/${id}`,
      expect.objectContaining({ method: 'PATCH', body: '{"active":false}' }),
    );
  });

  it('denies view-only permissions and invalid record references before creating a request', () => {
    expect(() =>
      createCatalogAction({
        module: 'pricing',
        payload: {},
        subject: { permissions: ['pricing.view'] },
      }),
    ).toThrow();
    expect(() =>
      createCatalogAction({
        module: 'shipment-types',
        payload: {},
        subject: { permissions: ['pricing.view'] },
      }),
    ).toThrow();
    expect(() =>
      createCatalogAction({
        module: 'cities',
        id: '../outside',
        payload: { active: false },
        subject: { permissions: ['cities.manage'] },
      }),
    ).toThrow();
  });
});
