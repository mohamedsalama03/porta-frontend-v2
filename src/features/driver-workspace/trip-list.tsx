'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { tripStatusSchema } from '@/lib/api/generated';
import { getDriverTrips } from './api';
import { driverKeys, parseDriverTripsQuery, driverQueryString } from './model';
import { driverTripStatusLabels } from './status';
import { useDriverRead } from './use-driver-read';
import { DriverTripCard } from './cards';
import {
  DriverReadFeedback,
  DriverSkeleton,
  DriverEmpty,
  DriverInvalidFilters,
  DriverPagination,
} from './ui';

export function DriverTripList() {
  const search = useSearchParams();
  const router = useRouter();
  const parsed = parseDriverTripsQuery(new URLSearchParams(search.toString()));
  const filters = parsed.success ? parsed.data : { per_page: 20 };
  const query = useDriverRead({
    queryKey: driverKeys.trips(filters),
    queryFn: (signal) => getDriverTrips(filters, signal),
    enabled: parsed.success,
  });
  return (
    <div className="driver-content">
      <div className="driver-page-heading">
        <h1>رحلاتي</h1>
        <p>الرحلات المسندة إليك. الأوقات بتوقيت ليبيا.</p>
      </div>
      {!parsed.success ? (
        <DriverInvalidFilters href="/driver/trips" />
      ) : (
        <>
          <div className="driver-filter">
            <label htmlFor="driver-trip-status">حالة الرحلة</label>
            <select
              id="driver-trip-status"
              value={filters.status ?? ''}
              disabled={query.isFetching || query.remainingMs > 0}
              onChange={(event) =>
                router.replace(
                  `/driver/trips${driverQueryString({ per_page: filters.per_page, status: event.target.value ? tripStatusSchema.parse(event.target.value) : undefined })}`,
                )
              }
            >
              <option value="">كل الحالات</option>
              {Object.entries(driverTripStatusLabels).map(([value, label]) => (
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
                {query.data.data.map((trip) => (
                  <DriverTripCard key={trip.id} trip={trip} />
                ))}
              </ul>
            ) : (
              <DriverEmpty>لا توجد رحلات ضمن هذا العرض</DriverEmpty>
            ))}
          <DriverReadFeedback query={query} />
          {query.data && (
            <DriverPagination
              base="/driver/trips"
              query={filters}
              meta={query.data.meta}
              disabled={query.isFetching || query.remainingMs > 0}
            />
          )}
        </>
      )}
    </div>
  );
}
