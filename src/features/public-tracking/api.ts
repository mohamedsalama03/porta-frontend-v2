import { api, type ApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import {
  approvedOperations,
  getTrackingTrackingNumberResponseSchema,
  type Tracking,
} from '@/lib/api/generated';
import { parseTrackingNumber } from './model';

export type TrackingData = Tracking;

/** The only tracking resource is the strict customer-safe public operation. */
export function createPublicTrackingApi(client: ApiClient = api) {
  async function getPublicTracking(number: string, signal?: AbortSignal): Promise<TrackingData> {
    const parsed = parseTrackingNumber(number);
    if (!parsed.success) throw new ApiError({ code: 'invalid_request' });
    const operation = approvedOperations.getTrackingTrackingNumber;
    const response = await client.request(
      operation.path.replace('{trackingNumber}', encodeURIComponent(parsed.data)),
      {
        method: operation.method,
        schema: getTrackingTrackingNumberResponseSchema,
        signal,
        notifyOnUnauthorized: false,
      },
    );
    if (response.data.tracking_number !== parsed.data) {
      throw new ApiError({ code: 'invalid_response', requestId: response.request_id });
    }
    // The generated strict schema rejects unexpected data fields; loose envelope metadata
    // and request IDs do not enter the UI/query cache. Preserve the API's event array order.
    return response.data;
  }

  return { getPublicTracking };
}

export const { getPublicTracking } = createPublicTrackingApi();
