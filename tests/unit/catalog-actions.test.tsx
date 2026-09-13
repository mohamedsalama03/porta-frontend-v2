import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api/client';
import { createQueryClient } from '@/lib/query/client';
import { ApiError } from '@/lib/api/errors';
import { CatalogCreateAction, CatalogEditAction } from '@/features/catalog';
import type { CatalogRecord } from '@/features/catalog/model';

const { subject } = vi.hoisted(() => ({ subject: { permissions: ['cities.manage'] } }));
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ user: subject }) }));
vi.mock('@/lib/config', () => ({
  config: { apiBaseUrl: null, loginPath: null, logoutPath: null },
}));

const city = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  name_ar: 'مدينة اختبار',
  name_en: 'Test City',
  code: 'TEST',
  active: true,
};

beforeEach(() => {
  subject.permissions = ['cities.manage'];
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});

describe('catalog form actions using mocked API calls only', () => {
  it.each(['pricing', 'branches'] as const)(
    'preserves saved %s references when asynchronous options replace the current-selection placeholders',
    async (module) => {
      subject.permissions = ['pricing.manage', 'cities.manage'];
      const destination = { ...city, id: '01ARZ3NDEKTSV4RRFFQ69G5FAW', name_ar: 'وجهة اختبار' };
      const shipmentType = { ...city, id: '01ARZ3NDEKTSV4RRFFQ69G5FAX', name_ar: 'نوع اختبار' };
      const record: CatalogRecord =
        module === 'pricing'
          ? {
              module,
              data: {
                id: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
                origin_city_id: city.id,
                destination_city_id: destination.id,
                shipment_type_id: shipmentType.id,
                shipment_size: 'SMALL',
                base_price: 1235,
                door_delivery_surcharge: 100,
                currency: 'LYD',
                minor_unit_scale: 3,
                active: true,
                effective_from: '2026-09-13T08:00:00+02:00',
                effective_until: null,
              },
            }
          : {
              module,
              data: {
                id: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
                city_id: city.id,
                name: 'فرع اختبار',
                address: 'عنوان اختبار',
                phone: null,
                active: true,
              },
            };
      const pending = new Map<string, (value: unknown) => void>();
      const request = vi.spyOn(api, 'request').mockImplementation((path) => {
        if (path.startsWith('/api/v1/admin/'))
          return Promise.resolve({ data: { ...record.data, active: false } });
        return new Promise((resolve) => {
          pending.set(path, resolve);
        });
      });
      const client = createQueryClient();
      render(
        <QueryClientProvider client={client}>
          <CatalogEditAction record={record} />
        </QueryClientProvider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'تعديل' }));
      const references =
        module === 'pricing'
          ? [
              screen.getByLabelText(/مدينة الانطلاق/),
              screen.getByLabelText(/مدينة الوصول/),
              screen.getByLabelText(/نوع الشحنة/),
            ]
          : [screen.getByLabelText(/المدينة/)];
      const expected =
        module === 'pricing' ? [city.id, destination.id, shipmentType.id] : [city.id];
      references.forEach((select, index) => expect(select).toHaveValue(expected[index]));
      await act(async () => {
        pending.get('/api/v1/cities')?.({ data: [city, destination] });
        pending.get('/api/v1/shipment-types')?.({ data: [shipmentType] });
      });
      await waitFor(() => references.forEach((select) => expect(select).toBeEnabled()));
      expect(references.map((select) => (select as HTMLSelectElement).value)).toEqual(expected);
      fireEvent.change(screen.getByLabelText('الحالة'), { target: { value: 'false' } });
      fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      const write = request.mock.calls.find(([, options]) => options.method === 'PATCH');
      expect(write?.[1].body).toEqual({ active: false });
      client.clear();
    },
  );

  it('waits for both catalog Retry-After deadlines before a combined options retry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T12:00:00Z'));
    subject.permissions = ['pricing.manage'];
    const request = vi
      .spyOn(api, 'request')
      .mockRejectedValueOnce(new ApiError({ status: 429, retryAfter: 1_000 }))
      .mockRejectedValueOnce(new ApiError({ status: 429, retryAfter: 3_000 }))
      .mockResolvedValue({
        data: [],
        meta: {},
        request_id: '123e4567-e89b-42d3-a456-426614174000',
      });
    const client = createQueryClient();
    // Exercise the explicit combined retry independently from the query retry policy.
    client.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });
    const view = render(
      <QueryClientProvider client={client}>
        <CatalogCreateAction module="pricing" />
      </QueryClientProvider>,
    );
    try {
      fireEvent.click(screen.getByRole('button', { name: 'إضافة تسعيرة' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      const retry = screen.getByRole('button', { name: /إعادة تحميل الخيارات/ });
      expect(request.mock.calls.map(([path]) => path)).toEqual([
        '/api/v1/cities',
        '/api/v1/shipment-types',
      ]);
      expect(retry).toBeDisabled();
      fireEvent.click(retry);
      expect(request).toHaveBeenCalledTimes(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
      expect(retry).toBeDisabled();
      fireEvent.click(retry);
      expect(request).toHaveBeenCalledTimes(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });
      expect(request).toHaveBeenCalledTimes(2);
      expect(retry).toBeEnabled();
      fireEvent.click(retry);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(request.mock.calls.map(([path]) => path)).toEqual([
        '/api/v1/cities',
        '/api/v1/shipment-types',
        '/api/v1/cities',
        '/api/v1/shipment-types',
      ]);
      expect(
        screen.queryByRole('button', { name: /إعادة تحميل الخيارات/ }),
      ).not.toBeInTheDocument();
    } finally {
      view.unmount();
      client.clear();
      vi.useRealTimers();
    }
  });

  it('restores focus to the trigger when the dialog closes', () => {
    render(
      <QueryClientProvider client={createQueryClient()}>
        <CatalogCreateAction module="cities" />
      </QueryClientProvider>,
    );
    const trigger = screen.getByRole('button', { name: 'إضافة مدينة' });
    trigger.focus();
    fireEvent.click(trigger);
    screen.getByLabelText(/الاسم بالعربية/).focus();
    fireEvent.click(screen.getAllByRole('button', { name: 'إغلاق' })[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('hides creation from users lacking the operation permission', () => {
    subject.permissions = ['cities.view'];
    render(
      <QueryClientProvider client={createQueryClient()}>
        <CatalogCreateAction module="cities" />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole('button', { name: 'إضافة مدينة' })).not.toBeInTheDocument();
  });

  it('validates required inputs, sends exact entered fields, and invalidates only affected cache', async () => {
    const request = vi.spyOn(api, 'request').mockResolvedValue({
      data: city,
      meta: {},
      request_id: '123e4567-e89b-42d3-a456-426614174000',
    });
    const client = createQueryClient();
    client.setQueryData(['unrelated-private-resource'], { keep: true });
    const onSuccess = vi.fn();
    render(
      <QueryClientProvider client={client}>
        <CatalogCreateAction module="cities" onSuccess={onSuccess} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'إضافة مدينة' }));
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    await waitFor(() =>
      expect(screen.getByLabelText(/الاسم بالعربية/)).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(request).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/الاسم بالعربية/), { target: { value: city.name_ar } });
    fireEvent.change(screen.getByLabelText(/الاسم بالإنجليزية/), {
      target: { value: city.name_en },
    });
    fireEvent.change(screen.getByLabelText(/رمز المدينة/), { target: { value: city.code } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(request).toHaveBeenCalledWith(
      '/api/v1/admin/cities',
      expect.objectContaining({
        method: 'POST',
        body: { name_ar: city.name_ar, name_en: city.name_en, code: city.code },
      }),
    );
    expect(client.getQueryData(['unrelated-private-resource'])).toEqual({ keep: true });
  });

  it('edits only a changed active state and preserves the same action when retrying', async () => {
    const request = vi
      .spyOn(api, 'request')
      .mockRejectedValueOnce(new ApiError({ code: 'network' }))
      .mockResolvedValueOnce({
        data: { ...city, active: false },
        meta: {},
        request_id: '123e4567-e89b-42d3-a456-426614174000',
      });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <CatalogEditAction record={{ module: 'cities', data: city }} />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'تعديل' }));
    fireEvent.change(screen.getByLabelText('الحالة'), { target: { value: 'false' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('الحالة')).toBeDisabled();
    const initial = request.mock.calls[0]?.[1];
    fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة نفسها' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      body: { active: false },
      idempotencyKey: initial?.idempotencyKey,
    });
  });
});
