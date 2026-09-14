'use client';

import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { ApiError } from '@/lib/api/errors';
import { formatDate } from '@/lib/formatters';
import type { CursorMeta } from '@/lib/api/generated';
import { driverQueryString } from './model';

export function DriverTime({ value }: { value: string }) {
  return <time dateTime={value}>{formatDate(value, { hour: '2-digit', minute: '2-digit' })}</time>;
}
export function DriverSkeleton() {
  return (
    <div className="driver-card-skeleton" role="status" aria-label="جارٍ تحميل العمل">
      <span className="sr-only">جارٍ تحميل العمل</span>
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export function driverErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'تعذّر تحميل البيانات. حاول مرة أخرى.';
  if (error.status === 401) return 'انتهت جلستك. سجّل الدخول للمتابعة.';
  if ([403, 404].includes(error.status)) return 'هذا العمل غير متاح لك حاليًا.';
  if (error.status === 409) return 'تم تحديث البيانات. يرجى مراجعة الحالة الحالية.';
  if (error.status === 422) return 'تعذّر قبول الإجراء. راجع بيانات الشحنة وحالتها ثم حاول مجددًا.';
  if (error.status === 429) return 'يرجى الانتظار قبل المحاولة مرة أخرى.';
  if (error.code === 'network') return 'تعذّر الاتصال. تحقق من الشبكة ثم حاول مجددًا.';
  return 'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى.';
}
export function DriverReadFeedback({
  query,
}: {
  query: {
    error: unknown;
    data?: unknown;
    isFetching: boolean;
    remainingMs: number;
    refresh: () => unknown;
  };
}) {
  const error = query.error instanceof ApiError ? query.error : null;
  return (
    <>
      {query.error && (
        <div className="driver-feedback" role="alert">
          <p>{driverErrorMessage(query.error)}</p>
          {query.data !== undefined && <p>قد تكون البيانات المعروضة قديمة. تعذّر تحديثها الآن.</p>}
          {error?.requestId && (
            <p className="driver-secondary">
              مرجع الطلب: <bdi dir="ltr">{error.requestId}</bdi>
            </p>
          )}
        </div>
      )}
      {query.remainingMs > 0 && (
        <p className="driver-secondary" role="status">
          يمكنك المحاولة بعد {Math.ceil(query.remainingMs / 1000)} ثانية.
        </p>
      )}
      <div className="driver-refresh-row">
        <button
          type="button"
          className="button button-secondary"
          aria-disabled={query.isFetching || query.remainingMs > 0}
          onClick={() => void query.refresh()}
        >
          <RefreshCw aria-hidden="true" />
          تحديث البيانات
        </button>
        {query.isFetching && (
          <span role="status" className="driver-secondary">
            جارٍ التحديث
          </span>
        )}
      </div>
    </>
  );
}
export function DriverEmpty({ children }: { children: string }) {
  return <p className="driver-empty">{children}</p>;
}
export function DriverInvalidFilters({ href }: { href: string }) {
  return (
    <div className="driver-feedback" role="alert">
      <h2>تعذّر قراءة خيارات العرض</h2>
      <p>افتح القائمة من البداية ثم اختر الحالة المطلوبة.</p>
      <Link className="button button-secondary" href={href}>
        إعادة ضبط العرض
      </Link>
    </div>
  );
}
export function DriverPagination({
  base,
  query,
  meta,
  disabled,
}: {
  base: string;
  query: Record<string, string | number | undefined>;
  meta: CursorMeta;
  disabled?: boolean;
}) {
  function href(cursor?: string) {
    return `${base}${driverQueryString({ ...query, cursor })}`;
  }
  return (
    <nav className="driver-pagination" aria-label="صفحات العمل">
      {meta.previous_cursor && (
        <Link
          className="button button-secondary"
          prefetch={false}
          aria-disabled={disabled}
          onClick={(event) => {
            if (disabled) event.preventDefault();
          }}
          href={href(meta.previous_cursor)}
        >
          السابق
        </Link>
      )}
      {query.cursor && !meta.previous_cursor && (
        <Link
          className="button button-secondary"
          prefetch={false}
          aria-disabled={disabled}
          onClick={(event) => {
            if (disabled) event.preventDefault();
          }}
          href={href()}
        >
          العودة للبداية
        </Link>
      )}
      {meta.next_cursor && (
        <Link
          className="button button-primary"
          prefetch={false}
          aria-disabled={disabled}
          onClick={(event) => {
            if (disabled) event.preventDefault();
          }}
          href={href(meta.next_cursor)}
        >
          التالي
        </Link>
      )}
    </nav>
  );
}
