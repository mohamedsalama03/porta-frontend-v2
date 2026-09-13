import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import {
  publicOrderDefaults,
  publicOrderFormSchema,
  type PublicOrderFormValues,
} from '@/features/public-order/schema';
import {
  publicOrderErrorMessage,
  publicOrderFieldErrors,
  publicOrderPayload,
  publicOrderQuoteFingerprint,
  publicOrderQuoteInput,
} from '@/features/public-order/model';

// Synthetic test input only; never submitted to the live service.
const values: PublicOrderFormValues = {
  ...publicOrderDefaults,
  sender_name: 'مُرسل اختبار',
  sender_phone: '0910000001',
  recipient_name: 'مُستلم اختبار',
  recipient_phone: '+218920000002',
  origin_city_id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  destination_city_id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  shipment_type_id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
};

describe('public order form and contract projection', () => {
  it('requires customer fields and the documented conditional door address', () => {
    expect(publicOrderFormSchema.safeParse(publicOrderDefaults).success).toBe(false);
    expect(publicOrderFormSchema.safeParse(values).success).toBe(true);
    const door = { ...values, delivery_method: 'DOOR_DELIVERY' as const };
    expect(publicOrderFormSchema.safeParse(door).success).toBe(false);
    expect(publicOrderFormSchema.safeParse({ ...door, delivery_address: '   ' }).success).toBe(
      false,
    );
    expect(
      publicOrderFormSchema.safeParse({ ...door, delivery_address: 'عنوان اختبار' }).success,
    ).toBe(true);
    expect(
      publicOrderFormSchema.safeParse({ ...values, sender_name: 'س'.repeat(151) }).success,
    ).toBe(false);
    expect(publicOrderFormSchema.safeParse({ ...values, notes: 'س'.repeat(2001) }).success).toBe(
      false,
    );
  });

  it('preserves Unicode names and documented phone representations without inventing normalization', () => {
    for (const phone of [
      '0910000001',
      '+218910000001',
      '00218910000001',
      '218910000001',
      '٠٩١ ٠٠٠-٠٠٠١',
    ]) {
      const body = publicOrderPayload({ ...values, sender_phone: ` ${phone} ` });
      expect(body.sender_phone).toBe(phone);
      expect(body.sender_name).toBe(values.sender_name);
    }
    expect(
      publicOrderFormSchema.safeParse({ ...values, sender_phone: '1'.repeat(41) }).success,
    ).toBe(false);
    // The generated Phone contract does not define a regex; final phone validity stays server-owned.
    expect(publicOrderPayload({ ...values, sender_phone: '000' }).sender_phone).toBe('000');
  });

  it('validates optional decimal weight with both generated syntax and numeric bounds', () => {
    for (const weight of ['', '0.001', '1.235', '100000', '100000.000'])
      expect(publicOrderFormSchema.safeParse({ ...values, weight }).success).toBe(true);
    for (const weight of ['0', '-1', '100000.001', '1.0001', '1e3', 'NaN', 'Infinity', '1,5'])
      expect(publicOrderFormSchema.safeParse({ ...values, weight }).success).toBe(false);
    expect(publicOrderPayload({ ...values, weight: '1.235' }).weight).toBe(1.235);
    expect(publicOrderPayload(values)).not.toHaveProperty('weight');
  });

  it('projects only customer fields and never adds price, branch, status or staff data', () => {
    const enriched = {
      ...values,
      branch_id: values.origin_city_id,
      final_price: 1,
      current_status: 'DELIVERED',
      staff: 'private',
    };
    const body = publicOrderPayload(enriched);
    expect(body).not.toHaveProperty('branch_id');
    expect(body).not.toHaveProperty('final_price');
    expect(body).not.toHaveProperty('current_status');
    expect(body).not.toHaveProperty('staff');
    expect(body).not.toHaveProperty('delivery_address');
    expect(body).not.toHaveProperty('notes');
    // The approved schema does not prohibit a same-city route; quote validation is authoritative.
    expect(
      publicOrderFormSchema.safeParse({ ...values, destination_city_id: values.origin_city_id })
        .success,
    ).toBe(true);
  });
});

describe('public quote identity and safe errors', () => {
  it('invalidates every quote-relevant change immediately but excludes contact data and optional weight', () => {
    const fingerprint = publicOrderQuoteFingerprint(values);
    expect(fingerprint).not.toBeNull();
    const changes: Partial<PublicOrderFormValues>[] = [
      { origin_city_id: values.destination_city_id },
      { destination_city_id: values.origin_city_id },
      { shipment_type_id: values.origin_city_id },
      { shipment_size: 'LARGE' },
      { delivery_method: 'DOOR_DELIVERY' },
    ];
    for (const change of changes)
      expect(publicOrderQuoteFingerprint({ ...values, ...change })).not.toBe(fingerprint);
    expect(publicOrderQuoteFingerprint({ ...values, origin_city_id: '' })).toBeNull();
    expect(
      publicOrderQuoteFingerprint({
        ...values,
        sender_name: 'اسم آخر',
        sender_phone: 'خاص',
        notes: 'خاص',
        weight: '2.500',
      }),
    ).toBe(fingerprint);
    expect(Object.keys(publicOrderQuoteInput(values) ?? {})).toEqual([
      'origin_city_id',
      'destination_city_id',
      'shipment_type_id',
      'shipment_size',
      'delivery_method',
    ]);
    expect(fingerprint).not.toContain(values.sender_phone);
  });

  it('maps only supported 422 field names and never shows server text or staff sign-in advice', () => {
    const error = new ApiError({
      status: 422,
      validationErrors: {
        sender_phone: ['private backend text'],
        branch_id: ['internal'],
        unknown: ['secret'],
      },
    });
    expect(publicOrderFieldErrors(error)).toEqual({ sender_phone: 'تحقق من قيمة هذا الحقل.' });
    expect(publicOrderFieldErrors(new Error('private error'))).toEqual({});
    expect(publicOrderErrorMessage(error, 'quote')).toContain('تسعيرة');
    expect(publicOrderErrorMessage(new ApiError({ status: 409 }))).toBe(
      'تعذّر تنفيذ الطلب بسبب تعارض. راجع البيانات قبل المحاولة مجددًا.',
    );
    expect(publicOrderErrorMessage(new ApiError({ status: 401 }))).not.toContain('تسجيل الدخول');
    expect(publicOrderErrorMessage(new Error('private error'))).not.toContain('private');
  });
});
