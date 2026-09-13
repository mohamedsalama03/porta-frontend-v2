import { api } from '@/lib/api/client';
import { createIdempotentAction } from '@/lib/api/idempotency';
import {
  postAdminShipmentsShipmentPaymentsBodySchema,
  postAdminShipmentsShipmentPaymentsResponseSchema,
  ulidSchema,
  type PaymentInput,
} from '@/lib/api/generated';

/** Amount is deliberately omitted by this form; the approved API determines full payment/refund values. */
export function createPaymentAction(shipmentId: string, body: PaymentInput) {
  const parsed = postAdminShipmentsShipmentPaymentsBodySchema.parse(body);
  ulidSchema.parse(shipmentId);
  return createIdempotentAction((idempotencyKey) =>
    api.request(`/api/v1/admin/shipments/${encodeURIComponent(shipmentId)}/payments`, {
      method: 'POST',
      body: parsed,
      bodySchema: postAdminShipmentsShipmentPaymentsBodySchema,
      schema: postAdminShipmentsShipmentPaymentsResponseSchema,
      idempotencyKey,
    }),
  );
}
