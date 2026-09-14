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
  postDriverTripsTripStartBodySchema,
  postDriverTripsTripStartPathSchema,
  postDriverTripsTripStartResponseSchema,
  postDriverTripsTripArriveBodySchema,
  postDriverTripsTripArrivePathSchema,
  postDriverTripsTripArriveResponseSchema,
  postDriverTripsTripCompleteBodySchema,
  postDriverTripsTripCompletePathSchema,
  postDriverTripsTripCompleteResponseSchema,
  type DriverShipment,
  type DriverTrip,
} from '@/lib/api/generated';
import {
  driverQueryString,
  type DriverPage,
  type DriverShipmentsQuery,
  type DriverTripsQuery,
  type DriverTripAction,
  type DriverTripDetail,
} from './model';
import type { DriverStatusTarget } from './status';

export type { DriverShipment, DriverTrip } from '@/lib/api/generated';
export const driverStatusPermission =
  approvedOperations.postDriverShipmentsShipmentStatus.permission;

// This map selects the documented endpoint only; detail metadata decides availability.
const tripActionOperations = {
  START: {
    operation: approvedOperations.postDriverTripsTripStart,
    pathSchema: postDriverTripsTripStartPathSchema,
    bodySchema: postDriverTripsTripStartBodySchema,
    responseSchema: postDriverTripsTripStartResponseSchema,
  },
  CONFIRM_ARRIVAL: {
    operation: approvedOperations.postDriverTripsTripArrive,
    pathSchema: postDriverTripsTripArrivePathSchema,
    bodySchema: postDriverTripsTripArriveBodySchema,
    responseSchema: postDriverTripsTripArriveResponseSchema,
  },
  COMPLETE: {
    operation: approvedOperations.postDriverTripsTripComplete,
    pathSchema: postDriverTripsTripCompletePathSchema,
    bodySchema: postDriverTripsTripCompleteBodySchema,
    responseSchema: postDriverTripsTripCompleteResponseSchema,
  },
} as const;

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

  async function getDriverTrip(id: string, signal?: AbortSignal): Promise<DriverTripDetail> {
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
    return response;
  }

  function createDriverTripAction(id: string, action: DriverTripAction) {
    if (!Object.hasOwn(tripActionOperations, action)) {
      throw new ApiError({ code: 'invalid_request' });
    }
    const { operation, pathSchema, bodySchema, responseSchema } = tripActionOperations[action];
    const path = pathSchema.safeParse({ trip: id });
    if (!path.success) throw new ApiError({ code: 'invalid_request' });
    const capturedBody = Object.freeze(bodySchema.parse({}));
    const capturedPath = operation.path.replace('{trip}', encodeURIComponent(path.data.trip));
    return createIdempotentAction(async (idempotencyKey): Promise<DriverTripDetail> => {
      const response = await client.request(capturedPath, {
        method: operation.method,
        body: capturedBody,
        bodySchema,
        schema: responseSchema,
        idempotencyKey,
      });
      assertResourceId(path.data.trip, response.data.id, response.request_id);
      // Saved replays may be older than current work. The caller refetches detail
      // after every success before offering another server-provided capability.
      return response;
    });
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
    createDriverTripAction,
    getDriverShipments,
    getDriverShipment,
    createDriverStatusAction,
  };
}

export const {
  getDriverTrips,
  getDriverTrip,
  createDriverTripAction,
  getDriverShipments,
  getDriverShipment,
  createDriverStatusAction,
} = createDriverWorkspaceApi();
