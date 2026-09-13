'use client';

import { useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link2, Unlink, X } from 'lucide-react';
import type { AttachShipmentsInput } from '@/lib/api/generated';
import { ApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { containDialogFocus } from '@/components/layout/dialog-focus';
import { attachShipmentsAction, detachShipmentAction } from './mutations';
import { parseAttachmentInput } from './write-model';
import { WriteFeedback, uncertainOperation } from './editor';

type AssignmentAttempt = {
  body: AttachShipmentsInput | null;
  text: string;
  run: () => Promise<unknown>;
  failure: ApiError | null;
};

export function TripShipmentsAction({
  tripId,
  shipment,
}: {
  tripId: string;
  shipment?: { id: string; tracking_number: string };
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState<AssignmentAttempt | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  if (!can(user, 'trips.assign_shipments')) return null;
  return (
    <>
      <button
        ref={trigger}
        className={`button ${shipment ? 'button-ghost' : 'button-secondary'}`}
        type="button"
        onClick={() => {
          setSaved(false);
          setOpen(true);
        }}
      >
        {shipment ? (
          <Unlink size={15} aria-hidden="true" />
        ) : (
          <Link2 size={15} aria-hidden="true" />
        )}
        {shipment ? 'إزالة من الرحلة' : 'إسناد شحنات'}
      </button>
      {saved && (
        <span className="operation-saved-note" role="status">
          {shipment ? 'أُزيلت الشحنة من الرحلة.' : 'تم إسناد الشحنات.'}
        </span>
      )}
      {open && (
        <AssignmentDialog
          tripId={tripId}
          shipment={shipment}
          attempt={attempt}
          onAttempt={setAttempt}
          close={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
          saved={() => {
            setSaved(true);
            setAttempt(null);
            setOpen(false);
            trigger.current?.focus();
          }}
        />
      )}
    </>
  );
}

function AssignmentDialog({
  tripId,
  shipment,
  close,
  saved,
  attempt,
  onAttempt,
}: {
  tripId: string;
  shipment?: { id: string; tracking_number: string };
  close: () => void;
  saved: () => void;
  attempt: AssignmentAttempt | null;
  onAttempt: (attempt: AssignmentAttempt | null) => void;
}) {
  const id = useId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState(attempt?.text ?? '');
  const [validated, setValidated] = useState<AttachShipmentsInput | null>(attempt?.body ?? null);
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(attempt?.failure ?? null);
  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['operations', 'trips'] }),
      queryClient.invalidateQueries({ queryKey: ['shipments'] }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
      queryClient.invalidateQueries({ queryKey: ['operations', 'audit'] }),
    ]);
  }
  async function submit() {
    if (!can(user, 'trips.assign_shipments')) {
      setFailure(new ApiError({ status: 403 }));
      return;
    }
    if (!shipment && !validated) return;
    setPending(true);
    setFailure(null);
    let currentAttempt = attempt;
    if (!currentAttempt) {
      const action = shipment
        ? detachShipmentAction(tripId, shipment.id)
        : attachShipmentsAction(tripId, validated!);
      currentAttempt = { body: validated, text, run: action.run, failure: null };
      onAttempt(currentAttempt);
    }
    try {
      await currentAttempt.run();
      await invalidate();
      saved();
    } catch (cause) {
      const error = cause instanceof ApiError ? cause : new ApiError({ code: 'network' });
      setFailure(error);
      onAttempt({ ...currentAttempt, failure: error });
      if (error.status === 409) await invalidate();
    } finally {
      setPending(false);
    }
  }
  return (
    <dialog
      className="operation-editor-dialog operation-assignment-dialog"
      ref={(node) => {
        if (node && !node.open) node.showModal();
      }}
      aria-labelledby={`${id}-title`}
      onKeyDown={containDialogFocus}
      onCancel={(event) => {
        if (pending) event.preventDefault();
        else close();
      }}
      onClose={close}
    >
      <div className="operation-editor-header">
        <h2 id={`${id}-title`}>{shipment ? 'إزالة الشحنة من الرحلة' : 'إسناد شحنات إلى الرحلة'}</h2>
        <button
          type="button"
          className="icon-button"
          disabled={pending}
          aria-label="إغلاق"
          onClick={close}
        >
          <X size={18} />
        </button>
      </div>
      {shipment ? (
        <p className="operation-note">
          سيُطلب إزالة الشحنة <bdi>{shipment.tracking_number}</bdi> من هذه الرحلة. تبقى الشحنة في
          المنظومة. تتحقق الخدمة من إمكانية الإزالة قبل اعتمادها.
        </p>
      ) : validated ? (
        <div className="operation-attachment-review">
          <h3>إسناد {validated.shipment_ids.length} شحنة</h3>
          <p>
            يراجع الطلب جميع الشحنات دفعة واحدة. إذا رفضت الخدمة إحدى الشحنات، لا يُعتمد الإسناد لأي
            منها.
          </p>
          <button
            type="button"
            className="button button-ghost"
            disabled={pending || (!!attempt && uncertainOperation(failure))}
            onClick={() => {
              setValidated(null);
              setFailure(null);
              onAttempt(null);
            }}
          >
            مراجعة الشحنات
          </button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setInvalid(false);
            try {
              setValidated(parseAttachmentInput(text));
            } catch {
              setInvalid(true);
            }
          }}
        >
          <div className="field">
            <label htmlFor={`${id}-ids`}>معرّفات الشحنات</label>
            <textarea
              id={`${id}-ids`}
              dir="ltr"
              rows={6}
              value={text}
              maxLength={6000}
              onChange={(event) => setText(event.target.value)}
              aria-invalid={invalid}
              aria-describedby={`${id}-help`}
            />
            <p id={`${id}-help`} className="field-hint">
              معرّف واحد في كل سطر، حتى 200 شحنة. استخدم معرّف الشحنة من رابط تفاصيلها.
            </p>
            {invalid && (
              <p className="field-error" role="alert">
                أدخل من 1 إلى 200 معرّف صالح، دون تكرار.
              </p>
            )}
          </div>
          <div className="operation-form-actions">
            <button className="button button-primary">مراجعة الإسناد</button>
          </div>
        </form>
      )}
      <WriteFeedback failure={failure} />
      {(shipment || validated) && (
        <div className="operation-form-actions">
          <button
            className="button button-primary"
            disabled={pending}
            type="button"
            onClick={() => void submit()}
          >
            {pending ? 'جارٍ تنفيذ الطلب…' : shipment ? 'تأكيد الإزالة' : 'تأكيد الإسناد'}
          </button>
          <button
            type="button"
            className="button button-secondary"
            disabled={pending}
            onClick={close}
          >
            إلغاء
          </button>
        </div>
      )}
    </dialog>
  );
}
