'use client';

import {
  useQuery,
  useQueryClient,
  type Query,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { ApiError } from '@/lib/api/errors';
import { useRetryAfter } from '@/lib/api/use-retry-after';
import { driverShipmentIdentity } from './model';

const cooldownKey = ['driver-workspace', 'read-cooldown'] as const;
type Cooldown = { deadline: number; error: ApiError };

async function revokeListCopies(client: QueryClient, queryKey: QueryKey) {
  const plural = queryKey[1] === 'shipment' ? 'shipments' : queryKey[1] === 'trip' ? 'trips' : null;
  if (!plural) return;
  const lists = client.getQueryCache().findAll({ queryKey: ['driver-workspace', plural] });
  await Promise.all(
    lists.map(async (query) => {
      const previous = query.state;
      await client.cancelQueries({ queryKey: query.queryKey, exact: true }, { revert: false });
      if (client.getQueryCache().find({ queryKey: query.queryKey, exact: true }) !== query) return;
      const page = query.state.data as { data?: { id: string }[] } | undefined;
      // Remove only the denied resource. A detail404 does not revoke the driver's
      // entire workspace, and the remaining rows retain their original freshness.
      if (page && Array.isArray(page.data))
        query.setState({
          data: {
            ...page,
            data: page.data.filter(
              (item) =>
                queryKey[1] === 'shipment'
                  ? driverShipmentIdentity(item.id) !== driverShipmentIdentity(String(queryKey[2]))
                  : item.id.toLowerCase() !== String(queryKey[2]).toLowerCase(),
            ),
          },
          status: previous.status,
          error: previous.error,
          errorUpdatedAt: previous.errorUpdatedAt,
          fetchFailureCount: previous.fetchFailureCount,
          fetchFailureReason: previous.fetchFailureReason,
          isInvalidated: true,
          fetchStatus: 'idle',
        });
    }),
  );
}

async function revokeResourceCopies(
  client: QueryClient,
  queryKey: QueryKey,
  error: ApiError,
  activeRead?: Query,
): Promise<void> {
  const resources =
    queryKey[0] === 'driver-workspace' && queryKey[1] === 'shipment'
      ? client.getQueryCache().findAll({
          predicate: (query) =>
            query.queryKey[0] === 'driver-workspace' &&
            query.queryKey[1] === 'shipment' &&
            typeof query.queryKey[2] === 'string' &&
            driverShipmentIdentity(query.queryKey[2]) === driverShipmentIdentity(String(queryKey[2])),
        })
      : client.getQueryCache().findAll({ queryKey, exact: true });
  // An unabortable write may outlive an unused detail query. Revoke any
  // remaining list copies even after that detail has been garbage collected.
  await Promise.all([
    revokeListCopies(client, queryKey),
    ...resources.map(async (resource) => {
      // The failing read must finish rejecting its own promise. Cancel all other
      // retained identities, including legacy casing variants, before clearing them.
      if (resource !== activeRead)
        await client.cancelQueries({ queryKey: resource.queryKey, exact: true }, { revert: false });
      // Session end can remove this query while cancellation settles. Never recreate it.
      if (client.getQueryCache().find({ queryKey: resource.queryKey, exact: true }) !== resource) return;
      resource.setState({
        data: undefined,
        dataUpdatedAt: 0,
        error,
        errorUpdatedAt: Date.now(),
        status: 'error',
        fetchStatus: 'idle',
        isInvalidated: true,
      });
    }),
  ]);
}

/** Remove revoked private data without letting cancellation restore the previous read. */
export function revokeDriverResource(client: QueryClient, queryKey: QueryKey, error: ApiError) {
  return revokeResourceCopies(client, queryKey, error);
}

/** The same read policy also applies to an authoritative read following a conflict. */
export async function readDriverResource<T>(
  client: QueryClient,
  queryKey: QueryKey,
  queryFn: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  await Promise.resolve();
  signal.throwIfAborted();
  const cooldown = client.getQueryData<Cooldown>(cooldownKey);
  if (cooldown && cooldown.deadline > Date.now())
    throw new ApiError({
      status: 429,
      requestId: cooldown.error.requestId,
      retryAfter: cooldown.deadline - Date.now(),
    });
  try {
    const data = await queryFn(signal);
    signal.throwIfAborted();
    return data;
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      await revokeResourceCopies(
        client,
        queryKey,
        error,
        client.getQueryCache().find({ queryKey, exact: true }),
      );
    }
    if (error instanceof ApiError && error.status === 429 && error.retryAfter) {
      client.setQueryDefaults(cooldownKey, { gcTime: Infinity });
      const deadline = Date.now() + error.retryAfter;
      client.setQueryData<Cooldown>(cooldownKey, (previous) =>
        previous && previous.deadline > deadline ? previous : { deadline, error },
      );
    }
    throw error;
  }
}

/** No polling, automatic retries, persistent storage or reconnect-queued work. */
export function useDriverRead<T>({
  queryKey,
  queryFn,
  enabled = true,
}: {
  queryKey: QueryKey;
  queryFn: (signal: AbortSignal) => Promise<T>;
  enabled?: boolean;
}) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => readDriverResource(client, queryKey, queryFn, signal),
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    networkMode: 'always',
  });
  const remainingMs = useRetryAfter(query.error);
  const denied = query.error instanceof ApiError && [401, 403, 404].includes(query.error.status);
  function refresh() {
    if (query.isFetching || remainingMs > 0 || !enabled) return;
    return query.refetch({ cancelRefetch: false });
  }
  return { ...query, data: denied ? undefined : query.data, remainingMs, refresh };
}
