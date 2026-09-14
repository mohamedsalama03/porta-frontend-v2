'use client';

import Link from 'next/link';
import { Phone } from 'lucide-react';
import { ulidSchema } from '@/lib/api/generated';
import { getDriverShipment } from './api';
import { driverKeys, safeTelHref } from './model';
import {
  driverShipmentStatusLabels,
  driverDeliveryMethodLabels,
  driverShipmentSizeLabels,
} from './status';
import { useDriverRead } from './use-driver-read';
import { DriverReadFeedback, DriverSkeleton } from './ui';
import { DriverShipmentActions } from './actions';

function Contact({ label, name, phone }: { label: string; name: string; phone: string }) {
  const href = safeTelHref(phone);
  return (
    <div className="driver-contact">
      <h3>{label}</h3>
      <p>{name}</p>
      <bdi dir="ltr">{phone}</bdi>
      {href && (
        <a className="button button-secondary" href={href} aria-label={`اتصال ${label}`}>
          <Phone aria-hidden="true" />
          اتصال
        </a>
      )}
    </div>
  );
}
export function DriverShipmentDetail({ id }: { id: string }) {
  const valid = ulidSchema.safeParse(id).success;
  const query = useDriverRead({
    queryKey: driverKeys.shipment(id),
    queryFn: (signal) => getDriverShipment(id, signal),
    enabled: valid,
  });
  const shipment = query.data;
  return (
    <div className="driver-content">
      <Link className="driver-text-link" href="/driver/shipments" prefetch={false}>
        العودة إلى الشحنات
      </Link>
      <div className="driver-page-heading">
        <h1>تفاصيل الشحنة</h1>
      </div>
      {!valid ? (
        <p className="driver-feedback" role="alert">
          هذا العمل غير متاح لك حاليًا.
        </p>
      ) : (
        <>
          {!shipment && query.isFetching && <DriverSkeleton />}
          {shipment && (
            <>
              <section className="driver-detail" aria-label="بيانات الشحنة">
                <span
                  className="driver-status"
                  data-complete={shipment.current_status === 'DELIVERED'}
                >
                  {driverShipmentStatusLabels[shipment.current_status]}
                </span>
                <h2>
                  <bdi dir="ltr" className="driver-tracking-number">
                    {shipment.tracking_number}
                  </bdi>
                </h2>
                <dl className="driver-detail-grid">
                  {shipment.origin_city && (
                    <div>
                      <dt>من</dt>
                      <dd>{shipment.origin_city.name_ar}</dd>
                    </div>
                  )}
                  {shipment.destination_city && (
                    <div>
                      <dt>إلى</dt>
                      <dd>{shipment.destination_city.name_ar}</dd>
                    </div>
                  )}
                  <div>
                    <dt>طريقة التسليم</dt>
                    <dd>{driverDeliveryMethodLabels[shipment.delivery_method]}</dd>
                  </div>
                  <div>
                    <dt>حجم الشحنة</dt>
                    <dd>{driverShipmentSizeLabels[shipment.shipment_size]}</dd>
                  </div>
                  {shipment.shipment_type && (
                    <div>
                      <dt>نوع الشحنة</dt>
                      <dd>{shipment.shipment_type.name_ar}</dd>
                    </div>
                  )}
                </dl>
                {shipment.delivery_address && (
                  <div className="driver-address">
                    <h3>عنوان التسليم</h3>
                    <p>{shipment.delivery_address}</p>
                  </div>
                )}
                <div className="driver-contacts">
                  <Contact
                    label="المستلم"
                    name={shipment.recipient_name}
                    phone={shipment.recipient_phone}
                  />
                  <Contact
                    label="المرسل"
                    name={shipment.sender_name}
                    phone={shipment.sender_phone}
                  />
                </div>
                {shipment.trip_id && (
                  <Link
                    href={`/driver/trips/${encodeURIComponent(shipment.trip_id)}`}
                    className="driver-text-link"
                    prefetch={false}
                  >
                    فتح الرحلة المرتبطة
                  </Link>
                )}
              </section>
              <DriverShipmentActions key={shipment.id} shipment={shipment} />
            </>
          )}
          <DriverReadFeedback query={query} />
        </>
      )}
    </div>
  );
}
