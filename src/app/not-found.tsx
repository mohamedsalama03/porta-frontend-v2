import Link from 'next/link';
import { ArrowRight, MapPinOff } from 'lucide-react';
export default function NotFound() {
  return (
    <main className="standalone-state">
      <section className="surface empty-panel">
        <div className="empty-symbol">
          <MapPinOff aria-hidden="true" />
        </div>
        <h1>تعذر العثور على الصفحة</h1>
        <p>قد يكون الرابط غير صحيح أو لم تعد الصفحة متاحة.</p>
        <Link className="button button-primary" href="/dashboard">
          <ArrowRight aria-hidden="true" />
          العودة إلى الرئيسية
        </Link>
      </section>
    </main>
  );
}
