import { z } from 'zod';
import {
  getDriverShipmentsQuerySchema,
  getDriverTripsQuerySchema,
  getDriverTripsTripResponseSchema,
  ulidSchema,
  type CursorMeta,
  type DriverTripActionMeta,
} from '@/lib/api/generated';

export type { DriverShipment, DriverTrip } from '@/lib/api/generated';
export type DriverTripsQuery = z.infer<typeof getDriverTripsQuerySchema>;
export type DriverShipmentsQuery = z.infer<typeof getDriverShipmentsQuerySchema>;
export type DriverPage<T> = { data: T[]; meta: CursorMeta };
export type DriverTripDetail = z.infer<typeof getDriverTripsTripResponseSchema>;
export type DriverTripAction = DriverTripActionMeta['allowed_actions'][number];

type ParsedQuery<T> = { success: true; data: T } | { success: false };

function parseDriverQuery<T>(schema: z.ZodType<T>, params: URLSearchParams): ParsedQuery<T> {
  const entries: [string, string | number][] = [];
  for (const [key, value] of params) {
    if (params.getAll(key).length !== 1) return { success: false };
    if (key === 'per_page') {
      if (!/^[1-9]\d{0,2}$/.test(value)) return { success: false };
      entries.push([key, Number(value)]);
    } else entries.push([key, value]);
  }
  const values = Object.fromEntries(entries);
  const parsed = schema.safeParse({ ...values, per_page: values.per_page ?? 20 });
  return parsed.success ? { success: true, data: parsed.data } : { success: false };
}

export function parseDriverTripsQuery(params: URLSearchParams) {
  return parseDriverQuery(getDriverTripsQuerySchema, params);
}

export function parseDriverShipmentsQuery(params: URLSearchParams) {
  return parseDriverQuery(getDriverShipmentsQuerySchema, params);
}

/** Preserve opaque cursors exactly; URLSearchParams encodes them as a single value. */
export function driverQueryString(query: DriverTripsQuery | DriverShipmentsQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  params.sort();
  return params.size ? `?${params.toString()}` : '';
}

const driverKey = ['driver-workspace'] as const;

/** One frontend identity for a shipment ULID; opaque filters and invalid route values stay intact. */
export function driverShipmentIdentity(id: string): string {
  return ulidSchema.safeParse(id).success ? id.toUpperCase() : id;
}

export const driverKeys = {
  all: driverKey,
  context: () => [...driverKey, 'context'] as const,
  me: () => [...driverKey, 'me'] as const,
  trips: (query: DriverTripsQuery = {}) =>
    [...driverKey, 'trips', { ...query, per_page: query.per_page ?? 20 }] as const,
  trip: (id: string) => [...driverKey, 'trip', id.toUpperCase()] as const,
  shipments: (query: DriverShipmentsQuery = {}) =>
    [...driverKey, 'shipments', { ...query, per_page: query.per_page ?? 20 }] as const,
  shipment: (id: string) => [...driverKey, 'shipment', driverShipmentIdentity(id)] as const,
};

/** Only dial a plain phone number. Never turn URI parameters, USSD or arbitrary text into actions. */
export function safeTelHref(phone: string): string | null {
  if (!phone || phone.length > 40) return null;
  const digits = phone.replace(/[٠-٩۰-۹]/g, (digit) =>
    String(digit.charCodeAt(0) - (digit <= '٩' ? 0x0660 : 0x06f0)),
  );
  if (/[^+0-9 ()-]/.test(digits) || !/^\+?[0-9 ()-]+$/.test(digits)) return null;
  const number = digits.replace(/[ ()-]/g, '');
  return /^\+?\d{7,15}$/.test(number) ? `tel:${number}` : null;
}
