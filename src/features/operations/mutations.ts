import { api } from '@/lib/api/client';
import { createIdempotentAction } from '@/lib/api/idempotency';
import {
  driverInputSchema,
  driverPatchSchema,
  tripInputSchema,
  tripPatchSchema,
  ulidSchema,
  postAdminDriversResponseSchema,
  patchAdminDriversDriverResponseSchema,
  postAdminTripsResponseSchema,
  patchAdminTripsTripResponseSchema,
  postAdminTripsTripShipmentsResponseSchema,
  deleteAdminTripsTripShipmentsShipmentResponseSchema,
  attachShipmentsInputSchema,
  type DriverInput,
  type DriverPatch,
  type TripInput,
  type TripPatch,
  type AttachShipmentsInput,
} from '@/lib/api/generated';

/** These actions capture one validated body and reuse one key for deliberate retry. */
export function driverWriteAction(body: DriverInput | DriverPatch, id?: string) {
  const snapshot = structuredClone(body);
  if (id) {
    const identifier = ulidSchema.parse(id);
    const parsed = driverPatchSchema.parse(snapshot);
    return createIdempotentAction((key) =>
      api.request(`/api/v1/admin/drivers/${identifier}`, {
        method: 'PATCH',
        body: parsed,
        bodySchema: driverPatchSchema,
        schema: patchAdminDriversDriverResponseSchema,
        idempotencyKey: key,
      }),
    );
  }
  const parsed = driverInputSchema.parse(snapshot);
  return createIdempotentAction((key) =>
    api.request('/api/v1/admin/drivers', {
      method: 'POST',
      body: parsed,
      bodySchema: driverInputSchema,
      schema: postAdminDriversResponseSchema,
      idempotencyKey: key,
    }),
  );
}

export function tripWriteAction(body: TripInput | TripPatch, id?: string) {
  const snapshot = structuredClone(body);
  if (id) {
    const identifier = ulidSchema.parse(id);
    const parsed = tripPatchSchema.parse(snapshot);
    return createIdempotentAction((key) =>
      api.request(`/api/v1/admin/trips/${identifier}`, {
        method: 'PATCH',
        body: parsed,
        bodySchema: tripPatchSchema,
        schema: patchAdminTripsTripResponseSchema,
        idempotencyKey: key,
      }),
    );
  }
  const parsed = tripInputSchema.parse(snapshot);
  return createIdempotentAction((key) =>
    api.request('/api/v1/admin/trips', {
      method: 'POST',
      body: parsed,
      bodySchema: tripInputSchema,
      schema: postAdminTripsResponseSchema,
      idempotencyKey: key,
    }),
  );
}

export function attachShipmentsAction(tripId: string, body: AttachShipmentsInput) {
  const id = ulidSchema.parse(tripId);
  const snapshot = attachShipmentsInputSchema.parse(structuredClone(body));
  return createIdempotentAction((key) =>
    api.request(`/api/v1/admin/trips/${id}/shipments`, {
      method: 'POST',
      body: snapshot,
      bodySchema: attachShipmentsInputSchema,
      schema: postAdminTripsTripShipmentsResponseSchema,
      idempotencyKey: key,
    }),
  );
}

export function detachShipmentAction(tripId: string, shipmentId: string) {
  const trip = ulidSchema.parse(tripId);
  const shipment = ulidSchema.parse(shipmentId);
  return createIdempotentAction((key) =>
    api.request(`/api/v1/admin/trips/${trip}/shipments/${shipment}`, {
      method: 'DELETE',
      schema: deleteAdminTripsTripShipmentsShipmentResponseSchema,
      idempotencyKey: key,
    }),
  );
}
