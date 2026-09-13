import type { City, Shipment, ShipmentType } from '@/lib/api/generated';
import { formatDate, formatMoney } from '@/lib/formatters';
import type { ShipmentLabel, ShipmentViewModel } from './view-model';

export const shipmentStatusLabels: Record<Shipment['current_status'], ShipmentLabel> = {
  RECEIVED: { label: 'تم الاستلام', tone: 'neutral' },
  PREPARING: { label: 'قيد التجهيز', tone: 'neutral' },
  IN_TRANSIT: { label: 'في الطريق', tone: 'info' },
  ARRIVED_CITY: { label: 'وصلت للمدينة', tone: 'warning' },
  READY_FOR_PICKUP: { label: 'جاهزة للاستلام', tone: 'info' },
  DELIVERED: { label: 'تم التسليم', tone: 'success' },
};
export const paymentStatusLabels: Record<Shipment['payment_status'], ShipmentLabel> = {
  PENDING: { label: 'بانتظار الدفع', tone: 'neutral' },
  PAID: { label: 'مدفوع', tone: 'success' },
  FAILED: { label: 'فشل الدفع', tone: 'warning' },
  REFUNDED: { label: 'مسترد', tone: 'neutral' },
};
export const shipmentSizeLabels = { SMALL: 'صغير', MEDIUM: 'متوسط', LARGE: 'كبير' } as const;
export const deliveryMethodLabels = {
  OFFICE_PICKUP: 'استلام من الفرع',
  DOOR_DELIVERY: 'توصيل إلى العنوان',
} as const;
export const paymentMethodLabels = {
  CASH_ON_DELIVERY: 'نقدًا عند التسليم',
  PREPAID_TRANSFER: 'تحويل مسبق',
} as const;

export function shipmentToViewModel(
  shipment: Shipment,
  cities: City[],
  types: ShipmentType[],
): ShipmentViewModel {
  return {
    id: shipment.id,
    href: `/shipments/${encodeURIComponent(shipment.id)}`,
    tracking: shipment.tracking_number,
    sender: shipment.sender_name,
    recipient: shipment.recipient_name,
    origin:
      cities.find((city) => city.id === shipment.origin_city_id)?.name_ar ??
      shipment.origin_city_id,
    destination:
      cities.find((city) => city.id === shipment.destination_city_id)?.name_ar ??
      shipment.destination_city_id,
    type:
      types.find((type) => type.id === shipment.shipment_type_id)?.name_ar ??
      shipment.shipment_type_id,
    size: shipmentSizeLabels[shipment.shipment_size],
    status: shipmentStatusLabels[shipment.current_status],
    payment: paymentStatusLabels[shipment.payment_status],
    driver: shipment.assigned_driver_id ?? 'غير معيّن',
    trip: shipment.trip_id ?? 'غير مرتبطة برحلة',
    price: formatMoney(shipment.final_price),
    createdDate: shipment.created_at?.slice(0, 10) ?? '',
    createdLabel: shipment.created_at
      ? formatDate(shipment.created_at, { hour: '2-digit', minute: '2-digit' })
      : 'غير متاح',
  };
}
