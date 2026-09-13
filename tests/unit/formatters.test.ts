import { describe, expect, it } from 'vitest';
import { formatMoney, formatNumber, formatDate } from '@/lib/formatters';

describe('display formatters', () => {
  it('formats integer LYD millimes with exact three-digit precision', () => {
    expect(formatMoney(12_345)).toMatch(/12[.,]345/);
    expect(formatMoney(0)).toMatch(/0[.,]000/);
    expect(formatMoney(-1)).toMatch(/0[.,]001/);
    expect(formatMoney(-1)).toContain('-');
    expect(formatMoney(Number.MAX_SAFE_INTEGER)).toMatch(/[.,]991/);
  });

  it('never displays NaN, Infinity, fractional millimes or unsafe amounts', () => {
    for (const amount of [Number.NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])
      expect(formatMoney(amount)).toBe('—');
    expect(formatNumber(Number.NaN)).toBe('—');
    expect(formatDate('invalid')).toBe('—');
  });
});
