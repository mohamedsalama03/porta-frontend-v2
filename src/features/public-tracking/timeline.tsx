import { formatDate } from '@/lib/formatters';
import type { TrackingData } from './api';
import { trackingStatusPresentation } from './status';

export function TrackingTime({ value }: { value: string }) {
  return <time dateTime={value}>{formatDate(value, { hour: '2-digit', minute: '2-digit' })}</time>;
}

export function TrackingTimeline({ events }: { events: TrackingData['tracking_timeline'] }) {
  return (
    <section className="tracking-history" aria-labelledby="tracking-history-heading">
      <div className="tracking-section-heading">
        <h3 id="tracking-history-heading">سجل الشحنة</h3>
        <p>الأوقات بتوقيت ليبيا</p>
      </div>
      {events.length ? (
        <ol className="tracking-timeline" aria-label="سجل الشحنة">
          {events.map((event, index) => (
            <li key={`${event.status}-${event.occurred_at}-${index}`}>
              <span className="tracking-timeline-dot" aria-hidden="true" />
              <div>
                <p className="tracking-event-label">
                  {trackingStatusPresentation[event.status].label}
                </p>
                <TrackingTime value={event.occurred_at} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="tracking-muted">لم تُضف تفاصيل إلى سجل الشحنة بعد.</p>
      )}
    </section>
  );
}
