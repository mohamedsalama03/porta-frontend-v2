import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { DriverTrip, DriverShipment } from './model';
import {
  driverShipmentStatusLabels,
  driverTripStatusLabels,
  driverDeliveryMethodLabels,
} from './status';
import { DriverTime } from './ui';

export function DriverTripCard({ trip }: { trip: DriverTrip }) {
  return (
    <li className="driver-work-card">
      <div className="driver-card-top">
        <span className="driver-status">{driverTripStatusLabels[trip.status]}</span>
        {trip.shipments_count !== undefined && (
          <span className="driver-secondary">{trip.shipments_count} شحنة</span>
        )}
      </div>
      <h3 className="driver-route">
        {trip.origin_city?.name_ar ?? 'مدينة الإرسال غير متاحة'}
        <ArrowLeft size={18} aria-hidden="true" />
        {trip.destination_city?.name_ar ?? 'مدينة الوصول غير متاحة'}
      </h3>
      <p className="driver-secondary">
        المغادرة: <DriverTime value={trip.departure_at} />
      </p>
      <Link
        className="driver-open-link"
        href={`/driver/trips/${encodeURIComponent(trip.id)}`}
        prefetch={false}
      >
        فتح الرحلة
        <ArrowLeft size={18} aria-hidden="true" />
      </Link>
    </li>
  );
}
export function DriverShipmentCard({ shipment }: { shipment: DriverShipment }) {
  return (
    <li className="driver-work-card">
      <div className="driver-card-top">
        <span className="driver-status">{driverShipmentStatusLabels[shipment.current_status]}</span>
        <span className="driver-secondary">
          {driverDeliveryMethodLabels[shipment.delivery_method]}
        </span>
      </div>
      <h3>
        <bdi dir="ltr" className="driver-tracking-number">
          {shipment.tracking_number}
        </bdi>
      </h3>
      <p>{shipment.recipient_name}</p>
      {shipment.destination_city && (
        <p className="driver-secondary">إلى {shipment.destination_city.name_ar}</p>
      )}
      <Link
        className="driver-open-link"
        href={`/driver/shipments/${encodeURIComponent(shipment.id)}`}
        prefetch={false}
      >
        فتح الشحنة
        <ArrowLeft size={18} aria-hidden="true" />
      </Link>
    </li>
  );
}
