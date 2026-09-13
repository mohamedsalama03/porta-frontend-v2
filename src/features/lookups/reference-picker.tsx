'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api/errors';
import { can } from '@/lib/permissions';
import {
  readReferencePage,
  referenceDefinitions,
  type ReferenceKind,
  type ReferenceOption,
  type ReferencePosition,
} from './api';
import './reference-picker.css';

export interface ReferencePickerProps {
  kind: ReferenceKind;
  id: string;
  value: string;
  onChange: (value: string) => void;
  selectedLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onBlur?: () => void;
  inputRef?: (element: HTMLInputElement | HTMLSelectElement | null) => void;
}

export function ReferencePicker(props: ReferencePickerProps) {
  return <ReferenceControl key={props.kind} {...props} />;
}

function ReferenceControl({
  kind,
  id,
  value,
  onChange,
  selectedLabel,
  disabled = false,
  invalid = false,
  describedBy,
  onBlur,
  inputRef,
}: ReferencePickerProps) {
  const { user } = useAuth();
  const definition = referenceDefinitions[kind];
  const allowed = can(user, definition.operation.permission);
  const [position, setPosition] = useState<ReferencePosition>({});
  const [history, setHistory] = useState<ReferencePosition[]>([]);
  const [remembered, setRemembered] = useState<ReferenceOption | null>(null);
  const [now, setNow] = useState(Date.now);
  const query = useQuery({
    queryKey: ['references', kind, position],
    queryFn: ({ signal }) => readReferencePage({ kind, position, subject: user, signal }),
    enabled: allowed && !disabled,
    staleTime: 30_000,
  });
  const error = query.error instanceof ApiError ? query.error : null;
  const retryAt = error?.retryAfter ? query.errorUpdatedAt + error.retryAfter : 0;
  const waiting = retryAt > now;
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.min(1_000, Math.max(0, retryAt - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [retryAt, waiting, now]);
  const options = query.data?.options ?? [];
  const selectedOnPage = options.find((option) => option.value === value);
  const selectedName =
    selectedOnPage?.label ??
    (remembered?.value === value ? remembered.label : selectedLabel) ??
    'الاختيار الحالي';
  const helpId = `${id}-reference-help`;
  const errorId = `${id}-reference-error`;
  const descriptions =
    [describedBy, !allowed ? helpId : undefined, query.isError && allowed ? errorId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;

  function changePage(next: ReferencePosition, backwards = false) {
    if (value) setRemembered({ value, label: selectedName });
    setHistory((pages) => (backwards ? pages.slice(0, -1) : [...pages, position]));
    setPosition(next);
  }

  if (!allowed)
    return (
      <div className="reference-picker">
        <input
          id={id}
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          dir="ltr"
          maxLength={26}
          autoComplete="off"
          aria-invalid={invalid}
          aria-describedby={descriptions}
        />
        <small id={helpId}>
          لا تتوفر صلاحية استعراض {definition.label} لهذا الحساب. يمكنك إدخال معرّف معتمد لديك؛
          تتحقق الخدمة من صلاحية الربط عند الحفظ.
        </small>
      </div>
    );

  const previous = history.at(-1) ?? query.data?.previous ?? null;
  return (
    <div className="reference-picker" aria-busy={query.isFetching}>
      <select
        id={id}
        ref={inputRef}
        value={value}
        onBlur={onBlur}
        disabled={disabled || query.isPending}
        aria-invalid={invalid}
        aria-describedby={descriptions}
        onChange={(event) => {
          const selected = options.find((option) => option.value === event.target.value);
          setRemembered(selected ?? null);
          onChange(event.target.value);
        }}
      >
        <option value="">{query.isPending ? 'جارٍ تحميل الخيارات…' : 'اختر من القائمة…'}</option>
        {value && !selectedOnPage && <option value={value}>{selectedName}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {query.isError ? (
        <div className="reference-error" id={errorId} role="alert">
          <p>
            {error?.message ?? 'تعذّر تحميل الخيارات.'}
            {error?.requestId && (
              <>
                {' '}
                مرجع الدعم: <bdi>{error.requestId}</bdi>
              </>
            )}
            {waiting && <> يرجى الانتظار {Math.ceil((retryAt - now) / 1000)} ثانية.</>}
          </p>
          <button
            className="button button-ghost"
            type="button"
            disabled={disabled || query.isFetching || waiting}
            onClick={() => {
              if (Date.now() >= retryAt) void query.refetch();
            }}
          >
            <RefreshCw size={13} aria-hidden="true" />
            إعادة المحاولة
          </button>
        </div>
      ) : (
        query.isSuccess && (
          <>
            {options.length === 0 && <small role="status">لا توجد خيارات في هذه الصفحة.</small>}
            <div className="reference-pagination">
              <small>{query.data.pageLabel}</small>
              <div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`الصفحة السابقة من ${definition.label}`}
                  disabled={disabled || query.isFetching || !previous}
                  onClick={() => {
                    if (previous) changePage(previous, true);
                  }}
                >
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`الصفحة التالية من ${definition.label}`}
                  disabled={disabled || query.isFetching || !query.data.next}
                  onClick={() => {
                    if (query.data.next) changePage(query.data.next);
                  }}
                >
                  <ChevronLeft size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
}
