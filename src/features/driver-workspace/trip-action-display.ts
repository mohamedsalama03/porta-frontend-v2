import type { DriverTripAction } from './model';

/** Presentation order only. Availability is exclusively the returned metadata. */
export const driverTripActionOrder = [
  'START',
  'CONFIRM_ARRIVAL',
  'COMPLETE',
] as const satisfies readonly DriverTripAction[];

export const driverTripActionLabels = {
  START: 'بدء الرحلة',
  CONFIRM_ARRIVAL: 'تأكيد الوصول',
  COMPLETE: 'إكمال الرحلة',
} as const satisfies Record<DriverTripAction, string>;

export const driverTripActionConfirmLabels = {
  START: 'تأكيد بدء الرحلة',
  CONFIRM_ARRIVAL: 'تأكيد الوصول إلى الوجهة',
  COMPLETE: 'تأكيد إكمال الرحلة',
} as const satisfies Record<DriverTripAction, string>;

export const driverTripActionDescriptions = {
  START:
    'أنت على وشك بدء هذه الرحلة. سيتم اعتماد الحالة الجديدة من الخادم وتحديث الشحنات المرتبطة وفق قواعد التشغيل.',
  CONFIRM_ARRIVAL:
    'أنت على وشك تأكيد وصول الرحلة. سيتم تحديث حالة الرحلة والشحنات المرتبطة من الخادم.',
  COMPLETE: 'أنت على وشك إكمال الرحلة. لن يتيح الخادم هذا الإجراء إلا بعد استيفاء شروط الإكمال.',
} as const satisfies Record<DriverTripAction, string>;

export const driverTripActionSuccessLabels = {
  START: 'تم بدء الرحلة بنجاح.',
  CONFIRM_ARRIVAL: 'تم تأكيد وصول الرحلة.',
  COMPLETE: 'تم إكمال الرحلة بنجاح.',
} as const satisfies Record<DriverTripAction, string>;
