'use client';

import { useRef, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { ApiError } from '@/lib/api/errors';
import { parseTrackingSearch, publicTrackingErrorMessage } from './model';
import { useTracking } from './use-tracking';
import { TrackingResult } from './result';
import { TrackingSkeleton } from './skeleton';

export function PublicTrackingForm() {
  const search = useSearchParams();
  const tracking = useTracking(parseTrackingSearch(search));
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = tracking.isFetching;
  const waiting = tracking.remainingMs > 0;
  const cause = tracking.error instanceof ApiError ? tracking.error : null;
  const message =
    tracking.validationError ||
    (tracking.error ? publicTrackingErrorMessage(tracking.error) : null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tracking.submit()) inputRef.current?.focus();
  }

  return (
    <div className="tracking-layout">
      <form className="tracking-search" onSubmit={submit} noValidate aria-label="البحث عن شحنة">
        <label htmlFor="tracking-number" className="public-order-field-label">
          رقم التتبع
        </label>
        <div className="tracking-search-controls">
          <input
            id="tracking-number"
            ref={inputRef}
            className="public-order-input"
            dir="ltr"
            value={tracking.input}
            onChange={(event) => tracking.changeInput(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            aria-invalid={Boolean(tracking.validationError)}
            aria-describedby={`tracking-help${message ? ' tracking-feedback' : ''}`}
          />
          <button type="submit" className="button button-primary" disabled={busy || waiting}>
            <Search aria-hidden="true" />
            تتبع الشحنة
          </button>
        </div>
        <p id="tracking-help" className="tracking-muted">
          ستجد رقم التتبع في تأكيد طلب الشحن. أدخله كما هو.
        </p>
      </form>
      {message && (
        <div id="tracking-feedback" className="tracking-feedback" role="alert">
          <h2>{message}</h2>
          {cause?.status === 404 && <p>راجع الرقم في تأكيد الطلب ثم حاول مرة أخرى.</p>}
          {tracking.data && <p>تعذّر تحديث الحالة. ما زالت آخر نتيجة ناجحة ظاهرة أدناه.</p>}
          {cause?.requestId && cause.status !== 404 && (
            <p className="tracking-request-id">
              مرجع الطلب: <bdi dir="ltr">{cause.requestId}</bdi>
            </p>
          )}
          {tracking.error && !tracking.data && cause?.status !== 404 && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                if (!tracking.submit()) inputRef.current?.focus();
              }}
              disabled={busy || waiting}
            >
              إعادة المحاولة
            </button>
          )}
        </div>
      )}
      {waiting && (
        <p className="tracking-cooldown" role="status">
          يرجى الانتظار قبل المحاولة مرة أخرى. يمكنك المحاولة بعد{' '}
          {Math.ceil(tracking.remainingMs / 1000)} ثانية.
        </p>
      )}
      {busy && tracking.data && (
        <p className="tracking-muted" role="status">
          جارٍ تحديث حالة الشحنة
        </p>
      )}
      {tracking.data ? (
        <TrackingResult
          key={tracking.data.tracking_number}
          data={tracking.data}
          refreshing={busy}
          refreshDisabled={busy || waiting}
          onRefresh={tracking.refresh}
        />
      ) : busy ? (
        <TrackingSkeleton />
      ) : (
        !message && (
          <div className="tracking-empty">
            <p>أدخل رقم التتبع لمعرفة آخر حالة لشحنتك.</p>
          </div>
        )
      )}
    </div>
  );
}
