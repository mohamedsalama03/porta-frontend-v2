'use client';
import { RefreshCw } from 'lucide-react';
export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="surface empty-panel" role="alert">
      <h1>تعذر عرض هذا القسم</h1>
      <p>أعد المحاولة. يمكنك استخدام القائمة للانتقال إلى قسم آخر.</p>
      <button className="button button-secondary" onClick={reset}>
        <RefreshCw aria-hidden="true" />
        إعادة المحاولة
      </button>
    </section>
  );
}
