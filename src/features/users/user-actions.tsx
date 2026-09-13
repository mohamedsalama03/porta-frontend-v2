'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Plus, Pencil, X } from 'lucide-react';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { createIdempotentAction } from '@/lib/api/idempotency';
import {
  approvedOperations,
  roleSchema,
  ulidSchema,
  userInputSchema,
  userPatchSchema,
  postAdminUsersResponseSchema,
  patchAdminUsersUserResponseSchema,
  type User,
  type UserInput,
  type UserPatch,
} from '@/lib/api/generated';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { ReferencePicker } from '@/features/lookups';
import './users.css';

const roleLabels = {
  SUPER_ADMIN: 'مدير أعلى',
  ADMIN: 'مدير',
  OPERATIONS_MANAGER: 'مدير العمليات',
  BRANCH_OPERATOR: 'موظف فرع',
  DRIVER: 'سائق',
} satisfies Record<z.infer<typeof roleSchema>, string>;
const formSchema = z.object({
  name: z.string().min(1, 'أدخل الاسم.').max(150),
  email: z.email('أدخل بريدًا إلكترونيًا صحيحًا.').max(254),
  password: z.string().max(1024),
  role: roleSchema,
  branch_id: z.union([z.literal(''), ulidSchema]),
  active: z.enum(['unchanged', 'true', 'false']),
});
type FormValues = z.infer<typeof formSchema>;
type UserAttempt = { body: string; values: FormValues; run: () => Promise<unknown> };

export function userWritePayload(values: FormValues, record?: User): UserInput | UserPatch {
  if (!record)
    return userInputSchema.parse({
      name: values.name,
      email: values.email,
      password: values.password,
      role: values.role,
      ...(values.branch_id ? { branch_id: values.branch_id } : {}),
      ...(values.active !== 'unchanged' ? { active: values.active === 'true' } : {}),
    });
  const body: UserPatch = {};
  if (values.role !== record.role) body.role = values.role;
  if (values.branch_id !== (record.branch_id ?? '')) body.branch_id = values.branch_id || null;
  if (values.active !== 'unchanged' && (values.active === 'true') !== record.active)
    body.active = values.active === 'true';
  return userPatchSchema.parse(body);
}

export function UserActions({ record, onSaved }: { record?: User; onSaved?: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState<UserAttempt | null>(null);
  const [failure, setFailure] = useState<ApiError | null>(null);
  if (!can(user, 'users.manage')) return null;
  return (
    <>
      <button
        type="button"
        className={`button ${record ? 'button-ghost' : 'button-primary'}`}
        onClick={() => {
          setSaved(false);
          setOpen(true);
        }}
      >
        {record ? <Pencil size={15} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
        {record ? 'تعديل الصلاحيات' : 'إضافة مستخدم'}
      </button>
      {saved && (
        <span role="status" className="user-save-note">
          تم حفظ الحساب.
        </span>
      )}
      {open && (
        <UserEditor
          record={record}
          attempt={attempt}
          setAttempt={setAttempt}
          failure={failure}
          setFailure={setFailure}
          close={() => setOpen(false)}
          saved={() => {
            setOpen(false);
            setSaved(true);
            setAttempt(null);
            setFailure(null);
            onSaved?.();
          }}
        />
      )}
    </>
  );
}

function UserEditor({
  record,
  close,
  saved,
  attempt,
  setAttempt,
  failure,
  setFailure,
}: {
  record?: User;
  close: () => void;
  saved: () => void;
  attempt: UserAttempt | null;
  setAttempt: (attempt: UserAttempt) => void;
  failure: ApiError | null;
  setFailure: (failure: ApiError | null) => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const uncertain =
    !!failure &&
    (failure.code === 'network' || failure.code === 'invalid_response' || failure.status >= 500);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema, { error: () => 'يرجى مراجعة قيمة هذا الحقل.' }),
    defaultValues: attempt?.values ?? {
      name: record?.name ?? '',
      email: record?.email ?? '',
      password: '',
      role: record?.role ?? 'BRANCH_OPERATOR',
      branch_id: record?.branch_id ?? '',
      active:
        record?.active === undefined ? 'unchanged' : (String(record.active) as 'true' | 'false'),
    },
  });
  async function submit(values: FormValues) {
    if (!can(user, 'users.manage')) {
      setFailure(new ApiError({ status: 403 }));
      return;
    }
    if (uncertain && attempt) {
      await execute(attempt);
      return;
    }
    setFailure(null);
    let body: UserInput | UserPatch;
    try {
      body = userWritePayload(values, record);
    } catch (cause) {
      if (cause instanceof z.ZodError)
        for (const issue of cause.issues) {
          const field = issue.path[0];
          if (typeof field === 'string' && field in values)
            setError(field as keyof FormValues, {
              message:
                field === 'password'
                  ? 'استخدم 12 حرفًا على الأقل مع حروف كبيرة وصغيرة ورقم ورمز.'
                  : 'يرجى مراجعة قيمة هذا الحقل.',
            });
        }
      return;
    }
    if (!Object.keys(body).length) {
      setFailure(new ApiError({ code: 'invalid_request' }));
      return;
    }
    const serialized = JSON.stringify(body);
    let next = attempt;
    if (!next || next.body !== serialized) {
      const snapshot = body;
      const write = createIdempotentAction((key) =>
        record
          ? api.request(`/api/v1/admin/users/${encodeURIComponent(ulidSchema.parse(record.id))}`, {
              method: 'PATCH',
              body: snapshot,
              bodySchema: userPatchSchema,
              schema: patchAdminUsersUserResponseSchema,
              idempotencyKey: approvedOperations.patchAdminUsersUser.idempotent ? key : undefined,
            })
          : api.request('/api/v1/admin/users', {
              method: 'POST',
              body: snapshot,
              bodySchema: userInputSchema,
              schema: postAdminUsersResponseSchema,
              idempotencyKey: approvedOperations.postAdminUsers.idempotent ? key : undefined,
            }),
      );
      next = { body: serialized, values: { ...values }, run: write.run };
      setAttempt(next);
    }
    await execute(next);
  }

  async function execute(next: UserAttempt) {
    setFailure(null);
    try {
      await next.run();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['operations', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['references', 'user'] }),
        queryClient.invalidateQueries({ queryKey: ['operations', 'audit'] }),
      ]);
      saved();
      // A role or active-state change may affect this browser's own authority.
      if (record) await refresh();
    } catch (cause) {
      const error = cause instanceof ApiError ? cause : new ApiError({ code: 'network' });
      setFailure(error);
      for (const field of Object.keys(error.validationErrors))
        if (field in next.values)
          setError(field as keyof FormValues, { message: error.validationErrors[field][0] });
    }
  }

  return (
    <dialog
      className="user-editor"
      aria-labelledby={`${id}-title`}
      ref={dialog}
      onCancel={(event) => {
        if (isSubmitting) event.preventDefault();
        else close();
      }}
    >
      <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
        <div className="user-editor-heading">
          <div>
            <h2 id={`${id}-title`}>{record ? 'تعديل صلاحيات المستخدم' : 'إضافة مستخدم'}</h2>
            <p>{record ? record.name : 'إنشاء حساب جديد لفريق العمل.'}</p>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="إغلاق"
            disabled={isSubmitting}
            onClick={close}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <fieldset disabled={isSubmitting || uncertain} className="user-editor-fields">
          {!record && (
            <>
              <UserField label="الاسم" error={errors.name?.message} id={`${id}-name`}>
                <input
                  id={`${id}-name`}
                  maxLength={150}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? `${id}-name-error` : undefined}
                  {...register('name')}
                />
              </UserField>
              <UserField label="البريد الإلكتروني" error={errors.email?.message} id={`${id}-email`}>
                <input
                  id={`${id}-email`}
                  type="email"
                  dir="ltr"
                  maxLength={254}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? `${id}-email-error` : undefined}
                  {...register('email')}
                />
              </UserField>
              <UserField
                label="كلمة المرور الأولية"
                error={errors.password?.message}
                id={`${id}-password`}
              >
                <input
                  id={`${id}-password`}
                  type="password"
                  dir="ltr"
                  autoComplete="new-password"
                  maxLength={1024}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? `${id}-password-error` : undefined}
                  {...register('password')}
                />
                <span className="field-hint">
                  12 حرفًا على الأقل، تشمل حروفًا كبيرة وصغيرة ورقمًا ورمزًا.
                </span>
              </UserField>
            </>
          )}
          <UserField label="الدور الوظيفي" error={errors.role?.message} id={`${id}-role`}>
            <select
              id={`${id}-role`}
              aria-invalid={Boolean(errors.role)}
              aria-describedby={errors.role ? `${id}-role-error` : undefined}
              {...register('role')}
            >
              {roleSchema.options.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          </UserField>
          <UserField label="الفرع" error={errors.branch_id?.message} id={`${id}-branch`}>
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
                  disabled={isSubmitting || uncertain}
                  invalid={Boolean(errors.branch_id)}
                  describedBy={errors.branch_id ? `${id}-branch-error` : undefined}
                />
              )}
            />
            <span className="field-hint">مطلوب لموظف الفرع.</span>
          </UserField>
          <UserField label="حالة الحساب" error={errors.active?.message} id={`${id}-active`}>
            <select
              id={`${id}-active`}
              aria-invalid={Boolean(errors.active)}
              aria-describedby={errors.active ? `${id}-active-error` : undefined}
              {...register('active')}
            >
              <option value="unchanged">{record ? 'دون تغيير' : 'الإعداد الافتراضي للخدمة'}</option>
              <option value="true">نشط</option>
              <option value="false">معطّل</option>
            </select>
          </UserField>
        </fieldset>
        <p className="user-authority-note">
          راجع الدور والفرع قبل الحفظ. تحدد الخدمة الصلاحيات الفعلية وتطبق القيود على تعديل
          الحسابات.
        </p>
        {failure && (
          <div className="inline-notice inline-error" role="alert">
            <p>
              {failure.message}
              {uncertain && (
                <>
                  <br />
                  لم تتأكد نتيجة العملية. بقيت البيانات ومفتاح الطلب محفوظة لهذه المحاولة؛ أعد إرسال
                  الطلب نفسه لتأكيد النتيجة.
                </>
              )}
              {failure.requestId && (
                <>
                  <br />
                  مرجع الدعم: <bdi>{failure.requestId}</bdi>
                </>
              )}
            </p>
          </div>
        )}
        <div className="user-editor-actions">
          <button type="submit" className="button button-primary" disabled={isSubmitting}>
            {isSubmitting
              ? 'جارٍ الحفظ…'
              : uncertain
                ? 'إعادة محاولة الطلب نفسه'
                : record
                  ? 'حفظ الصلاحيات'
                  : 'إنشاء الحساب'}
          </button>
          <button
            type="button"
            className="button button-secondary"
            disabled={isSubmitting}
            onClick={close}
          >
            إلغاء
          </button>
        </div>
      </form>
    </dialog>
  );
}

function UserField({
  label,
  error,
  id,
  children,
}: {
  label: string;
  error?: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
