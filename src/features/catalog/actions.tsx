'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Pencil, Plus, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api/errors';
import { can } from '@/lib/permissions';
import { shipmentSizeSchema, type ShipmentSize } from '@/lib/api/generated';
import { RetryButton } from '@/components/feedback/retry-button';
import { createCatalogAction, readCatalogOptions } from './api';
import {
  catalogDefinitions,
  type CatalogField,
  type CatalogModule,
  type CatalogRecord,
} from './model';
import { catalogDefaults, catalogPayload } from './values';
import './catalog.css';

type Attempt = { action: ReturnType<typeof createCatalogAction>; values: Record<string, string> };
type LauncherProps = { module: CatalogModule; record?: CatalogRecord; onSuccess?: () => void };
const sizeLabels: Record<ShipmentSize, string> = { SMALL: 'صغير', MEDIUM: 'متوسط', LARGE: 'كبير' };

export function CatalogCreateAction({
  module,
  onSuccess,
}: {
  module: CatalogModule;
  onSuccess?: () => void;
}) {
  return <CatalogLauncher module={module} onSuccess={onSuccess} />;
}

export function CatalogEditAction({
  record,
  onSuccess,
}: {
  record: CatalogRecord;
  onSuccess?: () => void;
}) {
  return <CatalogLauncher module={record.module} record={record} onSuccess={onSuccess} />;
}

function CatalogLauncher({ module, record, onSuccess }: LauncherProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);
  const definition = catalogDefinitions[module];
  const allowed = can(user, (record ? definition.edit : definition.create).operation.permission);
  if (!allowed) return null;
  return (
    <>
      <button
        className={`button ${record ? 'button-ghost catalog-edit-trigger' : 'button-primary'}`}
        onClick={() => {
          setSaved(false);
          setOpen(true);
        }}
      >
        {record ? <Pencil size={15} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
        {record ? 'تعديل' : `إضافة ${definition.label}`}
      </button>
      {saved && (
        <span className="catalog-saved" role="status">
          تم الحفظ
        </span>
      )}
      {open && (
        <CatalogDialog
          module={module}
          record={record}
          attempt={attempt}
          failure={failure}
          onAttempt={setAttempt}
          onFailure={setFailure}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setAttempt(null);
            setFailure(null);
            setOpen(false);
            setSaved(true);
            onSuccess?.();
          }}
        />
      )}
    </>
  );
}

function CatalogDialog({
  module,
  record,
  attempt,
  failure,
  onAttempt,
  onFailure,
  onClose,
  onSuccess,
}: LauncherProps & {
  attempt: Attempt | null;
  failure: ApiError | null;
  onAttempt: (attempt: Attempt | null) => void;
  onFailure: (error: ApiError | null) => void;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(Date.now);
  const definition = catalogDefinitions[module];
  const target = record ? definition.edit : definition.create;
  const form = useForm<Record<string, string>>({
    defaultValues: catalogDefaults(module, record),
    values: attempt?.values,
    resetOptions: { keepDefaultValues: true },
  });
  const dirtyFields = form.formState.dirtyFields;
  const needsCities = definition.fields.some((field) => field.kind === 'city');
  const needsTypes = definition.fields.some((field) => field.kind === 'shipment-type');
  const cities = useQuery({
    queryKey: ['catalog', 'form-cities'],
    queryFn: ({ signal }) => readCatalogOptions('city', signal),
    enabled: needsCities,
    staleTime: 60_000,
  });
  const types = useQuery({
    queryKey: ['catalog', 'form-types'],
    queryFn: ({ signal }) => readCatalogOptions('shipment-type', signal),
    enabled: needsTypes,
    staleTime: 60_000,
  });
  const locked = pending || attempt !== null;
  const retryAt = attempt?.action.retryAt ?? 0;
  const waiting = retryAt > now;

  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    if (!waiting) return;
    const timeout = setTimeout(() => setNow(Date.now()), Math.min(retryAt - Date.now(), 1_000));
    return () => clearTimeout(timeout);
  }, [retryAt, waiting, now]);

  async function refreshAffected() {
    const invalidations = [queryClient.invalidateQueries({ queryKey: ['operations', module] })];
    if (module === 'branches')
      invalidations.push(queryClient.invalidateQueries({ queryKey: ['references', 'branch'] }));
    if (module === 'cities' || module === 'shipment-types')
      invalidations.push(queryClient.invalidateQueries({ queryKey: ['catalog'] }));
    if (module === 'cities')
      for (const affected of ['branches', 'pricing', 'trips'])
        invalidations.push(queryClient.invalidateQueries({ queryKey: ['operations', affected] }));
    if (module === 'shipment-types')
      invalidations.push(queryClient.invalidateQueries({ queryKey: ['operations', 'pricing'] }));
    if (module === 'pricing')
      invalidations.push(queryClient.invalidateQueries({ queryKey: ['shipments', 'quote'] }));
    await Promise.all(invalidations);
  }

  async function execute(next: Attempt) {
    if (!can(user, target.operation.permission)) {
      onFailure(new ApiError({ status: 403 }));
      return;
    }
    setPending(true);
    onFailure(null);
    try {
      await next.action.run();
      await refreshAffected();
      onSuccess();
    } catch (cause: unknown) {
      const error = cause instanceof ApiError ? cause : new ApiError({ code: 'network' });
      onFailure(error);
      for (const field of definition.fields) {
        if (error.validationErrors[field.name])
          form.setError(field.name, {
            type: 'server',
            message: error.validationErrors[field.name][0],
          });
      }
      if (error.status === 409)
        await queryClient.invalidateQueries({ queryKey: ['operations', module] });
    } finally {
      setPending(false);
    }
  }

  const submit = form.handleSubmit(async (values) => {
    if (attempt) {
      await execute(attempt);
      return;
    }
    form.clearErrors();
    const changed = record ? new Set(Object.keys(dirtyFields)) : undefined;
    const payload = catalogPayload(module, values, changed);
    const checked = target.body.safeParse(payload);
    let valid = checked.success;
    for (const field of definition.fields) {
      if (field.required && (!changed || changed.has(field.name)) && !values[field.name]?.trim()) {
        form.setError(field.name, { message: 'هذا الحقل مطلوب.' });
        valid = false;
      }
    }
    if (!checked.success)
      for (const issue of checked.error.issues) {
        const fieldName = String(issue.path[0] ?? '');
        if (definition.fields.some((field) => field.name === fieldName))
          form.setError(fieldName, { message: 'راجع هذه القيمة وفق الصيغة الموضحة.' });
      }
    if (!valid || !Object.keys(payload).length) {
      if (!Object.keys(payload).length)
        form.setError('root', { message: 'لم تغيّر أي بيانات بعد.' });
      const first = definition.fields.find(
        (field) => !values[field.name]?.trim() && field.required,
      );
      if (first) form.setFocus(first.name);
      return;
    }
    try {
      const next = {
        action: createCatalogAction({ module, id: record?.data.id, payload, subject: user }),
        values: { ...values },
      };
      onAttempt(next);
      await execute(next);
    } catch (cause: unknown) {
      onFailure(cause instanceof ApiError ? cause : new ApiError({ code: 'invalid_request' }));
    }
  });

  function fieldOptions(field: CatalogField) {
    if (field.kind === 'city') return cities.data ?? [];
    if (field.kind === 'shipment-type') return types.data ?? [];
    if (field.kind === 'size')
      return shipmentSizeSchema.options.map((value) => ({ value, label: sizeLabels[value] }));
    return [
      { value: 'true', label: 'نشط' },
      { value: 'false', label: 'غير نشط' },
    ];
  }

  const canRevise = failure && [400, 409, 422].includes(failure.status);
  return (
    <dialog
      className="catalog-dialog surface"
      ref={dialog}
      aria-labelledby={`${id}-title`}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <header className="catalog-dialog-heading">
        <div>
          <p className="eyebrow">إدارة البيانات</p>
          <h2 id={`${id}-title`}>
            {record ? 'تعديل' : 'إضافة'} {definition.label}
          </h2>
        </div>
        <button className="icon-button" aria-label="إغلاق" onClick={onClose} disabled={pending}>
          <X size={19} aria-hidden="true" />
        </button>
      </header>
      <form onSubmit={submit} noValidate>
        <div className="catalog-form-grid">
          {definition.fields.map((field) => {
            const error = form.formState.errors[field.name]?.message;
            const select = ['city', 'shipment-type', 'size', 'active'].includes(field.kind);
            const options = select ? fieldOptions(field) : [];
            const loadingOptions =
              field.kind === 'city'
                ? cities.isPending
                : field.kind === 'shipment-type'
                  ? types.isPending
                  : false;
            return (
              <div
                className={`field ${field.kind === 'textarea' ? 'catalog-full-field' : ''}`}
                key={field.name}
              >
                <label htmlFor={`${id}-${field.name}`}>
                  {field.label}
                  {field.required && <span aria-hidden="true"> *</span>}
                </label>
                {select ? (
                  <Controller
                    name={field.name}
                    control={form.control}
                    render={({ field: input }) => (
                      <select
                        {...input}
                        value={input.value ?? ''}
                        id={`${id}-${field.name}`}
                        disabled={locked || loadingOptions}
                        aria-required={field.required}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? `${id}-${field.name}-error` : undefined}
                      >
                        <option value="">
                          {loadingOptions
                            ? 'جارٍ تحميل الخيارات…'
                            : field.required
                              ? 'اختر…'
                              : 'غير محدد'}
                        </option>
                        {input.value && !options.some((option) => option.value === input.value) && (
                          <option value={input.value}>الاختيار الحالي</option>
                        )}
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                  />
                ) : field.kind === 'textarea' ? (
                  <textarea
                    id={`${id}-${field.name}`}
                    aria-required={field.required}
                    rows={3}
                    maxLength={field.maxLength}
                    readOnly={locked}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${id}-${field.name}-error` : undefined}
                    {...form.register(field.name)}
                  />
                ) : (
                  <input
                    id={`${id}-${field.name}`}
                    aria-required={field.required}
                    type={field.kind === 'datetime' ? 'datetime-local' : 'text'}
                    step={field.kind === 'datetime' ? 1 : undefined}
                    inputMode={
                      field.kind === 'money'
                        ? 'decimal'
                        : field.kind === 'integer'
                          ? 'numeric'
                          : undefined
                    }
                    dir={
                      field.kind === 'datetime' ||
                      field.kind === 'money' ||
                      field.kind === 'integer' ||
                      field.name === 'code' ||
                      field.name === 'name_en' ||
                      field.name === 'phone'
                        ? 'ltr'
                        : undefined
                    }
                    maxLength={field.maxLength}
                    readOnly={locked}
                    aria-invalid={Boolean(error)}
                    aria-describedby={
                      error
                        ? `${id}-${field.name}-error`
                        : field.hint
                          ? `${id}-${field.name}-hint`
                          : undefined
                    }
                    {...form.register(field.name)}
                  />
                )}
                {field.hint && <small id={`${id}-${field.name}-hint`}>{field.hint}</small>}
                {typeof error === 'string' && (
                  <p className="field-error" id={`${id}-${field.name}-error`}>
                    {error}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        {needsCities && cities.isSuccess && cities.data.length === 0 && (
          <p className="inline-notice">
            لا توجد مدن متاحة للاختيار. أضف مدينة من قسم المدن قبل إنشاء سجل يعتمد عليها.
          </p>
        )}
        {needsTypes && types.isSuccess && types.data.length === 0 && (
          <p className="inline-notice">
            لا توجد أنواع شحن متاحة. أضف نوع شحنة قبل إعداد تسعيرة جديدة.
          </p>
        )}
        {((needsCities && cities.isError) || (needsTypes && types.isError)) && (
          <div className="inline-notice inline-error" role="alert">
            <p>تعذّر تحميل الخيارات. أعد المحاولة قبل اختيار قيمة جديدة.</p>
            <RetryButton
              className="button button-ghost"
              error={needsCities ? cities.error : null}
              additionalError={needsTypes ? types.error : null}
              disabled={(needsCities && cities.isFetching) || (needsTypes && types.isFetching)}
              retry={() => {
                if (needsCities) void cities.refetch();
                if (needsTypes) void types.refetch();
              }}
            >
              إعادة تحميل الخيارات
            </RetryButton>
          </div>
        )}
        {typeof form.formState.errors.root?.message === 'string' && (
          <p role="alert" className="field-error">
            {form.formState.errors.root.message}
          </p>
        )}
        {failure && (
          <div className="inline-notice inline-error" role="alert">
            <p>
              {failure.status === 409
                ? 'تعذّر الحفظ بسبب تعارض. راجع أحدث البيانات قبل المحاولة من جديد.'
                : failure.message}
              {failure.requestId && (
                <>
                  <br />
                  مرجع الدعم: <bdi>{failure.requestId}</bdi>
                </>
              )}
              {waiting && (
                <>
                  <br />
                  يمكن إعادة المحاولة بعد {Math.ceil((retryAt - now) / 1000)} ثانية.
                </>
              )}
            </p>
          </div>
        )}
        {attempt && !pending && !canRevise && (
          <p className="catalog-attempt-note">
            تُعاد المحاولة بالبيانات نفسها لتجنّب تكرار العملية.
          </p>
        )}
        <footer className="catalog-dialog-footer">
          <button
            type="button"
            className="button button-secondary"
            disabled={pending}
            onClick={onClose}
          >
            إغلاق
          </button>
          {canRevise && (
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                onAttempt(null);
                onFailure(null);
              }}
            >
              مراجعة البيانات
            </button>
          )}
          <button type="submit" className="button button-primary" disabled={pending || waiting}>
            {pending && <LoaderCircle size={16} className="pending-icon" aria-hidden="true" />}
            {pending ? 'جارٍ الحفظ…' : attempt ? 'إعادة المحاولة نفسها' : 'حفظ'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
