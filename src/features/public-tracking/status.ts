import type { ShipmentStatus } from '@/lib/api/generated';

/** Presentation only: these labels neither define nor predict lifecycle transitions. */
export const trackingStatusPresentation = {
  RECEIVED: {
    label: 'تم استلام الطلب',
    description: 'تم تسجيل الشحنة. ستظهر مراحلها هنا عند تحديث الحالة.',
    tone: 'neutral',
  },
  PREPARING: {
    label: 'جاري التجهيز',
    description: 'يجري تجهيز شحنتك.',
    tone: 'progress',
  },
  IN_TRANSIT: {
    label: 'خرجت في رحلة',
    description: 'الشحنة في طريقها إلى مدينة الوصول.',
    tone: 'progress',
  },
  ARRIVED_CITY: {
    label: 'وصلت للمدينة',
    description: 'وصلت الشحنة إلى مدينة الوصول.',
    tone: 'progress',
  },
  READY_FOR_PICKUP: {
    label: 'جاهزة للاستلام',
    description: 'شحنتك جاهزة للاستلام.',
    tone: 'progress',
  },
  DELIVERED: {
    label: 'تم التسليم',
    description: 'اكتمل تسليم شحنتك.',
    tone: 'complete',
  },
} as const satisfies Record<
  ShipmentStatus,
  { label: string; description: string; tone: 'neutral' | 'progress' | 'complete' }
>;
