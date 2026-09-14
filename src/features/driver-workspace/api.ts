import { api, type ApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { createIdempotentAction } from '@/lib/api/idempotency';
import {
  approvedOperations,
  getDriverShipmentsQuerySchema,
  getDriverShipmentsResponseSchema,
  getDriverShipmentsShipmentPathSchema,
  getDriverShipmentsShipmentResponseSchema,
  getDriverTripsQuerySchema,
  getDriverTripsResponseSchema,
  getDriverTripsTripPathSchema,
  getDriverTripsTripResponseSchema,
  postDriverShipmentsShipmentStatusBodySchema,
  postDriverShipmentsShipmentStatusPathSchema,
  postDriverShipmentsShipmentStatusResponseSchema,
  type DriverShipment,
  type DriverTrip,
} from '@/lib/api/generated';
import {
  driverQueryString,
  type DriverPage,
  type DriverShipmentsQuery,
  type DriverTripsQuery,
} from './model';
import type { DriverStatusTarget } from './status';

export type { DriverShipment, DriverTrip } from '@/lib/api/generated';
export const driverStatusPermission =
  approvedOperations.postDriverShipmentsShipmentStatus.permission;

function assertResourceId(expected: string, received: string, requestId: string): void {
  // ULIDs are case-insensitive; do not reject a backend's canonical casing.
  if (expected.toLowerCase() !== received.toLowerCase()) {
    throw new ApiError({ code: 'invalid_response', requestId });
  }
}

export function createDriverWorkspaceApi(client: ApiClient = api) {
  async function getDriverTrips(
    query: DriverTripsQuery = {},
    signal?: AbortSignal,
  ): Promise<DriverPage<DriverTrip>> {
    const parsed = getDriverTripsQuerySchema.safeParse({
      ...query,
      per_page: query.per_page ?? 20,
    });
    if (!parsed.success) throw new ApiError({ code: 'invalid_request' });
    const operation = approvedOperations.getDriverTrips;
    const response = await client.request(operation.path + driverQueryString(parsed.data), {
      method: operation.method,
      schema: getDriverTripsResponseSchema,
      signal,
    });
    if (parsed.data.status && response.data.some((trip) => trip.status !== parsed.data.status)) {
      throw new ApiError({ code: 'invalid_response', requestId: response.request_id });
    }
    return { data: response.data, meta: response.meta };
  }

  async function getDriverTrip(id: string, signal?: AbortSignal): Promise<DriverTrip> {
    const parsed = getDriverTripsTripPathSchema.safeParse({ trip: id });
    if (!parsed.success) throw new ApiError({ code: 'invalid_request' });
    const operation = approvedOperations.getDriverTripsTrip;
    const response = await client.request(
      operation.path.replace('{trip}', encodeURIComponent(id)),
      {
        method: operation.method,
        schema: getDriverTripsTripResponseSchema,
        signal,
      },
    );
    assertResourceId(id, response.data.id, response.request_id);
    return response.data;
  }

  async function getDriverShipments(
    query: DriverShipmentsQuery = {},
    signal?: AbortSignal,
  ): Promise<DriverPage<DriverShipment>> {
    const parsed = getDriverShipmentsQuerySchema.safeParse({
      ...query,
      per_page: query.per_page ?? 20,
    });
    if (!parsed.success) throw new ApiError({ code: 'invalid_request' });
    const operation = approvedOperations.getDriverShipments;
    const response = await client.request(operation.path + driverQueryString(parsed.data), {
      method: operation.method,
      schema: getDriverShipmentsResponseSchema,
      signal,
    });
    for (const shipment of response.data) {
      if (
        (parsed.data.trip_id &&
          shipment.trip_id?.toLowerCase() !== parsed.data.trip_id.toLowerCase()) ||
        (parsed.data.status && shipment.current_status !== parsed.data.status)
      ) {
        throw new ApiError({ code: 'invalid_response', requestId: response.request_id });
      }
    }
    return { data: response.data, meta: response.meta };
  }

  async function getDriverShipment(id: string, signal?: AbortSignal): Promise<DriverShipment> {
    const parsed = getDriverShipmentsShipmentPathSchema.safeParse({ shipment: id });
    if (!parsed.success) throw new ApiError({ code: 'invalid_request' });
    const operation = approvedOperations.getDriverShipmentsShipment;
    const response = await client.request(
      operation.path.replace('{shipment}', encodeURIComponent(id)),
      { method: operation.method, schema: getDriverShipmentsShipmentResponseSchema, signal },
    );
    assertResourceId(id, response.data.id, response.request_id);
    return response.data;
  }

  function createDriverStatusAction(id: string, target: DriverStatusTarget) {
    const path = postDriverShipmentsShipmentStatusPathSchema.safeParse({ shipment: id });
    const body = postDriverShipmentsShipmentStatusBodySchema.safeParse({ status: target });
    if (!path.success || !body.success) throw new ApiError({ code: 'invalid_request' });
    const capturedBody = Object.freeze(body.data);
    const operation = approvedOperations.postDriverShipmentsShipmentStatus;
    return createIdempotentAction(async (idempotencyKey): Promise<DriverShipment> => {
      const response = await client.request(
        operation.path.replace('{shipment}', encodeURIComponent(path.data.shipment)),
        {
          method: operation.method,
          body: capturedBody,
          bodySchema: postDriverShipmentsShipmentStatusBodySchema,
          schema: postDriverShipmentsShipmentStatusResponseSchema,
          idempotencyKey,
        },
      );
      assertResourceId(path.data.shipment, response.data.id, response.request_id);
      // A replay may precede later backend work; the UI still refreshes after confirmation.
      if (response.data.current_status !== capturedBody.status) {
        throw new ApiError({ code: 'invalid_response', requestId: response.request_id });
      }
      return response.data;
    });
  }

  return {
    getDriverTrips,
    getDriverTrip,
    getDriverShipments,
    getDriverShipment,
    createDriverStatusAction,
  };
}

export const {
  getDriverTrips,
  getDriverTrip,
  getDriverShipments,
  getDriverShipment,
  createDriverStatusAction,
} = createDriverWorkspaceApi();
