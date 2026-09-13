'use client';

import { useEffect, useRef } from 'react';

export default function OrderError({
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
      <section role="alert" aria-labelledby="public-order-error-title">
        <h1 id="public-order-error-title" ref={heading} tabIndex={-1}>
          تعذر عرض نموذج الطلب
        </h1>
        <p>حدث خطأ أثناء عرض الصفحة. حاول مرة أخرى.</p>
        <button type="button" className="button button-primary" onClick={retry}>
          إعادة المحاولة
        </button>
      </section>
    </main>
  );
}
