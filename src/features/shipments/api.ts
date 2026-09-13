import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { createIdempotentAction } from '@/lib/api/idempotency';
import {
  getAdminShipmentsQuerySchema,
  getAdminShipmentsResponseSchema,
  getAdminShipmentsShipmentResponseSchema,
  getCitiesResponseSchema,
  getShipmentTypesResponseSchema,
  postAdminShipmentsBodySchema,
  postAdminShipmentsResponseSchema,
  postQuotesBodySchema,
  postQuotesResponseSchema,
  patchAdminShipmentsShipmentBodySchema,
  patchAdminShipmentsShipmentResponseSchema,
  postAdminShipmentsShipmentDriverBodySchema,
  postAdminShipmentsShipmentDriverResponseSchema,
  getAdminDriversResponseSchema,
  ulidSchema,
  type ShipmentInput,
  type QuoteInput,
  type ShipmentPatch,
  type AssignDriverInput,
} from '@/lib/api/generated';

export const shipmentFilterLabels = {
  search: 'البحث',
  tracking_number: 'رقم التتبع',
  origin_city: 'من مدينة',
  destination_city: 'إلى مدينة',
  shipment_type: 'نوع الشحنة',
  driver: 'السائق',
  trip: 'الرحلة',
  status: 'الحالة',
  shipment_size: 'الحجم',
  payment_status: 'الدفع',
  created_from: 'من تاريخ',
  created_to: 'إلى تاريخ',
  sort: 'الترتيب',
  per_page: 'حجم الصفحة',
} as const;
export type ShipmentFilterKey = keyof typeof shipmentFilterLabels;

/** Only documented query parameters cross the API boundary. No client filtering. */
export function parseShipmentFilters(source: string) {
  const params = new URLSearchParams(source);
  const values: Record<string, string | number> = {};
  for (const key of [...Object.keys(shipmentFilterLabels), 'cursor']) {
    if (params.getAll(key).length > 1) throw new ApiError({ code: 'invalid_request' });
    const value = params.get(key);
    if (value) values[key] = key === 'per_page' ? Number(value) : value;
  }
  const parsed = getAdminShipmentsQuerySchema.safeParse(values);
  if (!parsed.success) throw new ApiError({ code: 'invalid_request' });
  return parsed.data;
}

export function updateShipmentFilters(
  source: string,
  changes: Record<string, string | null>,
  preserveCursor = false,
) {
  const params = new URLSearchParams(source);
  for (const [key, value] of Object.entries(changes)) {
    if (value?.trim()) params.set(key, value.trim());
    else params.delete(key);
  }
  if (!preserveCursor) params.delete('cursor');
  return params.toString();
}

export function getShipments(source: string, signal?: AbortSignal) {
  const filters = parseShipmentFilters(source);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined && value !== null) query.set(key, String(value));
  return api.request(`/api/v1/admin/shipments${query.size ? `?${query}` : ''}`, {
    schema: getAdminShipmentsResponseSchema,
    signal,
  });
}

export function getShipment(id: string, signal?: AbortSignal) {
  if (!ulidSchema.safeParse(id).success) throw new ApiError({ status: 404 });
  return api.request(`/api/v1/admin/shipments/${encodeURIComponent(id)}`, {
    schema: getAdminShipmentsShipmentResponseSchema,
    signal,
  });
}

export function getShipmentCities(signal?: AbortSignal) {
  return api.request('/api/v1/cities', { schema: getCitiesResponseSchema, signal });
}
export function getShipmentTypes(signal?: AbortSignal) {
  return api.request('/api/v1/shipment-types', { schema: getShipmentTypesResponseSchema, signal });
}
export function requestShipmentQuote(body: QuoteInput, signal?: AbortSignal) {
  return api.request('/api/v1/quotes', {
    method: 'POST',
    body,
    bodySchema: postQuotesBodySchema,
    schema: postQuotesResponseSchema,
    signal,
  });
}
export function createShipmentAction(body: ShipmentInput) {
  const parsed = postAdminShipmentsBodySchema.parse(body);
  // Capture the exact validated body; the helper retains the key for explicit retries.
  return createIdempotentAction((idempotencyKey) =>
    api.request('/api/v1/admin/shipments', {
      method: 'POST',
      body: parsed,
      bodySchema: postAdminShipmentsBodySchema,
      schema: postAdminShipmentsResponseSchema,
      idempotencyKey,
    }),
  );
}

export function updateShipmentAction(id: string, body: ShipmentPatch) {
  const parsed = patchAdminShipmentsShipmentBodySchema.parse(body);
  ulidSchema.parse(id);
  return createIdempotentAction((idempotencyKey) =>
    api.request(`/api/v1/admin/shipments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: parsed,
      bodySchema: patchAdminShipmentsShipmentBodySchema,
      schema: patchAdminShipmentsShipmentResponseSchema,
      idempotencyKey,
    }),
  );
}

export function assignShipmentDriverAction(id: string, body: AssignDriverInput) {
  const parsed = postAdminShipmentsShipmentDriverBodySchema.parse(body);
  ulidSchema.parse(id);
  return createIdempotentAction((idempotencyKey) =>
    api.request(`/api/v1/admin/shipments/${encodeURIComponent(id)}/driver`, {
      method: 'POST',
      body: parsed,
      bodySchema: postAdminShipmentsShipmentDriverBodySchema,
      schema: postAdminShipmentsShipmentDriverResponseSchema,
      idempotencyKey,
    }),
  );
}

export function getAssignableDrivers(cursor: string | null, signal?: AbortSignal) {
  const query = new URLSearchParams({ active: 'true', per_page: '25' });
  if (cursor) query.set('cursor', cursor);
  return api.request(`/api/v1/admin/drivers?${query}`, {
    schema: getAdminDriversResponseSchema,
    signal,
  });
}
