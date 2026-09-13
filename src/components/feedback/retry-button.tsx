'use client';

import { useId, type ReactNode } from 'react';
import { useRetryAfter } from '@/lib/api/use-retry-after';

export function RetryButton({
  error,
  additionalError,
  retry,
  disabled = false,
  className = 'button button-secondary',
  children = 'إعادة المحاولة',
}: {
  error: unknown;
  additionalError?: unknown;
  retry: () => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  // Independent countdowns preserve each response's arrival when two reads fail.
  const firstRemaining = useRetryAfter(error);
  const secondRemaining = useRetryAfter(additionalError);
  const remaining = Math.max(firstRemaining, secondRemaining);
  const countdownId = useId();
  const blocked = disabled || remaining > 0;

  return (
    <>
      {remaining > 0 && (
        <span id={countdownId} role="timer" aria-live="off">
          يمكنك إعادة المحاولة بعد {Math.ceil(remaining / 1_000)} ثانية.{' '}
        </span>
      )}
      <button
        className={className}
        type="button"
        disabled={blocked}
        aria-describedby={remaining > 0 ? countdownId : undefined}
        onClick={() => {
          if (!blocked) retry();
        }}
      >
        {children}
      </button>
    </>
  );
}
