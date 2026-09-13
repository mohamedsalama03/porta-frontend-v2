'use client';

import { useEffect, useState } from 'react';
import { ApiError } from './errors';

/** The remaining minimum delay for one response; observing it never issues a request. */
export function useRetryAfter(cause: unknown): number {
  const error = cause instanceof ApiError ? cause : null;
  const delay = Math.max(0, error?.retryAfter ?? 0);
  const [wait, setWait] = useState({ error, remaining: delay });
  // A new response starts its own minimum wait; ordinary rerenders preserve it.
  if (wait.error !== error) setWait({ error, remaining: delay });
  const remaining = wait.error === error ? wait.remaining : delay;

  useEffect(() => {
    if (delay <= 0) return;
    const deadline = Date.now() + delay;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now());
      setWait((current) => (current.error === error ? { error, remaining } : current));
      // Short ticks also avoid overflowing the browser's maximum timer delay.
      if (remaining > 0) timer = setTimeout(tick, Math.min(remaining, 1_000));
    };
    timer = setTimeout(tick, Math.min(delay, 1_000));
    return () => clearTimeout(timer);
  }, [error, delay]);

  return remaining;
}
