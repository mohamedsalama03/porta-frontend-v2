'use client';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { ApiError } from '@/lib/api/errors';
import { RetryButton } from './retry-button';
export function ErrorPanel({ error, retry }: { error: ApiError | null; retry: () => void }) {
  return (
    <section className="surface empty-panel" role="alert">
      <div className="empty-symbol">
        <ShieldAlert aria-hidden="true" />
      </div>
      <h2>تعذر تحميل البيانات</h2>
      <p>{error?.message || 'يرجى المحاولة مرة أخرى.'}</p>
      {error?.requestId && (
        <p>
          مرجع الدعم: <bdi>{error.requestId}</bdi>
        </p>
      )}
      <RetryButton error={error} retry={retry}>
        <RefreshCw aria-hidden="true" />
        إعادة المحاولة
      </RetryButton>
    </section>
  );
}
