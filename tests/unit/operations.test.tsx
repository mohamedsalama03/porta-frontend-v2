import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import {
  getAdminDriversQuerySchema,
  getAdminReportsQuerySchema,
  type Audit,
  type Report,
} from '@/lib/api/generated';
import { api } from '@/lib/api/client';
import {
  parseUrlQuery,
  queryString,
  mapAuditRow,
  mapDriverRow,
  activeCell,
} from '@/features/operations/model';
import { readOperations } from '@/features/operations/api';
import { OperationsTable, Pagination } from '@/features/operations/shared';
import { reportMetrics, businessToday } from '@/features/operations/reports';
import { OperationsList } from '@/features/operations/list';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/reports',
}));
const authState = vi.hoisted(() => ({
  user: null as { name: string; email: string; permissions: string[] } | null,
}));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: authState.user }) }));
vi.mock('@/lib/config', () => ({ config: { apiBaseUrl: 'http://localhost:8080' } }));
const identifier = '01K4XP3KD1QE7FDJT62DNW7HR9';
const names = { cities: new Map<string, string>(), types: new Map<string, string>() };
afterEach(() => {
  authState.user = null;
  vi.restoreAllMocks();
});

describe('live list authority and reference refresh', () => {
  it('never fetches protected rows for an unauthorized user', () => {
    const request = vi.spyOn(api, 'request');
    render(
      <QueryClientProvider client={new QueryClient()}>
        <OperationsList module="trips" />
      </QueryClientProvider>,
    );
    expect(screen.getByText('هذه الصفحة غير متاحة لحسابك')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
  it('replaces cached city labels when the catalog revision changes', async () => {
    authState.user = {
      name: 'مشغّل',
      email: 'operator@example.test',
      permissions: ['cities.manage'],
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const originalTime = Date.now();
    client.setQueryData(
      ['catalog', 'display-names'],
      { cities: new Map([[identifier, 'الاسم السابق']]), types: new Map() },
      { updatedAt: originalTime },
    );
    const request = vi.spyOn(api, 'request').mockResolvedValue({
      data: [
        {
          id: identifier,
          city_id: identifier,
          name: 'فرع الاختبار',
          address: 'عنوان الفرع',
          phone: null,
          active: true,
        },
      ],
      meta: { page: 1, last_page: 1, total: 1 },
      request_id: '48a260c9-18c6-4d91-bacb-b70c77b0274f',
    });
    render(
      <QueryClientProvider client={client}>
        <OperationsList module="branches" />
      </QueryClientProvider>,
    );
    await screen.findByText('الاسم السابق');
    await act(async () => {
      client.setQueryData(
        ['catalog', 'display-names'],
        { cities: new Map([[identifier, 'الاسم المحدّث']]), types: new Map() },
        { updatedAt: originalTime + 1 },
      );
    });
    await screen.findByText('الاسم المحدّث');
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('الاسم السابق')).not.toBeInTheDocument();
  });
});

describe('operation query boundaries', () => {
  it('keeps cursor opaque and accepts false without coercing it to true', () => {
    const parsed = parseUrlQuery(
      getAdminDriversQuerySchema,
      new URLSearchParams('active=false&per_page=25&cursor=a%2Bb%2Fc%3D'),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.active).toBe(false);
      expect(queryString(parsed.data)).toBe('?active=false&cursor=a%2Bb%2Fc%3D&per_page=25');
    }
  });
  it('rejects repeated, unknown, and invalid pagination filters', () => {
    expect(
      parseUrlQuery(getAdminDriversQuerySchema, new URLSearchParams('active=true&active=false'))
        .success,
    ).toBe(false);
    expect(
      parseUrlQuery(getAdminDriversQuerySchema, new URLSearchParams('per_page=1000')).success,
    ).toBe(false);
    expect(
      parseUrlQuery(getAdminDriversQuerySchema, new URLSearchParams('sort=name')).success,
    ).toBe(false);
    expect(
      parseUrlQuery(getAdminReportsQuerySchema, new URLSearchParams('from=not-a-date')).success,
    ).toBe(false);
  });
  it('passes validated filters and cancellation through the central client', async () => {
    const request = vi.spyOn(api, 'request').mockResolvedValueOnce({
      data: [],
      meta: { next_cursor: 'opaque-token' },
      request_id: '48a260c9-18c6-4d91-bacb-b70c77b0274f',
    });
    const controller = new AbortController();
    const result = await readOperations(
      'drivers',
      { active: false, cursor: 'a+b' },
      controller.signal,
      names,
    );
    expect(request).toHaveBeenCalledWith(
      '/api/v1/admin/drivers?active=false&cursor=a%2Bb',
      expect.objectContaining({ signal: controller.signal }),
    );
    expect(result.meta).toEqual({ next_cursor: 'opaque-token' });
    request.mockRestore();
  });
});

describe('curated operational display', () => {
  it('does not expose audit snapshots, actor identifiers, metadata, or raw server type names', () => {
    const audit: Audit = {
      id: identifier,
      actor_id: identifier,
      action: 'shipment.updated',
      entity_type: 'App\\Models\\Shipment',
      entity_id: identifier,
      before: '{"secret":"before-private"}',
      after: '{"secret":"after-private"}',
      metadata: '{"token":"private-token"}',
      created_at: '2026-09-13T10:00:00Z',
    };
    const row = mapAuditRow(audit);
    const displayed = JSON.stringify(row.cells);
    expect(displayed).toContain('تحديث');
    expect(displayed).toContain('شحنة');
    for (const privateValue of [
      identifier,
      'before-private',
      'after-private',
      'private-token',
      'App\\Models',
    ])
      expect(displayed).not.toContain(privateValue);
  });
  it('keeps an absent active property distinct from inactive', () => {
    expect(activeCell(undefined).text).toBe('غير محدد');
    expect(activeCell(false).text).toBe('غير نشط');
  });
  it('shows readable driver data and uses only the approved detail route', () => {
    const row = mapDriverRow({
      id: identifier,
      full_name: 'سائق الاختبار',
      phone: '+218911234567',
      license_number: null,
      user_id: identifier,
      active: true,
    });
    render(
      <OperationsTable
        title="السائقون"
        columns={['السائق', 'الهاتف', 'الرخصة', 'الحالة', 'الإجراءات']}
        rows={[row]}
      />,
    );
    expect(screen.getByText('سائق الاختبار')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'التفاصيل' })).toHaveAttribute(
      'href',
      `/drivers/${identifier}`,
    );
    expect(screen.queryByText(identifier)).not.toBeInTheDocument();
  });
  it('uses server pagination tokens and disables unavailable previous pages', async () => {
    const change = vi.fn();
    render(
      <Pagination
        meta={{ next_cursor: 'opaque-server-token' }}
        count={25}
        busy={false}
        onChange={change}
      />,
    );
    expect(screen.getByRole('button', { name: 'السابق' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'التالي' }));
    expect(change).toHaveBeenCalledWith('cursor', 'opaque-server-token');
  });
});

describe('authoritative report metrics', () => {
  const report: Report = {
    from: '2026-09-01',
    to: '2026-09-13',
    generated_at: '2026-09-13T10:00:00Z',
    total_shipments: 18,
    delivered_shipments: 5,
    shipments_by_status: { DELIVERED: 5 },
    shipments_by_origin_city: {},
    shipments_by_destination_city: {},
    shipments_by_date: [{ date: '2026-09-13', total: 3 }],
    active_trips: 2,
    net_revenue: -1250,
    revenue_by_date: [],
    revenue_by_route: [],
    revenue_route_limit: 500,
    currency: 'LYD',
    minor_unit_scale: 3,
  };
  it('does not invent today counts when today is outside the report', () => {
    expect(reportMetrics(report, '2026-09-14')[1].value).toBe('—');
    expect(reportMetrics(report, '2026-09-13')[1].value).toBe('3');
    expect(reportMetrics(report)[0].value).toBe('18');
  });
  it('uses Tripoli business dates rather than browser local dates', () => {
    expect(businessToday(new Date('2026-09-12T23:30:00Z'))).toBe('2026-09-13');
  });
  it('renders negative net revenue as exact millimes', () => {
    expect(reportMetrics(report)[3].value).toMatch(/1[.,]250/);
    expect(reportMetrics(report)[3].value).toContain('-');
  });
});
