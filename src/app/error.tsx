'use client';
import Link from 'next/link';
import { RefreshCw, TriangleAlert } from 'lucide-react';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="standalone-state">
      <section className="surface empty-panel" role="alert">
        <div className="empty-symbol">
          <TriangleAlert aria-hidden="true" />
        </div>
        <h1>تعذر عرض الصفحة</h1>
        <p>حدث خطأ غير متوقع. أعد المحاولة أو ارجع إلى الصفحة الرئيسية.</p>
        <div className="page-actions">
          <button className="button button-primary" onClick={reset}>
            <RefreshCw aria-hidden="true" />
            إعادة المحاولة
          </button>
          <Link className="button button-secondary" href="/dashboard">
            الرئيسية
          </Link>
        </div>
      </section>
    </main>
  );
}
