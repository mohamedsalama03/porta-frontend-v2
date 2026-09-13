'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/errors';
import { requestPublicOrderQuote, type PublicOrderQuoteResponse } from './api';
import { publicOrderQuoteFingerprint } from './model';
import type { PublicOrderFormValues, PublicOrderQuoteInput } from './schema';

type QuoteState = {
  fingerprint: string | null;
  attempt: number;
  status: 'incomplete' | 'loading' | 'ready' | 'error';
  data: PublicOrderQuoteResponse['data'] | null;
  error: unknown;
};

/** Prices belong to one exact selection. No old response remains visible during debounce. */
export function usePublicOrderQuote(values: Partial<PublicOrderFormValues>, enabled = true) {
  const fingerprint = enabled ? publicOrderQuoteFingerprint(values) : null;
  const retryAfterDeadline = useRef(0);
  const [cooldownError, setCooldownError] = useState<ApiError | null>(null);
  const [state, setState] = useState<QuoteState>({
    fingerprint,
    attempt: 0,
    status: fingerprint ? 'loading' : 'incomplete',
    data: null,
    error: null,
  });
  // Reset during render so neither a stale price nor an enabled submit flashes for a frame.
  const current =
    state.fingerprint === fingerprint
      ? state
      : {
          fingerprint,
          attempt: state.attempt + 1,
          status: fingerprint ? ('loading' as const) : ('incomplete' as const),
          data: null,
          error: null,
        };
  if (state.fingerprint !== fingerprint) setState(current);
  const attempt = current.attempt;

  useEffect(() => {
    if (!fingerprint) return;
    const controller = new AbortController();
    const debounceUntil = Date.now() + 350;
    let timer: ReturnType<typeof setTimeout>;
    const requestWhenAllowed = () => {
      if (controller.signal.aborted) return;
      const remaining = Math.max(debounceUntil, retryAfterDeadline.current) - Date.now();
      if (remaining > 0) {
        // Chunk long delays so browser timer overflow cannot send an early request.
        timer = setTimeout(requestWhenAllowed, Math.min(remaining, 2_147_483_647));
        return;
      }
      setCooldownError(null);
      const input = JSON.parse(fingerprint) as PublicOrderQuoteInput;
      void requestPublicOrderQuote(input, controller.signal).then(
        (response) => {
          if (controller.signal.aborted) return;
          setState((previous) =>
            previous.fingerprint === fingerprint && previous.attempt === attempt
              ? { ...previous, status: 'ready', data: response.data, error: null }
              : previous,
          );
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          if (error instanceof ApiError && error.status === 429 && (error.retryAfter ?? 0) > 0) {
            retryAfterDeadline.current = Math.max(
              retryAfterDeadline.current,
              Date.now() + error.retryAfter!,
            );
            // Preserve the same response identity so UI countdowns survive selection changes.
            setCooldownError(error);
          }
          setState((previous) =>
            previous.fingerprint === fingerprint && previous.attempt === attempt
              ? { ...previous, status: 'error', data: null, error }
              : previous,
          );
        },
      );
    };
    requestWhenAllowed();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [fingerprint, attempt]);

  return {
    ...current,
    cooldownError,
    retry: () => {
      // An early click is ignored, never turned into an automatic retry at the deadline.
      if (Date.now() < retryAfterDeadline.current) return;
      setState((previous) => ({
        ...previous,
        attempt: previous.attempt + 1,
        status: previous.fingerprint ? 'loading' : 'incomplete',
        data: null,
        error: null,
      }));
    },
  };
}
