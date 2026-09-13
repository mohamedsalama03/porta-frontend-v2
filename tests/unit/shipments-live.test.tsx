import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/client';
import {
  createShipmentAction,
  getShipments,
  parseShipmentFilters,
  updateShipmentFilters,
} from '@/features/shipments/api';
import { shipmentToViewModel } from '@/features/shipments/mappers';
import { ShipmentCreateLive } from '@/features/shipments/shipment-create-live';
import type { Shipment, ShipmentInput } from '@/lib/api/generated';
import { createPaymentAction } from '@/features/payments/payment-api';
import { PaymentActions } from '@/features/payments/payment-actions';

vi.mock('@/lib/api/client', () => ({ api: { request: vi.fn() } }));
const auth = vi.hoisted(() => ({ permissions: [] as string[], push: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { permissions: auth.permissions },
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: auth.push }) }));

const originId = '01M25A1F9VJ0H19PAAQN5R7P9Q';
const destinationId = '01M25A1F9VJ0H19PAAQN5R7P9R';
const typeId = '01M25A1F9VJ0H19PAAQN5R7P9S';
const requestId = 'fb5a4c00-b0ef-41e3-8878-53485cf3b63b';
const body: ShipmentInput = {
  sender_name: 'اسم اختبار',
  sender_phone: '+218911234567',
  recipient_name: 'مستلم اختبار',
  recipient_phone: '+218921234567',
  origin_city_id: originId,
  destination_city_id: destinationId,
  shipment_type_id: typeId,
  shipment_size: 'SMALL',
  delivery_method: 'OFFICE_PICKUP',
};
const shipment: Shipment = {
  ...body,
  weight: undefined,
  id: '01M25A1F9VJ0H19PAAQN5R7P9T',
  tracking_number: 'PTA-260913-TEST01',
  calculated_price: 10000,
  final_price: 12345,
  currency: 'LYD',
  payment_status: 'PENDING',
  current_status: 'RECEIVED',
};
const result = { data: shipment, meta: {}, request_id: requestId };
const paymentResult = {
  data: {
    id: '01M25A1F9VJ0H19PAAQN5R7P9V',
    shipment_id: shipment.id,
    from_status: 'PAID',
    status: 'REFUNDED',
    kind: 'REFUND',
    amount: -12345,
    currency: 'LYD',
    minor_unit_scale: 3,
    payment_method: 'CASH_ON_DELIVERY',
    external_reference: 'test-reference',
    notes: null,
    created_at: '2026-09-13T14:00:00+02:00',
  },
  meta: {},
  request_id: requestId,
};
const request = vi.mocked(api.request);
let client: QueryClient | undefined;

beforeEach(() => {
  request.mockReset();
  auth.push.mockReset();
  auth.permissions = ['shipments.view', 'shipments.create', 'shipments.update', 'payments.manage'];
});
afterEach(() => {
  client?.clear();
  vi.useRealTimers();
});

describe('approved shipment contract integration', () => {
  it('waits for both failed catalogs and for a failed quote before allowing their explicit retries', async () => {
    vi.useFakeTimers();
    const counts = new Map<string, number>();
    request.mockImplementation(async (path) => {
      const count = (counts.get(path) ?? 0) + 1;
      counts.set(path, count);
      if (path === '/api/v1/cities') {
        if (count === 1) throw new ApiError({ status: 429, retryAfter: 1_000 });
        return {
          data: [
            { id: originId, name_ar: 'طرابلس', name_en: 'Tripoli', code: 'TIP' },
            { id: destinationId, name_ar: 'بنغازي', name_en: 'Benghazi', code: 'BEN' },
          ],
          meta: {},
          request_id: requestId,
        };
      }
      if (path === '/api/v1/shipment-types') {
        if (count === 1) throw new ApiError({ status: 429, retryAfter: 3_000 });
        return {
          data: [{ id: typeId, name_ar: 'طرد', name_en: 'Parcel', code: 'PARCEL' }],
          meta: {},
          request_id: requestId,
        };
      }
      if (path === '/api/v1/quotes') {
        if (count === 1) throw new ApiError({ status: 429, retryAfter: 2_000 });
        return {
          data: {
            calculated_price: 10000,
            final_price: 12345,
            currency: 'LYD',
            minor_unit_scale: 3,
          },
          meta: {},
          request_id: requestId,
        };
      }
      throw new Error(`Unexpected request ${path}`);
    });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ShipmentCreateLive />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const catalogRetry = screen.getByRole('button', { name: 'إعادة المحاولة' });
    expect(catalogRetry).toBeDisabled();
    expect(catalogRetry).toHaveAccessibleDescription(/3 ثانية/);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    fireEvent.click(catalogRetry);
    expect(request).toHaveBeenCalledTimes(2);
    expect(catalogRetry).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(catalogRetry).toBeEnabled();
    expect(request).toHaveBeenCalledTimes(2);
    fireEvent.click(catalogRetry);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(request).toHaveBeenCalledTimes(4);
    fireEvent.change(screen.getByRole('combobox', { name: 'مدينة الانطلاق' }), {
      target: { value: originId },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'مدينة الوصول' }), {
      target: { value: destinationId },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'نوع الشحنة' }), {
      target: { value: typeId },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'الحجم' }), {
      target: { value: 'SMALL' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(360);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    const quoteRetry = screen.getByRole('button', { name: 'إعادة طلب السعر' });
    expect(quoteRetry).toBeDisabled();
    expect(quoteRetry).toHaveAccessibleDescription(/2 ثانية/);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    fireEvent.click(quoteRetry);
    expect(counts.get('/api/v1/quotes')).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(quoteRetry).toBeEnabled();
    expect(counts.get('/api/v1/quotes')).toBe(1);
    fireEvent.click(quoteRetry);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(counts.get('/api/v1/quotes')).toBe(2);
    expect(counts.has('/api/v1/admin/shipments')).toBe(false);
  });

  it('keeps server cursor and documented filters without sending unrelated UI state', async () => {
    request.mockResolvedValue({ data: [], meta: { next_cursor: 'next' }, request_id: requestId });
    await getShipments(
      'search=abc&cursor=cursor%2Bopaque&per_page=25&panel=compact&sort=-created_at',
    );
    const [path, options] = request.mock.calls[0];
    const url = new URL(path, 'https://example.invalid');
    expect(url.pathname).toBe('/api/v1/admin/shipments');
    expect(url.searchParams.get('cursor')).toBe('cursor+opaque');
    expect(url.searchParams.get('per_page')).toBe('25');
    expect(url.searchParams.has('panel')).toBe(false);
    expect(options.method).toBeUndefined();
    expect(parseShipmentFilters('status=IN_TRANSIT&per_page=25')).toMatchObject({
      status: 'IN_TRANSIT',
      per_page: 25,
    });
  });

  it('rejects duplicate or invalid contract filters and clears cursor when filters change', () => {
    expect(() => parseShipmentFilters('status=RECEIVED&status=DELIVERED')).toThrow(ApiError);
    expect(() => parseShipmentFilters('search=ab')).toThrow(ApiError);
    expect(() => parseShipmentFilters('status=INVENTED')).toThrow(ApiError);
    const updated = new URLSearchParams(
      updateShipmentFilters('cursor=old&status=RECEIVED', { search: 'Test' }),
    );
    expect(updated.has('cursor')).toBe(false);
    expect(updated.get('status')).toBe('RECEIVED');
    expect(updated.get('search')).toBe('Test');
  });

  it('maps the authoritative final price and optional absent fields without fabricating events', () => {
    const view = shipmentToViewModel(shipment, [], []);
    expect(view.price).toMatch(/12[.,]345/);
    expect(view.createdLabel).toBe('غير متاح');
    expect(view.href).toBe(`/shipments/${shipment.id}`);
    expect(view).not.toHaveProperty('timeline');
  });

  it('retains the exact body and idempotency key for an uncertain create retry', async () => {
    request.mockRejectedValueOnce(new ApiError({ code: 'network' })).mockResolvedValueOnce(result);
    const draft = { ...body };
    const action = createShipmentAction(draft);
    draft.sender_name = 'changed after action';
    await expect(action.run()).rejects.toMatchObject({ code: 'network' });
    await expect(action.run()).resolves.toEqual(result);
    expect(request.mock.calls[0][1].body).toMatchObject({ sender_name: 'اسم اختبار' });
    expect(request.mock.calls[0][1].idempotencyKey).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
    expect(request.mock.calls[0][1].idempotencyKey).toBe(request.mock.calls[1][1].idempotencyKey);
    await action.run();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('leaves payment amounts to the backend and retries a confirmed payment with the same key', async () => {
    request
      .mockRejectedValueOnce(new ApiError({ status: 503 }))
      .mockResolvedValueOnce(paymentResult);
    const payment = createPaymentAction(shipment.id, {
      status: 'REFUNDED',
      external_reference: 'test-reference',
    });
    await expect(payment.run()).rejects.toMatchObject({ status: 503 });
    await payment.run();
    expect(request.mock.calls[0][0]).toBe(`/api/v1/admin/shipments/${shipment.id}/payments`);
    expect(request.mock.calls[0][1].body).toEqual({
      status: 'REFUNDED',
      external_reference: 'test-reference',
    });
    expect(request.mock.calls[0][1].body).not.toHaveProperty('amount');
    expect(request.mock.calls[1][1].idempotencyKey).toBe(request.mock.calls[0][1].idempotencyKey);
  });

  it('requires explicit review and confirmation before issuing any financial request', async () => {
    // jsdom has no native dialog methods. The browser suite covers native focus behavior.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.removeAttribute('open');
      },
    });
    try {
      request.mockResolvedValue(paymentResult);
      client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      render(
        <QueryClientProvider client={client}>
          <PaymentActions shipment={shipment} />
        </QueryClientProvider>,
      );
      const user = userEvent.setup();
      await user.selectOptions(
        screen.getByRole('combobox', { name: 'العملية المطلوبة' }),
        'REFUNDED',
      );
      await user.click(screen.getByRole('button', { name: 'مراجعة العملية' }));
      expect(request).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: 'تأكيد عملية الدفع' })).toBeVisible();
      await user.click(screen.getByRole('button', { name: 'تأكيد وتسجيل العملية' }));
      await waitFor(() => expect(request).toHaveBeenCalledOnce());
      expect(request.mock.calls[0][1].body).toMatchObject({ status: 'REFUNDED' });
      expect(request.mock.calls[0][1].body).not.toHaveProperty('amount');
    } finally {
      Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
      Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
    }
  });

  it.each([true, false])(
    'requires a fresh quote and handles confirmed creation with view permission %s',
    async (canView) => {
      if (!canView) auth.permissions = ['shipments.create'];
      request.mockImplementation(async (path) => {
        if (path === '/api/v1/cities')
          return {
            data: [
              { id: originId, name_ar: 'طرابلس', name_en: 'Tripoli', code: 'TIP' },
              { id: destinationId, name_ar: 'بنغازي', name_en: 'Benghazi', code: 'BEN' },
            ],
            meta: {},
            request_id: requestId,
          };
        if (path === '/api/v1/shipment-types')
          return {
            data: [{ id: typeId, name_ar: 'طرد', name_en: 'Parcel', code: 'PARCEL' }],
            meta: {},
            request_id: requestId,
          };
        if (path === '/api/v1/quotes')
          return {
            data: {
              calculated_price: 10000,
              final_price: 12345,
              currency: 'LYD',
              minor_unit_scale: 3,
            },
            meta: {},
            request_id: requestId,
          };
        if (path === '/api/v1/admin/shipments') return result;
        throw new Error(`Unexpected path ${path}`);
      });
      client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      client.setQueryData(['reports', {}], { cached: true });
      render(
        <QueryClientProvider client={client}>
          <ShipmentCreateLive />
        </QueryClientProvider>,
      );
      const user = userEvent.setup();
      const submit = screen.getByRole('button', { name: 'إنشاء الشحنة' });
      expect(submit).toBeDisabled();
      await screen.findAllByRole('option', { name: 'طرابلس' });
      await user.selectOptions(screen.getByRole('combobox', { name: 'مدينة الانطلاق' }), originId);
      await user.selectOptions(
        screen.getByRole('combobox', { name: 'مدينة الوصول' }),
        destinationId,
      );
      await user.selectOptions(screen.getByRole('combobox', { name: 'نوع الشحنة' }), typeId);
      await user.selectOptions(screen.getByRole('combobox', { name: 'الحجم' }), 'SMALL');
      await waitFor(() => expect(submit).toBeEnabled());
      expect(screen.getAllByText(/12[.,]345/).length).toBeGreaterThan(0);
      const quoteCall = request.mock.calls.find(([path]) => path === '/api/v1/quotes');
      expect(quoteCall?.[1].body).not.toHaveProperty('sender_name');
      expect(quoteCall?.[1].body).not.toHaveProperty('final_price');
      await user.selectOptions(screen.getByRole('combobox', { name: 'الحجم' }), 'LARGE');
      expect(submit).toBeDisabled();
      expect(
        request.mock.calls.filter(([path]) => path === '/api/v1/admin/shipments'),
      ).toHaveLength(0);
      await waitFor(() => expect(submit).toBeEnabled());
      await user.type(screen.getByRole('textbox', { name: 'اسم المرسل' }), body.sender_name);
      await user.type(screen.getByRole('textbox', { name: 'هاتف المرسل' }), body.sender_phone);
      await user.type(screen.getByRole('textbox', { name: 'اسم المستلم' }), body.recipient_name);
      await user.type(screen.getByRole('textbox', { name: 'هاتف المستلم' }), body.recipient_phone);
      await user.click(submit);
      await waitFor(() => expect(client?.getQueryState(['reports', {}])?.isInvalidated).toBe(true));
      expect(
        request.mock.calls.filter(([path]) => path === '/api/v1/admin/shipments'),
      ).toHaveLength(1);
      if (canView) {
        await waitFor(() => expect(auth.push).toHaveBeenCalledWith(`/shipments/${shipment.id}`));
      } else {
        expect(await screen.findByRole('status')).toHaveTextContent(shipment.tracking_number);
        expect(auth.push).not.toHaveBeenCalled();
        expect(screen.queryByRole('form', { name: 'إنشاء شحنة' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'إنشاء شحنة أخرى' }));
        expect(screen.getByRole('textbox', { name: 'اسم المرسل' })).toHaveValue('');
        expect(screen.getByRole('button', { name: 'إنشاء الشحنة' })).toBeDisabled();
        expect(
          request.mock.calls.filter(([path]) => path === '/api/v1/admin/shipments'),
        ).toHaveLength(1);
      }
    },
  );
});
