import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { Driver, Trip } from '@/lib/api/generated';
import {
  attachShipmentsAction,
  detachShipmentAction,
  driverWriteAction,
} from '@/features/operations/mutations';
import {
  driverWritePayload,
  tripWritePayload,
  parseAttachmentInput,
  tripoliDateTime,
  localDateTimeValue,
} from '@/features/operations/write-model';
import {
  OperationEditButton,
  OperationsCreatePage,
  WriteFeedback,
} from '@/features/operations/editor';
import { TripShipmentsAction } from '@/features/operations/trip-shipments-action';

const auth = vi.hoisted(() => ({
  permissions: ['drivers.manage', 'trips.assign_shipments'] as string[],
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { name: 'اختبار', email: 'operator@example.test', permissions: auth.permissions },
  }),
}));
vi.mock('@/lib/config', () => ({ config: { apiBaseUrl: 'http://localhost:8080' } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const id = '01K4XP3KD1QE7FDJT62DNW7HR9';
const otherId = '01K4XP3KD1QE7FDJT62DNW7HR8';
const driver: Driver = {
  id,
  full_name: 'سائق مسجل',
  phone: '+218911234567',
  license_number: null,
  user_id: null,
  active: true,
};
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      {children}
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  auth.permissions = ['drivers.manage', 'trips.assign_shipments'];
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

describe('approved operation payloads', () => {
  it('sends only changed driver fields and preserves explicit inactive', () => {
    expect(
      driverWritePayload(
        {
          full_name: driver.full_name,
          phone: driver.phone,
          license_number: '',
          user_id: '',
          active: 'false',
        },
        driver,
      ),
    ).toEqual({ active: false });
    expect(
      driverWritePayload({
        full_name: 'جديد',
        phone: '0911234567',
        license_number: '',
        user_id: '',
        active: 'default',
      }),
    ).not.toHaveProperty('active');
  });
  it('uses explicit Tripoli offsets and leaves equivalent existing timestamps unchanged', () => {
    expect(tripoliDateTime('2026-09-13T14:30')).toBe('2026-09-13T14:30:00+02:00');
    expect(localDateTimeValue('2026-09-13T12:30:00Z')).toBe('2026-09-13T14:30');
    const trip: Trip = {
      id,
      origin_city_id: id,
      destination_city_id: otherId,
      driver_id: null,
      branch_id: null,
      departure_at: '2026-09-13T14:30:00+02:00',
      estimated_arrival_at: null,
      status: 'SCHEDULED',
    };
    expect(
      tripWritePayload(
        {
          origin_city_id: id,
          destination_city_id: otherId,
          driver_id: '',
          branch_id: '',
          departure_at: '2026-09-13T14:30',
          estimated_arrival_at: '',
        },
        trip,
      ),
    ).toEqual({});
  });
  it('rejects duplicate, empty, invalid, and oversized atomic attachment sets', () => {
    expect(parseAttachmentInput(`${id}\n${otherId}`)).toEqual({ shipment_ids: [id, otherId] });
    expect(() => parseAttachmentInput(`${id}\n${id}`)).toThrow();
    expect(() => parseAttachmentInput('')).toThrow();
    expect(() => parseAttachmentInput('unsafe/id')).toThrow();
    const ids = Array.from(
      { length: 201 },
      (_, index) => `01K4XP3KD1QE7FDJT62${index.toString(32).toUpperCase().padStart(8, '0')}`,
    );
    expect(() => parseAttachmentInput(ids.join('\n'))).toThrow();
  });
});

describe('write transport identity', () => {
  it('freezes a driver body and reuses its key after an uncertain failure', async () => {
    const request = vi
      .spyOn(api, 'request')
      .mockRejectedValueOnce(new ApiError({ code: 'network' }))
      .mockResolvedValueOnce({ data: { id } });
    const body = { full_name: 'الأول', phone: '0911234567' };
    const action = driverWriteAction(body);
    body.full_name = 'تعديل لاحق';
    await expect(action.run()).rejects.toBeInstanceOf(ApiError);
    await action.run();
    expect(request).toHaveBeenCalledTimes(2);
    const first = request.mock.calls[0][1];
    expect(first.body).toMatchObject({ full_name: 'الأول' });
    expect(first.idempotencyKey).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
    expect(request.mock.calls[1][1].idempotencyKey).toBe(first.idempotencyKey);
  });
  it('submits one atomic attachment request and a bodyless documented detach', async () => {
    const request = vi.spyOn(api, 'request').mockResolvedValue({ data: { id } });
    await attachShipmentsAction(id, { shipment_ids: [id, otherId] }).run();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe(`/api/v1/admin/trips/${id}/shipments`);
    expect(request.mock.calls[0][1].body).toEqual({ shipment_ids: [id, otherId] });
    await detachShipmentAction(id, otherId).run();
    expect(request.mock.calls[1][0]).toBe(`/api/v1/admin/trips/${id}/shipments/${otherId}`);
    expect(request.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
    expect(request.mock.calls[1][1].body).toBeUndefined();
  });
});

describe('deliberate write UI', () => {
  it('shows neutral conflict guidance and the support ID without claiming another user changed data or refresh succeeded', () => {
    const requestId = 'c7d81d01-00dc-4bbf-ab23-8d34dc5d39e2';
    render(<WriteFeedback failure={new ApiError({ status: 409, requestId })} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(
      'تعذّر تنفيذ العملية بسبب تعارض. راجع أحدث البيانات قبل المحاولة مجددًا.',
    );
    expect(alert).toHaveTextContent(`مرجع الدعم: ${requestId}`);
    expect(alert).not.toHaveTextContent('مستخدم آخر');
    expect(alert).not.toHaveTextContent('تم تحميل');
  });

  it('does not offer writes without exact permissions', () => {
    auth.permissions = ['drivers.view', 'trips.view'];
    render(
      <>
        <OperationEditButton record={{ module: 'drivers', data: driver }} />
        <TripShipmentsAction tripId={id} />
        <OperationsCreatePage module="drivers" />
      </>,
      { wrapper },
    );
    expect(screen.queryByRole('button', { name: 'تعديل البيانات' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'إسناد شحنات' })).not.toBeInTheDocument();
    expect(screen.getByText('هذه الصفحة غير متاحة لحسابك')).toBeInTheDocument();
  });
  it('retains the original body and key across close/reopen after unknown outcome', async () => {
    const request = vi
      .spyOn(api, 'request')
      .mockRejectedValueOnce(new ApiError({ code: 'network' }))
      .mockResolvedValueOnce({ data: { id } });
    render(<OperationEditButton record={{ module: 'drivers', data: driver }} />, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'تعديل البيانات' }));
    const name = screen.getByLabelText('الاسم الكامل');
    await userEvent.clear(name);
    await userEvent.type(name, 'سائق محدّث');
    await userEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
    await screen.findByRole('alert');
    expect(name).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'تعديل الطلب المرفوض' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'إغلاق' }));
    await userEvent.click(screen.getByRole('button', { name: 'تعديل البيانات' }));
    expect(screen.getByLabelText('الاسم الكامل')).toHaveValue('سائق محدّث');
    expect(screen.getByLabelText('الاسم الكامل')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة نفسها' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request.mock.calls[1][1].idempotencyKey).toBe(request.mock.calls[0][1].idempotencyKey);
    expect(request.mock.calls[1][1].body).toEqual(request.mock.calls[0][1].body);
    await screen.findByText('تم حفظ التعديلات.');
  });
  it('keeps the edit dialog open and its close control disabled while pending', async () => {
    let resolveRequest: (value: unknown) => void = () => {};
    vi.spyOn(api, 'request').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    render(<OperationEditButton record={{ module: 'drivers', data: driver }} />, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'تعديل البيانات' }));
    await userEvent.type(screen.getByLabelText('رقم الرخصة — اختياري'), 'LICENSE-12');
    await userEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'إغلاق' })).toBeDisabled());
    const event = new Event('cancel', { cancelable: true, bubbles: false });
    fireEvent(screen.getByRole('dialog'), event);
    expect(event.defaultPrevented).toBe(true);
    await act(async () => resolveRequest({ data: { id } }));
    await screen.findByText('تم حفظ التعديلات.');
  });
  it('requires attachment review before any write and preserves a failed attempt', async () => {
    const request = vi
      .spyOn(api, 'request')
      .mockRejectedValueOnce(new ApiError({ code: 'network' }))
      .mockResolvedValueOnce({ data: { id } });
    render(<TripShipmentsAction tripId={id} />, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'إسناد شحنات' }));
    await userEvent.type(screen.getByLabelText('معرّفات الشحنات'), `${id}\n${otherId}`);
    await userEvent.click(screen.getByRole('button', { name: 'مراجعة الإسناد' }));
    expect(request).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'تأكيد الإسناد' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'مراجعة الشحنات' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'إغلاق' }));
    await userEvent.click(screen.getByRole('button', { name: 'إسناد شحنات' }));
    await userEvent.click(screen.getByRole('button', { name: 'تأكيد الإسناد' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request.mock.calls[1][1].idempotencyKey).toBe(request.mock.calls[0][1].idempotencyKey);
    await screen.findByText('تم إسناد الشحنات.');
  });
});
