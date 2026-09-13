'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { shipmentPatchSchema, type Shipment, type ShipmentPatch } from '@/lib/api/generated';
import { ApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { shipmentKeys } from '@/lib/query/keys';
import { assignShipmentDriverAction, getAssignableDrivers, updateShipmentAction } from './api';

function MutationError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="shipment-live-error" role="alert">
      <p>{error instanceof ApiError ? error.message : 'تعذّر إتمام العملية.'}</p>
      {error instanceof ApiError && error.requestId && (
        <p>
          مرجع الدعم: <bdi>{error.requestId}</bdi>
        </p>
      )}
    </div>
  );
}

const isUncertain = (error: unknown) =>
  error instanceof ApiError &&
  (['network', 'invalid_response'].includes(error.code) || error.status >= 500);

export function ShipmentEditPanel({ shipment }: { shipment: Shipment }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ShipmentPatch>({
    resolver: zodResolver(shipmentPatchSchema),
    mode: 'onBlur',
    defaultValues: {
      sender_name: shipment.sender_name,
      sender_phone: shipment.sender_phone,
      recipient_name: shipment.recipient_name,
      recipient_phone: shipment.recipient_phone,
      delivery_address: shipment.delivery_address ?? undefined,
      notes: shipment.notes ?? '',
    },
  });
  const attempt = useRef<{
    signature: string;
    body: ShipmentPatch;
    action: ReturnType<typeof updateShipmentAction>;
  } | null>(null);
  const save = useMutation({
    mutationFn: (body: ShipmentPatch) => {
      const signature = JSON.stringify(body);
      if (!attempt.current || attempt.current.signature !== signature)
        attempt.current = { signature, body, action: updateShipmentAction(shipment.id, body) };
      return attempt.current.action.run();
    },
    retry: false,
    onSuccess: async (result) => {
      queryClient.setQueryData(shipmentKeys.detail(shipment.id), result);
      await queryClient.invalidateQueries({ queryKey: shipmentKeys.lists() });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422)
        for (const [key, values] of Object.entries(error.validationErrors))
          if (key in (attempt.current?.body ?? {}))
            setError(key as keyof ShipmentPatch, { type: 'server', message: values[0] });
    },
  });
  const uncertain = isUncertain(save.error);
  const field = (name: keyof ShipmentPatch, label: string, type = 'text') => (
    <label className="shipment-form-field">
      <span>{label}</span>
      <input
        className="field"
        type={type}
        {...register(
          name,
          name === 'delivery_address' ? { setValueAs: (value) => value || undefined } : {},
        )}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `edit-error-${name}` : undefined}
      />
      {errors[name] && (
        <small role="alert" className="shipment-field-error" id={`edit-error-${name}`}>
          تحقق من قيمة هذا الحقل.
        </small>
      )}
    </label>
  );
  return (
    <>
      <details className="surface shipment-form-section">
        <summary className="shipment-edit-summary">تعديل بيانات التواصل والملاحظات</summary>
        <p className="shipment-integration-note">
          يتحقق الخادم من إمكانية التعديل بحسب حالة الشحنة. لا تتغير بيانات المسار أو التسعير هنا.
        </p>
        <form
          noValidate
          onSubmit={handleSubmit((body) => {
            if (!save.isPending && !uncertain) save.mutate(body);
          })}
          aria-label="تعديل بيانات الشحنة"
        >
          <fieldset
            className="shipment-live-fieldset shipment-form-grid"
            disabled={save.isPending || uncertain}
          >
            <legend className="shipment-sr-only">بيانات التواصل</legend>
            {field('sender_name', 'اسم المرسل')}
            {field('sender_phone', 'هاتف المرسل', 'tel')}
            {field('recipient_name', 'اسم المستلم')}
            {field('recipient_phone', 'هاتف المستلم', 'tel')}
            {field('delivery_address', 'عنوان التوصيل')}
            <label className="shipment-form-field shipment-form-wide">
              <span>ملاحظات الشحنة</span>
              <textarea className="field" rows={3} maxLength={2000} {...register('notes')} />
            </label>
          </fieldset>
          <MutationError error={save.error} />
          {uncertain && (
            <p className="shipment-integration-note">
              لم تتأكد نتيجة الحفظ. أعد محاولة البيانات نفسها قبل تعديلها.
            </p>
          )}
          {save.isSuccess && (
            <p role="status" className="shipment-success-feedback">
              تم حفظ التعديلات.
            </p>
          )}
          <div className="shipment-live-actions">
            {uncertain ? (
              <button
                type="button"
                className="button button-primary"
                disabled={save.isPending}
                onClick={() => {
                  if (attempt.current) save.mutate(attempt.current.body);
                }}
              >
                إعادة محاولة الحفظ نفسه
              </button>
            ) : (
              <button type="submit" className="button button-primary" disabled={save.isPending}>
                {save.isPending ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
              </button>
            )}
            {save.error instanceof ApiError && save.error.status === 409 && (
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  void queryClient.invalidateQueries({ queryKey: shipmentKeys.detail(shipment.id) })
                }
              >
                تحميل أحدث بيانات الشحنة
              </button>
            )}
          </div>
        </form>
      </details>
      <ShipmentDriverAssignment shipment={shipment} />
    </>
  );
}

function ShipmentDriverAssignment({ shipment }: { shipment: Shipment }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState({ id: '', label: '' });
  const drivers = useQuery({
    queryKey: ['drivers', 'list', { active: true, cursor }],
    queryFn: ({ signal }) => getAssignableDrivers(cursor, signal),
    enabled: open && can(user, 'drivers.view'),
  });
  const attempt = useRef<{
    id: string;
    action: ReturnType<typeof assignShipmentDriverAction>;
  } | null>(null);
  const assign = useMutation({
    mutationFn: (id: string) => {
      if (!attempt.current || attempt.current.id !== id)
        attempt.current = {
          id,
          action: assignShipmentDriverAction(shipment.id, { driver_id: id }),
        };
      return attempt.current.action.run();
    },
    retry: false,
    onSuccess: async (result) => {
      queryClient.setQueryData(shipmentKeys.detail(shipment.id), result);
      await queryClient.invalidateQueries({ queryKey: shipmentKeys.lists() });
      dialog.current?.close();
      setOpen(false);
    },
  });
  const uncertain = isUncertain(assign.error);
  return (
    <section className="shipment-actions-panel">
      <h2>السائق المسؤول</h2>
      <p>يتحقق الخادم من نشاط السائق وإمكانية التعيين لهذه الشحنة قبل حفظ التغيير.</p>
      <button
        className="button button-secondary"
        type="button"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        تعيين سائق
      </button>
      <dialog
        className="shipment-columns-dialog shipment-assignment-dialog"
        ref={dialog}
        aria-labelledby="shipment-assignment-title"
        onClose={() => setOpen(false)}
        onCancel={(event) => {
          if (assign.isPending) event.preventDefault();
        }}
      >
        <div className="shipment-dialog-heading">
          <h2 id="shipment-assignment-title">تعيين سائق للشحنة</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="إغلاق تعيين السائق"
            disabled={assign.isPending}
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        <p>
          <bdi>{shipment.tracking_number}</bdi>
        </p>
        {!can(user, 'drivers.view') ? (
          <p>يتطلب اختيار سائق صلاحية عرض السائقين.</p>
        ) : (
          <>
            <label className="shipment-form-field">
              <span>السائق</span>
              <select
                className="field"
                value={selected.id}
                disabled={assign.isPending || uncertain || drivers.isPending}
                onChange={(event) => {
                  const value = drivers.data?.data.find(
                    (driver) => driver.id === event.target.value,
                  );
                  setSelected({ id: value?.id ?? '', label: value?.full_name ?? '' });
                }}
              >
                <option value="">اختر سائقًا</option>
                {selected.id && !drivers.data?.data.some((driver) => driver.id === selected.id) && (
                  <option value={selected.id}>{selected.label}</option>
                )}
                {drivers.data?.data.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.full_name}
                  </option>
                ))}
              </select>
            </label>
            {drivers.error && <MutationError error={drivers.error} />}
            <div className="shipment-cursor-actions shipment-live-actions">
              <button
                type="button"
                className="button button-secondary"
                disabled={!drivers.data?.meta.previous_cursor || drivers.isFetching}
                onClick={() => setCursor(drivers.data?.meta.previous_cursor ?? null)}
              >
                <ChevronRight size={14} />
                السابق
              </button>
              <button
                type="button"
                className="button button-secondary"
                disabled={!drivers.data?.meta.next_cursor || drivers.isFetching}
                onClick={() => setCursor(drivers.data?.meta.next_cursor ?? null)}
              >
                التالي
                <ChevronLeft size={14} />
              </button>
            </div>
            <MutationError error={assign.error} />
            {uncertain && <p>لم تتأكد نتيجة التعيين. تحتفظ إعادة المحاولة بالعملية نفسها.</p>}
            <button
              className="button button-primary shipment-dialog-done"
              type="button"
              disabled={!selected.id || assign.isPending}
              onClick={() => assign.mutate(uncertain ? attempt.current!.id : selected.id)}
            >
              {assign.isPending
                ? 'جارٍ التعيين…'
                : uncertain
                  ? 'إعادة محاولة التعيين نفسه'
                  : `تأكيد تعيين ${selected.label || 'السائق'}`}
            </button>
          </>
        )}
      </dialog>
    </section>
  );
}
