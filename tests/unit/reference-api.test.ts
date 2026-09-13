import { describe, expect, it, vi } from 'vitest';
import { createApiClient } from '@/lib/api/client';
import { readReferencePage } from '@/features/lookups/api';

vi.mock('@/lib/config', () => ({ config: { apiBaseUrl: null } }));
const branch = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  city_id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  name: 'فرع اختبار',
  address: 'عنوان اختبار',
  phone: null,
  active: true,
};
const requestId = '123e4567-e89b-42d3-a456-426614174000';

describe('bounded reference lookups using injected responses', () => {
  it('requests one validated branch page and propagates cancellation', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: [branch],
        meta: { page: 1, last_page: 3, total: 41 },
        request_id: requestId,
      }),
    );
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetch: fetcher });
    const controller = new AbortController();
    const result = await readReferencePage({
      kind: 'branch',
      position: {},
      subject: { permissions: ['cities.manage'] },
      signal: controller.signal,
      client,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/admin/branches?page=1&per_page=20',
      expect.objectContaining({ signal: controller.signal, method: 'GET' }),
    );
    expect(result.options).toEqual([{ value: branch.id, label: branch.name }]);
    expect(result.next).toEqual({ page: 2 });
    expect(result.previous).toBeNull();
  });

  it('uses only the provided server cursor for the requested driver page', async () => {
    const driver = {
      id: branch.id,
      full_name: 'سائق اختبار',
      phone: '0000000000',
      license_number: null,
      user_id: null,
      active: true,
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        data: [driver],
        meta: { next_cursor: 'following', previous_cursor: 'prior' },
        request_id: requestId,
      }),
    );
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetch: fetcher });
    const result = await readReferencePage({
      kind: 'driver',
      position: { cursor: 'page/+two' },
      subject: { permissions: ['drivers.view'] },
      client,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://api.example.test/api/v1/admin/drivers?cursor=page%2F%2Btwo&per_page=20',
    );
    expect(result.next).toEqual({ cursor: 'following' });
    expect(result.previous).toEqual({ cursor: 'prior' });
  });

  it('does not fetch when permission or query validation fails', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetch: fetcher });
    await expect(
      readReferencePage({
        kind: 'branch',
        position: {},
        subject: { permissions: ['users.manage'] },
        client,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      readReferencePage({
        kind: 'user',
        position: {},
        subject: { permissions: ['*', 'admin'] },
        client,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      readReferencePage({
        kind: 'driver',
        position: { page: 2 },
        subject: { permissions: ['drivers.view'] },
        client,
      }),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
