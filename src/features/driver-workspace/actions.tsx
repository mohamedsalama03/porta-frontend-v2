'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/provider';
import { can } from '@/lib/permissions';
import { ApiError } from '@/lib/api/errors';
import { useRetryAfter } from '@/lib/api/use-retry-after';
import { createDriverStatusAction, driverStatusPermission, getDriverShipment } from './api';
import { driverKeys, type DriverShipment } from './model';
import {
  driverActionLabels,
  driverShipmentStatusLabels,
  driverStatusTarget,
  type DriverStatusTarget,
} from './status';
import { driverErrorMessage } from './ui';
import { readDriverResource, revokeDriverResource } from './use-driver-read';
import { refreshTripAfterShipment } from './trip-queries';

export function DriverShipmentActions({ shipment }: { shipment: DriverShipment }) {
  const auth = useAuth();
  const client = useQueryClient();
  const allowed = can(auth.user, driverStatusPermission);
  const target = driverStatusTarget(shipment.current_status, allowed);
  const [confirmation, setConfirmation] = useState<{
    status: DriverShipment['current_status'];
    target: DriverStatusTarget;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [linkageReadFailed, setLinkageReadFailed] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [cancelRevision, setCancelRevision] = useState(0);
  const attempt = useRef<ReturnType<typeof createDriverStatusAction> | null>(null);
  const running = useRef(false);
  const refreshing = useRef(false);
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const initialButton = useRef<HTMLButtonElement>(null);
  const remainingMs = useRetryAfter(error);
  const staleConfirmation =
    confirmation !== null && confirmation.status !== shipment.current_status && !attempted;
  useEffect(() => {
    if (cancelRevision) initialButton.current?.focus({ preventScroll: true });
  }, [cancelRevision]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (confirmation || confirmed) heading.current?.focus({ preventScroll: true });
  }, [confirmation, confirmed]);

  async function refreshAuthoritative() {
    if (remainingMs > 0 || refreshing.current) return;
    refreshing.current = true;
    setPending(true);
    try {
      await client.cancelQueries({ queryKey: driverKeys.shipment(shipment.id), exact: true });
      if (!mounted.current) return;
      const fresh = await client.fetchQuery({
        queryKey: driverKeys.shipment(shipment.id),
        queryFn: ({ signal }) =>
          readDriverResource(
            client,
            driverKeys.shipment(shipment.id),
            (readSignal) => getDriverShipment(shipment.id, readSignal),
            signal,
          ),
        staleTime: 0,
        retry: false,
        networkMode: 'always',
      });
      if (mounted.current) setNeedsReview(false);
      return fresh;
    } finally {
      refreshing.current = false;
      if (mounted.current) setPending(false);
    }
  }
  async function execute() {
    if (
      !confirmation ||
      !allowed ||
      running.current ||
      remainingMs > 0 ||
      needsReview ||
      staleConfirmation
    )
      return;
    if (!attempt.current)
      attempt.current = createDriverStatusAction(shipment.id, confirmation.target);
    setAttempted(true);
    running.current = true;
    setPending(true);
    setError(null);
    setLinkageReadFailed(false);
    try {
      const data = await attempt.current.run();
      // Never repopulate an ended session's cache if its unabortable write finishes later.
      if (!mounted.current) return;
      await client.cancelQueries({ queryKey: driverKeys.shipment(shipment.id), exact: true });
      if (!mounted.current) return;
      client.setQueryData(driverKeys.shipment(shipment.id), data);
      setConfirmed(true);
      setConfirmation(null);
      attempt.current = null;
      setAttempted(false);
      // The write is confirmed even if a subsequent capability read is unavailable.
      void refreshTripAfterShipment(client, data.trip_id, () => mounted.current, data.id).catch(
        () => {
          if (mounted.current) setLinkageReadFailed(true);
        },
      );
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause);
      if (cause instanceof ApiError && [401, 403, 404, 409, 422].includes(cause.status)) {
        attempt.current = null;
        setAttempted(false);
        setConfirmation(null);
        if ([401, 403, 404].includes(cause.status))
          await revokeDriverResource(client, driverKeys.shipment(shipment.id), cause);
        if (cause.status === 409) {
          setNeedsReview(true);
          try {
            await refreshAuthoritative();
          } catch (readError) {
            if (mounted.current) setError(readError);
          }
        }
      }
    } finally {
      running.current = false;
      if (mounted.current) setPending(false);
    }
  }
  function cancel() {
    setConfirmation(null);
    setError(null);
    setCancelRevision((value) => value + 1);
  }
  const reference = error instanceof ApiError ? error.requestId : null;
  return (
    <section className="driver-action-area" aria-label="إجراءات الشحنة">
      {confirmed && (
        <div className="driver-action-success" role="status">
          <h2 ref={heading} tabIndex={-1}>
            تم تحديث حالة الشحنة
          </h2>
          <p>الحالة المعروضة مؤكدة من الخدمة.</p>
        </div>
      )}
      {linkageReadFailed && (
        <p className="driver-secondary" role="status">
          تم حفظ الإجراء. تعذّر تحديث بعض البيانات المرتبطة؛ حدّث الرحلة لمراجعة إجراءاتها الحالية.
        </p>
      )}
      {error !== null && (
        <div className="driver-feedback" role="alert">
          <p>{driverErrorMessage(error)}</p>
          {reference && (
            <p className="driver-secondary">
              مرجع الطلب: <bdi dir="ltr">{reference}</bdi>
            </p>
          )}
        </div>
      )}
      {remainingMs > 0 && (
        <p className="driver-secondary" role="status">
          يمكنك المحاولة بعد {Math.ceil(remainingMs / 1000)} ثانية.
        </p>
      )}
      {needsReview && (
        <button
          type="button"
          className="button button-secondary"
          disabled={pending || remainingMs > 0}
          onClick={() => {
            void refreshAuthoritative().catch((cause) => {
              if (mounted.current) setError(cause);
            });
          }}
        >
          تحديث الحالة للمراجعة
        </button>
      )}
      {confirmation ? (
        <div className="driver-confirmation" aria-labelledby="driver-confirmation-heading">
          <h2 id="driver-confirmation-heading" ref={heading} tabIndex={-1}>
            {driverActionLabels[confirmation.target]}
          </h2>
          <p>الحالة الحالية: {driverShipmentStatusLabels[shipment.current_status]}</p>
          <p>
            {confirmation.target === 'DELIVERED'
              ? 'أكّد فقط بعد إتمام تسليم الشحنة إلى المستلم.'
              : 'أكّد فقط بعد تجهيز الشحنة للاستلام.'}
          </p>
          {staleConfirmation && <p role="alert">تم تحديث البيانات. يرجى مراجعة الحالة الحالية.</p>}
          {error !== null && attempted && (
            <p className="driver-secondary">
              لم نتلقَّ تأكيدًا نهائيًا. إعادة المحاولة تتحقق من الإجراء نفسه.
            </p>
          )}
          <div className="driver-action-buttons">
            <button
              type="button"
              className="button button-primary"
              disabled={pending || remainingMs > 0 || needsReview || staleConfirmation}
              onClick={() => void execute()}
            >
              {pending
                ? 'جارٍ تأكيد الإجراء'
                : error !== null && attempted
                  ? 'إعادة محاولة الإجراء'
                  : 'تأكيد الإجراء'}
            </button>
            {!attempted && !pending && (
              <button type="button" className="button button-secondary" onClick={cancel}>
                رجوع
              </button>
            )}
          </div>
        </div>
      ) : target && !needsReview ? (
        <button
          ref={initialButton}
          type="button"
          className="button button-primary driver-main-action"
          disabled={pending || remainingMs > 0}
          onClick={() => {
            setConfirmed(false);
            setError(null);
            setConfirmation({ status: shipment.current_status, target });
          }}
        >
          {driverActionLabels[target]}
        </button>
      ) : (
        !confirmed &&
        !needsReview && <p className="driver-secondary">لا يوجد إجراء متاح لك على هذه الحالة.</p>
      )}
    </section>
  );
}
