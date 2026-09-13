'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X } from 'lucide-react';
import { paymentInputSchema, type PaymentInput, type Shipment } from '@/lib/api/generated';
import { ApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { formatMoney } from '@/lib/formatters';
import { dashboardKeys, paymentKeys, reportKeys, shipmentKeys } from '@/lib/query/keys';
import { paymentStatusLabels } from '@/features/shipments/mappers';
import { createPaymentAction } from './payment-api';
import './payments.css';

const actionLabels = {
  PAID: 'تسجيل دفع كامل',
  FAILED: 'تسجيل فشل الدفع',
  REFUNDED: 'تسجيل استرداد كامل',
} as const;

export function PaymentActions({ shipment }: { shipment: Shipment }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const [review, setReview] = useState<PaymentInput | null>(null);
  const form = useForm<PaymentInput>({
    resolver: zodResolver(paymentInputSchema),
    mode: 'onBlur',
    defaultValues: { status: 'PAID', external_reference: '', notes: '' },
  });
  const attempt = useRef<{
    signature: string;
    action: ReturnType<typeof createPaymentAction>;
  } | null>(null);
  const write = useMutation({
    mutationFn: (body: PaymentInput) => {
      const signature = JSON.stringify(body);
      if (!attempt.current || attempt.current.signature !== signature)
        attempt.current = { signature, action: createPaymentAction(shipment.id, body) };
      return attempt.current.action.run();
    },
    retry: false,
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422)
        for (const [key, values] of Object.entries(error.validationErrors))
          if (['status', 'external_reference', 'notes'].includes(key))
            form.setError(key as keyof PaymentInput, { type: 'server', message: values[0] });
    },
    onSuccess: async () => {
      // No optimistic payment state: each affected view reads the authoritative result.
      await Promise.all([
        client.invalidateQueries({ queryKey: ['payments', 'ledger', shipment.id] }),
        client.invalidateQueries({ queryKey: paymentKeys.lists() }),
        client.invalidateQueries({ queryKey: shipmentKeys.detail(shipment.id) }),
        client.invalidateQueries({ queryKey: shipmentKeys.lists() }),
        client.invalidateQueries({ queryKey: dashboardKeys.all }),
        client.invalidateQueries({ queryKey: reportKeys.all }),
      ]);
      dialog.current?.close();
      setReview(null);
    },
  });
  const uncertain =
    write.error instanceof ApiError &&
    (['network', 'invalid_response'].includes(write.error.code) || write.error.status >= 500);
  async function beginReview(event: FormEvent<HTMLFormElement>) {
    await form.handleSubmit((body) => {
      if (uncertain || write.isPending) return;
      setReview(body);
      dialog.current?.showModal();
    })(event);
  }
  const fieldError = (key: keyof PaymentInput) =>
    form.formState.errors[key] ? (
      <small className="payment-field-error" id={`payment-error-${key}`} role="alert">
        تحقق من قيمة هذا الحقل.
      </small>
    ) : null;
  if (!can(user, 'payments.manage')) return null;
  return (
    <section className="surface payment-actions">
      <div className="payment-actions-heading">
        <h2>عمليات الدفع</h2>
        <Link
          className="button button-secondary"
          href={`/payments?${new URLSearchParams({ shipment: shipment.id })}`}
        >
          عرض سجل المدفوعات
        </Link>
      </div>
      <p>سجّل عملية مؤكدة ثم راجع النتيجة التي يعتمدها الخادم.</p>
      <form noValidate onSubmit={beginReview} aria-label="تسجيل عملية دفع">
        <fieldset disabled={write.isPending || uncertain} className="payment-fields">
          <legend className="sr-only">بيانات عملية الدفع</legend>
          <label>
            <span>العملية المطلوبة</span>
            <select className="field" {...form.register('status')}>
              {Object.entries(actionLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>المرجع الخارجي (اختياري)</span>
            <input
              className="field"
              dir="ltr"
              maxLength={120}
              {...form.register('external_reference', {
                setValueAs: (value) => value || undefined,
              })}
              aria-invalid={!!form.formState.errors.external_reference}
              aria-describedby={
                form.formState.errors.external_reference
                  ? 'payment-error-external_reference'
                  : undefined
              }
            />
            {fieldError('external_reference')}
          </label>
          <label className="payment-notes">
            <span>الملاحظات (اختياري)</span>
            <textarea
              className="field"
              maxLength={500}
              rows={2}
              {...form.register('notes', { setValueAs: (value) => value || undefined })}
              aria-invalid={!!form.formState.errors.notes}
              aria-describedby={form.formState.errors.notes ? 'payment-error-notes' : undefined}
            />
            {fieldError('notes')}
          </label>
        </fieldset>
        {write.isSuccess && (
          <p className="payment-success" role="status">
            تم تسجيل عملية الدفع وتحديث البيانات.
          </p>
        )}
        {uncertain ? (
          <button
            type="button"
            className="button button-primary"
            onClick={() => dialog.current?.showModal()}
          >
            متابعة الطلب غير المؤكد
          </button>
        ) : (
          <button
            type="submit"
            className="button button-primary"
            disabled={write.isPending}
            onClick={() => {
              if (write.isSuccess) {
                attempt.current = null;
                write.reset();
              }
            }}
          >
            مراجعة العملية
          </button>
        )}
      </form>
      <dialog
        className="payment-confirmation"
        ref={dialog}
        aria-labelledby="payment-confirm-title"
        onCancel={(event) => {
          if (write.isPending) event.preventDefault();
        }}
      >
        <div className="payment-actions-heading">
          <h2 id="payment-confirm-title">تأكيد عملية الدفع</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="إغلاق تأكيد الدفع"
            disabled={write.isPending}
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        <dl className="payment-review">
          <div>
            <dt>الشحنة</dt>
            <dd>
              <bdi>{shipment.tracking_number}</bdi>
            </dd>
          </div>
          <div>
            <dt>حالة الدفع الحالية</dt>
            <dd>{paymentStatusLabels[shipment.payment_status].label}</dd>
          </div>
          <div>
            <dt>العملية المطلوبة</dt>
            <dd>{review ? actionLabels[review.status] : '—'}</dd>
          </div>
          <div>
            <dt>السعر النهائي للشحنة</dt>
            <dd>{formatMoney(shipment.final_price)}</dd>
          </div>
        </dl>
        <p>
          يحدد الخادم المبلغ الكامل وأهلية العملية. لا تتوفر دفعات أو استردادات جزئية. لن تتغير
          الحالة المعروضة قبل تأكيد الخدمة.
        </p>
        {review?.external_reference && (
          <p>
            المرجع: <bdi>{review.external_reference}</bdi>
          </p>
        )}
        {write.error && (
          <div className="payment-error" role="alert">
            <p>{write.error instanceof ApiError ? write.error.message : 'تعذّر تسجيل العملية.'}</p>
            {write.error instanceof ApiError && write.error.requestId && (
              <p>
                مرجع الدعم: <bdi>{write.error.requestId}</bdi>
              </p>
            )}
            {uncertain && (
              <p>نتيجة الطلب غير مؤكدة. إعادة المحاولة تستخدم البيانات ومفتاح العملية نفسيهما.</p>
            )}
          </div>
        )}
        <div className="payment-confirm-actions">
          <button
            type="button"
            className="button button-secondary"
            disabled={write.isPending}
            onClick={() => dialog.current?.close()}
          >
            العودة
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!review || write.isPending}
            onClick={() => {
              if (review) write.mutate(review);
            }}
          >
            {write.isPending
              ? 'جارٍ تسجيل العملية…'
              : uncertain
                ? 'إعادة محاولة الطلب نفسه'
                : 'تأكيد وتسجيل العملية'}
          </button>
        </div>
      </dialog>
    </section>
  );
}
