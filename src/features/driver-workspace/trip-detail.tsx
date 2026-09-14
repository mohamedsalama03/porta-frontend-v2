'use client';

import Link from 'next/link';
import { ulidSchema } from '@/lib/api/generated';
import { getDriverTrip } from './api';
import { driverKeys } from './model';
import { driverTripStatusLabels } from './status';
import { useDriverRead } from './use-driver-read';
import { DriverShipmentList } from './shipment-list';
import { DriverReadFeedback, DriverSkeleton, DriverTime } from './ui';

export function DriverTripDetail({ id }: { id: string }) {
  const valid = ulidSchema.safeParse(id).success;
  const query = useDriverRead({
    queryKey: driverKeys.trip(id),
    queryFn: (signal) => getDriverTrip(id, signal),
    enabled: valid,
  });
  return (
    <div className="driver-content">
      <Link className="driver-text-link" href="/driver/trips" prefetch={false}>
        العودة إلى الرحلات
      </Link>
      <div className="driver-page-heading">
        <h1>تفاصيل الرحلة</h1>
        <p>الأوقات بتوقيت ليبيا</p>
      </div>
      {!valid ? (
        <p className="driver-feedback" role="alert">
          هذا العمل غير متاح لك حاليًا.
        </p>
      ) : (
        <>
          {!query.data && query.isFetching && <DriverSkeleton />}
          {query.data && (
            <section className="driver-detail" aria-label="بيانات الرحلة">
              <span className="driver-status">{driverTripStatusLabels[query.data.status]}</span>
              <h2 className="driver-detail-route">
                {query.data.origin_city?.name_ar ?? 'مدينة الإرسال غير متاحة'} —{' '}
                {query.data.destination_city?.name_ar ?? 'مدينة الوصول غير متاحة'}
              </h2>
              <dl className="driver-detail-grid">
                <div>
                  <dt>موعد المغادرة</dt>
                  <dd>
                    <DriverTime value={query.data.departure_at} />
                  </dd>
                </div>
                {query.data.estimated_arrival_at && (
                  <div>
                    <dt>الوصول المتوقع</dt>
                    <dd>
                      <DriverTime value={query.data.estimated_arrival_at} />
                    </dd>
                  </div>
                )}
                {query.data.shipments_count !== undefined && (
                  <div>
                    <dt>عدد الشحنات</dt>
                    <dd>{query.data.shipments_count}</dd>
                  </div>
                )}
              </dl>
              <p className="driver-secondary driver-detail-note">
                تُعرض حالة الرحلة هنا، وتُدار إجراءاتها من فريق العمليات.
              </p>
            </section>
          )}
          <DriverReadFeedback query={query} />
          {query.data && <DriverShipmentList tripId={id} />}
        </>
      )}
    </div>
  );
}
