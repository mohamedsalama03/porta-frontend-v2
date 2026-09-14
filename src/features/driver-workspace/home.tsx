'use client';

import Link from 'next/link';
import { getDriverTrips, getDriverShipments } from './api';
import { driverKeys } from './model';
import { useDriverRead } from './use-driver-read';
import { DriverTripCard, DriverShipmentCard } from './cards';
import { DriverReadFeedback, DriverSkeleton, DriverEmpty } from './ui';

const firstPage = { per_page: 20 };
export function DriverHome() {
  const trips = useDriverRead({
    queryKey: driverKeys.trips(firstPage),
    queryFn: (signal) => getDriverTrips(firstPage, signal),
  });
  const shipments = useDriverRead({
    queryKey: driverKeys.shipments(firstPage),
    queryFn: (signal) => getDriverShipments(firstPage, signal),
  });
  return (
    <div className="driver-content">
      <div className="driver-page-heading">
        <h1>مساحة السائق</h1>
        <p>تابع العمل المسند إليك، وافتح الشحنة لتنفيذ الإجراء المتاح.</p>
      </div>
      <section className="driver-section" aria-labelledby="driver-home-trips">
        <div className="driver-section-heading">
          <h2 id="driver-home-trips">من رحلاتك</h2>
          <Link className="driver-text-link" href="/driver/trips" prefetch={false}>
            عرض الرحلات
          </Link>
        </div>
        {!trips.data && trips.isFetching && <DriverSkeleton />}
        {trips.data &&
          (trips.data.data.length ? (
            <ul className="driver-work-list">
              {trips.data.data.slice(0, 3).map((trip) => (
                <DriverTripCard key={trip.id} trip={trip} />
              ))}
            </ul>
          ) : (
            <DriverEmpty>لا توجد رحلات مسندة إليك</DriverEmpty>
          ))}
        <DriverReadFeedback query={trips} />
      </section>
      <section className="driver-section" aria-labelledby="driver-home-shipments">
        <div className="driver-section-heading">
          <h2 id="driver-home-shipments">من شحناتك</h2>
          <Link className="driver-text-link" href="/driver/shipments" prefetch={false}>
            عرض الشحنات
          </Link>
        </div>
        {!shipments.data && shipments.isFetching && <DriverSkeleton />}
        {shipments.data &&
          (shipments.data.data.length ? (
            <ul className="driver-work-list">
              {shipments.data.data.slice(0, 3).map((shipment) => (
                <DriverShipmentCard key={shipment.id} shipment={shipment} />
              ))}
            </ul>
          ) : (
            <DriverEmpty>لا توجد شحنات مخصصة لك</DriverEmpty>
          ))}
        <DriverReadFeedback query={shipments} />
      </section>
    </div>
  );
}
