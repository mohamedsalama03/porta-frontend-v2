import { postOrdersBodySchema, postQuotesBodySchema } from '@/lib/api/generated';
import { ApiError } from '@/lib/api/errors';
import {
  publicOrderFieldNames,
  publicOrderFormSchema,
  publicOrderWireInput,
  type PublicOrderField,
  type PublicOrderFormValues,
  type PublicOrderPayload,
  type PublicOrderQuoteInput,
} from './schema';

export function publicOrderPayload(values: PublicOrderFormValues): PublicOrderPayload {
  const checked = publicOrderFormSchema.parse(values);
  return postOrdersBodySchema.parse(publicOrderWireInput(checked));
}

/** Quote identity contains only the five documented pricing inputs, never contact data. */
export function publicOrderQuoteInput(
  values: Partial<PublicOrderFormValues>,
): PublicOrderQuoteInput | null {
  const parsed = postQuotesBodySchema.safeParse({
    origin_city_id: values.origin_city_id,
    destination_city_id: values.destination_city_id,
    shipment_type_id: values.shipment_type_id,
    shipment_size: values.shipment_size,
    delivery_method: values.delivery_method,
  });
  return parsed.success ? parsed.data : null;
}

export function publicOrderQuoteFingerprint(values: Partial<PublicOrderFormValues>): string | null {
  const input = publicOrderQuoteInput(values);
  return input ? JSON.stringify(input) : null;
}

export const publicOrderKeys = {
  all: ['public-order'] as const,
  cities: ['public-order', 'cities'] as const,
  types: ['public-order', 'types'] as const,
  quote: (fingerprint: string | null) => ['public-order', 'quote', fingerprint] as const,
};

export function publicOrderFieldErrors(error: unknown): Partial<Record<PublicOrderField, string>> {
  if (!(error instanceof ApiError) || error.status !== 422) return {};
  const fields: Partial<Record<PublicOrderField, string>> = {};
  for (const field of publicOrderFieldNames) {
    if (error.validationErrors[field]) fields[field] = 'تحقق من قيمة هذا الحقل.';
  }
  return fields;
}

/** Public recovery must not suggest staff sign-in or show unreviewed server prose. */
export function publicOrderErrorMessage(
  error: unknown,
  context: 'catalog' | 'quote' | 'order' = 'order',
): string {
  if (!(error instanceof ApiError)) return 'تعذّر إتمام الطلب. يرجى المحاولة لاحقًا.';
  if (error.status === 409)
    return 'تعذّر تنفيذ الطلب بسبب تعارض. راجع البيانات قبل المحاولة مجددًا.';
  if (error.status === 401 || error.status === 403)
    return 'تعذّر إتمام الطلب الآن. حاول لاحقًا أو تواصل مع الدعم.';
  if (error.status === 422 && context === 'quote')
    return 'تعذّر توفير تسعيرة لهذه الخيارات. راجع المسار وتفاصيل الشحنة.';
  return error.message;
}
