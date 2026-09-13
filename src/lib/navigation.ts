import { can, type PermissionSubject } from '@/lib/permissions';

export type NavigationMode = 'preview' | 'live';

export const navigationItems = [
  {
    key: 'dashboard',
    label: 'الرئيسية',
    section: 'workspace',
    permission: 'reports.view',
    keywords: 'نظرة عامة لوحة التحكم',
  },
  {
    key: 'shipments',
    label: 'الشحنات',
    section: 'workspace',
    permission: 'shipments.view',
    keywords: 'طرود تتبع إرسال',
  },
  {
    key: 'trips',
    label: 'الرحلات',
    section: 'workspace',
    permission: 'trips.view',
    keywords: 'مسار نقل',
  },
  {
    key: 'drivers',
    label: 'السائقون',
    section: 'workspace',
    permission: 'drivers.view',
    keywords: 'سائق توصيل',
  },
  {
    key: 'cities',
    label: 'المدن',
    section: 'management',
    permission: 'cities.manage',
    keywords: 'مدينة وجهة',
  },
  {
    key: 'branches',
    label: 'الفروع',
    section: 'management',
    permission: 'cities.manage',
    keywords: 'فرع مكتب',
  },
  {
    key: 'shipment-types',
    label: 'أنواع الشحنات',
    section: 'management',
    permission: 'pricing.view',
    keywords: 'نوع طرد',
  },
  {
    key: 'pricing',
    label: 'التسعير',
    section: 'management',
    permission: 'pricing.view',
    keywords: 'أسعار تكلفة تسعيرة',
  },
  {
    key: 'payments',
    label: 'المدفوعات',
    section: 'management',
    permission: 'payments.manage',
    keywords: 'دفع تحصيل مالية',
  },
  {
    key: 'reports',
    label: 'التقارير',
    section: 'administration',
    permission: 'reports.view',
    keywords: 'تقرير إحصائيات',
  },
  {
    key: 'users',
    label: 'المستخدمون والصلاحيات',
    section: 'administration',
    permission: 'users.manage',
    keywords: 'مستخدم فريق صلاحيات',
  },
  {
    key: 'audit',
    label: 'سجل العمليات',
    section: 'administration',
    permission: 'audit.view',
    keywords: 'تدقيق أحداث نشاط',
  },
  {
    key: 'settings',
    label: 'الإعدادات',
    section: 'administration',
    permission: null,
    keywords: 'مظهر تفضيلات داكن',
  },
] as const;

export type NavigationItem = (typeof navigationItems)[number];
export type ModuleKey = NavigationItem['key'];

export const moduleLabels = Object.fromEntries(
  navigationItems.map((item) => [item.key, item.label]),
) as Record<ModuleKey, string>;

/** Read permissions come from each approved operation's x-permission. */
export function getNavigationItems(
  subject: PermissionSubject | null | undefined,
  mode: NavigationMode,
) {
  if (mode === 'preview') return [...navigationItems];
  if (!subject) return [];
  return navigationItems.filter(
    (item) => item.permission === null || can(subject, item.permission),
  );
}

/** Local preferences require authentication but have no fabricated server permission. */
export function canAccessModule(
  subject: PermissionSubject | null | undefined,
  module: ModuleKey | undefined,
): boolean {
  if (!subject || !module) return false;
  const item = navigationItems.find((entry) => entry.key === module);
  return Boolean(item && (item.permission === null || can(subject, item.permission)));
}

export function getNavigationHref(module: ModuleKey, mode: NavigationMode) {
  if (mode === 'preview') return module === 'dashboard' ? '/preview' : `/preview/${module}`;
  return `/${module}`;
}

export function getCurrentModule(pathname: string): ModuleKey | undefined {
  const segments = pathname.split('/').filter(Boolean);
  const candidate = segments[0] === 'preview' ? (segments[1] ?? 'dashboard') : segments[0];
  return navigationItems.find((item) => item.key === candidate)?.key;
}

/** Creation routes use their write permission, independently of list access. */
export function canAccessRoute(
  subject: { permissions: readonly string[] } | null,
  pathname: string,
) {
  const createPermissions: Record<string, string> = {
    '/shipments/new': 'shipments.create',
    '/trips/new': 'trips.create',
    '/drivers/new': 'drivers.manage',
  };
  const permission = createPermissions[pathname.replace(/\/$/, '')];
  return permission
    ? can(subject, permission)
    : canAccessModule(subject, getCurrentModule(pathname));
}
