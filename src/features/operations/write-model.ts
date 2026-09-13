import { z } from 'zod';
import {
  driverInputSchema,
  driverPatchSchema,
  tripInputSchema,
  tripPatchSchema,
  ulidSchema,
  attachShipmentsInputSchema,
  type Driver,
  type Trip,
} from '@/lib/api/generated';

const optionalId = z.union([z.literal(''), ulidSchema]);
export const driverFormSchema = z.object({
  full_name: z.string().trim().min(1, 'أدخل اسم السائق.').max(150),
  phone: z.string().trim().min(1, 'أدخل رقم الهاتف.').max(30),
  license_number: z.string().max(80),
  user_id: optionalId,
  active: z.enum(['default', 'true', 'false']),
});
export type DriverFormValues = z.infer<typeof driverFormSchema>;
export const tripFormSchema = z.object({
  origin_city_id: ulidSchema,
  destination_city_id: ulidSchema,
  driver_id: optionalId,
  branch_id: optionalId,
  departure_at: z.string().min(1, 'حدد موعد الانطلاق.'),
  estimated_arrival_at: z.string(),
});
export type TripFormValues = z.infer<typeof tripFormSchema>;

/** Convert a Libya wall-clock selection to an explicit-offset timestamp for the contract. */
export function tripoliDateTime(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) throw new Error('Invalid date');
  const normalized = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${normalized}Z`);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid date');
  const zone = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Tripoli',
    timeZoneName: 'longOffset',
  })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')
    ?.value.replace('GMT', '');
  if (!zone || !/^[+-]\d{2}:\d{2}$/.test(zone)) throw new Error('Unavailable time zone');
  return `${normalized}${zone}`;
}

export function localDateTimeValue(timestamp: string | null | undefined): string {
  if (!timestamp) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Tripoli',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  const field = (key: string) => parts.find((part) => part.type === key)?.value ?? '';
  return `${field('year')}-${field('month')}-${field('day')}T${field('hour')}:${field('minute')}`;
}

export function driverWritePayload(values: DriverFormValues, record?: Driver) {
  const full = {
    full_name: values.full_name,
    phone: values.phone,
    license_number: values.license_number || null,
    user_id: values.user_id || null,
    ...(values.active === 'default' ? {} : { active: values.active === 'true' }),
  };
  if (!record) return driverInputSchema.parse(full);
  const changed = Object.fromEntries(
    Object.entries(full).filter(([key, value]) => value !== record[key as keyof Driver]),
  );
  return driverPatchSchema.parse(changed);
}

export function tripWritePayload(values: TripFormValues, record?: Trip) {
  const full = {
    origin_city_id: values.origin_city_id,
    destination_city_id: values.destination_city_id,
    driver_id: values.driver_id || null,
    branch_id: values.branch_id || null,
    departure_at: tripoliDateTime(values.departure_at),
    estimated_arrival_at: values.estimated_arrival_at
      ? tripoliDateTime(values.estimated_arrival_at)
      : null,
  };
  if (!record) return tripInputSchema.parse(full);
  const changed = Object.fromEntries(
    Object.entries(full).filter(([key, value]) => {
      if (key === 'departure_at')
        return values.departure_at !== localDateTimeValue(record.departure_at);
      if (key === 'estimated_arrival_at')
        return values.estimated_arrival_at !== localDateTimeValue(record.estimated_arrival_at);
      return value !== record[key as keyof Trip];
    }),
  );
  return tripPatchSchema.parse(changed);
}

export function parseAttachmentInput(text: string) {
  return attachShipmentsInputSchema.parse({
    shipment_ids: text
      .trim()
      .split(/[\s,،]+/)
      .filter(Boolean),
  });
}
