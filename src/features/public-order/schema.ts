import { z } from 'zod';
import {
  deliveryMethodSchema,
  paymentMethodSchema,
  postOrdersBodySchema,
  shipmentSizeSchema,
  type QuoteInput,
  type ShipmentInput,
} from '@/lib/api/generated';

export const publicOrderFieldLabels = {
  sender_name: 'اسم المرسل',
  sender_phone: 'هاتف المرسل',
  recipient_name: 'اسم المستلم',
  recipient_phone: 'هاتف المستلم',
  origin_city_id: 'مدينة الإرسال',
  destination_city_id: 'مدينة الاستلام',
  shipment_type_id: 'نوع الشحنة',
  shipment_size: 'حجم الشحنة',
  weight: 'الوزن',
  delivery_method: 'طريقة الاستلام',
  delivery_address: 'عنوان التوصيل',
  payment_method: 'طريقة الدفع',
  notes: 'ملاحظات',
} as const;

export type PublicOrderField = keyof typeof publicOrderFieldLabels;
export const publicOrderFieldNames = Object.keys(publicOrderFieldLabels) as PublicOrderField[];
export type PublicOrderPayload = Omit<ShipmentInput, 'branch_id'>;
export type PublicOrderQuoteInput = Pick<
  QuoteInput,
  | 'origin_city_id'
  | 'destination_city_id'
  | 'shipment_type_id'
  | 'shipment_size'
  | 'delivery_method'
>;

const requiredText = (message: string) => z.string().trim().min(1, message);
const formFields = z.object({
  sender_name: requiredText('أدخل اسم المرسل.'),
  sender_phone: requiredText('أدخل هاتف المرسل.'),
  recipient_name: requiredText('أدخل اسم المستلم.'),
  recipient_phone: requiredText('أدخل هاتف المستلم.'),
  origin_city_id: requiredText('اختر مدينة الإرسال.'),
  destination_city_id: requiredText('اختر مدينة الاستلام.'),
  shipment_type_id: requiredText('اختر نوع الشحنة.'),
  shipment_size: z.enum(shipmentSizeSchema.options, { error: 'اختر حجم الشحنة.' }),
  weight: z.string().trim(),
  delivery_method: z.enum(deliveryMethodSchema.options, { error: 'اختر طريقة الاستلام.' }),
  delivery_address: z.string().trim(),
  payment_method: z.enum(paymentMethodSchema.options, { error: 'اختر طريقة الدفع.' }),
  notes: z.string().trim(),
});

export type PublicOrderFormValues = z.infer<typeof formFields>;

/** Explicit customer-field projection; no branch, price, status or staff fields can be added. */
export function publicOrderWireInput(values: PublicOrderFormValues): PublicOrderPayload {
  return {
    sender_name: values.sender_name,
    sender_phone: values.sender_phone,
    recipient_name: values.recipient_name,
    recipient_phone: values.recipient_phone,
    origin_city_id: values.origin_city_id,
    destination_city_id: values.destination_city_id,
    shipment_type_id: values.shipment_type_id,
    shipment_size: values.shipment_size,
    delivery_method: values.delivery_method,
    payment_method: values.payment_method,
    ...(values.weight ? { weight: Number(values.weight) } : {}),
    ...(values.notes ? { notes: values.notes } : {}),
    ...(values.delivery_method === 'DOOR_DELIVERY'
      ? { delivery_address: values.delivery_address }
      : {}),
  };
}

/** Only immediate form ergonomics are local; generated validators retain the API constraints. */
export const publicOrderFormSchema = formFields.superRefine((values, context) => {
  if (values.weight && !postOrdersBodySchema.shape.weight.safeParse(values.weight).success) {
    context.addIssue({
      code: 'custom',
      path: ['weight'],
      message: 'أدخل وزنًا موجبًا حتى 100000، بثلاث خانات عشرية كحد أقصى.',
    });
  }
  const parsed = postOrdersBodySchema.safeParse(publicOrderWireInput(values));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && Object.hasOwn(publicOrderFieldLabels, field)) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message:
            field === 'delivery_address'
              ? 'أدخل عنوان التوصيل، بحد أقصى 500 حرف.'
              : field === 'weight'
                ? 'أدخل وزنًا موجبًا حتى 100000، بثلاث خانات عشرية كحد أقصى.'
                : `راجع ${publicOrderFieldLabels[field as PublicOrderField]}.`,
        });
      }
    }
  }
});

export const publicOrderDefaults: PublicOrderFormValues = {
  sender_name: '',
  sender_phone: '',
  recipient_name: '',
  recipient_phone: '',
  origin_city_id: '',
  destination_city_id: '',
  shipment_type_id: '',
  shipment_size: 'SMALL',
  weight: '',
  delivery_method: 'OFFICE_PICKUP',
  delivery_address: '',
  payment_method: 'CASH_ON_DELIVERY',
  notes: '',
};
