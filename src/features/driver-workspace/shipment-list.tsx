'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { shipmentStatusSchema } from '@/lib/api/generated';
import { getDriverShipments } from './api';
import { driverKeys, parseDriverShipmentsQuery, driverQueryString } from './model';
import { driverShipmentStatusLabels } from './status';
import { useDriverRead } from './use-driver-read';
import { DriverShipmentCard } from './cards';
import {
  DriverReadFeedback,
  DriverSkeleton,
  DriverEmpty,
  DriverInvalidFilters,
  DriverPagination,
} from './ui';

export function DriverShipmentList({ tripId }: { tripId?: string }) {
  const search = useSearchParams();
  const router = useRouter();
  const params = new URLSearchParams(search.toString());
  if (tripId) params.set('trip_id', tripId);
  const parsed = parseDriverShipmentsQuery(params);
  const filters = parsed.success ? parsed.data : { per_page: 20 };
  const query = useDriverRead({
    queryKey: driverKeys.shipments(filters),
    queryFn: (signal) => getDriverShipments(filters, signal),
    enabled: parsed.success,
  });
  const base = tripId ? `/driver/trips/${encodeURIComponent(tripId)}` : '/driver/shipments';
  const Heading = tripId ? 'h2' : 'h1';
  return (
    <div className={tripId ? 'driver-section' : 'driver-content'}>
      <div className="driver-page-heading">
        <Heading>{tripId ? 'شحنات الرحلة' : 'شحناتي'}</Heading>
        {!tripId && <p>الشحنات المخصصة لك فقط. افتح الشحنة لعرض تفاصيلها.</p>}
      </div>
      {!parsed.success ? (
        <DriverInvalidFilters href={base} />
      ) : (
        <>
          <div className="driver-filter">
            <label htmlFor="driver-shipment-status">حالة الشحنة</label>
            <select
              id="driver-shipment-status"
              value={filters.status ?? ''}
              disabled={query.isFetching || query.remainingMs > 0}
              onChange={(event) =>
                router.replace(
                  `${base}${driverQueryString({ per_page: filters.per_page, trip_id: tripId ? undefined : filters.trip_id, status: event.target.value ? shipmentStatusSchema.parse(event.target.value) : undefined })}`,
                )
              }
            >
              <option value="">كل الحالات</option>
              {Object.entries(driverShipmentStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {!query.data && query.isFetching && <DriverSkeleton />}
          {query.data &&
            (query.data.data.length ? (
              <ul className="driver-work-list">
                {query.data.data.map((shipment) => (
                  <DriverShipmentCard key={shipment.id} shipment={shipment} />
                ))}
              </ul>
            ) : (
              <DriverEmpty>لا توجد شحنات ضمن هذا العرض</DriverEmpty>
            ))}
          <DriverReadFeedback query={query} />
          {query.data && (
            <DriverPagination
              base={base}
              query={{ ...filters, trip_id: tripId ? undefined : filters.trip_id }}
              meta={query.data.meta}
              disabled={query.isFetching || query.remainingMs > 0}
            />
          )}
        </>
      )}
    </div>
  );
}
