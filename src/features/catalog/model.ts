import type { z } from 'zod';
import {
  approvedOperations,
  cityInputSchema,
  cityPatchSchema,
  branchInputSchema,
  branchPatchSchema,
  shipmentTypeInputSchema,
  shipmentTypePatchSchema,
  pricingRuleInputSchema,
  pricingRulePatchSchema,
  postAdminCitiesResponseSchema,
  patchAdminCitiesCityResponseSchema,
  postAdminBranchesResponseSchema,
  patchAdminBranchesBranchResponseSchema,
  postAdminShipmentTypesResponseSchema,
  patchAdminShipmentTypesShipmentTypeResponseSchema,
  postAdminPricingRulesResponseSchema,
  patchAdminPricingRulesPricingRuleResponseSchema,
  type City,
  type Branch,
  type ShipmentType,
  type PricingRule,
} from '@/lib/api/generated';

export type CatalogModule = 'cities' | 'branches' | 'shipment-types' | 'pricing';
export type CatalogRecord =
  | { module: 'cities'; data: City }
  | { module: 'branches'; data: Branch }
  | { module: 'shipment-types'; data: ShipmentType }
  | { module: 'pricing'; data: PricingRule };

export type CatalogField = {
  name: string;
  label: string;
  kind:
    | 'text'
    | 'textarea'
    | 'integer'
    | 'money'
    | 'datetime'
    | 'city'
    | 'shipment-type'
    | 'size'
    | 'active';
  required?: boolean;
  nullable?: boolean;
  maxLength?: number;
  hint?: string;
};

type CatalogOperation = {
  path: string;
  method: 'POST' | 'PATCH';
  permission: string;
  idempotent: boolean;
};
type CatalogDefinition = {
  label: string;
  fields: CatalogField[];
  create: {
    operation: CatalogOperation;
    body: z.ZodType<Record<string, unknown>>;
    response: z.ZodType<unknown>;
  };
  edit: {
    operation: CatalogOperation;
    body: z.ZodType<Record<string, unknown>>;
    response: z.ZodType<unknown>;
  };
};

const namedFields: CatalogField[] = [
  { name: 'name_ar', label: 'الاسم بالعربية', kind: 'text', required: true, maxLength: 120 },
  { name: 'name_en', label: 'الاسم بالإنجليزية', kind: 'text', required: true, maxLength: 120 },
];
const stateFields: CatalogField[] = [
  { name: 'active', label: 'الحالة', kind: 'active' },
  { name: 'sort_order', label: 'ترتيب العرض', kind: 'integer', hint: 'قيمة صحيحة بين 0 و10000.' },
];

export const catalogDefinitions: Record<CatalogModule, CatalogDefinition> = {
  cities: {
    label: 'مدينة',
    fields: [
      ...namedFields,
      {
        name: 'code',
        label: 'رمز المدينة',
        kind: 'text',
        required: true,
        maxLength: 16,
        hint: 'حرفان إلى 16 حرفًا: أحرف إنجليزية كبيرة، أرقام، شرطة أو شرطة سفلية.',
      },
      ...stateFields,
    ],
    create: {
      operation: approvedOperations.postAdminCities,
      body: cityInputSchema,
      response: postAdminCitiesResponseSchema,
    },
    edit: {
      operation: approvedOperations.patchAdminCitiesCity,
      body: cityPatchSchema,
      response: patchAdminCitiesCityResponseSchema,
    },
  },
  branches: {
    label: 'فرع',
    fields: [
      { name: 'name', label: 'اسم الفرع', kind: 'text', required: true, maxLength: 120 },
      { name: 'city_id', label: 'المدينة', kind: 'city', required: true },
      { name: 'address', label: 'العنوان', kind: 'textarea', required: true, maxLength: 500 },
      {
        name: 'phone',
        label: 'رقم الهاتف',
        kind: 'text',
        nullable: true,
        maxLength: 40,
        hint: 'اختياري، بحد أقصى 40 حرفًا.',
      },
      { name: 'active', label: 'الحالة', kind: 'active' },
    ],
    create: {
      operation: approvedOperations.postAdminBranches,
      body: branchInputSchema,
      response: postAdminBranchesResponseSchema,
    },
    edit: {
      operation: approvedOperations.patchAdminBranchesBranch,
      body: branchPatchSchema,
      response: patchAdminBranchesBranchResponseSchema,
    },
  },
  'shipment-types': {
    label: 'نوع شحنة',
    fields: [
      ...namedFields,
      {
        name: 'code',
        label: 'رمز النوع',
        kind: 'text',
        required: true,
        maxLength: 32,
        hint: 'حرفان إلى 32 حرفًا: أحرف إنجليزية كبيرة، أرقام، شرطة أو شرطة سفلية.',
      },
      { name: 'description', label: 'الوصف', kind: 'textarea', maxLength: 500, nullable: true },
      ...stateFields,
    ],
    create: {
      operation: approvedOperations.postAdminShipmentTypes,
      body: shipmentTypeInputSchema,
      response: postAdminShipmentTypesResponseSchema,
    },
    edit: {
      operation: approvedOperations.patchAdminShipmentTypesShipmentType,
      body: shipmentTypePatchSchema,
      response: patchAdminShipmentTypesShipmentTypeResponseSchema,
    },
  },
  pricing: {
    label: 'تسعيرة',
    fields: [
      { name: 'origin_city_id', label: 'مدينة الانطلاق', kind: 'city', required: true },
      { name: 'destination_city_id', label: 'مدينة الوصول', kind: 'city', required: true },
      { name: 'shipment_type_id', label: 'نوع الشحنة', kind: 'shipment-type', required: true },
      { name: 'shipment_size', label: 'حجم الشحنة', kind: 'size', required: true },
      {
        name: 'base_price',
        label: 'السعر الأساسي (د.ل.)',
        kind: 'money',
        required: true,
        hint: 'حتى ثلاث خانات عشرية، مثل 25.000.',
      },
      { name: 'door_delivery_surcharge', label: 'رسوم التوصيل للباب (د.ل.)', kind: 'money' },
      {
        name: 'effective_from',
        label: 'بداية السريان — توقيت طرابلس',
        kind: 'datetime',
        required: true,
      },
      {
        name: 'effective_until',
        label: 'نهاية السريان — توقيت طرابلس',
        kind: 'datetime',
        nullable: true,
        hint: 'اتركها فارغة إذا لم توجد نهاية محددة.',
      },
      { name: 'active', label: 'الحالة', kind: 'active' },
    ],
    create: {
      operation: approvedOperations.postAdminPricingRules,
      body: pricingRuleInputSchema,
      response: postAdminPricingRulesResponseSchema,
    },
    edit: {
      operation: approvedOperations.patchAdminPricingRulesPricingRule,
      body: pricingRulePatchSchema,
      response: patchAdminPricingRulesPricingRuleResponseSchema,
    },
  },
};
