import {
  catalogDefinitions,
  type CatalogField,
  type CatalogModule,
  type CatalogRecord,
} from './model';

/** Representation conversion only: never calculate an authoritative price. */
export function decimalToMillimes(value: string): number | null {
  if (value.length > 32) return null;
  const matched = /^(0|[1-9]\d*)(?:[.,](\d{1,3}))?$/.exec(value.trim());
  if (!matched) return null;
  const exact = BigInt(matched[1]) * 1000n + BigInt((matched[2] ?? '').padEnd(3, '0'));
  return exact <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(exact) : null;
}

export function millimesToDecimal(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) return '';
  return `${Math.floor(value / 1000)}.${String(value % 1000).padStart(3, '0')}`;
}

const tripoliFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Tripoli',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function toTripoliInput(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = Object.fromEntries(
    tripoliFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export function fromTripoliInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const normalized = value.length === 16 ? `${value}:00` : value;
  const localAsUtc = Date.parse(`${normalized}Z`);
  if (!Number.isFinite(localAsUtc)) return null;
  let instant = localAsUtc;
  for (let pass = 0; pass < 2; pass++) {
    const displayedAsUtc = Date.parse(`${toTripoliInput(new Date(instant).toISOString())}Z`);
    if (!Number.isFinite(displayedAsUtc)) return null;
    instant += localAsUtc - displayedAsUtc;
  }
  const result = new Date(instant).toISOString();
  return toTripoliInput(result) === normalized ? result : null;
}

export function catalogDefaults(
  module: CatalogModule,
  record?: CatalogRecord,
): Record<string, string> {
  const data: Record<string, unknown> = record?.data ?? {};
  return Object.fromEntries(
    catalogDefinitions[module].fields.map((field) => {
      const value = data[field.name];
      if (value === undefined || value === null) return [field.name, ''];
      if (field.kind === 'money' && typeof value === 'number')
        return [field.name, millimesToDecimal(value)];
      if (field.kind === 'datetime' && typeof value === 'string')
        return [field.name, toTripoliInput(value)];
      return [field.name, String(value)];
    }),
  );
}

function parseField(field: CatalogField, input: string): unknown {
  if (input === '') return field.nullable ? null : undefined;
  if (field.kind === 'active') return input === 'true' ? true : input === 'false' ? false : input;
  if (field.kind === 'money') return decimalToMillimes(input) ?? Number.NaN;
  if (field.kind === 'integer') return /^\d+$/.test(input) ? Number(input) : Number.NaN;
  if (field.kind === 'datetime') return fromTripoliInput(input) ?? input;
  return input;
}

export function catalogPayload(
  module: CatalogModule,
  values: Record<string, string>,
  changed?: ReadonlySet<string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of catalogDefinitions[module].fields) {
    if (changed && !changed.has(field.name)) continue;
    const value = parseField(field, values[field.name] ?? '');
    if (value !== undefined) payload[field.name] = value;
  }
  return payload;
}
