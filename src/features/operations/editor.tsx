'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Pencil, X } from 'lucide-react';
import { z } from 'zod';
import type { Driver, Trip } from '@/lib/api/generated';
import { ApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { containDialogFocus } from '@/components/layout/dialog-focus';
import { ReferencePicker } from '@/features/lookups';
import { driverWriteAction, tripWriteAction } from './mutations';
import {
  driverFormSchema,
  driverWritePayload,
  localDateTimeValue,
  tripFormSchema,
  tripWritePayload,
  type DriverFormValues,
  type TripFormValues,
} from './write-model';
import { ForbiddenOperation, useCatalogNames } from './shared';
import './operations.css';

export type EditableOperation =
  { module: 'drivers'; data: Driver } | { module: 'trips'; data: Trip };

type DriverAttempt = { action: ReturnType<typeof driverWriteAction>; values: DriverFormValues };
type TripAttempt = { action: ReturnType<typeof tripWriteAction>; values: TripFormValues };

export function uncertainOperation(error: ApiError | null) {
  return (
    !error || error.code === 'network' || error.code === 'invalid_response' || error.status >= 500
  );
}

export function OperationsCreatePage({ module }: { module: 'trips' | 'drivers' }) {
  const { user } = useAuth();
  const router = useRouter();
  const [driverAttempt, setDriverAttempt] = useState<DriverAttempt | null>(null);
  const [tripAttempt, setTripAttempt] = useState<TripAttempt | null>(null);
  const [created, setCreated] = useState(false);
  const permission = module === 'trips' ? 'trips.create' : 'drivers.manage';
  const canRead = can(user, module === 'trips' ? 'trips.view' : 'drivers.view');
  const onSaved = (id: string) => {
    if (canRead) router.push(`/${module}/${id}`);
    else setCreated(true);
  };
  if (!can(user, permission)) return <ForbiddenOperation />;
  if (created)
    return (
      <section className="surface empty-panel">
        <h1>{module === 'trips' ? 'تم إنشاء الرحلة' : 'تمت إضافة السائق'}</h1>
        <p>اعتمدت الخدمة الطلب بنجاح.</p>
        <button type="button" className="button button-primary" onClick={() => setCreated(false)}>
          إضافة سجل آخر
        </button>
        <Link className="text-link" href="/settings">
          العودة إلى مساحة العمل
        </Link>
      </section>
    );
  return (
    <div className="operations-page">
      <Link className="text-link" href={canRead ? `/${module}` : '/settings'}>
        <ArrowRight size={15} aria-hidden="true" />
        العودة إلى مساحة العمل
      </Link>
      <div className="page-heading operation-detail-heading">
        <div>
          <h1>{module === 'trips' ? 'إنشاء رحلة' : 'إضافة سائق'}</h1>
          <p>أدخل البيانات المطلوبة، ثم راجعها قبل الحفظ.</p>
        </div>
      </div>
      <section className="surface operation-form-panel">
        {module === 'drivers' ? (
          <DriverForm attempt={driverAttempt} onAttempt={setDriverAttempt} saved={onSaved} />
        ) : (
          <TripForm attempt={tripAttempt} onAttempt={setTripAttempt} saved={onSaved} />
        )}
      </section>
    </div>
  );
}

export function OperationEditButton({ record }: { record: EditableOperation }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [driverAttempt, setDriverAttempt] = useState<DriverAttempt | null>(null);
  const [tripAttempt, setTripAttempt] = useState<TripAttempt | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  if (!can(user, record.module === 'trips' ? 'trips.update' : 'drivers.manage')) return null;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="button button-secondary"
        onClick={() => {
          setSaved(false);
          setOpen(true);
        }}
      >
        <Pencil size={15} aria-hidden="true" />
        تعديل البيانات
      </button>
      {saved && (
        <span role="status" className="operation-saved-note">
          تم حفظ التعديلات.
        </span>
      )}
      {open && (
        <dialog
          className="operation-editor-dialog"
          ref={(node) => {
            if (node && !node.open) node.showModal();
          }}
          aria-labelledby={`${id}-title`}
          onKeyDown={containDialogFocus}
          onCancel={(event) => {
            if (pending) event.preventDefault();
          }}
          onClose={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
        >
          <div className="operation-editor-header">
            <h2 id={`${id}-title`}>تعديل {record.module === 'trips' ? 'الرحلة' : 'السائق'}</h2>
            <button
              className="icon-button"
              type="button"
              aria-label="إغلاق"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X size={18} />
            </button>
          </div>
          {record.module === 'drivers' ? (
            <DriverForm
              attempt={driverAttempt}
              onAttempt={setDriverAttempt}
              onPending={setPending}
              record={record.data}
              saved={() => {
                setSaved(true);
                setOpen(false);
                trigger.current?.focus();
              }}
            />
          ) : (
            <TripForm
              attempt={tripAttempt}
              onAttempt={setTripAttempt}
              onPending={setPending}
              record={record.data}
              saved={() => {
                setSaved(true);
                setOpen(false);
                trigger.current?.focus();
              }}
            />
          )}
        </dialog>
      )}
    </>
  );
}

function useWriteCompletion(module: 'trips' | 'drivers') {
  const query = useQueryClient();
  return async () => {
    await Promise.all([
      query.invalidateQueries({ queryKey: ['operations', module] }),
      ...(module === 'drivers'
        ? [
            query.invalidateQueries({ queryKey: ['drivers', 'list'] }),
            query.invalidateQueries({ queryKey: ['references', 'driver'] }),
          ]
        : []),
      query.invalidateQueries({ queryKey: ['operations', 'audit'] }),
      query.invalidateQueries({ queryKey: ['reports'] }),
    ]);
  };
}

function DriverForm({
  record,
  saved,
  attempt,
  onAttempt,
  onPending,
}: {
  record?: Driver;
  saved: (id: string) => void;
  attempt: DriverAttempt | null;
  onAttempt: (attempt: DriverAttempt | null) => void;
  onPending?: (pending: boolean) => void;
}) {
  const { user } = useAuth();
  const id = useId();
  const [failure, setFailure] = useState<ApiError | null>(null);
  const complete = useWriteCompletion('drivers');
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema, { error: () => 'يرجى مراجعة قيمة الحقل.' }),
    defaultValues: attempt?.values ?? {
      full_name: record?.full_name ?? '',
      phone: record?.phone ?? '',
      license_number: record?.license_number ?? '',
      user_id: record?.user_id ?? '',
      active: record ? (record.active ? 'true' : 'false') : 'default',
    },
  });
  const submit = handleSubmit(async (values) => {
    if (!can(user, 'drivers.manage')) {
      setFailure(new ApiError({ status: 403 }));
      return;
    }
    setFailure(null);
    const body = driverWritePayload(values, record);
    if (!attempt && !Object.keys(body).length) {
      setFailure(new ApiError({ code: 'invalid_request' }));
      return;
    }
    const currentAttempt = attempt ?? {
      values: structuredClone(values),
      action: driverWriteAction(body, record?.id),
    };
    onAttempt(currentAttempt);
    onPending?.(true);
    try {
      const response = await currentAttempt.action.run();
      onAttempt(null);
      await complete();
      saved(response.data.id);
    } catch (cause) {
      const error = cause instanceof ApiError ? cause : new ApiError({ code: 'network' });
      setFailure(error);
      for (const key of Object.keys(error.validationErrors))
        if (key in values)
          setError(key as keyof DriverFormValues, { message: error.validationErrors[key][0] });
      if (error.status === 409) await complete();
    } finally {
      onPending?.(false);
    }
  });
  return (
    <form onSubmit={submit} noValidate aria-busy={isSubmitting}>
      <fieldset disabled={isSubmitting || !!attempt} className="operation-form-fields">
        <FormField id={`${id}-name`} label="الاسم الكامل" error={errors.full_name?.message}>
          <input id={`${id}-name`} {...register('full_name')} maxLength={150} autoComplete="name" />
        </FormField>
        <FormField id={`${id}-phone`} label="رقم الهاتف" error={errors.phone?.message}>
          <input
            id={`${id}-phone`}
            {...register('phone')}
            type="tel"
            dir="ltr"
            maxLength={30}
            autoComplete="tel"
          />
        </FormField>
        <FormField
          id={`${id}-license`}
          label="رقم الرخصة — اختياري"
          error={errors.license_number?.message}
        >
          <input id={`${id}-license`} {...register('license_number')} dir="ltr" maxLength={80} />
        </FormField>
        <FormField
          id={`${id}-user`}
          label="الحساب المرتبط — اختياري"
          error={errors.user_id?.message}
        >
          <Controller
            control={control}
            name="user_id"
            render={({ field }) => (
              <ReferencePicker
                kind="user"
                id={`${id}-user`}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                inputRef={field.ref}
                selectedLabel={record?.user_id ? 'الحساب المرتبط الحالي' : undefined}
                disabled={isSubmitting || !!attempt}
                invalid={Boolean(errors.user_id)}
                describedBy={errors.user_id ? `${id}-user-error` : undefined}
              />
            )}
          />
          <small className="field-hint">تتحقق الخدمة من صلاحية ربط الحساب بهذا السائق.</small>
        </FormField>
        <FormField id={`${id}-active`} label="حالة السائق" error={errors.active?.message}>
          <select id={`${id}-active`} {...register('active')}>
            <option value="default">إعداد الخدمة الافتراضي</option>
            <option value="true">نشط</option>
            <option value="false">غير نشط</option>
          </select>
        </FormField>
      </fieldset>
      {record && (
        <p className="operation-note">
          تعطيل السائق يؤثر على إتاحته للعمل. تراجع الخدمة ارتباطاته قبل اعتماد التغيير.
        </p>
      )}
      <WriteFeedback failure={failure} />
      {attempt && !isSubmitting && (
        <p className="inline-notice">
          حُفظ الطلب السابق. أعد المحاولة بنفس البيانات للتحقق من نتيجته دون إنشاء طلب مكرر.
        </p>
      )}
      <div className="operation-form-actions">
        {attempt && !isSubmitting && !uncertainOperation(failure) && (
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              onAttempt(null);
              setFailure(null);
            }}
          >
            تعديل الطلب المرفوض
          </button>
        )}
        <button className="button button-primary" disabled={isSubmitting}>
          {isSubmitting
            ? 'جارٍ الحفظ…'
            : attempt
              ? 'إعادة المحاولة نفسها'
              : record
                ? 'حفظ التعديلات'
                : 'إضافة السائق'}
        </button>
      </div>
    </form>
  );
}

function TripForm({
  record,
  saved,
  attempt,
  onAttempt,
  onPending,
}: {
  record?: Trip;
  saved: (id: string) => void;
  attempt: TripAttempt | null;
  onAttempt: (attempt: TripAttempt | null) => void;
  onPending?: (pending: boolean) => void;
}) {
  const { user } = useAuth();
  const id = useId();
  const catalog = useCatalogNames();
  const [failure, setFailure] = useState<ApiError | null>(null);
  const complete = useWriteCompletion('trips');
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema, { error: () => 'يرجى مراجعة قيمة الحقل.' }),
    defaultValues: attempt?.values ?? {
      origin_city_id: record?.origin_city_id ?? '',
      destination_city_id: record?.destination_city_id ?? '',
      driver_id: record?.driver_id ?? '',
      branch_id: record?.branch_id ?? '',
      departure_at: localDateTimeValue(record?.departure_at),
      estimated_arrival_at: localDateTimeValue(record?.estimated_arrival_at),
    },
  });
  const submit = handleSubmit(async (values) => {
    if (!can(user, record ? 'trips.update' : 'trips.create')) {
      setFailure(new ApiError({ status: 403 }));
      return;
    }
    setFailure(null);
    let body: ReturnType<typeof tripWritePayload>;
    try {
      body = tripWritePayload(values, record);
    } catch (cause) {
      if (cause instanceof z.ZodError)
        for (const issue of cause.issues) {
          const key = issue.path[0];
          if (typeof key === 'string' && key in values)
            setError(key as keyof TripFormValues, { message: 'يرجى مراجعة قيمة الحقل.' });
        }
      else setError('departure_at', { message: 'أدخل موعداً صالحاً.' });
      return;
    }
    if (!attempt && !Object.keys(body).length) {
      setFailure(new ApiError({ code: 'invalid_request' }));
      return;
    }
    const currentAttempt = attempt ?? {
      values: structuredClone(values),
      action: tripWriteAction(body, record?.id),
    };
    onAttempt(currentAttempt);
    onPending?.(true);
    try {
      const response = await currentAttempt.action.run();
      onAttempt(null);
      await complete();
      saved(response.data.id);
    } catch (cause) {
      const error = cause instanceof ApiError ? cause : new ApiError({ code: 'network' });
      setFailure(error);
      for (const key of Object.keys(error.validationErrors))
        if (key in values)
          setError(key as keyof TripFormValues, { message: error.validationErrors[key][0] });
      if (error.status === 409) await complete();
    } finally {
      onPending?.(false);
    }
  });
  const options = Array.from(catalog.names.cities);
  return (
    <form onSubmit={submit} noValidate aria-busy={isSubmitting}>
      <fieldset disabled={isSubmitting || !!attempt} className="operation-form-fields">
        <FormField
          id={`${id}-origin`}
          label="مدينة الانطلاق"
          error={errors.origin_city_id?.message}
        >
          <select id={`${id}-origin`} {...register('origin_city_id')}>
            <option value="">اختر المدينة</option>
            {record && !catalog.names.cities.has(record.origin_city_id) && (
              <option value={record.origin_city_id}>
                {record.origin_city?.name_ar ?? 'المدينة الحالية'}
              </option>
            )}
            {options.map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          id={`${id}-destination`}
          label="مدينة الوصول"
          error={errors.destination_city_id?.message}
        >
          <select id={`${id}-destination`} {...register('destination_city_id')}>
            <option value="">اختر المدينة</option>
            {record && !catalog.names.cities.has(record.destination_city_id) && (
              <option value={record.destination_city_id}>
                {record.destination_city?.name_ar ?? 'المدينة الحالية'}
              </option>
            )}
            {options.map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          id={`${id}-departure`}
          label="موعد الانطلاق — بتوقيت ليبيا"
          error={errors.departure_at?.message}
        >
          <input
            id={`${id}-departure`}
            type="datetime-local"
            dir="ltr"
            {...register('departure_at')}
          />
        </FormField>
        <FormField
          id={`${id}-arrival`}
          label="الوصول المتوقع — اختياري"
          error={errors.estimated_arrival_at?.message}
        >
          <input
            id={`${id}-arrival`}
            type="datetime-local"
            dir="ltr"
            {...register('estimated_arrival_at')}
          />
        </FormField>
        <FormField id={`${id}-driver`} label="السائق — اختياري" error={errors.driver_id?.message}>
          <Controller
            control={control}
            name="driver_id"
            render={({ field }) => (
              <ReferencePicker
                kind="driver"
                id={`${id}-driver`}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                inputRef={field.ref}
                selectedLabel={record?.driver?.full_name}
                disabled={isSubmitting || !!attempt}
                invalid={Boolean(errors.driver_id)}
                describedBy={errors.driver_id ? `${id}-driver-error` : undefined}
              />
            )}
          />
        </FormField>
        <FormField id={`${id}-branch`} label="الفرع — اختياري" error={errors.branch_id?.message}>
          <Controller
            control={control}
            name="branch_id"
            render={({ field }) => (
              <ReferencePicker
                kind="branch"
                id={`${id}-branch`}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                inputRef={field.ref}
                selectedLabel={record?.branch_id ? 'الفرع الحالي' : undefined}
                disabled={isSubmitting || !!attempt}
                invalid={Boolean(errors.branch_id)}
                describedBy={errors.branch_id ? `${id}-branch-error` : undefined}
              />
            )}
          />
        </FormField>
      </fieldset>
      {!catalog.isPending && !options.length && (
        <p className="inline-notice">
          لا تتوفر مدن نشطة للاختيار. أضف المدن المعتمدة قبل إنشاء الرحلة.
        </p>
      )}
      <p className="operation-note">
        المواعيد بتوقيت Africa/Tripoli. تتحقق الخدمة من المسار والسائق والفرع؛ لا يُعتمد التغيير قبل
        استجابة ناجحة.
      </p>
      <WriteFeedback failure={failure} />
      {attempt && !isSubmitting && (
        <p className="inline-notice">
          حُفظ الطلب السابق. أعد المحاولة بنفس البيانات للتحقق من نتيجته دون إنشاء طلب مكرر.
        </p>
      )}
      <div className="operation-form-actions">
        {attempt && !isSubmitting && !uncertainOperation(failure) && (
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              onAttempt(null);
              setFailure(null);
            }}
          >
            تعديل الطلب المرفوض
          </button>
        )}
        <button className="button button-primary" disabled={isSubmitting || catalog.isPending}>
          {isSubmitting
            ? 'جارٍ الحفظ…'
            : attempt
              ? 'إعادة المحاولة نفسها'
              : record
                ? 'حفظ التعديلات'
                : 'إنشاء الرحلة'}
        </button>
      </div>
    </form>
  );
}

function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {Children.map(children, (child) =>
        isValidElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>(
          child,
        ) && child.props.id === id
          ? cloneElement(child, {
              'aria-invalid': Boolean(error),
              'aria-describedby': error ? `${id}-error` : undefined,
            })
          : child,
      )}
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function WriteFeedback({ failure }: { failure: ApiError | null }) {
  return failure ? (
    <div className="inline-notice inline-error" role="alert">
      <p>
        {failure.status === 409
          ? 'تعذّر تنفيذ العملية بسبب تعارض. راجع أحدث البيانات قبل المحاولة مجددًا.'
          : failure.message}
        {failure.requestId && (
          <>
            <br />
            مرجع الدعم: <bdi>{failure.requestId}</bdi>
          </>
        )}
      </p>
    </div>
  ) : null;
}
