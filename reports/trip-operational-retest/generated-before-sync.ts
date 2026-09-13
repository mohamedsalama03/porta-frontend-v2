// Generated from contracts/porta-api-v1.openapi.json. Do not edit.
// SHA-256: 90d5a0905238d2c9447e1002332fb65b63b1dc552c4c98b441627b9c809b6ae4
import { z } from 'zod';

export const ulidSchema = z.ulid().regex(new RegExp('^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$'));
export type Ulid = z.infer<typeof ulidSchema>;

export const timestampSchema = z.iso.datetime({ offset: true });
export type Timestamp = z.infer<typeof timestampSchema>;

export const businessDateSchema = z.iso.date();
export type BusinessDate = z.infer<typeof businessDateSchema>;

export const moneySchema = z.number().int().safe().min(0).max(2000000000);
export type Money = z.infer<typeof moneySchema>;

export const signedMoneySchema = z.number().int().safe();
export type SignedMoney = z.infer<typeof signedMoneySchema>;

export const phoneSchema = z.string().max(40);
export type Phone = z.infer<typeof phoneSchema>;

export const shipmentSizeSchema = z.enum(['SMALL', 'MEDIUM', 'LARGE']);
export type ShipmentSize = z.infer<typeof shipmentSizeSchema>;

export const deliveryMethodSchema = z.enum(['OFFICE_PICKUP', 'DOOR_DELIVERY']);
export type DeliveryMethod = z.infer<typeof deliveryMethodSchema>;

export const paymentMethodSchema = z.enum(['CASH_ON_DELIVERY', 'PREPAID_TRANSFER']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const paymentStatusSchema = z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const shipmentStatusSchema = z.enum([
  'RECEIVED',
  'PREPARING',
  'IN_TRANSIT',
  'ARRIVED_CITY',
  'READY_FOR_PICKUP',
  'DELIVERED',
]);
export type ShipmentStatus = z.infer<typeof shipmentStatusSchema>;

export const tripStatusSchema = z.enum([
  'SCHEDULED',
  'LOADING',
  'DEPARTED',
  'ARRIVED',
  'COMPLETED',
  'CANCELLED',
]);
export type TripStatus = z.infer<typeof tripStatusSchema>;

export const roleSchema = z.enum([
  'SUPER_ADMIN',
  'ADMIN',
  'OPERATIONS_MANAGER',
  'BRANCH_OPERATOR',
  'DRIVER',
]);
export type Role = z.infer<typeof roleSchema>;

export const metaSchema = z.looseObject({});
export type Meta = z.infer<typeof metaSchema>;

export const cursorMetaSchema = z.strictObject({
  next_cursor: z.union([z.string(), z.null()]),
  previous_cursor: z.union([z.string(), z.null()]).optional(),
  per_page: z.number().int().safe().min(1).max(100).optional(),
  has_more: z.boolean().optional(),
});
export type CursorMeta = z.infer<typeof cursorMetaSchema>;

export const pageMetaSchema = z.strictObject({
  page: z.number().int().safe().min(1),
  total: z.number().int().safe().min(0),
  last_page: z.number().int().safe().min(1),
});
export type PageMeta = z.infer<typeof pageMetaSchema>;

export const errorSchema = z.strictObject({
  message: z.string(),
  request_id: z.uuid(),
  errors: z.looseObject({}).catchall(z.array(z.string())).optional(),
});
export type Error = z.infer<typeof errorSchema>;

export const cityNameSchema = z.strictObject({
  name_ar: z.string().max(120),
  name_en: z.string().max(120),
});
export type CityName = z.infer<typeof cityNameSchema>;

export const driverCitySchema = z.strictObject({
  name_ar: z.string().max(120),
  name_en: z.string().max(120),
  code: z.string().max(16),
});
export type DriverCity = z.infer<typeof driverCitySchema>;

export const citySchema = z.strictObject({
  id: ulidSchema,
  name_ar: z.string().max(120),
  name_en: z.string().max(120),
  code: z.string().max(16),
  active: z.boolean().optional(),
  sort_order: z.number().int().safe().min(0).max(10000).optional(),
});
export type City = z.infer<typeof citySchema>;

export const shipmentTypeSchema = z.strictObject({
  id: ulidSchema,
  name_ar: z.string().max(120),
  name_en: z.string().max(120),
  code: z.string().max(32),
  description: z.union([z.string().max(500), z.null()]).optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().safe().min(0).max(10000).optional(),
});
export type ShipmentType = z.infer<typeof shipmentTypeSchema>;

export const branchSchema = z.strictObject({
  id: ulidSchema,
  city_id: ulidSchema,
  name: z.string().max(120),
  address: z.string().max(500),
  phone: z.union([phoneSchema, z.null()]),
  active: z.boolean(),
});
export type Branch = z.infer<typeof branchSchema>;

export const cityInputSchema = z.looseObject({
  name_ar: z.string().max(120),
  name_en: z.string().max(120),
  code: z.string().regex(new RegExp('^[A-Z0-9_-]{2,16}$')),
  active: z.boolean().optional(),
  sort_order: z.number().int().safe().min(0).max(10000).optional(),
});
export type CityInput = z.infer<typeof cityInputSchema>;

export const cityPatchSchema = z.looseObject({
  name_ar: z.string().max(120).optional(),
  name_en: z.string().max(120).optional(),
  code: z.string().regex(new RegExp('^[A-Z0-9_-]{2,16}$')).optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().safe().min(0).max(10000).optional(),
});
export type CityPatch = z.infer<typeof cityPatchSchema>;

export const branchInputSchema = z.looseObject({
  city_id: ulidSchema,
  name: z.string().max(120),
  address: z.string().max(500),
  phone: z.union([phoneSchema, z.null()]).optional(),
  active: z.boolean().optional(),
});
export type BranchInput = z.infer<typeof branchInputSchema>;

export const branchPatchSchema = z.looseObject({
  city_id: ulidSchema.optional(),
  name: z.string().max(120).optional(),
  address: z.string().max(500).optional(),
  phone: z.union([phoneSchema, z.null()]).optional(),
  active: z.boolean().optional(),
});
export type BranchPatch = z.infer<typeof branchPatchSchema>;

export const shipmentTypeInputSchema = z.looseObject({
  name_ar: z.string().max(120),
  name_en: z.string().max(120),
  code: z.string().regex(new RegExp('^[A-Z0-9_-]{2,32}$')),
  active: z.boolean().optional(),
  sort_order: z.number().int().safe().min(0).max(10000).optional(),
  description: z.union([z.string().max(500), z.null()]).optional(),
});
export type ShipmentTypeInput = z.infer<typeof shipmentTypeInputSchema>;

export const shipmentTypePatchSchema = z.looseObject({
  name_ar: z.string().max(120).optional(),
  name_en: z.string().max(120).optional(),
  code: z.string().regex(new RegExp('^[A-Z0-9_-]{2,32}$')).optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().safe().min(0).max(10000).optional(),
  description: z.union([z.string().max(500), z.null()]).optional(),
});
export type ShipmentTypePatch = z.infer<typeof shipmentTypePatchSchema>;

export const quoteInputSchema = z.looseObject({
  origin_city_id: ulidSchema,
  destination_city_id: ulidSchema,
  shipment_type_id: ulidSchema,
  shipment_size: shipmentSizeSchema,
  delivery_method: deliveryMethodSchema,
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;

export const quoteSchema = z.strictObject({
  calculated_price: moneySchema,
  final_price: moneySchema,
  currency: z.literal('LYD'),
  minor_unit_scale: z.literal(3),
});
export type Quote = z.infer<typeof quoteSchema>;

export const pricingRuleInputSchema = z.looseObject({
  origin_city_id: ulidSchema,
  destination_city_id: ulidSchema,
  shipment_type_id: ulidSchema,
  shipment_size: shipmentSizeSchema,
  base_price: z.number().int().safe().min(0).max(1000000000),
  door_delivery_surcharge: z.number().int().safe().min(0).max(1000000000).optional(),
  active: z.boolean().optional(),
  effective_from: timestampSchema,
  effective_until: z.union([timestampSchema, z.null()]).optional(),
});
export type PricingRuleInput = z.infer<typeof pricingRuleInputSchema>;

export const pricingRulePatchSchema = z.looseObject({
  origin_city_id: ulidSchema.optional(),
  destination_city_id: ulidSchema.optional(),
  shipment_type_id: ulidSchema.optional(),
  shipment_size: shipmentSizeSchema.optional(),
  base_price: z.number().int().safe().min(0).max(1000000000).optional(),
  door_delivery_surcharge: z.number().int().safe().min(0).max(1000000000).optional(),
  active: z.boolean().optional(),
  effective_from: timestampSchema.optional(),
  effective_until: z.union([timestampSchema, z.null()]).optional(),
});
export type PricingRulePatch = z.infer<typeof pricingRulePatchSchema>;

export const pricingRuleSchema = z.strictObject({
  id: ulidSchema,
  origin_city_id: ulidSchema,
  destination_city_id: ulidSchema,
  shipment_type_id: ulidSchema,
  shipment_size: shipmentSizeSchema,
  base_price: z.number().int().safe().min(0).max(1000000000),
  door_delivery_surcharge: z.number().int().safe().min(0).max(1000000000),
  active: z.boolean(),
  effective_from: timestampSchema,
  effective_until: z.union([timestampSchema, z.null()]),
  currency: z.literal('LYD'),
  minor_unit_scale: z.literal(3),
});
export type PricingRule = z.infer<typeof pricingRuleSchema>;

export const shipmentInputSchema = z
  .strictObject({
    sender_name: z.string().max(150),
    sender_phone: phoneSchema,
    recipient_name: z.string().max(150),
    recipient_phone: phoneSchema,
    origin_city_id: ulidSchema,
    destination_city_id: ulidSchema,
    shipment_type_id: ulidSchema,
    branch_id: z.union([ulidSchema, z.null()]).optional(),
    shipment_size: shipmentSizeSchema,
    weight: z
      .union([
        z.number().max(100000).gt(0),
        z.string().regex(new RegExp('^[0-9]+(?:\\.[0-9]{1,3})?$')),
        z.null(),
      ])
      .optional(),
    notes: z.union([z.string().max(2000), z.null()]).optional(),
    delivery_method: deliveryMethodSchema,
    delivery_address: z.union([z.string().max(500), z.null()]).optional(),
    payment_method: z.enum(['CASH_ON_DELIVERY', 'PREPAID_TRANSFER']).optional(),
  })
  .superRefine((value, ctx) => {
    if (z.looseObject({ delivery_method: z.literal('DOOR_DELIVERY') }).safeParse(value).success) {
      const result = z
        .looseObject({ delivery_address: z.string().min(1).max(500) })
        .safeParse(value);
      if (!result.success)
        for (const issue of result.error.issues)
          ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  });
export type ShipmentInput = z.infer<typeof shipmentInputSchema>;

export const shipmentPatchSchema = z.strictObject({
  sender_name: z.string().max(150).optional(),
  sender_phone: phoneSchema.optional(),
  recipient_name: z.string().max(150).optional(),
  recipient_phone: phoneSchema.optional(),
  notes: z.union([z.string().max(2000), z.null()]).optional(),
  delivery_address: z.string().min(1).max(500).optional(),
});
export type ShipmentPatch = z.infer<typeof shipmentPatchSchema>;

export const shipmentSchema = z.strictObject({
  id: ulidSchema,
  tracking_number: z.string().regex(new RegExp('^PTA-[0-9]{6}-[A-Z0-9]{6,20}$')),
  sender_name: z.string().max(150),
  sender_phone: phoneSchema,
  recipient_name: z.string().max(150),
  recipient_phone: phoneSchema,
  origin_city_id: ulidSchema,
  destination_city_id: ulidSchema,
  shipment_type_id: ulidSchema,
  branch_id: z.union([ulidSchema, z.null()]).optional(),
  shipment_size: shipmentSizeSchema,
  weight: z.union([z.string().regex(new RegExp('^[0-9]+\\.[0-9]{3}$')), z.null()]).optional(),
  notes: z.union([z.string().max(2000), z.null()]).optional(),
  delivery_method: deliveryMethodSchema.optional(),
  delivery_address: z.union([z.string().max(500), z.null()]).optional(),
  payment_method: z.enum(['CASH_ON_DELIVERY', 'PREPAID_TRANSFER']).optional(),
  calculated_price: moneySchema,
  final_price: moneySchema,
  currency: z.literal('LYD'),
  minor_unit_scale: z.literal(3).optional(),
  payment_status: paymentStatusSchema,
  current_status: shipmentStatusSchema,
  assigned_driver_id: z.union([ulidSchema, z.null()]).optional(),
  trip_id: z.union([ulidSchema, z.null()]).optional(),
  created_at: timestampSchema.optional(),
  updated_at: timestampSchema.optional(),
});
export type Shipment = z.infer<typeof shipmentSchema>;

export const orderCreatedSchema = z.strictObject({
  tracking_number: z.string().regex(new RegExp('^PTA-[0-9]{6}-[A-Z0-9]{6,20}$')),
  current_status: shipmentStatusSchema,
  final_price: moneySchema,
  currency: z.literal('LYD'),
  minor_unit_scale: z.literal(3),
});
export type OrderCreated = z.infer<typeof orderCreatedSchema>;

export const trackingEventSchema = z.strictObject({
  status: shipmentStatusSchema,
  status_label: z.string(),
  occurred_at: timestampSchema,
});
export type TrackingEvent = z.infer<typeof trackingEventSchema>;

export const trackingSchema = z.strictObject({
  tracking_number: z.string().regex(new RegExp('^PTA-[0-9]{6}-[A-Z0-9]{6,20}$')),
  origin_city: cityNameSchema,
  destination_city: cityNameSchema,
  shipment_type: z.string().max(120),
  current_status: shipmentStatusSchema,
  status_label: z.string(),
  created_at: timestampSchema,
  estimated_delivery: z.union([timestampSchema, z.null()]),
  tracking_timeline: z.array(trackingEventSchema),
});
export type Tracking = z.infer<typeof trackingSchema>;

export const shipmentStatusInputSchema = z.strictObject({
  status: shipmentStatusSchema,
  notes: z.union([z.string().max(1000), z.null()]).optional(),
});
export type ShipmentStatusInput = z.infer<typeof shipmentStatusInputSchema>;

export const assignDriverInputSchema = z.looseObject({ driver_id: ulidSchema });
export type AssignDriverInput = z.infer<typeof assignDriverInputSchema>;

export const paymentInputSchema = z.looseObject({
  status: z.enum(['PAID', 'FAILED', 'REFUNDED']),
  amount: moneySchema.optional(),
  external_reference: z
    .union([z.string().max(120).regex(new RegExp('^[a-zA-Z0-9._:/-]+$')), z.null()])
    .optional(),
  notes: z.union([z.string().max(500), z.null()]).optional(),
});
export type PaymentInput = z.infer<typeof paymentInputSchema>;

export const paymentEntrySchema = z.strictObject({
  id: ulidSchema,
  shipment_id: ulidSchema,
  from_status: paymentStatusSchema,
  status: z.enum(['PAID', 'FAILED', 'REFUNDED']),
  kind: z.enum(['CAPTURE', 'FAILURE', 'REFUND']),
  amount: signedMoneySchema,
  currency: z.literal('LYD'),
  minor_unit_scale: z.literal(3),
  payment_method: paymentMethodSchema,
  external_reference: z.union([z.string().max(120), z.null()]),
  notes: z.union([z.string().max(500), z.null()]),
  created_at: timestampSchema,
});
export type PaymentEntry = z.infer<typeof paymentEntrySchema>;

export const driverInputSchema = z.strictObject({
  full_name: z.string().max(150),
  phone: z.string().max(30),
  license_number: z.union([z.string().max(80), z.null()]).optional(),
  user_id: z.union([ulidSchema, z.null()]).optional(),
  active: z.boolean().optional(),
});
export type DriverInput = z.infer<typeof driverInputSchema>;

export const driverPatchSchema = z.strictObject({
  full_name: z.string().max(150).optional(),
  phone: z.string().max(30).optional(),
  license_number: z.union([z.string().max(80), z.null()]).optional(),
  user_id: z.union([ulidSchema, z.null()]).optional(),
  active: z.boolean().optional(),
});
export type DriverPatch = z.infer<typeof driverPatchSchema>;

export const driverSchema = z.strictObject({
  id: ulidSchema,
  full_name: z.string().max(150),
  phone: z.string().max(30),
  license_number: z.union([z.string().max(80), z.null()]),
  user_id: z.union([ulidSchema, z.null()]),
  active: z.boolean(),
});
export type Driver = z.infer<typeof driverSchema>;

export const tripInputSchema = z.strictObject({
  origin_city_id: ulidSchema,
  destination_city_id: ulidSchema,
  driver_id: z.union([ulidSchema, z.null()]).optional(),
  branch_id: z.union([ulidSchema, z.null()]).optional(),
  departure_at: z.iso
    .datetime({ offset: true })
    .regex(
      new RegExp('^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$'),
    ),
  estimated_arrival_at: z.union([z.iso.datetime({ offset: true }), z.null()]).optional(),
});
export type TripInput = z.infer<typeof tripInputSchema>;

export const tripPatchSchema = z.strictObject({
  origin_city_id: ulidSchema.optional(),
  destination_city_id: ulidSchema.optional(),
  driver_id: z.union([ulidSchema, z.null()]).optional(),
  branch_id: z.union([ulidSchema, z.null()]).optional(),
  departure_at: z.iso
    .datetime({ offset: true })
    .regex(
      new RegExp('^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$'),
    )
    .optional(),
  estimated_arrival_at: z.union([z.iso.datetime({ offset: true }), z.null()]).optional(),
});
export type TripPatch = z.infer<typeof tripPatchSchema>;

export const tripSchema = z.strictObject({
  id: ulidSchema,
  origin_city_id: ulidSchema,
  destination_city_id: ulidSchema,
  driver_id: z.union([ulidSchema, z.null()]),
  branch_id: z.union([ulidSchema, z.null()]),
  departure_at: z.iso
    .datetime({ offset: true })
    .regex(
      new RegExp('^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2}$'),
    ),
  estimated_arrival_at: z.union([z.iso.datetime({ offset: true }), z.null()]),
  origin_city: citySchema.optional(),
  destination_city: citySchema.optional(),
  driver: z
    .union([z.strictObject({ id: ulidSchema, full_name: z.string().max(150) }), z.null()])
    .optional(),
  status: tripStatusSchema,
  shipments_count: z.number().int().safe().min(0).optional(),
  created_at: z.union([timestampSchema, z.null()]).optional(),
});
export type Trip = z.infer<typeof tripSchema>;

export const tripStatusInputSchema = z.strictObject({ status: tripStatusSchema });
export type TripStatusInput = z.infer<typeof tripStatusInputSchema>;

export const attachShipmentsInputSchema = z.strictObject({
  shipment_ids: z
    .array(ulidSchema)
    .min(1)
    .max(200)
    .refine((items) => new Set(items.map((item) => JSON.stringify(item))).size === items.length, {
      message: 'Values must be unique',
    }),
});
export type AttachShipmentsInput = z.infer<typeof attachShipmentsInputSchema>;

export const driverStatusInputSchema = z.strictObject({
  status: z.enum(['READY_FOR_PICKUP', 'DELIVERED']),
});
export type DriverStatusInput = z.infer<typeof driverStatusInputSchema>;

export const driverShipmentSchema = z.strictObject({
  id: ulidSchema,
  tracking_number: z.string().regex(new RegExp('^PTA-[0-9]{6}-[A-Z0-9]{6,20}$')),
  trip_id: z.union([ulidSchema, z.null()]),
  current_status: shipmentStatusSchema,
  origin_city: driverCitySchema.optional(),
  destination_city: driverCitySchema.optional(),
  sender_name: z.string().max(150),
  sender_phone: phoneSchema,
  recipient_name: z.string().max(150),
  recipient_phone: phoneSchema,
  delivery_method: deliveryMethodSchema,
  delivery_address: z.union([z.string().max(500), z.null()]),
  shipment_size: shipmentSizeSchema,
  shipment_type: cityNameSchema.optional(),
});
export type DriverShipment = z.infer<typeof driverShipmentSchema>;

export const driverTripSchema = z.strictObject({
  id: ulidSchema,
  origin_city: driverCitySchema.optional(),
  destination_city: driverCitySchema.optional(),
  departure_at: timestampSchema,
  estimated_arrival_at: z.union([timestampSchema, z.null()]),
  status: tripStatusSchema,
  shipments_count: z.number().int().safe().min(0).optional(),
});
export type DriverTrip = z.infer<typeof driverTripSchema>;

export const loginInputSchema = z.strictObject({
  email: z.email().max(254),
  password: z.string().max(1024),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const userInputSchema = z
  .looseObject({
    name: z.string().max(150),
    email: z.email().max(254),
    password: z.string().min(12).max(1024),
    role: roleSchema,
    branch_id: z.union([ulidSchema, z.null()]).optional(),
    active: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (z.looseObject({ role: z.literal('BRANCH_OPERATOR') }).safeParse(value).success) {
      const result = z.looseObject({ branch_id: ulidSchema }).safeParse(value);
      if (!result.success)
        for (const issue of result.error.issues)
          ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  });
export type UserInput = z.infer<typeof userInputSchema>;

export const userPatchSchema = z.looseObject({
  role: roleSchema.optional(),
  branch_id: z.union([ulidSchema, z.null()]).optional(),
  active: z.boolean().optional(),
});
export type UserPatch = z.infer<typeof userPatchSchema>;

export const userSchema = z.strictObject({
  id: ulidSchema,
  name: z.string().max(150),
  email: z.email(),
  role: roleSchema,
  branch_id: z.union([ulidSchema, z.null()]).optional(),
  active: z.boolean().optional(),
  email_verified_at: z.union([timestampSchema, z.null()]).optional(),
  created_at: timestampSchema.optional(),
  updated_at: timestampSchema.optional(),
});
export type User = z.infer<typeof userSchema>;

export const meSchema = z.strictObject({
  id: ulidSchema,
  name: z.string().max(150),
  email: z.email(),
  role: roleSchema,
  branch_id: z.union([ulidSchema, z.null()]),
  permissions: z.array(z.string()),
});
export type Me = z.infer<typeof meSchema>;

export const logoutSchema = z.strictObject({ logged_out: z.literal(true) });
export type Logout = z.infer<typeof logoutSchema>;

export const auditSchema = z.strictObject({
  id: ulidSchema,
  actor_id: z.union([ulidSchema, z.null()]),
  action: z.string().max(80),
  entity_type: z.string().max(160),
  entity_id: ulidSchema,
  before: z.string(),
  after: z.string(),
  metadata: z.string(),
  created_at: timestampSchema,
});
export type Audit = z.infer<typeof auditSchema>;

export const reportSchema = z.strictObject({
  from: businessDateSchema,
  to: businessDateSchema,
  generated_at: timestampSchema,
  total_shipments: z.number().int().safe().min(0),
  delivered_shipments: z.number().int().safe().min(0),
  shipments_by_status: z.looseObject({}).catchall(z.number().int().safe().min(0)),
  shipments_by_origin_city: z.looseObject({}).catchall(z.number().int().safe().min(0)),
  shipments_by_destination_city: z.looseObject({}).catchall(z.number().int().safe().min(0)),
  shipments_by_date: z.array(
    z.strictObject({ date: businessDateSchema, total: z.number().int().safe().min(0) }),
  ),
  active_trips: z.number().int().safe().min(0),
  net_revenue: signedMoneySchema,
  revenue_by_date: z.array(
    z.strictObject({ date: businessDateSchema, revenue: signedMoneySchema }),
  ),
  revenue_by_route: z.array(
    z.strictObject({
      origin_city_id: ulidSchema,
      destination_city_id: ulidSchema,
      revenue: signedMoneySchema,
    }),
  ),
  revenue_route_limit: z.literal(500),
  currency: z.literal('LYD'),
  minor_unit_scale: z.literal(3),
});
export type Report = z.infer<typeof reportSchema>;

export const reportMetaSchema = z.strictObject({
  cache_ttl_seconds: z.literal(60),
  timezone: z.literal('Africa/Tripoli'),
});
export type ReportMeta = z.infer<typeof reportMetaSchema>;

export const postOrdersQuerySchema = z.strictObject({});

export const postOrdersPathSchema = z.strictObject({});

export const postOrdersBodySchema = shipmentInputSchema;

export const postOrdersResponseSchema = z.strictObject({
  data: orderCreatedSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getTrackingTrackingNumberQuerySchema = z.strictObject({});

export const getTrackingTrackingNumberPathSchema = z.strictObject({
  trackingNumber: z.string().regex(new RegExp('^PTA-[0-9]{6}-[A-Z0-9]{6,20}$')),
});

export const getTrackingTrackingNumberResponseSchema = z.strictObject({
  data: trackingSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const postAuthLoginQuerySchema = z.strictObject({});

export const postAuthLoginPathSchema = z.strictObject({});

export const postAuthLoginBodySchema = loginInputSchema;

export const postAuthLoginResponseSchema = z.strictObject({
  data: meSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const postAuthLogoutQuerySchema = z.strictObject({});

export const postAuthLogoutPathSchema = z.strictObject({});

export const postAuthLogoutResponseSchema = z.strictObject({
  data: logoutSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getAuthMeQuerySchema = z.strictObject({});

export const getAuthMePathSchema = z.strictObject({});

export const getAuthMeResponseSchema = z.strictObject({
  data: meSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getCitiesQuerySchema = z.strictObject({});

export const getCitiesPathSchema = z.strictObject({});

export const getCitiesResponseSchema = z.strictObject({
  data: z.array(citySchema),
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getShipmentTypesQuerySchema = z.strictObject({});

export const getShipmentTypesPathSchema = z.strictObject({});

export const getShipmentTypesResponseSchema = z.strictObject({
  data: z.array(shipmentTypeSchema),
  meta: metaSchema,
  request_id: z.uuid(),
});

export const postQuotesQuerySchema = z.strictObject({});

export const postQuotesPathSchema = z.strictObject({});

export const postQuotesBodySchema = quoteInputSchema;

export const postQuotesResponseSchema = z.strictObject({
  data: quoteSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getAdminCitiesQuerySchema = z.strictObject({
  page: z.number().int().safe().min(1).max(10000).optional(),
  per_page: z.number().int().safe().min(1).max(100).optional(),
});

export const getAdminCitiesPathSchema = z.strictObject({});

export const getAdminCitiesResponseSchema = z.strictObject({
  data: z.array(citySchema),
  meta: pageMetaSchema,
  request_id: z.uuid(),
});

export const postAdminCitiesQuerySchema = z.strictObject({});

export const postAdminCitiesPathSchema = z.strictObject({});

export const postAdminCitiesBodySchema = cityInputSchema;

export const postAdminCitiesResponseSchema = z.strictObject({
  data: citySchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const patchAdminCitiesCityQuerySchema = z.strictObject({});

export const patchAdminCitiesCityPathSchema = z.strictObject({ city: ulidSchema });

export const patchAdminCitiesCityBodySchema = cityPatchSchema;

export const patchAdminCitiesCityResponseSchema = z.strictObject({
  data: citySchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getAdminBranchesQuerySchema = z.strictObject({
  page: z.number().int().safe().min(1).max(10000).optional(),
  per_page: z.number().int().safe().min(1).max(100).optional(),
});

export const getAdminBranchesPathSchema = z.strictObject({});

export const getAdminBranchesResponseSchema = z.strictObject({
  data: z.array(branchSchema),
  meta: pageMetaSchema,
  request_id: z.uuid(),
});

export const postAdminBranchesQuerySchema = z.strictObject({});

export const postAdminBranchesPathSchema = z.strictObject({});

export const postAdminBranchesBodySchema = branchInputSchema;

export const postAdminBranchesResponseSchema = z.strictObject({
  data: branchSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const patchAdminBranchesBranchQuerySchema = z.strictObject({});

export const patchAdminBranchesBranchPathSchema = z.strictObject({ branch: ulidSchema });

export const patchAdminBranchesBranchBodySchema = branchPatchSchema;

export const patchAdminBranchesBranchResponseSchema = z.strictObject({
  data: branchSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getAdminShipmentTypesQuerySchema = z.strictObject({
  page: z.number().int().safe().min(1).max(10000).optional(),
  per_page: z.number().int().safe().min(1).max(100).optional(),
});

export const getAdminShipmentTypesPathSchema = z.strictObject({});

export const getAdminShipmentTypesResponseSchema = z.strictObject({
  data: z.array(shipmentTypeSchema),
  meta: pageMetaSchema,
  request_id: z.uuid(),
});

export const postAdminShipmentTypesQuerySchema = z.strictObject({});

export const postAdminShipmentTypesPathSchema = z.strictObject({});

export const postAdminShipmentTypesBodySchema = shipmentTypeInputSchema;

export const postAdminShipmentTypesResponseSchema = z.strictObject({
  data: shipmentTypeSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const patchAdminShipmentTypesShipmentTypeQuerySchema = z.strictObject({});

export const patchAdminShipmentTypesShipmentTypePathSchema = z.strictObject({
  shipmentType: ulidSchema,
});

export const patchAdminShipmentTypesShipmentTypeBodySchema = shipmentTypePatchSchema;

export const patchAdminShipmentTypesShipmentTypeResponseSchema = z.strictObject({
  data: shipmentTypeSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getAdminPricingRulesQuerySchema = z.strictObject({
  page: z.number().int().safe().min(1).max(10000).optional(),
  per_page: z.number().int().safe().min(1).max(100).optional(),
  origin_city_id: ulidSchema.optional(),
  destination_city_id: ulidSchema.optional(),
  shipment_type_id: ulidSchema.optional(),
  active: z.boolean().optional(),
});

export const getAdminPricingRulesPathSchema = z.strictObject({});

export const getAdminPricingRulesResponseSchema = z.strictObject({
  data: z.array(pricingRuleSchema),
  meta: pageMetaSchema,
  request_id: z.uuid(),
});

export const postAdminPricingRulesQuerySchema = z.strictObject({});

export const postAdminPricingRulesPathSchema = z.strictObject({});

export const postAdminPricingRulesBodySchema = pricingRuleInputSchema;

export const postAdminPricingRulesResponseSchema = z.strictObject({
  data: pricingRuleSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const patchAdminPricingRulesPricingRuleQuerySchema = z.strictObject({});

export const patchAdminPricingRulesPricingRulePathSchema = z.strictObject({
  pricingRule: ulidSchema,
});

export const patchAdminPricingRulesPricingRuleBodySchema = pricingRulePatchSchema;

export const patchAdminPricingRulesPricingRuleResponseSchema = z.strictObject({
  data: pricingRuleSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getAdminShipmentsQuerySchema = z.strictObject({
  cursor: z.string().max(1000).optional(),
  per_page: z.number().int().safe().min(1).max(100).optional(),
  tracking_number: z.string().max(40).optional(),
  search: z.string().min(3).max(150).optional(),
  origin_city: ulidSchema.optional(),
  destination_city: ulidSchema.optional(),
  shipment_type: ulidSchema.optional(),
  driver: ulidSchema.optional(),
  trip: ulidSchema.optional(),
  status: shipmentStatusSchema.optional(),
  shipment_size: shipmentSizeSchema.optional(),
  payment_status: paymentStatusSchema.optional(),
  created_from: businessDateSchema.optional(),
  created_to: businessDateSchema.optional(),
  sort: z.enum(['created_at', '-created_at']).optional(),
});

export const getAdminShipmentsPathSchema = z.strictObject({});

export const getAdminShipmentsResponseSchema = z.strictObject({
  data: z.array(shipmentSchema),
  meta: cursorMetaSchema,
  request_id: z.uuid(),
});

export const postAdminShipmentsQuerySchema = z.strictObject({});

export const postAdminShipmentsPathSchema = z.strictObject({});

export const postAdminShipmentsBodySchema = shipmentInputSchema;

export const postAdminShipmentsResponseSchema = z.strictObject({
  data: shipmentSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getAdminShipmentsShipmentQuerySchema = z.strictObject({});

export const getAdminShipmentsShipmentPathSchema = z.strictObject({ shipment: ulidSchema });

export const getAdminShipmentsShipmentResponseSchema = z.strictObject({
  data: shipmentSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const patchAdminShipmentsShipmentQuerySchema = z.strictObject({});

export const patchAdminShipmentsShipmentPathSchema = z.strictObject({ shipment: ulidSchema });

export const patchAdminShipmentsShipmentBodySchema = shipmentPatchSchema;

export const patchAdminShipmentsShipmentResponseSchema = z.strictObject({
  data: shipmentSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const postAdminShipmentsShipmentStatusQuerySchema = z.strictObject({});

export const postAdminShipmentsShipmentStatusPathSchema = z.strictObject({ shipment: ulidSchema });

export const postAdminShipmentsShipmentStatusBodySchema = shipmentStatusInputSchema;

export const postAdminShipmentsShipmentStatusResponseSchema = z.strictObject({
  data: shipmentSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const postAdminShipmentsShipmentDriverQuerySchema = z.strictObject({});

export const postAdminShipmentsShipmentDriverPathSchema = z.strictObject({ shipment: ulidSchema });

export const postAdminShipmentsShipmentDriverBodySchema = assignDriverInputSchema;

export const postAdminShipmentsShipmentDriverResponseSchema = z.strictObject({
  data: shipmentSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getAdminShipmentsShipmentPaymentsQuerySchema = z.strictObject({
  cursor: z.string().max(1000).optional(),
  per_page: z.number().int().safe().min(1).max(100).optional(),
});

export const getAdminShipmentsShipmentPaymentsPathSchema = z.strictObject({ shipment: ulidSchema });

export const getAdminShipmentsShipmentPaymentsResponseSchema = z.strictObject({
  data: z.array(paymentEntrySchema),
  meta: cursorMetaSchema,
  request_id: z.uuid(),
});

export const postAdminShipmentsShipmentPaymentsQuerySchema = z.strictObject({});

export const postAdminShipmentsShipmentPaymentsPathSchema = z.strictObject({
  shipment: ulidSchema,
});

export const postAdminShipmentsShipmentPaymentsBodySchema = paymentInputSchema;

export const postAdminShipmentsShipmentPaymentsResponseSchema = z.strictObject({
  data: paymentEntrySchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getAdminDriversQuerySchema = z.strictObject({
  cursor: z.string().max(1000).optional(),
  per_page: z.number().int().safe().min(1).max(100).optional(),
  active: z.boolean().optional(),
});

export const getAdminDriversPathSchema = z.strictObject({});

export const getAdminDriversResponseSchema = z.strictObject({
  data: z.array(driverSchema),
  meta: cursorMetaSchema,
  request_id: z.uuid(),
});

export const postAdminDriversQuerySchema = z.strictObject({});

export const postAdminDriversPathSchema = z.strictObject({});

export const postAdminDriversBodySchema = driverInputSchema;

export const postAdminDriversResponseSchema = z.strictObject({
  data: driverSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getAdminDriversDriverQuerySchema = z.strictObject({});

export const getAdminDriversDriverPathSchema = z.strictObject({ driver: ulidSchema });

export const getAdminDriversDriverResponseSchema = z.strictObject({
  data: driverSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const patchAdminDriversDriverQuerySchema = z.strictObject({});

export const patchAdminDriversDriverPathSchema = z.strictObject({ driver: ulidSchema });

export const patchAdminDriversDriverBodySchema = driverPatchSchema;

export const patchAdminDriversDriverResponseSchema = z.strictObject({
  data: driverSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getAdminTripsQuerySchema = z.strictObject({
  cursor: z.string().max(1000).optional(),
  per_page: z.number().int().safe().min(1).max(100).optional(),
  status: tripStatusSchema.optional(),
  driver_id: ulidSchema.optional(),
  origin_city_id: ulidSchema.optional(),
  destination_city_id: ulidSchema.optional(),
  branch_id: ulidSchema.optional(),
});

export const getAdminTripsPathSchema = z.strictObject({});

export const getAdminTripsResponseSchema = z.strictObject({
  data: z.array(tripSchema),
  meta: cursorMetaSchema,
  request_id: z.uuid(),
});

export const postAdminTripsQuerySchema = z.strictObject({});

export const postAdminTripsPathSchema = z.strictObject({});

export const postAdminTripsBodySchema = tripInputSchema;

export const postAdminTripsResponseSchema = z.strictObject({
  data: tripSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getAdminTripsTripQuerySchema = z.strictObject({});

export const getAdminTripsTripPathSchema = z.strictObject({ trip: ulidSchema });

export const getAdminTripsTripResponseSchema = z.strictObject({
  data: tripSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const patchAdminTripsTripQuerySchema = z.strictObject({});

export const patchAdminTripsTripPathSchema = z.strictObject({ trip: ulidSchema });

export const patchAdminTripsTripBodySchema = tripPatchSchema;

export const patchAdminTripsTripResponseSchema = z.strictObject({
  data: tripSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getAdminTripsTripShipmentsQuerySchema = z.strictObject({
  cursor: z.string().max(1000).optional(),
  per_page: z.number().int().safe().min(1).max(100).optional(),
});

export const getAdminTripsTripShipmentsPathSchema = z.strictObject({ trip: ulidSchema });

export const getAdminTripsTripShipmentsResponseSchema = z.strictObject({
  data: z.array(driverShipmentSchema),
  meta: cursorMetaSchema,
  request_id: z.uuid(),
});

export const postAdminTripsTripShipmentsQuerySchema = z.strictObject({});

export const postAdminTripsTripShipmentsPathSchema = z.strictObject({ trip: ulidSchema });

export const postAdminTripsTripShipmentsBodySchema = attachShipmentsInputSchema;

export const postAdminTripsTripShipmentsResponseSchema = z.strictObject({
  data: tripSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const deleteAdminTripsTripShipmentsShipmentQuerySchema = z.strictObject({});

export const deleteAdminTripsTripShipmentsShipmentPathSchema = z.strictObject({
  trip: ulidSchema,
  shipment: ulidSchema,
});

export const deleteAdminTripsTripShipmentsShipmentResponseSchema = z.strictObject({
  data: tripSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const postAdminTripsTripStatusQuerySchema = z.strictObject({});

export const postAdminTripsTripStatusPathSchema = z.strictObject({ trip: ulidSchema });

export const postAdminTripsTripStatusBodySchema = tripStatusInputSchema;

export const postAdminTripsTripStatusResponseSchema = z.strictObject({
  data: tripSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getDriverTripsQuerySchema = z.strictObject({
  cursor: z.string().max(1000).optional(),
  per_page: z.number().int().safe().min(1).max(100).optional(),
  status: tripStatusSchema.optional(),
});

export const getDriverTripsPathSchema = z.strictObject({});

export const getDriverTripsResponseSchema = z.strictObject({
  data: z.array(driverTripSchema),
  meta: cursorMetaSchema,
  request_id: z.uuid(),
});

export const getDriverTripsTripQuerySchema = z.strictObject({});

export const getDriverTripsTripPathSchema = z.strictObject({ trip: ulidSchema });

export const getDriverTripsTripResponseSchema = z.strictObject({
  data: driverTripSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getDriverShipmentsQuerySchema = z.strictObject({
  cursor: z.string().max(1000).optional(),
  per_page: z.number().int().safe().min(1).max(100).optional(),
  trip_id: ulidSchema.optional(),
  status: shipmentStatusSchema.optional(),
});

export const getDriverShipmentsPathSchema = z.strictObject({});

export const getDriverShipmentsResponseSchema = z.strictObject({
  data: z.array(driverShipmentSchema),
  meta: cursorMetaSchema,
  request_id: z.uuid(),
});

export const getDriverShipmentsShipmentQuerySchema = z.strictObject({});

export const getDriverShipmentsShipmentPathSchema = z.strictObject({ shipment: ulidSchema });

export const getDriverShipmentsShipmentResponseSchema = z.strictObject({
  data: driverShipmentSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const postDriverShipmentsShipmentStatusQuerySchema = z.strictObject({});

export const postDriverShipmentsShipmentStatusPathSchema = z.strictObject({ shipment: ulidSchema });

export const postDriverShipmentsShipmentStatusBodySchema = driverStatusInputSchema;

export const postDriverShipmentsShipmentStatusResponseSchema = z.strictObject({
  data: driverShipmentSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getAdminUsersQuerySchema = z.strictObject({
  cursor: z.string().max(1000).optional(),
  per_page: z.number().int().safe().min(1).max(100).optional(),
});

export const getAdminUsersPathSchema = z.strictObject({});

export const getAdminUsersResponseSchema = z.strictObject({
  data: z.array(userSchema),
  meta: cursorMetaSchema,
  request_id: z.uuid(),
});

export const postAdminUsersQuerySchema = z.strictObject({});

export const postAdminUsersPathSchema = z.strictObject({});

export const postAdminUsersBodySchema = userInputSchema;

export const postAdminUsersResponseSchema = z.strictObject({
  data: userSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const patchAdminUsersUserQuerySchema = z.strictObject({});

export const patchAdminUsersUserPathSchema = z.strictObject({ user: ulidSchema });

export const patchAdminUsersUserBodySchema = userPatchSchema;

export const patchAdminUsersUserResponseSchema = z.strictObject({
  data: userSchema,
  meta: metaSchema,
  request_id: z.uuid(),
});

export const getAdminAuditLogsQuerySchema = z.strictObject({
  cursor: z.string().max(1000).optional(),
  per_page: z.number().int().safe().min(1).max(100).optional(),
});

export const getAdminAuditLogsPathSchema = z.strictObject({});

export const getAdminAuditLogsResponseSchema = z.strictObject({
  data: z.array(auditSchema),
  meta: cursorMetaSchema,
  request_id: z.uuid(),
});

export const getAdminReportsQuerySchema = z.strictObject({
  from: businessDateSchema.optional(),
  to: businessDateSchema.optional(),
});

export const getAdminReportsPathSchema = z.strictObject({});

export const getAdminReportsResponseSchema = z.strictObject({
  data: reportSchema,
  meta: reportMetaSchema,
  request_id: z.uuid(),
});

export const getCsrfCookieQuerySchema = z.strictObject({});

export const getCsrfCookiePathSchema = z.strictObject({});

export const getCsrfCookieResponseSchema = z.null();

export const approvedOperations = {
  postOrders: { path: '/api/v1/orders', method: 'POST', permission: null, idempotent: true },
  getTrackingTrackingNumber: {
    path: '/api/v1/tracking/{trackingNumber}',
    method: 'GET',
    permission: null,
    idempotent: false,
  },
  postAuthLogin: {
    path: '/api/v1/auth/login',
    method: 'POST',
    permission: null,
    idempotent: false,
  },
  postAuthLogout: {
    path: '/api/v1/auth/logout',
    method: 'POST',
    permission: null,
    idempotent: false,
  },
  getAuthMe: { path: '/api/v1/auth/me', method: 'GET', permission: null, idempotent: false },
  getCities: { path: '/api/v1/cities', method: 'GET', permission: null, idempotent: false },
  getShipmentTypes: {
    path: '/api/v1/shipment-types',
    method: 'GET',
    permission: null,
    idempotent: false,
  },
  postQuotes: { path: '/api/v1/quotes', method: 'POST', permission: null, idempotent: false },
  getAdminCities: {
    path: '/api/v1/admin/cities',
    method: 'GET',
    permission: 'cities.manage',
    idempotent: false,
  },
  postAdminCities: {
    path: '/api/v1/admin/cities',
    method: 'POST',
    permission: 'cities.manage',
    idempotent: true,
  },
  patchAdminCitiesCity: {
    path: '/api/v1/admin/cities/{city}',
    method: 'PATCH',
    permission: 'cities.manage',
    idempotent: true,
  },
  getAdminBranches: {
    path: '/api/v1/admin/branches',
    method: 'GET',
    permission: 'cities.manage',
    idempotent: false,
  },
  postAdminBranches: {
    path: '/api/v1/admin/branches',
    method: 'POST',
    permission: 'cities.manage',
    idempotent: true,
  },
  patchAdminBranchesBranch: {
    path: '/api/v1/admin/branches/{branch}',
    method: 'PATCH',
    permission: 'cities.manage',
    idempotent: true,
  },
  getAdminShipmentTypes: {
    path: '/api/v1/admin/shipment-types',
    method: 'GET',
    permission: 'pricing.view',
    idempotent: false,
  },
  postAdminShipmentTypes: {
    path: '/api/v1/admin/shipment-types',
    method: 'POST',
    permission: 'pricing.manage',
    idempotent: true,
  },
  patchAdminShipmentTypesShipmentType: {
    path: '/api/v1/admin/shipment-types/{shipmentType}',
    method: 'PATCH',
    permission: 'pricing.manage',
    idempotent: true,
  },
  getAdminPricingRules: {
    path: '/api/v1/admin/pricing-rules',
    method: 'GET',
    permission: 'pricing.view',
    idempotent: false,
  },
  postAdminPricingRules: {
    path: '/api/v1/admin/pricing-rules',
    method: 'POST',
    permission: 'pricing.manage',
    idempotent: true,
  },
  patchAdminPricingRulesPricingRule: {
    path: '/api/v1/admin/pricing-rules/{pricingRule}',
    method: 'PATCH',
    permission: 'pricing.manage',
    idempotent: true,
  },
  getAdminShipments: {
    path: '/api/v1/admin/shipments',
    method: 'GET',
    permission: 'shipments.view',
    idempotent: false,
  },
  postAdminShipments: {
    path: '/api/v1/admin/shipments',
    method: 'POST',
    permission: 'shipments.create',
    idempotent: true,
  },
  getAdminShipmentsShipment: {
    path: '/api/v1/admin/shipments/{shipment}',
    method: 'GET',
    permission: 'shipments.view',
    idempotent: false,
  },
  patchAdminShipmentsShipment: {
    path: '/api/v1/admin/shipments/{shipment}',
    method: 'PATCH',
    permission: 'shipments.update',
    idempotent: true,
  },
  postAdminShipmentsShipmentStatus: {
    path: '/api/v1/admin/shipments/{shipment}/status',
    method: 'POST',
    permission: 'shipments.change_status',
    idempotent: true,
  },
  postAdminShipmentsShipmentDriver: {
    path: '/api/v1/admin/shipments/{shipment}/driver',
    method: 'POST',
    permission: 'shipments.update',
    idempotent: true,
  },
  getAdminShipmentsShipmentPayments: {
    path: '/api/v1/admin/shipments/{shipment}/payments',
    method: 'GET',
    permission: 'payments.manage',
    idempotent: false,
  },
  postAdminShipmentsShipmentPayments: {
    path: '/api/v1/admin/shipments/{shipment}/payments',
    method: 'POST',
    permission: 'payments.manage',
    idempotent: true,
  },
  getAdminDrivers: {
    path: '/api/v1/admin/drivers',
    method: 'GET',
    permission: 'drivers.view',
    idempotent: false,
  },
  postAdminDrivers: {
    path: '/api/v1/admin/drivers',
    method: 'POST',
    permission: 'drivers.manage',
    idempotent: true,
  },
  getAdminDriversDriver: {
    path: '/api/v1/admin/drivers/{driver}',
    method: 'GET',
    permission: 'drivers.view',
    idempotent: false,
  },
  patchAdminDriversDriver: {
    path: '/api/v1/admin/drivers/{driver}',
    method: 'PATCH',
    permission: 'drivers.manage',
    idempotent: true,
  },
  getAdminTrips: {
    path: '/api/v1/admin/trips',
    method: 'GET',
    permission: 'trips.view',
    idempotent: false,
  },
  postAdminTrips: {
    path: '/api/v1/admin/trips',
    method: 'POST',
    permission: 'trips.create',
    idempotent: true,
  },
  getAdminTripsTrip: {
    path: '/api/v1/admin/trips/{trip}',
    method: 'GET',
    permission: 'trips.view',
    idempotent: false,
  },
  patchAdminTripsTrip: {
    path: '/api/v1/admin/trips/{trip}',
    method: 'PATCH',
    permission: 'trips.update',
    idempotent: true,
  },
  getAdminTripsTripShipments: {
    path: '/api/v1/admin/trips/{trip}/shipments',
    method: 'GET',
    permission: 'trips.view',
    idempotent: false,
  },
  postAdminTripsTripShipments: {
    path: '/api/v1/admin/trips/{trip}/shipments',
    method: 'POST',
    permission: 'trips.assign_shipments',
    idempotent: true,
  },
  deleteAdminTripsTripShipmentsShipment: {
    path: '/api/v1/admin/trips/{trip}/shipments/{shipment}',
    method: 'DELETE',
    permission: 'trips.assign_shipments',
    idempotent: true,
  },
  postAdminTripsTripStatus: {
    path: '/api/v1/admin/trips/{trip}/status',
    method: 'POST',
    permission: 'trips.update',
    idempotent: true,
  },
  getDriverTrips: {
    path: '/api/v1/driver/trips',
    method: 'GET',
    permission: null,
    idempotent: false,
  },
  getDriverTripsTrip: {
    path: '/api/v1/driver/trips/{trip}',
    method: 'GET',
    permission: null,
    idempotent: false,
  },
  getDriverShipments: {
    path: '/api/v1/driver/shipments',
    method: 'GET',
    permission: null,
    idempotent: false,
  },
  getDriverShipmentsShipment: {
    path: '/api/v1/driver/shipments/{shipment}',
    method: 'GET',
    permission: null,
    idempotent: false,
  },
  postDriverShipmentsShipmentStatus: {
    path: '/api/v1/driver/shipments/{shipment}/status',
    method: 'POST',
    permission: 'shipments.change_status',
    idempotent: true,
  },
  getAdminUsers: {
    path: '/api/v1/admin/users',
    method: 'GET',
    permission: 'users.manage',
    idempotent: false,
  },
  postAdminUsers: {
    path: '/api/v1/admin/users',
    method: 'POST',
    permission: 'users.manage',
    idempotent: true,
  },
  patchAdminUsersUser: {
    path: '/api/v1/admin/users/{user}',
    method: 'PATCH',
    permission: 'users.manage',
    idempotent: true,
  },
  getAdminAuditLogs: {
    path: '/api/v1/admin/audit-logs',
    method: 'GET',
    permission: 'audit.view',
    idempotent: false,
  },
  getAdminReports: {
    path: '/api/v1/admin/reports',
    method: 'GET',
    permission: 'reports.view',
    idempotent: false,
  },
  getCsrfCookie: {
    path: '/sanctum/csrf-cookie',
    method: 'GET',
    permission: null,
    idempotent: false,
  },
} as const;
