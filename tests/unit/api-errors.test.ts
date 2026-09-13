import { describe, expect, it } from 'vitest';
import { ApiError, normalizeHttpError, parseRetryAfter } from '@/lib/api/errors';

describe('safe API errors', () => {
  it.each([401, 403, 404, 409, 419, 422, 429, 500, 503])(
    'maps HTTP %i without backend exception text',
    (status) => {
      const error = normalizeHttpError(new Response(null, { status }), {
        message: 'SQLSTATE password=secret',
        exception: 'DatabaseError',
        trace: ['/internal/path'],
      });
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(status);
      expect(error.message).toMatch(/[\u0600-\u06ff]/);
      expect(JSON.stringify(error)).not.toMatch(/SQLSTATE|secret|internal|DatabaseError/);
      expect(error.message).not.toContain('SQLSTATE');
    },
  );

  it('places safe messages at validated fields while dropping raw error prose', () => {
    const error = normalizeHttpError(new Response(null, { status: 422 }), {
      errors: {
        email: ['SQL constraint at secret_table'],
        'items.0.name': ['Private stack trace'],
        '<script>': ['unsafe'],
      },
      request_id: 'request-42',
    });
    expect(Object.keys(error.validationErrors)).toEqual(['email', 'items.0.name']);
    expect(error.validationErrors.email).toEqual(['تحقق من قيمة هذا الحقل.']);
    expect(error.requestId).toBe('request-42');
    expect(JSON.stringify(error)).not.toMatch(/secret_table|Private stack/);
  });

  it('prefers a safe header request ID and rejects unsafe identifiers', () => {
    const error = normalizeHttpError(
      new Response(null, { status: 500, headers: { 'X-Request-ID': 'trace-123' } }),
      { request_id: 'body-123' },
    );
    expect(error.requestId).toBe('trace-123');
    expect(
      normalizeHttpError(new Response(null, { status: 500 }), { request_id: '<internal stack>' })
        .requestId,
    ).toBeNull();
  });

  it('honors both Retry-After forms and rejects malformed delays', () => {
    const now = Date.UTC(2026, 8, 13, 12, 0, 0);
    expect(parseRetryAfter('120', now)).toBe(120_000);
    expect(parseRetryAfter('0.5', now)).toBe(500);
    expect(parseRetryAfter('Sun, 13 Sep 2026 12:02:00 GMT', now)).toBe(120_000);
    expect(parseRetryAfter('Sun, 13 Sep 2026 11:59:00 GMT', now)).toBe(0);
    expect(parseRetryAfter('-2', now)).toBeNull();
    expect(parseRetryAfter('invalid', now)).toBeNull();
    expect(parseRetryAfter(null, now)).toBeNull();
  });
});
