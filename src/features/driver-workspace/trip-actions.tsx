'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/errors';
import type { DriverTripAction, DriverTripDetail } from './model';
import { driverTripStatusLabels } from './status';
import { DriverTime, driverErrorMessage } from './ui';
import { useDriverTripAction } from './trip-action-state';
import {
  driverTripActionOrder,
  driverTripActionLabels,
  driverTripActionConfirmLabels,
  driverTripActionDescriptions,
  driverTripActionSuccessLabels,
} from './trip-action-display';

function tripActionError(error: unknown) {
  if (error instanceof ApiError && error.status === 409)
    return 'تم تحديث حالة الرحلة. يرجى مراجعة البيانات الحالية.';
  if (error instanceof ApiError && error.status === 422)
    return 'تعذّر قبول إجراء الرحلة. حدّث البيانات ثم حاول مجددًا.';
  return driverErrorMessage(error);
}

export function DriverTripActions({
  detail,
  readBusy = false,
}: {
  detail: DriverTripDetail;
  readBusy?: boolean;
}) {
  const state = useDriverTripAction(detail);
  const [confirmation, setConfirmation] = useState<{
    action: DriverTripAction;
    snapshot: DriverTripDetail;
  } | null>(null);
  const [cancelFocus, setCancelFocus] = useState<{
    action: DriverTripAction;
    revision: number;
  } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const actionButtons = useRef<Partial<Record<DriverTripAction, HTMLButtonElement | null>>>({});
  const available = driverTripActionOrder.filter((action) =>
    detail.meta.allowed_actions.includes(action),
  );
  const selected =
    state.attemptAction ??
    (confirmation &&
    confirmation.snapshot === detail &&
    available.includes(confirmation.action) &&
    !state.blocked
      ? confirmation.action
      : null);
  const uncertain = state.phase === 'uncertain';
  const trip = detail.data;

  useEffect(() => {
    if (selected) heading.current?.focus({ preventScroll: true });
  }, [selected]);
  useEffect(() => {
    if (state.successAction) resultHeading.current?.focus({ preventScroll: true });
  }, [state.successAction]);
  useEffect(() => {
    if (cancelFocus) actionButtons.current[cancelFocus.action]?.focus({ preventScroll: true });
  }, [cancelFocus]);

  function cancel() {
    if (!selected || state.attemptAction || state.busy) return;
    setConfirmation(null);
    setCancelFocus((previous) => ({ action: selected, revision: (previous?.revision ?? 0) + 1 }));
  }
  function confirm() {
    if (!selected || state.busy || readBusy || state.remainingMs > 0) return;
    setConfirmation(null);
    if (uncertain) void state.retry();
    else void state.run(selected);
  }
  const requestId = state.error instanceof ApiError ? state.error.requestId : null;

  return (
    <section className="driver-action-area driver-trip-actions" aria-label="إجراءات الرحلة">
      {state.successAction && (
        <div className="driver-action-success" role="status">
          <h2 ref={resultHeading} tabIndex={-1}>
            {driverTripActionSuccessLabels[state.successAction]}
          </h2>
          {state.blocked && <p>جارٍ التحقق من الإجراءات المتاحة للرحلة.</p>}
        </div>
      )}
      {state.error !== null && state.error !== undefined && (
        <div className="driver-feedback" role="alert">
          <p>{tripActionError(state.error)}</p>
          {uncertain && <p>لم يصل تأكيد نهائي للإجراء. إعادة المحاولة تتحقق من الطلب نفسه.</p>}
          {requestId && (
            <p className="driver-secondary">
              مرجع الطلب: <bdi dir="ltr">{requestId}</bdi>
            </p>
          )}
        </div>
      )}
      {state.remainingMs > 0 && (
        <p className="driver-secondary" role="status">
          يمكنك المحاولة بعد {Math.ceil(state.remainingMs / 1000)} ثانية.
        </p>
      )}
      {state.phase === 'review' && (
        <button
          type="button"
          className="button button-secondary"
          disabled={state.busy || readBusy || state.remainingMs > 0}
          onClick={() => void state.review()}
        >
          تحديث الرحلة للمراجعة
        </button>
      )}
      {selected ? (
        <div
          className="driver-confirmation"
          aria-labelledby="driver-trip-confirmation-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
          }}
        >
          <h2 id="driver-trip-confirmation-title" ref={heading} tabIndex={-1}>
            {driverTripActionLabels[selected]}
          </h2>
          <p className="driver-trip-confirmation-route">
            {trip.origin_city?.name_ar ?? 'مدينة الإرسال غير متاحة'} —{' '}
            {trip.destination_city?.name_ar ?? 'مدينة الوصول غير متاحة'}
          </p>
          <p>
            المغادرة: <DriverTime value={trip.departure_at} />
          </p>
          <p>الحالة الحالية: {driverTripStatusLabels[trip.status]}</p>
          <p>{driverTripActionDescriptions[selected]}</p>
          <div className="driver-action-buttons">
            <button
              type="button"
              className="button button-primary"
              disabled={
                state.busy || readBusy || state.remainingMs > 0 || (state.blocked && !uncertain)
              }
              onClick={confirm}
            >
              {state.phase === 'pending'
                ? 'جارٍ تأكيد الإجراء'
                : uncertain
                  ? 'إعادة المحاولة'
                  : driverTripActionConfirmLabels[selected]}
            </button>
            {!state.attemptAction && (
              <button type="button" className="button button-secondary" onClick={cancel}>
                رجوع
              </button>
            )}
          </div>
          {state.phase === 'pending' && (
            <p className="sr-only" role="status">
              جارٍ تأكيد إجراء الرحلة
            </p>
          )}
        </div>
      ) : (
        !state.blocked &&
        (available.length ? (
          <div className="driver-trip-action-choices">
            {available.map((action) => (
              <button
                key={action}
                ref={(button) => {
                  actionButtons.current[action] = button;
                }}
                type="button"
                className="button button-primary driver-main-action"
                disabled={state.busy || readBusy}
                onClick={() => setConfirmation({ action, snapshot: detail })}
              >
                {driverTripActionLabels[action]}
              </button>
            ))}
          </div>
        ) : (
          <p className="driver-secondary">لا توجد إجراءات متاحة حاليًا.</p>
        ))
      )}
    </section>
  );
}
