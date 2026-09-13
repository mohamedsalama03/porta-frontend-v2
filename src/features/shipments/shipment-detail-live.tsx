'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clipboard, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { ApiError } from '@/lib/api/errors';
import { formatDate, formatMoney } from '@/lib/formatters';
import { shipmentKeys } from '@/lib/query/keys';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { RetryButton } from '@/components/feedback/retry-button';
import { PageSkeleton } from '@/components/feedback/page-skeleton';
import { getShipment } from './api';
import { useShipmentCatalogs } from './live-hooks';
import {
  deliveryMethodLabels,
  paymentMethodLabels,
  paymentStatusLabels,
  shipmentStatusLabels,
  shipmentToViewModel,
} from './mappers';
import { ShipmentBadge } from './presentation';
import { ShipmentEditPanel } from './shipment-edit-panel';
import { PaymentActions } from '@/features/payments/payment-actions';

function DetailValue({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="shipment-info-row">
      <dt>{label}</dt>
      <dd>{value || 'غير متاح'}</dd>
    </div>
  );
}

export function ShipmentDetailLive({ id }: { id: string }) {
  const { user } = useAuth();
  const allowed = can(user, 'shipments.view');
  const detail = useQuery({
    queryKey: shipmentKeys.detail(id),
    queryFn: ({ signal }) => getShipment(id, signal),
    enabled: allowed,
  });
  const { cities, types } = useShipmentCatalogs(allowed);
  const [copy, setCopy] = useState('');
  if (!allowed)
    return (
      <section className="surface shipment-table-state">
        <h1>تفاصيل الشحنة</h1>
        <p>ليس لديك صلاحية لعرض الشحنات.</p>
      </section>
    );
  if (detail.isPending) return <PageSkeleton />;
  if (detail.error)
    return (
      <ErrorPanel
        error={detail.error instanceof ApiError ? detail.error : null}
        retry={() => void detail.refetch()}
      />
    );
  const shipment = detail.data.data;
  const view = shipmentToViewModel(shipment, cities.data?.data ?? [], types.data?.data ?? []);
  async function copyTracking() {
    try {
      await navigator.clipboard.writeText(shipment.tracking_number);
      setCopy('تم نسخ رقم التتبع');
    } catch {
      setCopy('تعذّر النسخ. حدد رقم التتبع وانسخه يدويًا.');
    }
  }
  return (
    <div className="shipment-detail">
      <Link className="shipment-back-link" href="/shipments">
        <ArrowLeft size={15} aria-hidden="true" />
        العودة إلى الشحنات
      </Link>
      <div className="shipment-detail-heading">
        <div>
          <div className="shipment-tracking-heading">
            <h1 dir="ltr">{shipment.tracking_number}</h1>
            <button
              className="icon-button"
              type="button"
              aria-label="نسخ رقم التتبع"
              onClick={copyTracking}
            >
              <Clipboard size={17} />
            </button>
            <ShipmentBadge value={shipmentStatusLabels[shipment.current_status]} />
          </div>
          <p>
            {shipment.created_at
              ? `أنشئت في ${formatDate(shipment.created_at, { hour: '2-digit', minute: '2-digit' })}`
              : 'تاريخ الإنشاء غير متاح'}
          </p>
          <span className="shipment-copy-feedback" role="status">
            {copy}
          </span>
        </div>
        <div className="shipment-heading-price">
          <strong>{formatMoney(shipment.final_price)}</strong>
          <span>السعر النهائي</span>
        </div>
      </div>
      <div className="shipment-detail-layout">
        <div className="shipment-detail-main">
          <section className="surface shipment-detail-panel">
            <h2>الأطراف</h2>
            <div className="shipment-people">
              <div>
                <h3>المرسل</h3>
                <p className="shipment-person-name">{shipment.sender_name}</p>
                <a
                  className="shipment-contact"
                  dir="ltr"
                  href={`tel:${shipment.sender_phone.replace(/[^+0-9]/g, '')}`}
                >
                  {shipment.sender_phone}
                </a>
              </div>
              <div>
                <h3>المستلم</h3>
                <p className="shipment-person-name">{shipment.recipient_name}</p>
                <a
                  className="shipment-contact"
                  dir="ltr"
                  href={`tel:${shipment.recipient_phone.replace(/[^+0-9]/g, '')}`}
                >
                  {shipment.recipient_phone}
                </a>
              </div>
            </div>
          </section>
          <section className="surface shipment-detail-panel">
            <h2>المسار والشحنة</h2>
            <dl className="shipment-info-grid">
              <DetailValue label="مدينة الانطلاق" value={view.origin} />
              <DetailValue label="مدينة الوصول" value={view.destination} />
              <DetailValue label="نوع الشحنة" value={view.type} />
              <DetailValue label="الحجم" value={view.size} />
              <DetailValue label="الوزن" value={shipment.weight} />
              <DetailValue label="الفرع" value={shipment.branch_id} />
              <DetailValue
                label="طريقة التسليم"
                value={
                  shipment.delivery_method
                    ? deliveryMethodLabels[shipment.delivery_method]
                    : undefined
                }
              />
              <DetailValue label="عنوان التوصيل" value={shipment.delivery_address} />
              <DetailValue label="معرّف السائق" value={shipment.assigned_driver_id} />
              <DetailValue label="معرّف الرحلة" value={shipment.trip_id} />
            </dl>
          </section>
          <section className="surface shipment-detail-panel">
            <h2>الدفع</h2>
            <dl className="shipment-info-grid">
              <DetailValue label="السعر المحسوب" value={formatMoney(shipment.calculated_price)} />
              <DetailValue label="السعر النهائي" value={formatMoney(shipment.final_price)} />
              <DetailValue
                label="طريقة الدفع"
                value={
                  shipment.payment_method ? paymentMethodLabels[shipment.payment_method] : undefined
                }
              />
              <DetailValue
                label="حالة الدفع"
                value={paymentStatusLabels[shipment.payment_status].label}
              />
            </dl>
          </section>
          <section className="surface shipment-detail-panel">
            <h2>الملاحظات</h2>
            <p className="shipment-notes">{shipment.notes || 'لا توجد ملاحظات.'}</p>
          </section>
          {can(user, 'payments.manage') && <PaymentActions shipment={shipment} />}
          {can(user, 'shipments.update') && (
            <ShipmentEditPanel key={shipment.id} shipment={shipment} />
          )}
        </div>
        <aside className="shipment-detail-side">
          <section className="surface shipment-detail-panel">
            <h2>آخر تحديث</h2>
            <p className="shipment-notes">
              {shipment.updated_at
                ? formatDate(shipment.updated_at, { hour: '2-digit', minute: '2-digit' })
                : 'التوقيت غير متاح.'}
            </p>
            <p className="shipment-integration-note">
              سجل الأحداث التفصيلي غير متاح في واجهة الإدارة الحالية.
            </p>
            <RetryButton
              className="button button-secondary shipment-refresh"
              error={detail.error}
              retry={() => void detail.refetch()}
              disabled={detail.isFetching}
            >
              <RefreshCw size={15} aria-hidden="true" />
              تحديث البيانات
            </RetryButton>
          </section>
          <section className="shipment-actions-panel">
            <h2>حالة الشحنة</h2>
            <p>
              تغيير الحالة متوقف حتى تتيح الخدمة الإجراءات المسموحة لهذه الشحنة. الحالة المعروضة هي
              آخر حالة مؤكدة من الخادم.
            </p>
            <button className="button button-secondary" type="button" disabled>
              تغيير الحالة
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
