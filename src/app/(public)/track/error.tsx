'use client';

import { useEffect, useRef } from 'react';

export default function TrackingError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <main id="main-content" className="public-order-main public-order-boundary" tabIndex={-1}>
      <section role="alert" aria-labelledby="tracking-boundary-heading">
        <h1 id="tracking-boundary-heading" ref={heading} tabIndex={-1}>
          تعذّر عرض صفحة التتبع
        </h1>
        <p>حدث خطأ أثناء عرض الصفحة. حاول مرة أخرى.</p>
        <button type="button" className="button button-primary" onClick={retry}>
          إعادة المحاولة
        </button>
      </section>
    </main>
  );
}
