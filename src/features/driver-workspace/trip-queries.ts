import type { Query, QueryClient } from '@tanstack/react-query';
import { getDriverShipment, getDriverTrip } from './api';
import { driverKeys } from './model';
import { readDriverResource } from './use-driver-read';

type CurrentSession = () => boolean;

/** Limit invalidation to captured Driver queries, never a replacement session's cache. */
export async function refreshDriverTripDependents(
  client: QueryClient,
  isCurrent: CurrentSession,
  includeShipments: boolean,
  excludeShipmentId?: string,
): Promise<void> {
  if (!isCurrent()) return;
  const queries = new Set(
    client.getQueryCache().findAll({
      predicate: (query) =>
        query.queryKey[0] === driverKeys.all[0] &&
        (query.queryKey[1] === 'trips' ||
          (includeShipments &&
            (query.queryKey[1] === 'shipments' ||
              (query.queryKey[1] === 'shipment' &&
                String(query.queryKey[2]).toLowerCase() !== excludeShipmentId?.toLowerCase())))),
    }),
  );
  await client.invalidateQueries({
    predicate: (query: Query) => isCurrent() && queries.has(query),
    refetchType: 'active',
  });
}

/** A successful mutation, including a replay, never supplies lasting capabilities. */
export async function refreshDriverTrip(
  client: QueryClient,
  tripId: string,
  isCurrent: CurrentSession,
) {
  if (!isCurrent()) return;
  const queryKey = driverKeys.trip(tripId);
  await client.cancelQueries({ queryKey, exact: true });
  if (!isCurrent()) return;
  return client.fetchQuery({
    queryKey,
    queryFn: ({ signal }) =>
      readDriverResource(
        client,
        queryKey,
        (readSignal) => getDriverTrip(tripId, readSignal),
        signal,
      ),
    staleTime: 0,
    gcTime: 5 * 60_000,
    retry: false,
    networkMode: 'always',
  });
}

/** Shipment writes discover trip capabilities through a fresh detail GET only. */
export async function refreshTripAfterShipment(
  client: QueryClient,
  tripId: string | null,
  isCurrent: CurrentSession,
  shipmentId?: string,
): Promise<void> {
  if (!isCurrent()) return;
  const lists = refreshDriverTripDependents(client, isCurrent, true, shipmentId);
  const trip = tripId ? refreshDriverTrip(client, tripId, isCurrent) : Promise.resolve();
  const shipment = (async () => {
    if (!shipmentId || !isCurrent()) return;
    const queryKey = driverKeys.shipment(shipmentId);
    await client.cancelQueries({ queryKey, exact: true });
    if (!isCurrent()) return;
    await client.fetchQuery({
      queryKey,
      queryFn: ({ signal }) =>
        readDriverResource(
          client,
          queryKey,
          (readSignal) => getDriverShipment(shipmentId, readSignal),
          signal,
        ),
      staleTime: 0,
      gcTime: 5 * 60_000,
      retry: false,
      networkMode: 'always',
    });
  })();
  const outcomes = await Promise.allSettled([lists, trip, shipment]);
  const failed = outcomes.find((outcome) => outcome.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}
