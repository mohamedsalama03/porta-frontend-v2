'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, CheckCircle2, Copy } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';
import { trackingHref } from '@/features/public-tracking/model';
import { OrderReviewDetails, type OrderReviewData } from './summary';

export function OrderSuccess({
  trackingNumber,
  finalPrice,
  summary,
  onNewOrder,
}: {
  trackingNumber: string;
  finalPrice: number;
  summary: OrderReviewData;
  onNewOrder?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    heading.current?.focus();
  }, []);

  async function copyTracking() {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  return (
    <section className="public-order-success" aria-labelledby="public-order-success-heading">
      <div className="public-order-success-heading">
        <CheckCircle2 size={32} strokeWidth={1.5} aria-hidden="true" />
        <h2 id="public-order-success-heading" ref={heading} tabIndex={-1}>
          تم تسجيل طلب الشحن
        </h2>
        <p>احتفظ برقم التتبع للرجوع إلى طلبك.</p>
      </div>
      <div className="public-order-tracking">
        <p>رقم التتبع</p>
        <bdi dir="ltr" className="public-order-tracking-number">
          {trackingNumber}
        </bdi>
        <button type="button" className="button button-secondary" onClick={copyTracking}>
          {copyState === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          نسخ رقم التتبع
        </button>
        <p
          className={`public-order-copy-feedback${copyState === 'failed' ? ' public-order-field-error' : ''}`}
          role="status"
          aria-live="polite"
        >
          {copyState === 'copied'
            ? 'تم نسخ رقم التتبع.'
            : copyState === 'failed'
              ? 'تعذّر النسخ. حدّد رقم التتبع وانسخه يدويًا.'
              : '\u00a0'}
        </p>
      </div>
      <div className="public-order-success-price">
        <span>إجمالي سعر الشحن</span>
        <strong>
          <bdi>{formatMoney(finalPrice)}</bdi>
        </strong>
      </div>
      <div className="public-order-success-summary">
        <h3>بيانات الطلب التي أرسلتها</h3>
        <OrderReviewDetails data={summary} />
      </div>
      <div className="public-order-success-actions">
        <Link
          href={trackingHref(trackingNumber)}
          className="button button-primary"
          prefetch={false}
        >
          تتبع الشحنة
        </Link>
      </div>
      {onNewOrder && (
        <div className="public-order-success-actions">
          <button type="button" className="button button-secondary" onClick={onNewOrder}>
            طلب شحن آخر
          </button>
        </div>
      )}
    </section>
  );
}
