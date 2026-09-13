import type { ShipmentViewModel } from './view-model';

export const previewFilterLabels = {
  q: 'البحث',
  status: 'الحالة',
  origin: 'من مدينة',
  destination: 'إلى مدينة',
  type: 'نوع الشحنة',
  size: 'الحجم',
  driver: 'السائق',
  trip: 'الرحلة',
  payment: 'الدفع',
  from: 'من تاريخ',
  to: 'إلى تاريخ',
} as const;
export type PreviewFilterKey = keyof typeof previewFilterLabels;

/** URL state for the component preview only; not a mapping to server query fields. */
export function updatePreviewFilters(
  source: string,
  changes: Partial<Record<PreviewFilterKey, string>>,
) {
  const params = new URLSearchParams(source);
  for (const [key, value] of Object.entries(changes)) {
    if (value.trim()) params.set(key, value.trim());
    else params.delete(key);
  }
  params.delete('cursor');
  params.delete('page');
  return params.toString();
}

/** Bounded fixture filtering for isolated component development, never operational data. */
export function filterPreviewShipments(rows: ShipmentViewModel[], params: URLSearchParams) {
  const query = params.get('q')?.toLocaleLowerCase('ar').trim() ?? '';
  return rows.filter((row) => {
    if (
      query &&
      ![row.tracking, row.sender, row.recipient].some((value) =>
        value.toLocaleLowerCase('ar').includes(query),
      )
    )
      return false;
    const values = {
      status: row.status.label,
      origin: row.origin,
      destination: row.destination,
      type: row.type,
      size: row.size,
      driver: row.driver,
      trip: row.trip,
      payment: row.payment.label,
    };
    for (const [key, value] of Object.entries(values)) {
      if (params.get(key) && params.get(key) !== value) return false;
    }
    if (params.get('from') && row.createdDate < params.get('from')!) return false;
    if (params.get('to') && row.createdDate > params.get('to')!) return false;
    return true;
  });
}
