import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { shipmentStatusSchema } from '@/lib/api/generated';
import { formatDate } from '@/lib/formatters';
import {
  parseTrackingNumber,
  parseTrackingSearch,
  publicTrackingErrorMessage,
  trackingHref,
  trackingKeys,
} from '@/features/public-tracking/model';
import { trackingStatusPresentation } from '@/features/public-tracking/status';

const number = 'PTA-260913-TRACKTEST01';

describe('public tracking input and link model', () => {
  it('trims only outer whitespace and requires the exact generated identifier format', () => {
    expect(parseTrackingNumber(` \t${number}\n`).data).toBe(number);
    for (const invalid of [
      '',
      ' \t\n',
      number.toLowerCase(),
      number.replace('TRACK', 'TRA CK'),
      `${number}/x`,
    ]) {
      expect(parseTrackingNumber(invalid).success).toBe(false);
    }
    expect(parseTrackingNumber(null).success).toBe(false);
    expect(parseTrackingNumber({ number }).success).toBe(false);
    expect(parseTrackingNumber('PTA-260913-ABC123').success).toBe(true);
    expect(parseTrackingNumber(`PTA-260913-${'A'.repeat(20)}`).success).toBe(true);
    expect(parseTrackingNumber(`PTA-260913-${'A'.repeat(21)}`).success).toBe(false);
  });

  it('parses one URL value without turning malformed input into a silently different identifier', () => {
    expect(parseTrackingSearch(new URLSearchParams({ number: ` ${number} ` }))).toBe(number);
    expect(parseTrackingSearch(new URLSearchParams())).toBeNull();
    expect(parseTrackingSearch(new URLSearchParams({ number: '  ' }))).toBeNull();
    expect(parseTrackingSearch(new URLSearchParams('number=first&number=second'))).toBeNull();
    expect(parseTrackingSearch(new URLSearchParams({ number: number.toLowerCase() }))).toBe(
      number.toLowerCase(),
    );
    expect(parseTrackingSearch(new URLSearchParams({ number: `${number}&phone=private` }))).toBe(
      `${number}&phone=private`,
    );
  });

  it('creates a same-site tracking link with just the validated identifier and rejects injection', () => {
    const url = new URL(trackingHref(` ${number} `), 'https://frontend.example.test');
    expect(url.pathname).toBe('/track');
    expect([...url.searchParams]).toEqual([['number', number]]);
    expect(url.hash).toBe('');
    expect(parseTrackingSearch(url.searchParams)).toBe(number);
    expect(() => trackingHref(`${number}&sender_phone=private`)).toThrow();
    expect(() => trackingHref('//external.example.test')).toThrow();
  });

  it('separates identifiers in memory-query keys and does not include contact information', () => {
    expect(trackingKeys.detail(number)).toEqual(['public-tracking', 'detail', number]);
    expect(trackingKeys.detail(number)).not.toEqual(trackingKeys.detail('PTA-260913-OTHERTEST01'));
    expect(trackingKeys.detail(null)).toEqual(['public-tracking', 'detail', null]);
  });
});

describe('public tracking presentation without lifecycle rules', () => {
  it('maps every exact shipment enum once and does not invent ARRIVED or final-delivery stages', () => {
    expect(Object.keys(trackingStatusPresentation)).toEqual(shipmentStatusSchema.options);
    expect(trackingStatusPresentation.ARRIVED_CITY.label).toBe('وصلت للمدينة');
    expect(trackingStatusPresentation.READY_FOR_PICKUP.description).toBe('شحنتك جاهزة للاستلام.');
    expect(trackingStatusPresentation.DELIVERED).toMatchObject({
      label: 'تم التسليم',
      tone: 'complete',
    });
    for (const presentation of Object.values(trackingStatusPresentation)) {
      expect(presentation.label).toMatch(/[\u0600-\u06ff]/);
      expect(Object.keys(presentation).sort()).toEqual(['description', 'label', 'tone']);
    }
    expect(trackingStatusPresentation).not.toHaveProperty('ARRIVED');
    expect(trackingStatusPresentation).not.toHaveProperty('OUT_FOR_DELIVERY');
  });

  it('uses the existing Tripoli formatter for equivalent absolute instants without another offset', () => {
    const options = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;
    const formatted = formatDate('2026-09-13T23:30:00Z', options);
    expect(formatted).toBe(formatDate('2026-09-14T01:30:00+02:00', options));
    expect(formatted).toContain('01:30');
    expect(formatted).toContain('14');
    expect(formatDate('invalid', options)).toBe('—');
  });

  it('explains not-found, rate limit and connectivity safely without arbitrary error text', () => {
    expect(publicTrackingErrorMessage(new ApiError({ status: 404 }))).toBe(
      'لم نعثر على شحنة بهذا الرقم',
    );
    expect(publicTrackingErrorMessage(new ApiError({ status: 429, retryAfter: 12000 }))).toBe(
      'يرجى الانتظار قبل المحاولة مرة أخرى',
    );
    expect(publicTrackingErrorMessage(new ApiError({ code: 'network' }))).toContain('اتصالك');
    expect(publicTrackingErrorMessage(new ApiError({ code: 'invalid_request' }))).toContain(
      'رقم التتبع',
    );
    expect(publicTrackingErrorMessage(new Error('private stack trace'))).not.toContain('private');
  });

  it('uses one safe temporary-service response for invalid payloads, staff auth and server errors', () => {
    const message = 'خدمة التتبع غير متاحة مؤقتًا. يرجى المحاولة لاحقًا.';
    for (const status of [400, 401, 403, 419, 422, 500, 503]) {
      expect(publicTrackingErrorMessage(new ApiError({ status }))).toBe(message);
    }
    expect(publicTrackingErrorMessage(new ApiError({ code: 'invalid_response' }))).toBe(message);
    expect(message).not.toContain('تسجيل الدخول');
  });
});
