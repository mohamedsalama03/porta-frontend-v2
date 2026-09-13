import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { formatMoney } from '@/lib/formatters';
import { PublicOrderForm } from '@/features/public-order/form';

vi.mock('@/lib/api/client', () => ({ api: { request: vi.fn() } }));
const request = vi.mocked(api.request);
const origin = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  name_ar: 'مدينة الإرسال التجريبية',
  name_en: 'Origin Test',
  code: 'TEST-A',
};
const destination = {
  ...origin,
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  name_ar: 'مدينة الاستلام التجريبية',
  code: 'TEST-B',
};
const shipmentType = {
  ...origin,
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
  name_ar: 'نوع تجريبي',
  description: 'وصف النوع التجريبي',
};
const requestId = '123e4567-e89b-42d3-a456-426614174000';
const envelope = (data: unknown) => ({ data, meta: {}, request_id: requestId });
const quote = { calculated_price: 1000, final_price: 1235, currency: 'LYD', minor_unit_scale: 3 };
const created = {
  tracking_number: 'PTA-260913-TEST123456',
  current_status: 'RECEIVED',
  final_price: 1700,
  currency: 'LYD',
  minor_unit_scale: 3,
};
let clients: QueryClient[] = [];
let submit: () => Promise<unknown>;

function defaultRequests() {
  request.mockImplementation(async (path) => {
    if (path === '/api/v1/cities') return envelope([origin, destination]);
    if (path === '/api/v1/shipment-types') return envelope([shipmentType]);
    if (path === '/api/v1/quotes') return envelope(quote);
    if (path === '/api/v1/orders') return submit();
    throw new Error('Unexpected non-public request');
  });
}
function renderForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <PublicOrderForm />
    </QueryClientProvider>,
  );
}
function orderCalls() {
  return request.mock.calls.filter(([path]) => path === '/api/v1/orders');
}
async function fillForm() {
  await waitFor(() => expect(screen.getByLabelText('اسم المرسل')).toBeEnabled());
  for (const [label, value] of [
    ['اسم المرسل', 'مرسل اختبار'],
    ['هاتف المرسل', '0910000001'],
    ['اسم المستلم', 'مستلم اختبار'],
    ['هاتف المستلم', '0920000002'],
    ['مدينة الإرسال', origin.id],
    ['مدينة الاستلام', destination.id],
    ['نوع الشحنة', shipmentType.id],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await screen.findByText(formatMoney(1235), { normalizer: (text) => text });
}
async function prepareReview() {
  await fillForm();
  fireEvent.click(screen.getByRole('button', { name: 'مراجعة الطلب' }));
  await screen.findByRole('button', { name: 'تأكيد طلب الشحن' });
}
async function advance(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

beforeEach(() => {
  request.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
  submit = async () => envelope(created);
  defaultRequests();
});
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients = [];
  vi.useRealTimers();
});

describe('public order form with mocked public API responses only', () => {
  it('shows loading and genuine empty catalogs without enabling booking or inserting options', async () => {
    let resolveCities!: (value: unknown) => void;
    request.mockImplementation(async (path) =>
      path === '/api/v1/cities'
        ? new Promise((resolve) => {
            resolveCities = resolve;
          })
        : envelope([]),
    );
    renderForm();
    expect(screen.getByText('جارٍ تحميل المدن وأنواع الشحنات…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'مراجعة الطلب' })).toBeDisabled();
    await act(async () => resolveCities(envelope([])));
    expect(await screen.findByText('الحجز غير متاح حاليًا')).toBeInTheDocument();
    expect(screen.getByLabelText('مدينة الإرسال')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'مراجعة الطلب' })).toBeDisabled();
    expect(orderCalls()).toHaveLength(0);
    expect(
      request.mock.calls.some(([path]) => path.includes('/admin') || path.includes('/auth')),
    ).toBe(false);
  });

  it('focuses the first required field and preserves entered data through validation', async () => {
    renderForm();
    await waitFor(() => expect(screen.getByLabelText('اسم المرسل')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('هاتف المستلم'), { target: { value: '0920000002' } });
    fireEvent.click(screen.getByRole('button', { name: 'مراجعة الطلب' }));
    await waitFor(() => expect(screen.getByLabelText('اسم المرسل')).toHaveFocus());
    expect(screen.getByText('راجع الحقول التالية لإكمال الطلب:')).toBeInTheDocument();
    expect(screen.getByLabelText('هاتف المستلم')).toHaveValue('0920000002');
    expect(orderCalls()).toHaveLength(0);
  });

  it('maps a definitive 422 to the correct field, focuses it and permits a corrected new attempt', async () => {
    let attempt = 0;
    submit = async () => {
      if (++attempt === 1)
        throw new ApiError({
          status: 422,
          requestId,
          validationErrors: { sender_phone: ['private server message'], branch_id: ['internal'] },
        });
      return envelope(created);
    };
    renderForm();
    await prepareReview();
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد طلب الشحن' }));
    await waitFor(() => expect(screen.getByLabelText('هاتف المرسل')).toHaveFocus());
    expect(screen.getByLabelText('هاتف المرسل')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('اسم المرسل')).toHaveValue('مرسل اختبار');
    expect(screen.queryByText('private server message')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('هاتف المرسل'), { target: { value: '0930000003' } });
    fireEvent.click(screen.getByRole('button', { name: 'مراجعة الطلب' }));
    fireEvent.click(await screen.findByRole('button', { name: 'تأكيد طلب الشحن' }));
    await screen.findByRole('heading', { name: 'تم تسجيل طلب الشحن' });
    expect(orderCalls()).toHaveLength(2);
    expect(orderCalls()[1][1].idempotencyKey).not.toBe(orderCalls()[0][1].idempotencyKey);
    expect(orderCalls()[1][1].body).toMatchObject({ sender_phone: '0930000003' });
  });

  it.each([409, 500])(
    'locks the original %i attempt, deduplicates clicks and retries the same key/body',
    async (status) => {
      let attempt = 0;
      let resolveRetry!: (value: unknown) => void;
      submit = async () => {
        if (++attempt === 1) throw new ApiError({ status, requestId });
        return new Promise((resolve) => {
          resolveRetry = resolve;
        });
      };
      renderForm();
      await prepareReview();
      fireEvent.click(screen.getByRole('button', { name: 'تأكيد طلب الشحن' }));
      const retry = await screen.findByRole('button', { name: 'إعادة المحاولة' });
      expect(screen.getByLabelText('اسم المرسل')).toBeDisabled();
      expect(screen.getByLabelText('اسم المرسل')).toHaveValue('مرسل اختبار');
      expect(screen.queryByRole('button', { name: /تعديل البيانات/ })).not.toBeInTheDocument();
      if (status === 409) {
        expect(
          screen.getByText('تعذّر تنفيذ الطلب بسبب تعارض. راجع البيانات قبل المحاولة مجددًا.'),
        ).toBeInTheDocument();
        expect(screen.queryByText(/مستخدم آخر/)).not.toBeInTheDocument();
      }
      fireEvent.click(retry);
      fireEvent.click(retry);
      await waitFor(() => expect(orderCalls()).toHaveLength(2));
      expect(orderCalls()[1][1].body).toEqual(orderCalls()[0][1].body);
      expect(orderCalls()[1][1].idempotencyKey).toBe(orderCalls()[0][1].idempotencyKey);
      await act(async () => resolveRetry(envelope(created)));
      await screen.findByRole('heading', { name: 'تم تسجيل طلب الشحن' });
      expect(orderCalls()).toHaveLength(2);
    },
  );

  it('waits for an order Retry-After deadline without automatically submitting again', async () => {
    let attempt = 0;
    submit = async () => {
      if (++attempt === 1) throw new ApiError({ status: 429, retryAfter: 2000 });
      return envelope(created);
    };
    renderForm();
    await prepareReview();
    vi.useFakeTimers();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'تأكيد طلب الشحن' })));
    const retry = screen.getByRole('button', { name: 'إعادة المحاولة' });
    expect(retry).toBeDisabled();
    await advance(1999);
    expect(retry).toBeDisabled();
    expect(orderCalls()).toHaveLength(1);
    await advance(1);
    expect(retry).toBeEnabled();
    expect(orderCalls()).toHaveLength(1);
    await act(async () => fireEvent.click(retry));
    expect(orderCalls()).toHaveLength(2);
    expect(orderCalls()[1][1].idempotencyKey).toBe(orderCalls()[0][1].idempotencyKey);
  });

  it('honors both catalog rate-limit deadlines before a combined recovery request', async () => {
    vi.useFakeTimers();
    const counts = new Map<string, number>();
    request.mockImplementation(async (path) => {
      const count = (counts.get(path) ?? 0) + 1;
      counts.set(path, count);
      if (count === 1)
        throw new ApiError({ status: 429, retryAfter: path.endsWith('/cities') ? 1000 : 3000 });
      return envelope(path.endsWith('/cities') ? [origin, destination] : [shipmentType]);
    });
    renderForm();
    await advance(0);
    const retry = screen.getByRole('button', { name: 'إعادة تحميل الخيارات' });
    expect(retry).toBeDisabled();
    await advance(1000);
    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(request).toHaveBeenCalledTimes(2);
    await advance(2000);
    expect(retry).toBeEnabled();
    await act(async () => fireEvent.click(retry));
    await advance(0);
    expect(request).toHaveBeenCalledTimes(4);
    expect(screen.getByLabelText('اسم المرسل')).toBeEnabled();
  });

  it('shows the authoritative creation price, announces copy results and never persists PII or resubmits on refresh', async () => {
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    const clipboard = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboard },
    });
    const first = renderForm();
    await prepareReview();
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد طلب الشحن' }));
    const heading = await screen.findByRole('heading', { name: 'تم تسجيل طلب الشحن' });
    expect(heading).toHaveFocus();
    expect(screen.getByText(created.tracking_number)).toBeInTheDocument();
    expect(screen.getByText(formatMoney(1700), { normalizer: (text) => text })).toBeInTheDocument();
    expect(
      screen.queryByText(formatMoney(1235), { normalizer: (text) => text }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'نسخ رقم التتبع' }));
    expect(await screen.findByText('تم نسخ رقم التتبع.')).toBeInTheDocument();
    expect(clipboard).toHaveBeenCalledWith(created.tracking_number);
    clipboard.mockRejectedValueOnce(new Error('clipboard unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'نسخ رقم التتبع' }));
    expect(
      await screen.findByText('تعذّر النسخ. حدّد رقم التتبع وانسخه يدويًا.'),
    ).toBeInTheDocument();
    expect(storageWrite.mock.calls).toEqual([['porta-public-order-confirmed', 'yes']]);
    expect(window.localStorage.length).toBe(0);
    first.unmount();
    renderForm();
    expect(await screen.findByRole('heading', { name: 'سبق تأكيد طلب الشحن' })).toBeInTheDocument();
    expect(screen.queryByText(created.tracking_number)).not.toBeInTheDocument();
    expect(orderCalls()).toHaveLength(1);
  });
});
