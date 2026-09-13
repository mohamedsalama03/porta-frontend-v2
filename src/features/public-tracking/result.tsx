'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Copy, Package, RefreshCw } from 'lucide-react';
import type { TrackingData } from './api';
import { trackingStatusPresentation } from './status';
import { TrackingTime, TrackingTimeline } from './timeline';

export function TrackingResult({
  data,
  refreshing,
  refreshDisabled,
  onRefresh,
}: {
  data: TrackingData;
  refreshing: boolean;
  refreshDisabled: boolean;
  onRefresh: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const status = trackingStatusPresentation[data.current_status];

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [data.tracking_number]);

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(data.tracking_number);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  return (
    <article className="tracking-result" aria-labelledby="tracking-result-heading">
      <div className="tracking-current" data-tone={status.tone}>
        {status.tone === 'complete' ? (
          <CheckCircle2 size={28} aria-hidden="true" />
        ) : (
          <Package size={28} aria-hidden="true" />
        )}
        <div>
          <h2 ref={heading} id="tracking-result-heading" tabIndex={-1}>
            {status.label}
          </h2>
          <p>{status.description}</p>
        </div>
      </div>
      <div className="tracking-identity">
        <div>
          <p className="tracking-muted">رقم التتبع</p>
          <bdi dir="ltr" className="tracking-number">
            {data.tracking_number}
          </bdi>
        </div>
        <button type="button" className="button button-secondary" onClick={copyNumber}>
          {copyState === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          نسخ رقم التتبع
        </button>
        <p className="tracking-copy-feedback" role="status">
          {copyState === 'copied'
            ? 'تم نسخ رقم التتبع.'
            : copyState === 'failed'
              ? 'تعذّر النسخ. حدّد رقم التتبع وانسخه يدويًا.'
              : '\u00a0'}
        </p>
      </div>
      <dl className="tracking-summary">
        <div>
          <dt>من</dt>
          <dd>{data.origin_city.name_ar}</dd>
        </div>
        <div>
          <dt>إلى</dt>
          <dd>{data.destination_city.name_ar}</dd>
        </div>
        <div>
          <dt>نوع الشحنة</dt>
          <dd>{data.shipment_type}</dd>
        </div>
        <div>
          <dt>تاريخ الطلب</dt>
          <dd>
            <TrackingTime value={data.created_at} />
          </dd>
        </div>
        {data.estimated_delivery && (
          <div>
            <dt>موعد التسليم المتوقع</dt>
            <dd>
              <TrackingTime value={data.estimated_delivery} />
            </dd>
          </div>
        )}
      </dl>
      <TrackingTimeline events={data.tracking_timeline} />
      <div className="tracking-refresh">
        <button
          type="button"
          className="button button-secondary"
          aria-disabled={refreshDisabled}
          onClick={() => {
            if (!refreshDisabled) onRefresh();
          }}
        >
          <RefreshCw
            aria-hidden="true"
            className={refreshing ? 'tracking-refreshing' : undefined}
          />
          تحديث الحالة
        </button>
        <p>تُعرض الحالة عند الطلب. يمكنك تحديثها يدويًا.</p>
      </div>
    </article>
  );
}
