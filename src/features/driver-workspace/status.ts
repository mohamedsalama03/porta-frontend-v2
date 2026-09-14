import type {
  DeliveryMethod,
  DriverStatusInput,
  ShipmentSize,
  ShipmentStatus,
  TripStatus,
} from '@/lib/api/generated';

// Match the established operational vocabulary without importing the Admin presentation bundle.
export const driverShipmentStatusLabels = {
  RECEIVED: 'تم الاستلام',
  PREPARING: 'قيد التجهيز',
  IN_TRANSIT: 'في الطريق',
  ARRIVED_CITY: 'وصلت للمدينة',
  READY_FOR_PICKUP: 'جاهزة للاستلام',
  DELIVERED: 'تم التسليم',
} as const satisfies Record<ShipmentStatus, string>;

export const driverTripStatusLabels = {
  SCHEDULED: 'مجدولة',
  LOADING: 'قيد التحميل',
  DEPARTED: 'غادرت',
  ARRIVED: 'وصلت',
  COMPLETED: 'مكتملة',
  CANCELLED: 'ملغاة',
} as const satisfies Record<TripStatus, string>;

export const driverDeliveryMethodLabels = {
  OFFICE_PICKUP: 'استلام من الفرع',
  DOOR_DELIVERY: 'توصيل إلى العنوان',
} as const satisfies Record<DeliveryMethod, string>;

export const driverShipmentSizeLabels = {
  SMALL: 'صغير',
  MEDIUM: 'متوسط',
  LARGE: 'كبير',
} as const satisfies Record<ShipmentSize, string>;

export type DriverStatusTarget = DriverStatusInput['status'];
export const driverActionLabels = {
  READY_FOR_PICKUP: 'تأكيد جاهزية الاستلام',
  DELIVERED: 'تأكيد تسليم الشحنة',
} as const satisfies Record<DriverStatusTarget, string>;

/** Only the two edges explicitly documented by postDriverShipmentsShipmentStatus. */
export function driverStatusTarget(
  currentStatus: ShipmentStatus,
  canChangeStatus: boolean,
): DriverStatusTarget | null {
  if (!canChangeStatus) return null;
  if (currentStatus === 'ARRIVED_CITY') return 'READY_FOR_PICKUP';
  if (currentStatus === 'READY_FOR_PICKUP') return 'DELIVERED';
  return null;
}
