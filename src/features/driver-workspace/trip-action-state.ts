'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/errors';
import { useRetryAfter } from '@/lib/api/use-retry-after';
import { createDriverTripAction } from './api';
import { driverKeys, type DriverTripAction, type DriverTripDetail } from './model';
import { refreshDriverTrip, refreshDriverTripDependents } from './trip-queries';
import { revokeDriverResource } from './use-driver-read';

type Attempt = Readonly<{
  tripId: string;
  action: DriverTripAction;
  request: ReturnType<typeof createDriverTripAction>;
}>;
type Phase = 'idle' | 'pending' | 'uncertain' | 'review' | 'confirmed';
type ActionState = {
  attempt: Attempt | null;
  phase: Phase;
  error: unknown;
  successAction: DriverTripAction | null;
  retryDeadline: number;
  refreshing: boolean;
};
const idle = (): ActionState => ({
  attempt: null,
  phase: 'idle',
  error: null,
  successAction: null,
  retryDeadline: 0,
  refreshing: false,
});
export const driverTripAttemptKey = (tripId: string) =>
  [...driverKeys.all, 'trip-action-attempt', tripId.toUpperCase()] as const;

/** Navigation can retain an uncertain request in memory; session cleanup removes it. */
export function useDriverTripAction(detail: DriverTripDetail) {
  const client = useQueryClient();
  const tripId = detail.data.id.toUpperCase();
  const queryKey = driverTripAttemptKey(tripId);
  const observed = useQuery({
    queryKey,
    queryFn: idle,
    enabled: false,
    initialData: idle,
    staleTime: Infinity,
    gcTime: Infinity,
    structuralSharing: false,
  });
  const state = observed.data;
  const [mountedAt] = useState(Date.now);
  // Convert the retained absolute deadline only once per response (and on remount),
  // so navigating back neither restarts nor silently submits a rate-limited attempt.
  const cooldownError = useMemo(() => {
    if (!(state.error instanceof ApiError) || !state.retryDeadline) return state.error;
    return new ApiError({
      status: state.error.status,
      code: state.error.code,
      requestId: state.error.requestId,
      retryAfter: Math.max(
        0,
        Math.min(state.error.retryAfter ?? 0, state.retryDeadline - mountedAt),
      ),
    });
  }, [state.error, state.retryDeadline, mountedAt]);
  const remainingMs = useRetryAfter(cooldownError);

  function currentScope() {
    const query = client.getQueryCache().find<ActionState>({ queryKey, exact: true });
    const isCurrent = () =>
      !!query && client.getQueryCache().find({ queryKey, exact: true }) === query;
    const read = () => query?.state.data;
    const update = (patch: Partial<ActionState>) => {
      if (!query || !isCurrent()) return;
      query.setData({ ...(query.state.data ?? idle()), ...patch });
    };
    return { query, isCurrent, read, update };
  }

  async function fetchForReview(scope: ReturnType<typeof currentScope>) {
    if (!scope.isCurrent()) return;
    scope.update({ phase: 'review', refreshing: true, retryDeadline: 0 });
    try {
      const fresh = await refreshDriverTrip(client, tripId, scope.isCurrent);
      if (!scope.isCurrent() || !fresh) return;
      scope.update({
        phase: scope.read()?.successAction ? 'confirmed' : 'idle',
        error:
          scope.read()?.error instanceof ApiError &&
          (scope.read()?.error as ApiError).status === 409
            ? scope.read()?.error
            : null,
        refreshing: false,
        retryDeadline: 0,
      });
    } catch (error) {
      scope.update({
        error,
        phase: 'review',
        refreshing: false,
        retryDeadline:
          error instanceof ApiError && error.retryAfter ? Date.now() + error.retryAfter : 0,
      });
    }
  }

  async function execute(scope: ReturnType<typeof currentScope>, attempt: Attempt) {
    scope.update({ phase: 'pending', error: null, retryDeadline: 0, successAction: null });
    try {
      const response = await attempt.request.run();
      if (!scope.isCurrent()) return;
      // Clear the logical attempt once success is authoritative. Keep the action
      // area blocked until a separate GET replaces even a saved replay snapshot.
      scope.update({
        attempt: null,
        phase: 'review',
        successAction: attempt.action,
        refreshing: true,
      });
      await client.cancelQueries({ queryKey: driverKeys.trip(tripId), exact: true });
      if (!scope.isCurrent()) return;
      client.setQueryData(driverKeys.trip(tripId), response);
      void refreshDriverTripDependents(client, scope.isCurrent, attempt.action !== 'COMPLETE');
      await fetchForReview(scope);
    } catch (error) {
      if (!scope.isCurrent()) return;
      if (error instanceof ApiError && [401, 403, 404, 409, 422].includes(error.status)) {
        scope.update({ attempt: null, phase: 'idle', error, retryDeadline: 0 });
        if ([401, 403, 404].includes(error.status)) {
          await revokeDriverResource(client, driverKeys.trip(tripId), error);
          if (scope.isCurrent()) await refreshDriverTripDependents(client, scope.isCurrent, false);
        } else if (error.status === 409) {
          void refreshDriverTripDependents(client, scope.isCurrent, true);
          await fetchForReview(scope);
        }
      } else {
        scope.update({
          phase: 'uncertain',
          error,
          retryDeadline:
            attempt.request.retryAt ??
            (error instanceof ApiError && error.retryAfter ? Date.now() + error.retryAfter : 0),
        });
      }
    }
  }

  async function run(action: DriverTripAction) {
    const scope = currentScope();
    const current = scope.read();
    if (
      !scope.isCurrent() ||
      !current ||
      current.attempt ||
      current.refreshing ||
      ['pending', 'review'].includes(current.phase) ||
      current.retryDeadline > Date.now()
    )
      return;
    const authoritative = client.getQueryData<DriverTripDetail>(driverKeys.trip(tripId));
    if (!authoritative?.meta.allowed_actions.includes(action)) return;
    const attempt = Object.freeze({
      tripId,
      action,
      request: createDriverTripAction(tripId, action),
    });
    scope.update({ attempt });
    await execute(scope, attempt);
  }

  async function retry() {
    const scope = currentScope();
    const current = scope.read();
    if (
      !scope.isCurrent() ||
      !current?.attempt ||
      current.phase !== 'uncertain' ||
      current.retryDeadline > Date.now()
    )
      return;
    await execute(scope, current.attempt);
  }

  async function review() {
    const scope = currentScope();
    const current = scope.read();
    if (
      !scope.isCurrent() ||
      current?.phase !== 'review' ||
      current.refreshing ||
      current.retryDeadline > Date.now()
    )
      return;
    await fetchForReview(scope);
  }

  return {
    attemptAction: state.attempt?.action ?? null,
    phase: state.phase,
    error: state.error,
    successAction: state.successAction,
    remainingMs,
    run,
    retry,
    review,
    busy: state.phase === 'pending' || state.refreshing,
    blocked: ['pending', 'uncertain', 'review'].includes(state.phase),
  };
}
