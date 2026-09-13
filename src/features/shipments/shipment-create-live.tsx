'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Info } from 'lucide-react';
import { quoteInputSchema, shipmentInputSchema, type ShipmentInput } from '@/lib/api/generated';
import { ApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { formatMoney } from '@/lib/formatters';
import { reportKeys, shipmentKeys } from '@/lib/query/keys';
import { RetryButton } from '@/components/feedback/retry-button';
import { createShipmentAction, requestShipmentQuote } from './api';
import { deliveryMethodLabels, paymentMethodLabels, shipmentSizeLabels } from './mappers';
import { useShipmentCatalogs } from './live-hooks';

export function ShipmentCreateLive() {
  const { user } = useAuth();
  const allowed = can(user, 'shipments.create');
  const canView = can(user, 'shipments.view');
  const router = useRouter();
  const queryClient = useQueryClient();
  const { cities, types } = useShipmentCatalogs(allowed);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ShipmentInput>({
    resolver: zodResolver(shipmentInputSchema),
    mode: 'onBlur',
    defaultValues: {
      sender_name: '',
      sender_phone: '',
      recipient_name: '',
      recipient_phone: '',
      delivery_method: 'OFFICE_PICKUP',
      payment_method: 'CASH_ON_DELIVERY',
    },
  });
  const [origin, destination, type, size, delivery] = useWatch({
    control,
    name: [
      'origin_city_id',
      'destination_city_id',
      'shipment_type_id',
      'shipment_size',
      'delivery_method',
    ],
  });
  const quoteCandidate = quoteInputSchema.safeParse({
    origin_city_id: origin,
    destination_city_id: destination,
    shipment_type_id: type,
    shipment_size: size,
    delivery_method: delivery,
  });
  const fingerprint = JSON.stringify(quoteCandidate.success ? quoteCandidate.data : null);
  const [debouncedFingerprint, setDebouncedFingerprint] = useState('null');
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedFingerprint(fingerprint), 350);
    return () => window.clearTimeout(timer);
  }, [fingerprint]);
  const quote = useQuery({
    queryKey: ['shipments', 'quote', debouncedFingerprint],
    queryFn: ({ signal }) =>
      requestShipmentQuote(quoteInputSchema.parse(JSON.parse(debouncedFingerprint)), signal),
    enabled: allowed && debouncedFingerprint !== 'null' && debouncedFingerprint === fingerprint,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const quoteCurrent =
    fingerprint !== 'null' &&
    fingerprint === debouncedFingerprint &&
    quote.isSuccess &&
    !quote.isFetching;
  const attempt = useRef<{
    signature: string;
    body: ShipmentInput;
    action: ReturnType<typeof createShipmentAction>;
  } | null>(null);
  const create = useMutation({
    mutationFn: (body: ShipmentInput) => {
      const signature = JSON.stringify(body);
      if (!attempt.current || attempt.current.signature !== signature)
        attempt.current = { signature, body, action: createShipmentAction(body) };
      return attempt.current.action.run();
    },
    retry: false,
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) {
        for (const [field, messages] of Object.entries(error.validationErrors))
          if (Object.hasOwn(shipmentInputSchema.shape, field))
            setError(field as keyof ShipmentInput, { type: 'server', message: messages[0] });
      }
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: shipmentKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: reportKeys.all }),
      ]);
      if (canView) {
        queryClient.setQueryData(shipmentKeys.detail(result.data.id), result);
        router.push(`/shipments/${encodeURIComponent(result.data.id)}`);
      }
    },
  });
  const uncertain =
    create.error instanceof ApiError &&
    (['network', 'invalid_response'].includes(create.error.code) || create.error.status >= 500);
  const locked = create.isPending || uncertain || create.isSuccess;
  const field = (
    name: keyof ShipmentInput,
    label: string,
    options: { type?: string; wide?: boolean; optional?: boolean; placeholder?: string } = {},
  ) => (
    <label className={`shipment-form-field${options.wide ? ' shipment-form-wide' : ''}`}>
      <span>
        {label}
        {options.optional ? ' (اختياري)' : ''}
      </span>
      <input
        className="field"
        type={options.type ?? 'text'}
        placeholder={options.placeholder}
        {...register(
          name,
          options.optional
            ? { setValueAs: (value: string) => (value === '' ? undefined : value) }
            : {},
        )}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `live-error-${name}` : undefined}
        autoComplete="off"
      />
      {errors[name] && (
        <small className="shipment-field-error" id={`live-error-${name}`} role="alert">
          {errors[name]?.type === 'server' ? errors[name]?.message : 'تحقق من قيمة هذا الحقل.'}
        </small>
      )}
    </label>
  );
  const select = (
    name: keyof ShipmentInput,
    label: string,
    options: Array<{ value: string; label: string }>,
  ) => (
    <label className="shipment-form-field">
      <span>{label}</span>
      <select
        className="field"
        {...register(name)}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `live-error-${name}` : undefined}
      >
        <option value="">اختر {label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {errors[name] && (
        <small className="shipment-field-error" id={`live-error-${name}`} role="alert">
          تحقق من قيمة هذا الحقل.
        </small>
      )}
    </label>
  );
  const cityOptions =
    cities.data?.data.map((city) => ({ value: city.id, label: city.name_ar })) ?? [];

  if (!allowed)
    return (
      <section className="surface shipment-table-state">
        <h1>إنشاء شحنة</h1>
        <p>ليس لديك صلاحية لإنشاء الشحنات.</p>
      </section>
    );
  if (create.isSuccess && !canView)
    return (
      <section className="surface shipment-table-state" role="status">
        <h1>تم إنشاء الشحنة</h1>
        <p>
          رقم التتبع: <bdi>{create.data.data.tracking_number}</bdi>
        </p>
        <button
          className="button button-primary"
          type="button"
          onClick={() => {
            attempt.current = null;
            reset();
            create.reset();
          }}
        >
          إنشاء شحنة أخرى
        </button>
      </section>
    );
  return (
    <div className="shipment-create-preview">
      {canView && (
        <Link className="shipment-back-link" href="/shipments">
          <ArrowLeft size={15} aria-hidden="true" />
          العودة إلى الشحنات
        </Link>
      )}
      <div className="shipment-page-title">
        <div>
          <h1>إنشاء شحنة</h1>
          <p>أدخل تفاصيل الشحنة وراجع السعر المعتمد قبل الإنشاء.</p>
        </div>
      </div>
      <form
        className="shipment-create-layout"
        onSubmit={handleSubmit((body) => {
          if (quoteCurrent && !locked) create.mutate(body);
        })}
        noValidate
        aria-label="إنشاء شحنة"
      >
        <fieldset className="shipment-form-sections shipment-live-fieldset" disabled={locked}>
          <legend className="shipment-sr-only">تفاصيل الشحنة</legend>
          <section className="surface shipment-form-section">
            <h2>المرسل</h2>
            <div className="shipment-form-grid">
              {field('sender_name', 'اسم المرسل')}
              {field('sender_phone', 'هاتف المرسل', { type: 'tel' })}
            </div>
          </section>
          <section className="surface shipment-form-section">
            <h2>المستلم</h2>
            <div className="shipment-form-grid">
              {field('recipient_name', 'اسم المستلم')}
              {field('recipient_phone', 'هاتف المستلم', { type: 'tel' })}
            </div>
          </section>
          <section className="surface shipment-form-section">
            <h2>المسار والشحنة</h2>
            {(cities.isError || types.isError) && (
              <p role="alert" className="shipment-field-error">
                تعذّر تحميل خيارات المسار.{' '}
                <RetryButton
                  className="shipment-clear-filters"
                  error={cities.error}
                  additionalError={types.error}
                  disabled={cities.isFetching || types.isFetching}
                  retry={() => {
                    void cities.refetch();
                    void types.refetch();
                  }}
                >
                  إعادة المحاولة
                </RetryButton>
              </p>
            )}
            <div className="shipment-form-grid">
              {select('origin_city_id', 'مدينة الانطلاق', cityOptions)}
              {select('destination_city_id', 'مدينة الوصول', cityOptions)}
              {select(
                'shipment_type_id',
                'نوع الشحنة',
                types.data?.data.map((item) => ({ value: item.id, label: item.name_ar })) ?? [],
              )}
              {select(
                'shipment_size',
                'الحجم',
                Object.entries(shipmentSizeLabels).map(([value, label]) => ({ value, label })),
              )}
              {field('weight', 'الوزن', {
                optional: true,
                placeholder: 'وزن موجب حتى ثلاث خانات عشرية',
              })}
              {field('branch_id', 'معرّف الفرع', { optional: true })}
            </div>
          </section>
          <section className="surface shipment-form-section">
            <h2>التوصيل والدفع</h2>
            <div className="shipment-form-grid">
              {select(
                'delivery_method',
                'طريقة التسليم',
                Object.entries(deliveryMethodLabels).map(([value, label]) => ({ value, label })),
              )}
              {select(
                'payment_method',
                'طريقة الدفع',
                Object.entries(paymentMethodLabels).map(([value, label]) => ({ value, label })),
              )}
              {field('delivery_address', 'عنوان التوصيل', {
                optional: delivery !== 'DOOR_DELIVERY',
                wide: true,
              })}
            </div>
          </section>
          <section className="surface shipment-form-section">
            <h2>الملاحظات</h2>
            <label className="shipment-form-field">
              <span className="shipment-sr-only">ملاحظات الشحنة</span>
              <textarea className="field" rows={4} maxLength={2000} {...register('notes')} />
            </label>
          </section>
        </fieldset>
        <aside className="shipment-quote-column">
          <section className="surface shipment-quote-panel">
            <h2>عرض السعر</h2>
            <p>السعر من خدمة بورتا. يعيد الخادم التحقق من التسعير عند إنشاء الشحنة.</p>
            <div aria-live="polite">
              {fingerprint === 'null' ? (
                <p>اختر المسار ونوع الشحنة وحجمها لعرض السعر.</p>
              ) : !quoteCurrent && !quote.isError ? (
                <p>جارٍ تحديث عرض السعر…</p>
              ) : quote.isError ? (
                <p role="alert">
                  {quote.error instanceof ApiError ? quote.error.message : 'تعذّر جلب السعر.'}
                  <RetryButton
                    className="shipment-clear-filters"
                    error={quote.error}
                    disabled={quote.isFetching}
                    retry={() => void quote.refetch()}
                  >
                    إعادة طلب السعر
                  </RetryButton>
                </p>
              ) : (
                <dl>
                  <div>
                    <dt>السعر المحسوب</dt>
                    <dd>{quoteCurrent ? formatMoney(quote.data.data.calculated_price) : '—'}</dd>
                  </div>
                  <div className="shipment-quote-total">
                    <dt>السعر النهائي</dt>
                    <dd>{quoteCurrent ? formatMoney(quote.data.data.final_price) : '—'}</dd>
                  </div>
                </dl>
              )}
            </div>
            <p className="shipment-quote-notice">
              <Info size={15} aria-hidden="true" />
              <span>القيم المعروضة تشمل ثلاث خانات عشرية للدينار الليبي.</span>
            </p>
            {create.error && (
              <div role="alert" className="shipment-live-error">
                <p>
                  {create.error instanceof ApiError ? create.error.message : 'تعذّر إنشاء الشحنة.'}
                </p>
                {create.error instanceof ApiError && create.error.requestId && (
                  <p>
                    مرجع الدعم: <bdi>{create.error.requestId}</bdi>
                  </p>
                )}
                {uncertain && (
                  <p>
                    لم تتأكد نتيجة الطلب. احتفظنا بالبيانات ومفتاح العملية لإعادة محاولة الطلب نفسه
                    دون إنشاء نسخة إضافية.
                  </p>
                )}
              </div>
            )}
            {uncertain ? (
              <button
                className="button button-primary"
                type="button"
                disabled={create.isPending}
                onClick={() => {
                  if (attempt.current) create.mutate(attempt.current.body);
                }}
              >
                إعادة محاولة الطلب نفسه
              </button>
            ) : (
              <button
                className="button button-primary"
                type="submit"
                disabled={!quoteCurrent || locked}
              >
                {create.isPending
                  ? 'جارٍ إنشاء الشحنة…'
                  : create.isSuccess
                    ? 'تم إنشاء الشحنة'
                    : 'إنشاء الشحنة'}
              </button>
            )}
          </section>
        </aside>
      </form>
    </div>
  );
}
