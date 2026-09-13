import { parseISO } from 'date-fns';

const numberFormatter = new Intl.NumberFormat('ar-LY', { numberingSystem: 'latn' });
const moneyFormatter = new Intl.NumberFormat('ar-LY', {
  numberingSystem: 'latn',
  style: 'currency',
  currency: 'LYD',
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** Display only; accepts authoritative integer millimes without deriving prices. */
export function formatMoney(millimes: number): string {
  if (!Number.isSafeInteger(millimes)) return '—';
  // Format the integer part separately so even MAX_SAFE_INTEGER keeps exact millimes.
  const value = BigInt(millimes);
  const absolute = value < 0n ? -value : value;
  const units = absolute / 1_000n;
  const fraction = (absolute % 1_000n).toString().padStart(3, '0');
  const signedUnits = value < 0n ? -units : units;
  const formattedParts = moneyFormatter.formatToParts(signedUnits);
  const formatted = formattedParts
    .map((part) => (part.type === 'fraction' ? fraction : part.value))
    .join('');
  if (value < 0n && units === 0n) {
    return moneyFormatter
      .formatToParts(-0)
      .map((part) => (part.type === 'fraction' ? fraction : part.value))
      .join('');
  }
  return formatted;
}

export const formatMillimes = formatMoney;

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? numberFormatter.format(value) : '—';
}

export function formatDate(value: string | Date, options: Intl.DateTimeFormatOptions = {}): string {
  const date = value instanceof Date ? value : parseISO(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ar-LY', {
    numberingSystem: 'latn',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Africa/Tripoli',
    ...options,
  }).format(date);
}
