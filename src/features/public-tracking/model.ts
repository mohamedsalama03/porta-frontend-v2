import { z } from 'zod';
import { getTrackingTrackingNumberPathSchema } from '@/lib/api/generated';
import { ApiError } from '@/lib/api/errors';

/** Only outer whitespace is harmless. The approved identifier is case-sensitive. */
export const trackingNumberSchema = z
  .string({ error: 'أدخل رقم التتبع.' })
  .trim()
  .min(1, { error: 'أدخل رقم التتبع.' })
  .refine(
    (number) => getTrackingTrackingNumberPathSchema.shape.trackingNumber.safeParse(number).success,
    { error: 'تحقق من رقم التتبع كما ورد في تأكيد الطلب.' },
  );

export function parseTrackingNumber(value: unknown) {
  return trackingNumberSchema.safeParse(value);
}

export const trackingKeys = {
  all: ['public-tracking'] as const,
  detail: (trackingNumber: string | null) => ['public-tracking', 'detail', trackingNumber] as const,
};

/** Return a single query value for visible validation; never silently pick a duplicate. */
export function parseTrackingSearch(search: { getAll(name: string): string[] }): string | null {
  const values = search.getAll('number');
  return values.length === 1 ? values[0].trim() || null : null;
}

/** A tracking link carries one validated identifier, never order/customer fields. */
export function trackingHref(number: string): string {
  return `/track?${new URLSearchParams({ number: trackingNumberSchema.parse(number) }).toString()}`;
}

/** Public recovery never renders server prose or requests staff sign-in. */
export function publicTrackingErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'تعذّر تحميل حالة الشحنة. يرجى المحاولة لاحقًا.';
  if (error.status === 404) return 'لم نعثر على شحنة بهذا الرقم';
  if (error.status === 429) return 'يرجى الانتظار قبل المحاولة مرة أخرى';
  if (error.code === 'network') return 'تعذّر الاتصال بالخدمة. تحقق من اتصالك ثم حاول مجددًا.';
  if (error.code === 'invalid_request') return 'تحقق من رقم التتبع كما ورد في تأكيد الطلب.';
  return 'خدمة التتبع غير متاحة مؤقتًا. يرجى المحاولة لاحقًا.';
}
