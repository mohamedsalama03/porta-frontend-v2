import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIdempotentAction } from '@/lib/api/idempotency';
import { ApiError } from '@/lib/api/errors';
import { driverShipmentSchema, driverTripSchema } from '@/lib/api/generated';
import * as driverApi from '@/features/driver-workspace/api';
import * as tripQueries from '@/features/driver-workspace/trip-queries';
import { DriverShipmentActions } from '@/features/driver-workspace/actions';
import { DriverShipmentCard, DriverTripCard } from '@/features/driver-workspace/cards';
import { driverKeys, type DriverShipment } from '@/features/driver-workspace/model';
import { DriverTime } from '@/features/driver-workspace/ui';
import { formatDate } from '@/lib/formatters';
import { driverShipmentFixture, driverTripFixture } from '../../scripts/driver-check-fixtures.mjs';

const auth = vi.hoisted(() => ({
  user: { name: 'سائق تجريبي', permissions: ['shipments.change_status'] },
}));
vi.mock('@/lib/auth/provider', () => ({ useAuth: () => auth }));
vi.mock('@/lib/api/client', () => ({ api: { request: vi.fn() } }));
const shipment = driverShipmentSchema.parse(driverShipmentFixture());
const trip = driverTripSchema.parse(driverTripFixture());
let clients: QueryClient[] = [];
function mount(initial = shipment) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 60_000 } } });
  clients.push(client);
  client.setQueryData(driverKeys.shipment(initial.id), initial);
  function Harness() {
    const q = useQuery({
      queryKey: driverKeys.shipment(initial.id),
      queryFn: () => Promise.resolve(initial),
      enabled: false,
    });
    return q.data ? <DriverShipmentActions shipment={q.data} /> : <p>Revoked</p>;
  }
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    ),
  };
}
beforeEach(() => {
  auth.user.permissions = ['shipments.change_status'];
  vi.spyOn(tripQueries, 'refreshTripAfterShipment').mockResolvedValue();
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const client of clients) client.clear();
  clients = [];
});

describe('driver safe presentation', () => {
  it('renders cards without IDs, contact values or extra administrative fields', () => {
    const data = {
      ...shipment,
      notes: 'PRIVATE_NOTE',
      final_price: 999999,
      driver_name: 'PRIVATE_DRIVER',
    };
    const { container } = render(
      <ul>
        <DriverTripCard trip={{ ...trip }} />
        <DriverShipmentCard shipment={data} />
      </ul>,
    );
    expect(container.textContent).toContain(shipment.tracking_number);
    for (const hidden of [
      shipment.id,
      trip.id,
      shipment.sender_phone,
      shipment.recipient_phone,
      shipment.delivery_address,
      'PRIVATE_NOTE',
      'PRIVATE_DRIVER',
      '999999',
    ])
      if (hidden) expect(container.textContent).not.toContain(hidden);
  });
  it('does not invent missing route or shipment count and preserves zero', () => {
    const { rerender } = render(
      <ul>
        <DriverTripCard
          trip={{
            id: trip.id,
            departure_at: trip.departure_at,
            estimated_arrival_at: null,
            status: trip.status,
          }}
        />
      </ul>,
    );
    expect(screen.getByText(/مدينة الإرسال غير متاحة/)).toBeVisible();
    expect(screen.queryByText(/\d شحنة/)).not.toBeInTheDocument();
    rerender(
      <ul>
        <DriverTripCard trip={{ ...trip, shipments_count: 0 }} />
      </ul>,
    );
    expect(screen.getByText('0 شحنة')).toBeVisible();
  });
  it('formats absolute instants using existing Tripoli formatter', () => {
    const value = '2026-09-14T22:30:00Z';
    const { container } = render(<DriverTime value={value} />);
    expect(container.querySelector('time')).toHaveAttribute('datetime', value);
    expect(container.textContent).toBe(formatDate(value, { hour: '2-digit', minute: '2-digit' }));
  });
});

describe('driver deliberate mutation', () => {
  it('requires permission and a documented source status', () => {
    auth.user.permissions = [];
    mount();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('returns focus when confirmation is cancelled without sending a mutation', async () => {
    const create = vi.spyOn(driverApi, 'createDriverStatusAction');
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد جاهزية الاستلام' }));
    expect(screen.getByRole('heading', { name: 'تأكيد جاهزية الاستلام' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'رجوع' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'تأكيد جاهزية الاستلام' })).toHaveFocus(),
    );
    expect(create).not.toHaveBeenCalled();
  });
  it('confirms once, holds pending, then shows authoritative success', async () => {
    let resolve!: (value: DriverShipment) => void;
    const submit = vi.fn(
      () =>
        new Promise<DriverShipment>((done) => {
          resolve = done;
        }),
    );
    vi.spyOn(driverApi, 'createDriverStatusAction').mockImplementation(() =>
      createIdempotentAction(submit),
    );
    const { client } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد جاهزية الاستلام' }));
    expect(submit).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'تأكيد الإجراء' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'جارٍ تأكيد الإجراء' })).toBeDisabled();
    expect(screen.queryByText('تم تحديث حالة الشحنة')).not.toBeInTheDocument();
    await act(async () => resolve({ ...shipment, current_status: 'READY_FOR_PICKUP' }));
    expect(await screen.findByRole('heading', { name: 'تم تحديث حالة الشحنة' })).toBeVisible();
    expect(
      client.getQueryData<DriverShipment>(driverKeys.shipment(shipment.id))?.current_status,
    ).toBe('READY_FOR_PICKUP');
    expect(tripQueries.refreshTripAfterShipment).toHaveBeenCalledWith(
      client,
      shipment.trip_id,
      expect.any(Function),
      shipment.id,
    );
  });
  it('keeps a confirmed shipment write confirmed when trip capability recovery fails', async () => {
    vi.mocked(tripQueries.refreshTripAfterShipment).mockRejectedValue(
      new ApiError({ code: 'network' }),
    );
    vi.spyOn(driverApi, 'createDriverStatusAction').mockImplementation(() =>
      createIdempotentAction(async () => ({ ...shipment, current_status: 'READY_FOR_PICKUP' })),
    );
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد جاهزية الاستلام' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإجراء' }));
    expect(await screen.findByRole('heading', { name: 'تم تحديث حالة الشحنة' })).toBeVisible();
    expect(
      await screen.findByText(/تم حفظ الإجراء. تعذّر تحديث بعض البيانات المرتبطة/),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'إعادة محاولة الإجراء' })).not.toBeInTheDocument();
  });
  it('keeps same logical idempotency key after an unknown network outcome', async () => {
    const keys: string[] = [];
    let calls = 0;
    vi.spyOn(driverApi, 'createDriverStatusAction').mockImplementation(() =>
      createIdempotentAction(async (key) => {
        keys.push(key);
        if (++calls === 1) throw new ApiError({ code: 'network' });
        return { ...shipment, current_status: 'READY_FOR_PICKUP' };
      }),
    );
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد جاهزية الاستلام' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإجراء' }));
    fireEvent.click(await screen.findByRole('button', { name: 'إعادة محاولة الإجراء' }));
    await screen.findByRole('heading', { name: 'تم تحديث حالة الشحنة' });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });
  it('reloads authoritative resource after409 instead of reusing stale action', async () => {
    vi.spyOn(driverApi, 'createDriverStatusAction').mockImplementation(() =>
      createIdempotentAction(async () => {
        throw new ApiError({ status: 409 });
      }),
    );
    const read = vi
      .spyOn(driverApi, 'getDriverShipment')
      .mockResolvedValue({ ...shipment, current_status: 'READY_FOR_PICKUP' });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد جاهزية الاستلام' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإجراء' }));
    expect(await screen.findByText('تم تحديث البيانات. يرجى مراجعة الحالة الحالية.')).toBeVisible();
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: 'تأكيد تسليم الشحنة' })).toBeEnabled();
  });
  it('requires a successful reread before offering an action after an unreadable409', async () => {
    vi.spyOn(driverApi, 'createDriverStatusAction').mockImplementation(() =>
      createIdempotentAction(async () => {
        throw new ApiError({ status: 409 });
      }),
    );
    vi.spyOn(driverApi, 'getDriverShipment').mockRejectedValue(new ApiError({ code: 'network' }));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد جاهزية الاستلام' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإجراء' }));
    expect(await screen.findByRole('button', { name: 'تحديث الحالة للمراجعة' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'تأكيد جاهزية الاستلام' })).not.toBeInTheDocument();
  });
  it('handles422 safely and requires a new deliberate confirmation', async () => {
    vi.spyOn(driverApi, 'createDriverStatusAction').mockImplementation(() =>
      createIdempotentAction(async () => {
        throw new ApiError({ status: 422, validationErrors: { status: ['PRIVATE_BACKEND'] } });
      }),
    );
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد جاهزية الاستلام' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإجراء' }));
    expect(
      await screen.findByText('تعذّر قبول الإجراء. راجع بيانات الشحنة وحالتها ثم حاول مجددًا.'),
    ).toBeVisible();
    expect(screen.queryByText('PRIVATE_BACKEND')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تأكيد جاهزية الاستلام' })).toBeEnabled();
  });
  it.each([403, 404])(
    'discards detail and list copies after mutation denial %s',
    async (status) => {
      vi.spyOn(driverApi, 'createDriverStatusAction').mockImplementation(() =>
        createIdempotentAction(async () => {
          throw new ApiError({ status });
        }),
      );
      const view = mount();
      view.client.setQueryData(driverKeys.shipments(), {
        data: [shipment],
        meta: { next_cursor: null },
      });
      fireEvent.click(screen.getByRole('button', { name: 'تأكيد جاهزية الاستلام' }));
      fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإجراء' }));
      await screen.findByText('Revoked');
      expect(view.client.getQueryData(driverKeys.shipments())).toEqual({
        data: [],
        meta: { next_cursor: null },
      });
      expect(view.client.getQueryData(driverKeys.shipment(shipment.id))).toBeUndefined();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    },
  );
  it('respects429 from the authoritative409 reread and blocks repeated review requests', async () => {
    vi.spyOn(driverApi, 'createDriverStatusAction').mockImplementation(() =>
      createIdempotentAction(async () => {
        throw new ApiError({ status: 409 });
      }),
    );
    const read = vi
      .spyOn(driverApi, 'getDriverShipment')
      .mockRejectedValue(new ApiError({ status: 429, retryAfter: 60_000 }));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد جاهزية الاستلام' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإجراء' }));
    await screen.findByText('يرجى الانتظار قبل المحاولة مرة أخرى.');
    const retry = screen.getByRole('button', { name: 'تحديث الحالة للمراجعة' });
    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('does not restore the session cache if logout overlaps cancellation before a success update', async () => {
    vi.spyOn(driverApi, 'createDriverStatusAction').mockImplementation(() =>
      createIdempotentAction(async () => ({ ...shipment, current_status: 'READY_FOR_PICKUP' })),
    );
    const view = mount();
    let finish!: () => void;
    const cancel = vi.spyOn(view.client, 'cancelQueries').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد جاهزية الاستلام' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإجراء' }));
    await waitFor(() => expect(cancel).toHaveBeenCalled());
    view.unmount();
    view.client.clear();
    await act(async () => finish());
    expect(view.client.getQueryCache().getAll()).toHaveLength(0);
  });
  it('does not repopulate a cleared private cache after unmount during a write', async () => {
    let resolve!: (value: DriverShipment) => void;
    vi.spyOn(driverApi, 'createDriverStatusAction').mockImplementation(() =>
      createIdempotentAction(
        () =>
          new Promise<DriverShipment>((done) => {
            resolve = done;
          }),
      ),
    );
    const view = mount();
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد جاهزية الاستلام' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإجراء' }));
    await waitFor(() => expect(resolve).toBeDefined());
    view.unmount();
    view.client.clear();
    await act(async () => resolve({ ...shipment, current_status: 'READY_FOR_PICKUP' }));
    expect(view.client.getQueryCache().getAll()).toHaveLength(0);
  });
});
