import { z } from 'zod';
import {
  getAdminAuditLogsQuerySchema,
  getAdminBranchesQuerySchema,
  getAdminCitiesQuerySchema,
  getAdminDriversQuerySchema,
  getAdminPricingRulesQuerySchema,
  getAdminShipmentTypesQuerySchema,
  getAdminTripsQuerySchema,
  getAdminUsersQuerySchema,
  type Audit,
  type Branch,
  type City,
  type Driver,
  type PricingRule,
  type ShipmentType,
  type Trip,
  type User,
} from '@/lib/api/generated';
import { formatDate, formatMoney, formatNumber } from '@/lib/formatters';

export type OperationsModule =
  'trips' | 'drivers' | 'cities' | 'branches' | 'shipment-types' | 'pricing' | 'users' | 'audit';
export type DisplayCell = {
  text: string;
  secondary?: string;
  href?: string;
  badge?: 'success' | 'warning' | 'info' | 'danger' | 'neutral';
  numeric?: boolean;
};
export type EditableRecord =
  | { module: 'cities'; data: City }
  | { module: 'branches'; data: Branch }
  | { module: 'shipment-types'; data: ShipmentType }
  | { module: 'pricing'; data: PricingRule }
  | { module: 'users'; data: User };
export type DisplayRow = { key: string; cells: DisplayCell[]; record?: EditableRecord };
export type CatalogNames = {
  cities: ReadonlyMap<string, string>;
  types: ReadonlyMap<string, string>;
};
export type OperationQuery = Record<string, string | number | boolean | undefined>;

export const operationDefinitions = {
  trips: {
    title: 'الرحلات',
    description: 'مسارات النقل ومواعيد الانطلاق وحالة كل رحلة.',
    permission: 'trips.view',
    pagination: 'cursor',
    columns: ['المسار', 'السائق', 'موعد الانطلاق', 'الشحنات', 'الحالة', ''],
    query: getAdminTripsQuerySchema,
  },
  drivers: {
    title: 'السائقون',
    description: 'دليل السائقين وبيانات الاتصال والحالة التشغيلية.',
    permission: 'drivers.view',
    pagination: 'cursor',
    columns: ['السائق', 'رقم الهاتف', 'رقم الرخصة', 'الحالة', ''],
    query: getAdminDriversQuerySchema,
  },
  cities: {
    title: 'المدن',
    description: 'المدن المعتمدة ضمن شبكة التوصيل.',
    permission: 'cities.manage',
    pagination: 'page',
    columns: ['المدينة', 'الاسم بالإنجليزية', 'الرمز', 'الحالة'],
    query: getAdminCitiesQuerySchema,
  },
  branches: {
    title: 'الفروع',
    description: 'نقاط العمل وعناوين الفروع وأرقام التواصل.',
    permission: 'cities.manage',
    pagination: 'page',
    columns: ['الفرع', 'المدينة', 'العنوان', 'الهاتف', 'الحالة'],
    query: getAdminBranchesQuerySchema,
  },
  'shipment-types': {
    title: 'أنواع الشحنات',
    description: 'تصنيف الشحنات المعتمد في المنظومة.',
    permission: 'pricing.view',
    pagination: 'page',
    columns: ['النوع', 'الاسم بالإنجليزية', 'الرمز', 'الوصف', 'الحالة'],
    query: getAdminShipmentTypesQuerySchema,
  },
  pricing: {
    title: 'التسعير',
    description: 'أسعار المسارات وتوصيل الباب كما تحددها الخدمة.',
    permission: 'pricing.view',
    pagination: 'page',
    columns: ['المسار', 'النوع والحجم', 'السعر الأساسي', 'توصيل الباب', 'سريان التسعيرة', 'الحالة'],
    query: getAdminPricingRulesQuerySchema,
  },
  users: {
    title: 'المستخدمون والصلاحيات',
    description: 'حسابات فريق العمل والأدوار المسندة إليهم.',
    permission: 'users.manage',
    pagination: 'cursor',
    columns: ['المستخدم', 'البريد الإلكتروني', 'الدور', 'الحالة', 'تاريخ الإنشاء'],
    query: getAdminUsersQuerySchema,
  },
  audit: {
    title: 'سجل العمليات',
    description: 'سجل موجز للأحداث الإدارية المصرّح بعرضها.',
    permission: 'audit.view',
    pagination: 'cursor',
    columns: ['العملية', 'السجل المتأثر', 'التوقيت'],
    query: getAdminAuditLogsQuerySchema,
  },
} as const;

export const tripStatusLabels: Record<Trip['status'], string> = {
  SCHEDULED: 'مجدولة',
  LOADING: 'قيد التحميل',
  DEPARTED: 'غادرت',
  ARRIVED: 'وصلت',
  COMPLETED: 'مكتملة',
  CANCELLED: 'ملغاة',
};
const roleLabels: Record<User['role'], string> = {
  SUPER_ADMIN: 'مدير المنظومة',
  ADMIN: 'مدير',
  OPERATIONS_MANAGER: 'مدير العمليات',
  BRANCH_OPERATOR: 'مشغّل فرع',
  DRIVER: 'سائق',
};
const sizeLabels = { SMALL: 'صغير', MEDIUM: 'متوسط', LARGE: 'كبير' };

export function parseUrlQuery<T>(schema: z.ZodType<T>, params: URLSearchParams) {
  const values: Record<string, string | number | boolean> = {};
  for (const [key, value] of params.entries()) {
    if (params.getAll(key).length !== 1) return { success: false as const };
    values[key] = ['page', 'per_page'].includes(key)
      ? Number(value)
      : key === 'active' && ['true', 'false'].includes(value)
        ? value === 'true'
        : value;
  }
  return schema.safeParse(values);
}

export function queryString(query: OperationQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== '') params.set(key, String(value));
  params.sort();
  return params.size ? `?${params.toString()}` : '';
}

export function activeCell(active: boolean | undefined): DisplayCell {
  return active === undefined
    ? { text: 'غير محدد' }
    : { text: active ? 'نشط' : 'غير نشط', badge: active ? 'success' : 'neutral' };
}

export function tripStatusCell(status: Trip['status']): DisplayCell {
  return {
    text: tripStatusLabels[status],
    badge:
      status === 'COMPLETED'
        ? 'success'
        : status === 'CANCELLED'
          ? 'danger'
          : status === 'DEPARTED'
            ? 'info'
            : status === 'LOADING'
              ? 'warning'
              : 'neutral',
  };
}

export function cityName(id: string, names: CatalogNames): string {
  return names.cities.get(id) ?? 'مدينة غير متاحة';
}

export const mapCityRow = (item: City): DisplayRow => ({
  key: item.id,
  record: { module: 'cities', data: item },
  cells: [
    { text: item.name_ar },
    { text: item.name_en },
    { text: item.code, numeric: true },
    activeCell(item.active),
  ],
});
export const mapBranchRow = (item: Branch, names: CatalogNames): DisplayRow => ({
  key: item.id,
  record: { module: 'branches', data: item },
  cells: [
    { text: item.name },
    { text: cityName(item.city_id, names) },
    { text: item.address },
    { text: item.phone ?? '—', numeric: true },
    activeCell(item.active),
  ],
});
export const mapTypeRow = (item: ShipmentType): DisplayRow => ({
  key: item.id,
  record: { module: 'shipment-types', data: item },
  cells: [
    { text: item.name_ar },
    { text: item.name_en },
    { text: item.code, numeric: true },
    { text: item.description ?? '—' },
    activeCell(item.active),
  ],
});
export const mapDriverRow = (item: Driver): DisplayRow => ({
  key: item.id,
  cells: [
    { text: item.full_name },
    { text: item.phone, numeric: true },
    { text: item.license_number ?? '—', numeric: true },
    activeCell(item.active),
    { text: 'التفاصيل', href: `/drivers/${encodeURIComponent(item.id)}` },
  ],
});
export const mapTripRow = (item: Trip, names: CatalogNames): DisplayRow => ({
  key: item.id,
  cells: [
    {
      text: `${item.origin_city?.name_ar ?? cityName(item.origin_city_id, names)} ← ${item.destination_city?.name_ar ?? cityName(item.destination_city_id, names)}`,
    },
    { text: item.driver?.full_name ?? 'غير مسند' },
    { text: formatDate(item.departure_at, { hour: '2-digit', minute: '2-digit' }) },
    {
      text: item.shipments_count === undefined ? '—' : formatNumber(item.shipments_count),
      numeric: true,
    },
    tripStatusCell(item.status),
    { text: 'التفاصيل', href: `/trips/${encodeURIComponent(item.id)}` },
  ],
});
export const mapPricingRow = (item: PricingRule, names: CatalogNames): DisplayRow => ({
  key: item.id,
  record: { module: 'pricing', data: item },
  cells: [
    {
      text: `${cityName(item.origin_city_id, names)} ← ${cityName(item.destination_city_id, names)}`,
    },
    {
      text: names.types.get(item.shipment_type_id) ?? 'نوع غير متاح',
      secondary: sizeLabels[item.shipment_size],
    },
    { text: formatMoney(item.base_price), numeric: true },
    { text: formatMoney(item.door_delivery_surcharge), numeric: true },
    {
      text: formatDate(item.effective_from),
      secondary: item.effective_until
        ? `حتى ${formatDate(item.effective_until)}`
        : 'دون تاريخ انتهاء',
    },
    activeCell(item.active),
  ],
});
export const mapUserRow = (item: User): DisplayRow => ({
  key: item.id,
  record: { module: 'users', data: item },
  cells: [
    { text: item.name },
    { text: item.email, numeric: true },
    { text: roleLabels[item.role] },
    activeCell(item.active),
    { text: item.created_at ? formatDate(item.created_at) : '—' },
  ],
});

const actionLabels: Record<string, string> = {
  created: 'إنشاء',
  updated: 'تحديث',
  deleted: 'حذف',
  status_changed: 'تغيير الحالة',
  assigned: 'إسناد',
  deactivated: 'تعطيل',
  activated: 'تفعيل',
  login: 'تسجيل دخول',
  logout: 'تسجيل خروج',
  payment_recorded: 'تسجيل دفعة',
};
export function auditActionLabel(action: string) {
  const leaf = action.split(/[.:/]/).pop() ?? '';
  return actionLabels[leaf.toLowerCase()] ?? 'عملية إدارية مسجلة';
}
export function auditEntityLabel(entity: string) {
  const name =
    entity
      .split(/[\\/.]/)
      .pop()
      ?.toLowerCase() ?? '';
  return (
    (
      {
        shipment: 'شحنة',
        trip: 'رحلة',
        driver: 'سائق',
        user: 'مستخدم',
        city: 'مدينة',
        branch: 'فرع',
        pricingrule: 'تسعيرة',
        pricing_rule: 'تسعيرة',
        shipmenttype: 'نوع شحنة',
        paymententry: 'دفعة',
        payment: 'دفعة',
      } as Record<string, string>
    )[name] ?? 'سجل إداري'
  );
}
export const mapAuditRow = (item: Audit): DisplayRow => ({
  key: item.id,
  cells: [
    { text: auditActionLabel(item.action) },
    { text: auditEntityLabel(item.entity_type) },
    {
      text: formatDate(item.created_at, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    },
  ],
});
