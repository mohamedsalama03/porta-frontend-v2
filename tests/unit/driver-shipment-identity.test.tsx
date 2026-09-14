import { type ReactNode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as driverApi from '@/features/driver-workspace/api';
import {
  driverKeys,
  driverShipmentIdentity,
  type DriverShipment,
} from '@/features/driver-workspace/model';
import { DriverShipmentDetail } from '@/features/driver-workspace/shipment-detail';
import {
  readDriverResource,
  revokeDriverResource,
  useDriverRead,
} from '@/features/driver-workspace/use-driver-read';
import { driverShipmentSchema } from '@/lib/api/generated';
import { ApiError } from '@/lib/api/errors';
import { createIdempotentAction } from '@/lib/api/idempotency';
import { clearPrivateQueryCache } from '@/lib/query/client';
import { driverShipmentFixture } from '../../scripts/driver-check-fixtures.mjs';

vi.mock('@/lib/auth/provider', () => ({
  useAuth: () => ({ user: { name: 'QA Driver', permissions: ['shipments.change_status'] } }),
}));
vi.mock('@/lib/api/client', () => ({ api: { request: vi.fn() } }));

const shipment = driverShipmentSchema.parse(driverShipmentFixture());
const upper = shipment.id.toUpperCase();
const lower = shipment.id.toLowerCase();
const mixed = `${upper.slice(0, 12).toLowerCase()}${upper.slice(12)}`;
const unrelated = {
  ...shipment,
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAZ',
  recipient_name: 'OTHER QA RECIPIENT',
};
const privateValues = [
  shipment.sender_name,
  shipment.sender_phone,
  shipment.recipient_name,
  shipment.recipient_phone,
  shipment.delivery_address!,
  shipment.tracking_number,
];
const clients: QueryClient[] = [];

function createClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 60_000 } } });
  clients.push(client);
  return client;
}
function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
function deferred<T>() {
  let resolve!: (data: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.restoreAllMocks();
});

describe('Driver shipment ULID identity', () => {
  it('maps accepted casing to one key without normalizing opaque or invalid values', () => {
    for (const id of [lower, mixed, upper]) {
      expect(driverShipmentIdentity(id)).toBe(upper);
      expect(driverKeys.shipment(id)).toEqual(['driver-workspace', 'shipment', upper]);
    }
    const opaque = 'Cursor/aB+CaseSensitive=';
    expect(driverShipmentIdentity(opaque)).toBe(opaque);
    expect(driverShipmentIdentity('../admin')).toBe('../admin');
    expect(driverKeys.shipments({ cursor: opaque })[2].cursor).toBe(opaque);
    expect(driverKeys.trip(lower)).toEqual(driverKeys.trip(upper));
  });

  it('converges simultaneous lower/uppercase detail observers on one canonical response and request', async () => {
    const client = createClient();
    const pending = deferred<DriverShipment>();
    const read = vi.fn(() => pending.promise);
    const { result } = renderHook(
      () => {
        const lowercase = useDriverRead({ queryKey: driverKeys.shipment(lower), queryFn: read });
        const uppercase = useDriverRead({ queryKey: driverKeys.shipment(upper), queryFn: read });
        return [lowercase, uppercase];
      },
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    await act(async () => pending.resolve(shipment));
    await waitFor(() =>
      expect(result.current.map((query) => query.data?.id)).toEqual([upper, upper]),
    );
    expect(client.getQueryCache().findAll({ queryKey: driverKeys.all })).toHaveLength(1);
    const changed = { ...shipment, current_status: 'READY_FOR_PICKUP' as const };
    act(() => client.setQueryData(driverKeys.shipment(changed.id), changed));
    await waitFor(() =>
      expect(result.current.map((query) => query.data?.current_status)).toEqual([
        'READY_FOR_PICKUP',
        'READY_FOR_PICKUP',
      ]),
    );
  });

  it.each([lower, upper])('keeps the valid %s route and canonical response working', async (id) => {
    const client = createClient();
    const read = vi.spyOn(driverApi, 'getDriverShipment').mockResolvedValue(shipment);
    render(<DriverShipmentDetail id={id} />, { wrapper: wrapper(client) });
    expect(await screen.findByText(shipment.sender_name)).toBeVisible();
    expect(read).toHaveBeenCalledWith(id, expect.any(AbortSignal));
    expect(client.getQueryData(driverKeys.shipment(upper))).toEqual(shipment);
    expect(
      client.getQueryCache().findAll({ queryKey: ['driver-workspace', 'shipment'] }),
    ).toHaveLength(1);
  });
});

describe('lowercase Driver shipment ULID revocation privacy', () => {
  it('removes every private contact/address, telephone link and operational detail after canonical mutation404', async () => {
    const client = createClient();
    vi.spyOn(driverApi, 'getDriverShipment').mockResolvedValue(shipment);
    const denied = new ApiError({ status: 404 });
    const mutation = vi.fn(async () => {
      throw denied;
    });
    vi.spyOn(driverApi, 'createDriverStatusAction').mockImplementation(() =>
      createIdempotentAction(mutation),
    );
    const { container } = render(<DriverShipmentDetail id={lower} />, { wrapper: wrapper(client) });
    await screen.findByText(shipment.sender_name);
    for (const value of privateValues) expect(container).toHaveTextContent(value);
    expect(container.querySelectorAll('a[href^="tel:"]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد جاهزية الاستلام' }));
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الإجراء' }));
    await screen.findByText('هذا العمل غير متاح لك حاليًا.');
    await waitFor(() => {
      for (const value of privateValues) expect(container).not.toHaveTextContent(value);
      expect(container.querySelectorAll('a[href^="tel:"]')).toHaveLength(0);
      expect(container.querySelector('.driver-detail')).toBeNull();
      expect(container.querySelector('.driver-action-area')).toBeNull();
    });
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(driverKeys.shipment(lower))).toBeUndefined();
  });

  it.each(['mutation', 'read'] as const)(
    'prunes every retained casing and trip-linked/list copy after %s404 without wiping unrelated data',
    async (source) => {
      const client = createClient();
      const aliases = [upper, lower, mixed].map(
        (id) => ['driver-workspace', 'shipment', id] as const,
      );
      for (const key of aliases) client.setQueryData(key, shipment);
      const lists = [
        driverKeys.shipments(),
        driverKeys.shipments({ trip_id: shipment.trip_id!, cursor: 'page/+A' }),
        driverKeys.shipments({ trip_id: shipment.trip_id!.toLowerCase(), status: 'ARRIVED_CITY' }),
      ];
      const meta = { next_cursor: 'opaque/A+' };
      for (const key of lists)
        client.setQueryData(key, { data: [shipment, { ...shipment, id: lower }, unrelated], meta });
      client.setQueryData(driverKeys.shipment(unrelated.id), unrelated);
      const tripKey = driverKeys.trip(shipment.trip_id!);
      const trip = { id: shipment.trip_id, status: 'ARRIVED' };
      client.setQueryData(tripKey, trip);
      client.setQueryData(['admin', 'untouched'], { sentinel: 'still-present' });
      const denied = new ApiError({ status: 404 });
      if (source === 'mutation')
        await revokeDriverResource(client, driverKeys.shipment(upper), denied);
      else
        await expect(
          client.fetchQuery({
            queryKey: driverKeys.shipment(lower),
            staleTime: 0,
            retry: false,
            queryFn: ({ signal }) =>
              readDriverResource(
                client,
                driverKeys.shipment(lower),
                async () => {
                  throw denied;
                },
                signal,
              ),
          }),
        ).rejects.toBe(denied);
      for (const key of aliases) {
        expect(client.getQueryData(key)).toBeUndefined();
        expect(client.getQueryState(key)?.error).toBe(denied);
      }
      for (const key of lists)
        expect(client.getQueryData(key)).toEqual({ data: [unrelated], meta });
      expect(client.getQueryData(driverKeys.shipment(unrelated.id))).toEqual(unrelated);
      expect(client.getQueryData(tripKey)).toEqual(trip);
      expect(client.getQueryData(['admin', 'untouched'])).toEqual({ sentinel: 'still-present' });
    },
  );

  it('cancels pending lowercase detail and prevents its late successful response restoring private data after revocation', async () => {
    const client = createClient();
    const pending = deferred<DriverShipment>();
    const read = vi.fn((signal: AbortSignal) => {
      void signal;
      return pending.promise;
    });
    const { result } = renderHook(
      () => useDriverRead({ queryKey: driverKeys.shipment(lower), queryFn: read }),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => expect(read).toHaveBeenCalledOnce());
    await act(async () =>
      revokeDriverResource(client, driverKeys.shipment(upper), new ApiError({ status: 404 })),
    );
    expect(read.mock.calls[0][0].aborted).toBe(true);
    await waitFor(() => expect(result.current.error).toMatchObject({ status: 404 }));
    await act(async () => pending.resolve(shipment));
    expect(result.current.data).toBeUndefined();
    expect(client.getQueryData(driverKeys.shipment(upper))).toBeUndefined();
    expect(client.getQueryState(driverKeys.shipment(upper))?.error).toMatchObject({ status: 404 });
    expect(read).toHaveBeenCalledOnce();
  });

  it('cancels a late trip-linked list response without losing other assigned shipments', async () => {
    const client = createClient();
    const key = driverKeys.shipments({ trip_id: shipment.trip_id!.toLowerCase() });
    const page = { data: [shipment, unrelated], meta: { next_cursor: null } };
    client.setQueryData(key, page);
    const pending = deferred<typeof page>();
    const read = vi.fn((signal: AbortSignal) => {
      void signal;
      return pending.promise;
    });
    const result = client
      .fetchQuery({
        queryKey: key,
        staleTime: 0,
        queryFn: ({ signal }) => readDriverResource(client, key, read, signal),
      })
      .catch(() => undefined);
    await waitFor(() => expect(read).toHaveBeenCalledOnce());
    await revokeDriverResource(client, driverKeys.shipment(lower), new ApiError({ status: 404 }));
    expect(read.mock.calls[0][0].aborted).toBe(true);
    pending.resolve(page);
    await result;
    expect(client.getQueryData(key)).toEqual({ data: [unrelated], meta: page.meta });
    expect(client.getQueryState(key)).toMatchObject({
      status: 'success',
      error: null,
      isInvalidated: true,
    });
  });

  it('does not return an unabortable read result after its signal was revoked', async () => {
    const client = createClient();
    const pending = deferred<DriverShipment>();
    const controller = new AbortController();
    const read = vi.fn(() => pending.promise);
    const result = readDriverResource(client, driverKeys.shipment(lower), read, controller.signal);
    const rejection = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await waitFor(() => expect(read).toHaveBeenCalledOnce());
    controller.abort();
    pending.resolve(shipment);
    await rejection;
  });

  it('keeps a replacement session clean when revocation, logout and a late response overlap', async () => {
    const client = createClient();
    const pending = deferred<DriverShipment>();
    const read = vi.fn(() => pending.promise);
    const key = driverKeys.shipment(lower);
    client.setQueryData(key, shipment);
    const result = client
      .fetchQuery({
        queryKey: key,
        staleTime: 0,
        queryFn: ({ signal }) => readDriverResource(client, key, read, signal),
      })
      .catch(() => undefined);
    await waitFor(() => expect(read).toHaveBeenCalledOnce());
    const revocation = revokeDriverResource(
      client,
      driverKeys.shipment(upper),
      new ApiError({ status: 404 }),
    );
    clearPrivateQueryCache(client);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    const secondSession = { id: upper, recipient_name: 'DRIVER B ONLY' };
    client.setQueryData(driverKeys.shipment(upper), secondSession);
    await revocation;
    pending.resolve(shipment);
    await result;
    expect(client.getQueryData(driverKeys.shipment(lower))).toEqual(secondSession);
    const cache = JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.state.data),
    );
    for (const value of privateValues) expect(cache).not.toContain(value);
  });
});
