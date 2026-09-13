import { z } from 'zod';
import { api, type ApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { createIdempotentAction } from '@/lib/api/idempotency';
import {
  approvedOperations,
  getCitiesResponseSchema,
  getShipmentTypesResponseSchema,
  postOrdersBodySchema,
  postOrdersResponseSchema,
  postQuotesBodySchema,
  postQuotesResponseSchema,
} from '@/lib/api/generated';
import type { PublicOrderPayload, PublicOrderQuoteInput } from './schema';

export type PublicOrderCitiesResponse = z.infer<typeof getCitiesResponseSchema>;
export type PublicOrderTypesResponse = z.infer<typeof getShipmentTypesResponseSchema>;
export type PublicOrderQuoteResponse = z.infer<typeof postQuotesResponseSchema>;
export type PublicOrderResponse = z.infer<typeof postOrdersResponseSchema>;

/** Public operations use the approved stateful-browser CSRF transport, without staff auth. */
export function createPublicOrderApi(client: ApiClient = api) {
  function getPublicOrderCities(signal?: AbortSignal) {
    return client.request(approvedOperations.getCities.path, {
      schema: getCitiesResponseSchema,
      signal,
      notifyOnUnauthorized: false,
    });
  }

  function getPublicOrderTypes(signal?: AbortSignal) {
    return client.request(approvedOperations.getShipmentTypes.path, {
      schema: getShipmentTypesResponseSchema,
      signal,
      notifyOnUnauthorized: false,
    });
  }

  function requestPublicOrderQuote(body: PublicOrderQuoteInput, signal?: AbortSignal) {
    const parsed = postQuotesBodySchema.safeParse({
      origin_city_id: body.origin_city_id,
      destination_city_id: body.destination_city_id,
      shipment_type_id: body.shipment_type_id,
      shipment_size: body.shipment_size,
      delivery_method: body.delivery_method,
    });
    if (!parsed.success) return Promise.reject(new ApiError({ code: 'invalid_request' }));
    return client.request(approvedOperations.postQuotes.path, {
      method: approvedOperations.postQuotes.method,
      body: parsed.data,
      bodySchema: postQuotesBodySchema,
      schema: postQuotesResponseSchema,
      signal,
      notifyOnUnauthorized: false,
    });
  }

  function createPublicOrderAction(body: PublicOrderPayload) {
    const parsed = postOrdersBodySchema.safeParse(body);
    if (!parsed.success || Object.hasOwn(parsed.data, 'branch_id'))
      throw new ApiError({ code: 'invalid_request' });
    // All fields are scalar. Capture/freeze once, before any submit or retry, and never cancel it.
    const snapshot = Object.freeze({ ...parsed.data });
    return createIdempotentAction((idempotencyKey) =>
      client.request(approvedOperations.postOrders.path, {
        method: approvedOperations.postOrders.method,
        body: snapshot,
        bodySchema: postOrdersBodySchema,
        schema: postOrdersResponseSchema,
        idempotencyKey,
        notifyOnUnauthorized: false,
      }),
    );
  }

  return {
    getPublicOrderCities,
    getPublicOrderTypes,
    requestPublicOrderQuote,
    createPublicOrderAction,
  };
}

export const {
  getPublicOrderCities,
  getPublicOrderTypes,
  requestPublicOrderQuote,
  createPublicOrderAction,
} = createPublicOrderApi();
