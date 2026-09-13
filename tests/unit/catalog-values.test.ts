import { describe, expect, it } from 'vitest';
import {
  catalogPayload,
  decimalToMillimes,
  fromTripoliInput,
  millimesToDecimal,
  toTripoliInput,
} from '@/features/catalog/values';
import { catalogDefinitions } from '@/features/catalog/model';

describe('catalog display input', () => {
  it('converts decimal amounts exactly without floating-point price arithmetic', () => {
    expect(decimalToMillimes('25.001')).toBe(25001);
    expect(decimalToMillimes('0.029')).toBe(29);
    expect(decimalToMillimes('0,1')).toBe(100);
    expect(millimesToDecimal(25001)).toBe('25.001');
    for (const input of ['1.0001', 'NaN', '-1', '1e3', '01.2', ''])
      expect(decimalToMillimes(input)).toBeNull();
    expect(
      catalogDefinitions.pricing.create.body.safeParse({
        base_price: decimalToMillimes('1000000.001'),
      }).success,
    ).toBe(false);
  });

  it('converts explicit Tripoli wall-clock input to ISO and rejects impossible dates', () => {
    expect(fromTripoliInput('2026-09-13T10:30')).toBe('2026-09-13T08:30:00.000Z');
    expect(toTripoliInput('2026-09-13T08:30:00Z')).toBe('2026-09-13T10:30:00');
    expect(fromTripoliInput('2026-02-30T10:00')).toBeNull();
    expect(fromTripoliInput('not a timestamp')).toBeNull();
  });

  it('sends only changed approved edit fields, preserving omitted optional values', () => {
    expect(
      catalogPayload(
        'cities',
        {
          name_ar: 'طرابلس',
          name_en: 'Tripoli',
          code: 'TIP',
          active: 'false',
          sort_order: '',
          private: 'ignored',
        },
        new Set(['active']),
      ),
    ).toEqual({ active: false });
    expect(catalogPayload('branches', { phone: '' }, new Set(['phone']))).toEqual({ phone: null });
    expect(
      catalogPayload(
        'pricing',
        { base_price: '25.001', effective_from: '2026-09-13T10:30' },
        new Set(['base_price']),
      ),
    ).toEqual({ base_price: 25001 });
  });
});
