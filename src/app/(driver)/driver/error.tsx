'use client';

import { RefreshCw } from 'lucide-react';

export default function DriverPageError({ reset }: { reset: () => void }) {
  return (
    <section className="driver-access-panel" role="alert">
      <h1>تعذّر عرض هذا القسم</h1>
      <p>أعد المحاولة أو اختر قسمًا آخر من قائمة مساحة السائق.</p>
      <button className="driver-shell-button" type="button" onClick={reset}>
        <RefreshCw aria-hidden="true" />
        إعادة المحاولة
      </button>
    </section>
  );
}
