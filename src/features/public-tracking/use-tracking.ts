'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/errors';
import { getPublicTracking } from './api';
import { parseTrackingNumber, trackingHref, trackingKeys } from './model';

type SearchState = {
  source: string | null;
  input: string;
  number: string | null;
  validationError: string | null;
};

function stateFromUrl(source: string | null): SearchState {
  const parsed = parseTrackingNumber(source);
  return {
    source,
    input: source ?? '',
    number: parsed.success ? parsed.data : null,
    validationError: source && !parsed.success ? parsed.error.issues[0].message : null,
  };
}

/** Requests are explicit actions or one URL lookup, never effects of typing or a timer. */
export function useTracking(urlNumber: string | null) {
  const client = useQueryClient();
  const [search, setSearch] = useState(() => stateFromUrl(urlNumber));
  const deadlineRef = useRef(0);
  const ownUrlChange = useRef<string | null>(null);
  const [cooldown, setCooldown] = useState<{
    error: ApiError | null;
    deadline: number;
    remainingMs: number;
  }>({ error: null, deadline: 0, remainingMs: 0 });

  // Keep back/forward and direct links in sync without rendering another number's result.
  const current = search.source === urlNumber ? search : stateFromUrl(urlNumber);
  if (search.source !== urlNumber) setSearch(current);

  const queryOptions = useCallback(
    (number: string | null) => ({
      queryKey: trackingKeys.detail(number),
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        // StrictMode's discarded mount aborts before this microtask reaches HTTP.
        await Promise.resolve();
        signal.throwIfAborted();
        if (!number) throw new ApiError({ code: 'invalid_request' });
        try {
          return await getPublicTracking(number, signal);
        } catch (error) {
          signal.throwIfAborted();
          if (error instanceof ApiError && error.status === 429) {
            const remainingMs = Math.max(0, error.retryAfter ?? 0);
            const deadline = Math.max(deadlineRef.current, Date.now() + remainingMs);
            deadlineRef.current = deadline;
            setCooldown({ error, deadline, remainingMs: Math.max(0, deadline - Date.now()) });
          }
          throw error;
        }
      },
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: false as const,
      retryOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      refetchInterval: false as const,
      // A public action fails visibly offline instead of silently resuming on reconnect.
      networkMode: 'always' as const,
    }),
    [],
  );
  const query = useQuery({ ...queryOptions(current.number), enabled: false });

  useEffect(() => {
    const parsed = parseTrackingNumber(urlNumber);
    if (!parsed.success) return;
    if (ownUrlChange.current === parsed.data) {
      ownUrlChange.current = null;
      return;
    }
    ownUrlChange.current = null;
    if (Date.now() < deadlineRef.current) return;
    void client.fetchQuery(queryOptions(parsed.data)).catch(() => {
      // Query state owns the safe error; an automatic URL lookup is never retried.
    });
    return () => {
      void client.cancelQueries({ queryKey: trackingKeys.detail(parsed.data), exact: true });
    };
  }, [client, queryOptions, urlNumber]);

  useEffect(() => {
    const deadline = cooldown.deadline;
    if (deadline <= Date.now()) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const remainingMs = Math.max(0, deadline - Date.now());
      setCooldown((previous) =>
        previous.deadline === deadline ? { ...previous, remainingMs } : previous,
      );
      if (remainingMs > 0) timer = setTimeout(tick, Math.min(remainingMs, 1_000));
    };
    timer = setTimeout(tick, Math.min(deadline - Date.now(), 1_000));
    return () => clearTimeout(timer);
  }, [cooldown.deadline]);

  function changeInput(input: string) {
    const stillSameNumber = input.trim() === current.number;
    if (current.number && !stillSameNumber) {
      void client.cancelQueries({ queryKey: trackingKeys.detail(current.number), exact: true });
    }
    setSearch({
      ...current,
      input,
      number: stillSameNumber ? current.number : null,
      validationError: null,
    });
  }

  function submit(): boolean {
    const parsed = parseTrackingNumber(current.input);
    if (!parsed.success) {
      setSearch({ ...current, validationError: parsed.error.issues[0].message });
      return false;
    }
    if (Date.now() < deadlineRef.current) return false;
    setCooldown({ error: null, deadline: 0, remainingMs: 0 });
    setSearch({ ...current, input: parsed.data, number: parsed.data, validationError: null });
    if (urlNumber !== parsed.data) ownUrlChange.current = parsed.data;
    window.history.replaceState(null, '', trackingHref(parsed.data));
    const options = queryOptions(parsed.data);
    const previous = client.getQueryState(options.queryKey);
    void client
      .fetchQuery({ ...options, staleTime: previous?.error ? 0 : options.staleTime })
      .catch(() => {});
    return true;
  }

  function refresh() {
    if (!current.number || Date.now() < deadlineRef.current) return;
    if (client.isFetching({ queryKey: trackingKeys.detail(current.number), exact: true })) return;
    setCooldown({ error: null, deadline: 0, remainingMs: 0 });
    void client.fetchQuery({ ...queryOptions(current.number), staleTime: 0 }).catch(() => {});
  }

  return {
    input: current.input,
    changeInput,
    submit,
    refresh,
    number: current.number,
    data: current.number ? query.data : undefined,
    error: cooldown.error ?? (current.number ? query.error : null),
    isFetching: current.number !== null && query.isFetching,
    validationError: current.validationError,
    remainingMs: cooldown.remainingMs,
  };
}
