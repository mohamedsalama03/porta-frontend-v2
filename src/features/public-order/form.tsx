'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState, useSyncExternalStore } from 'react';
import { useController, useForm, useWatch } from 'react-hook-form';
import { ApiError } from '@/lib/api/errors';
import { useRetryAfter } from '@/lib/api/use-retry-after';
import {
  createPublicOrderAction,
  getPublicOrderCities,
  getPublicOrderTypes,
  type PublicOrderResponse,
} from './api';
import { OrderChoiceGroup, OrderInput, OrderSection, OrderSelect, OrderTextarea } from './fields';
import {
  publicOrderErrorMessage,
  publicOrderFieldErrors,
  publicOrderKeys,
  publicOrderPayload,
  publicOrderQuoteFingerprint,
} from './model';
import {
  publicOrderDefaults,
  publicOrderFieldLabels,
  publicOrderFieldNames,
  publicOrderFormSchema,
  type PublicOrderFormValues,
  type PublicOrderPayload,
} from './schema';
import { OrderSummary, type OrderReviewData } from './summary';
import { OrderSuccess } from './success';
import { usePublicOrderQuote } from './use-quote';

const sizeLabels = { SMALL: 'صغيرة', MEDIUM: 'متوسطة', LARGE: 'كبيرة' } as const;
const deliveryLabels = {
  OFFICE_PICKUP: 'استلام من المكتب',
  DOOR_DELIVERY: 'توصيل إلى الباب',
} as const;
const paymentLabels = {
  CASH_ON_DELIVERY: 'الدفع عند الاستلام',
  PREPAID_TRANSFER: 'تحويل مسبق',
} as const;
const confirmationMarker = 'porta-public-order-confirmed';
const noSubscription = () => () => {};
function hasPreviousConfirmation() {
  try {
    return window.sessionStorage.getItem(confirmationMarker) === 'yes';
  } catch {
    return false;
  }
}
function rememberConfirmation(confirmed: boolean) {
  // A non-personal boolean only. Contacts, notes, request bodies and tracking stay in memory.
  try {
    if (confirmed) window.sessionStorage.setItem(confirmationMarker, 'yes');
    else window.sessionStorage.removeItem(confirmationMarker);
  } catch {
    /* Storage is optional; refresh can never trigger a mutation. */
  }
}

type Review = { payload: PublicOrderPayload; summary: OrderReviewData; fingerprint: string };
type Success = { data: PublicOrderResponse['data']; summary: OrderReviewData };

function RequestFeedback({
  error,
  wait = 0,
  context = 'order',
}: {
  error: unknown;
  wait?: number;
  context?: 'catalog' | 'quote' | 'order';
}) {
  if (!error) return null;
  return (
    <div className="public-order-feedback public-order-feedback--error" role="alert">
      <p>{publicOrderErrorMessage(error, context)}</p>
      {wait > 0 && <p>يمكنك المحاولة بعد {Math.ceil(wait / 1_000)} ثانية.</p>}
      {error instanceof ApiError && error.requestId && (
        <p className="public-order-request-id">
          رقم مرجع المساعدة: <bdi>{error.requestId}</bdi>
        </p>
      )}
    </div>
  );
}

export function PublicOrderForm() {
  const previousConfirmation = useSyncExternalStore(
    noSubscription,
    hasPreviousConfirmation,
    () => false,
  );
  const [confirmationDismissed, setConfirmationDismissed] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);
  const [pending, setPending] = useState(false);
  const [orderError, setOrderError] = useState<unknown>(null);
  const [uncertain, setUncertain] = useState(false);
  const action = useRef<ReturnType<typeof createPublicOrderAction> | null>(null);
  const inFlight = useRef(false);
  const reviewRegion = useRef<HTMLDivElement>(null);
  const errorRegion = useRef<HTMLDivElement>(null);
  const form = useForm<PublicOrderFormValues>({
    resolver: zodResolver(publicOrderFormSchema),
    defaultValues: publicOrderDefaults,
    mode: 'onBlur',
  });
  const values = useWatch({ control: form.control });
  const { field: deliveryField } = useController({
    control: form.control,
    name: 'delivery_method',
  });
  const { field: paymentField } = useController({ control: form.control, name: 'payment_method' });
  const cities = useQuery({
    queryKey: publicOrderKeys.cities,
    queryFn: ({ signal }) => getPublicOrderCities(signal),
    staleTime: 5 * 60_000,
  });
  const types = useQuery({
    queryKey: publicOrderKeys.types,
    queryFn: ({ signal }) => getPublicOrderTypes(signal),
    staleTime: 5 * 60_000,
  });
  const catalogError = cities.error ?? types.error;
  const catalogsLoading = cities.isPending || types.isPending;
  const catalogsEmpty =
    !catalogsLoading && !catalogError && (!cities.data?.data.length || !types.data?.data.length);
  const catalogsReady = !catalogsLoading && !catalogError && !catalogsEmpty;
  const selectionsAvailable =
    !!cities.data?.data.some((item) => item.id === values.origin_city_id) &&
    !!cities.data?.data.some((item) => item.id === values.destination_city_id) &&
    !!types.data?.data.some((item) => item.id === values.shipment_type_id);
  const showRefreshNotice = previousConfirmation && !confirmationDismissed && !success;
  const quote = usePublicOrderQuote(
    values,
    catalogsReady && selectionsAvailable && !success && !showRefreshNotice,
  );
  const quoteError = quote.error ?? quote.cooldownError;
  const quoteWait = useRetryAfter(quoteError);
  const orderWait = useRetryAfter(orderError);
  const citiesWait = useRetryAfter(cities.error);
  const typesWait = useRetryAfter(types.error);
  const catalogWait = Math.max(citiesWait, typesWait);
  const locked = pending || !!review || uncertain;
  const errors = form.formState.errors;
  const errorFields = publicOrderFieldNames.filter((field) => errors[field]);
  const cityOptions =
    cities.data?.data.map((item) => ({ value: item.id, label: item.name_ar })) ?? [];
  const typeOptions =
    types.data?.data.map((item) => ({ value: item.id, label: item.name_ar })) ?? [];
  const selectedType = types.data?.data.find((item) => item.id === values.shipment_type_id);

  function focusReview() {
    requestAnimationFrame(() => reviewRegion.current?.focus());
  }
  function reviewOrder(checked: PublicOrderFormValues) {
    if (inFlight.current || locked) return;
    if (
      quote.status !== 'ready' ||
      !quote.data ||
      !quote.fingerprint ||
      quote.fingerprint !== publicOrderQuoteFingerprint(checked) ||
      !selectionsAvailable
    ) {
      focusReview();
      return;
    }
    const summary: OrderReviewData = {
      senderName: checked.sender_name,
      senderPhone: checked.sender_phone,
      recipientName: checked.recipient_name,
      recipientPhone: checked.recipient_phone,
      originCity: cityOptions.find((item) => item.value === checked.origin_city_id)!.label,
      destinationCity: cityOptions.find((item) => item.value === checked.destination_city_id)!
        .label,
      shipmentType: typeOptions.find((item) => item.value === checked.shipment_type_id)!.label,
      shipmentSize: sizeLabels[checked.shipment_size],
      deliveryMethod: deliveryLabels[checked.delivery_method],
      paymentMethod: paymentLabels[checked.payment_method],
      ...(checked.weight ? { weight: `${checked.weight} كجم` } : {}),
      ...(checked.notes ? { notes: checked.notes } : {}),
      ...(checked.delivery_method === 'DOOR_DELIVERY'
        ? { deliveryAddress: checked.delivery_address }
        : {}),
    };
    setOrderError(null);
    setReview({ payload: publicOrderPayload(checked), summary, fingerprint: quote.fingerprint });
    focusReview();
  }

  async function submitOrder() {
    if (!review || inFlight.current || orderWait > 0 || success) return;
    // A retry resolves the original immutable attempt. Never replace its key or body.
    if (
      !action.current &&
      (quote.status !== 'ready' ||
        quote.fingerprint !== review.fingerprint ||
        publicOrderQuoteFingerprint(form.getValues()) !== review.fingerprint ||
        !selectionsAvailable)
    )
      return;
    inFlight.current = true;
    setPending(true);
    setOrderError(null);
    try {
      action.current ??= createPublicOrderAction(review.payload);
      const response = await action.current.run();
      rememberConfirmation(true);
      setSuccess({ data: response.data, summary: review.summary });
      setUncertain(false);
    } catch (error) {
      setOrderError(error);
      if (error instanceof ApiError && error.status === 422) {
        // A definitive validation rejection can be corrected as a new logical attempt.
        action.current = null;
        setReview(null);
        setUncertain(false);
        const fieldErrors = publicOrderFieldErrors(error);
        for (const field of publicOrderFieldNames) {
          if (fieldErrors[field])
            form.setError(field, { type: 'server', message: fieldErrors[field] });
        }
        const first = publicOrderFieldNames.find((field) => fieldErrors[field]);
        requestAnimationFrame(() => (first ? form.setFocus(first) : errorRegion.current?.focus()));
      } else {
        setUncertain(true);
        focusReview();
      }
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function startNewOrder() {
    rememberConfirmation(false);
    setConfirmationDismissed(true);
    setSuccess(null);
    setReview(null);
    setUncertain(false);
    setOrderError(null);
    action.current = null;
    form.reset(publicOrderDefaults);
    requestAnimationFrame(() => form.setFocus('sender_name'));
  }

  if (success)
    return (
      <OrderSuccess
        trackingNumber={success.data.tracking_number}
        finalPrice={success.data.final_price}
        summary={success.summary}
        onNewOrder={startNewOrder}
      />
    );

  if (showRefreshNotice)
    return (
      <section className="public-order-refresh" aria-labelledby="public-order-refresh-title">
        <h2 id="public-order-refresh-title">سبق تأكيد طلب الشحن</h2>
        <p>
          لا يُعاد إرسال الطلب عند تحديث الصفحة. تفاصيل التأكيد غير محفوظة على هذا الجهاز؛ استخدم
          رقم التتبع الذي احتفظت به.
        </p>
        <p>ابدأ طلبًا جديدًا فقط إذا كنت تريد إرسال شحنة أخرى.</p>
        <button className="public-order-primary" type="button" onClick={startNewOrder}>
          طلب شحن جديد
        </button>
      </section>
    );

  return (
    <>
      <p className="public-order-form-context">
        بيانات التواصل ← تفاصيل الشحنة ← المراجعة والتأكيد
      </p>
      {catalogsLoading && (
        <p className="public-order-feedback" role="status">
          جارٍ تحميل المدن وأنواع الشحنات…
        </p>
      )}
      {catalogError && (
        <div className="public-order-catalog-state">
          <RequestFeedback error={catalogError} wait={catalogWait} context="catalog" />
          <button
            type="button"
            className="public-order-secondary"
            disabled={catalogWait > 0 || cities.isFetching || types.isFetching}
            onClick={() => {
              if (catalogWait > 0 || cities.isFetching || types.isFetching) return;
              void cities.refetch();
              void types.refetch();
            }}
          >
            إعادة تحميل الخيارات
          </button>
        </div>
      )}
      {catalogsEmpty && (
        <div className="public-order-feedback" role="status">
          <h2>الحجز غير متاح حاليًا</h2>
          <p>لا تتوفر خيارات شحن في الوقت الحالي. يرجى المحاولة لاحقًا.</p>
          <button
            type="button"
            className="public-order-secondary"
            disabled={cities.isFetching || types.isFetching}
            onClick={() => {
              void cities.refetch();
              void types.refetch();
            }}
          >
            تحديث الخيارات
          </button>
        </div>
      )}
      <form
        className="public-order-layout"
        noValidate
        onSubmit={(event) => {
          void form.handleSubmit(reviewOrder)(event);
        }}
        aria-label="طلب شحن"
      >
        <div className="public-order-form">
          <div ref={errorRegion} tabIndex={-1}>
            {!review && <RequestFeedback error={orderError} />}
            {errorFields.length > 0 && (
              <div className="public-order-feedback public-order-feedback--error" role="alert">
                <p>راجع الحقول التالية لإكمال الطلب:</p>
                <ul>
                  {errorFields.map((field) => (
                    <li key={field}>
                      <button
                        type="button"
                        className="public-order-text-action"
                        onClick={() => form.setFocus(field)}
                      >
                        {publicOrderFieldLabels[field]}: {errors[field]?.message}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <fieldset
            className="public-order-editable"
            disabled={locked || !catalogsReady}
            aria-busy={pending}
          >
            <legend className="sr-only">بيانات طلب الشحن</legend>
            <OrderSection id="sender" title="بيانات المرسل">
              <div className="public-order-field-grid">
                <OrderInput
                  id="sender_name"
                  label="اسم المرسل"
                  autoComplete="section-sender name"
                  maxLength={150}
                  required
                  {...form.register('sender_name')}
                  error={errors.sender_name?.message}
                />
                <OrderInput
                  id="sender_phone"
                  label="هاتف المرسل"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  autoComplete="section-sender tel"
                  placeholder="0910000000"
                  maxLength={40}
                  required
                  hint="رقم ليبي، مثل 0910000000 أو ‎+218910000000."
                  {...form.register('sender_phone')}
                  error={errors.sender_phone?.message}
                />
              </div>
            </OrderSection>
            <OrderSection id="recipient" title="بيانات المستلم">
              <div className="public-order-field-grid">
                <OrderInput
                  id="recipient_name"
                  label="اسم المستلم"
                  autoComplete="section-recipient name"
                  maxLength={150}
                  required
                  {...form.register('recipient_name')}
                  error={errors.recipient_name?.message}
                />
                <OrderInput
                  id="recipient_phone"
                  label="هاتف المستلم"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  autoComplete="section-recipient tel"
                  placeholder="0920000000"
                  maxLength={40}
                  required
                  hint="أدخل رقمًا يمكن التواصل مع المستلم من خلاله."
                  {...form.register('recipient_phone')}
                  error={errors.recipient_phone?.message}
                />
              </div>
            </OrderSection>
            <OrderSection
              id="route"
              title="مسار الشحنة"
              description="اختر مدينة الإرسال ومدينة الاستلام."
            >
              <div className="public-order-field-grid">
                <OrderSelect
                  id="origin_city_id"
                  label="مدينة الإرسال"
                  options={cityOptions}
                  required
                  {...form.register('origin_city_id')}
                  error={errors.origin_city_id?.message}
                />
                <OrderSelect
                  id="destination_city_id"
                  label="مدينة الاستلام"
                  options={cityOptions}
                  required
                  {...form.register('destination_city_id')}
                  error={errors.destination_city_id?.message}
                />
              </div>
            </OrderSection>
            <OrderSection id="shipment" title="تفاصيل الشحنة">
              <OrderSelect
                id="shipment_type_id"
                label="نوع الشحنة"
                options={typeOptions}
                required
                hint={selectedType?.description ?? undefined}
                {...form.register('shipment_type_id')}
                error={errors.shipment_type_id?.message}
              />
              <div className="public-order-field-grid">
                <OrderSelect
                  id="shipment_size"
                  label="حجم الشحنة"
                  options={Object.entries(sizeLabels).map(([value, label]) => ({ value, label }))}
                  required
                  {...form.register('shipment_size')}
                  error={errors.shipment_size?.message}
                />
                <OrderInput
                  id="weight"
                  label="الوزن (كجم)"
                  optional
                  inputMode="decimal"
                  dir="ltr"
                  placeholder="مثال: 2.5"
                  hint="حتى ثلاث خانات عشرية."
                  {...form.register('weight')}
                  error={errors.weight?.message}
                />
              </div>
            </OrderSection>
            <OrderSection id="delivery" title="الاستلام والدفع">
              <OrderChoiceGroup
                id="delivery_method"
                label="طريقة الاستلام"
                name="delivery_method"
                value={values.delivery_method ?? ''}
                inputRef={deliveryField.ref}
                onBlur={deliveryField.onBlur}
                onValueChange={deliveryField.onChange}
                options={[
                  {
                    value: 'OFFICE_PICKUP',
                    label: deliveryLabels.OFFICE_PICKUP,
                    description: 'يستلم المستلم الشحنة من المكتب.',
                  },
                  {
                    value: 'DOOR_DELIVERY',
                    label: deliveryLabels.DOOR_DELIVERY,
                    description: 'تُسلّم الشحنة إلى العنوان الذي تحدده.',
                  },
                ]}
                error={errors.delivery_method?.message}
              />
              {values.delivery_method === 'DOOR_DELIVERY' && (
                <OrderTextarea
                  id="delivery_address"
                  label="عنوان التوصيل"
                  required
                  maxLength={500}
                  autoComplete="section-recipient street-address"
                  {...form.register('delivery_address')}
                  error={errors.delivery_address?.message}
                />
              )}
              <OrderChoiceGroup
                id="payment_method"
                label="طريقة الدفع"
                name="payment_method"
                value={values.payment_method ?? ''}
                inputRef={paymentField.ref}
                onBlur={paymentField.onBlur}
                onValueChange={paymentField.onChange}
                options={[
                  { value: 'CASH_ON_DELIVERY', label: paymentLabels.CASH_ON_DELIVERY },
                  { value: 'PREPAID_TRANSFER', label: paymentLabels.PREPAID_TRANSFER },
                ]}
                error={errors.payment_method?.message}
                hint="يُسجّل اختيارك مع الطلب. لا تُجرى أي عملية دفع عبر هذه الصفحة."
              />
            </OrderSection>
            <OrderSection id="notes" title="ملاحظات إضافية">
              <OrderTextarea
                id="notes"
                label="ملاحظات"
                optional
                maxLength={2000}
                rows={3}
                hint={`${values.notes?.length ?? 0} / 2000 حرف. أضف ما يساعد على استلام الشحنة أو توصيلها.`}
                {...form.register('notes')}
                error={errors.notes?.message}
              />
            </OrderSection>
          </fieldset>
        </div>
        <div
          className="public-order-summary-region"
          ref={reviewRegion}
          role="region"
          aria-label="السعر والمراجعة"
          tabIndex={-1}
        >
          <OrderSummary
            state={quote.status}
            finalPrice={quote.data?.final_price}
            review={review?.summary}
            onEdit={
              review && !uncertain && !pending
                ? () => {
                    setReview(null);
                    requestAnimationFrame(() => form.setFocus('sender_name'));
                  }
                : undefined
            }
          >
            <RequestFeedback error={quoteError} wait={quoteWait} context="quote" />
            {quote.status === 'error' && (
              <button
                type="button"
                className="public-order-secondary"
                onClick={() => {
                  if (quoteWait <= 0 && !pending && !uncertain) quote.retry();
                }}
                disabled={quoteWait > 0 || pending || uncertain}
              >
                إعادة طلب السعر
              </button>
            )}
            {review && <RequestFeedback error={orderError} wait={orderWait} />}
            {uncertain && (
              <p className="public-order-retry-note">
                تعذّر تأكيد نتيجة الطلب. احتفظ بهذه الصفحة مفتوحة وأعد المحاولة بالبيانات نفسها
                لتجنّب تكرار الطلب.
              </p>
            )}
            {review ? (
              <button
                className="public-order-primary"
                type="button"
                onClick={() => {
                  void submitOrder();
                }}
                disabled={
                  pending ||
                  orderWait > 0 ||
                  (!uncertain && (quote.status !== 'ready' || !selectionsAvailable))
                }
              >
                {pending ? 'جارٍ تأكيد الطلب…' : uncertain ? 'إعادة المحاولة' : 'تأكيد طلب الشحن'}
              </button>
            ) : (
              <button
                className="public-order-primary"
                type="submit"
                disabled={!catalogsReady || quote.status === 'loading'}
              >
                مراجعة الطلب
              </button>
            )}
            <p className="public-order-submit-note">
              {review
                ? 'بالتأكيد، تُرسل بيانات الشحنة لإنشاء الطلب.'
                : 'ستراجع البيانات والسعر قبل تأكيد الطلب.'}
            </p>
          </OrderSummary>
        </div>
      </form>
    </>
  );
}
