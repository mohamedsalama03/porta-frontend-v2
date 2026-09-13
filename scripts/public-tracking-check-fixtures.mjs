import { readFileSync } from 'node:fs';
import { localOrigin } from './public-order-check-fixtures.mjs';
export { localOrigin };

// Synthetic presentation data only. The resolver blocks every non-tracking API request.
export const fixtureNumber = 'PTA-260913-TRACKINGVISUAL01';
export const fixtureRequestId = '123e4567-e89b-42d3-a456-426614174000';
export const statuses = JSON.parse(readFileSync('contracts/porta-api-v1.openapi.json', 'utf8'))
  .components.schemas.ShipmentStatus.enum;
export function trackingFixture(status = 'RECEIVED') {
  return {
    data: {
      tracking_number: fixtureNumber,
      origin_city: { name_ar: 'مدينة الإرسال التجريبية ذات الاسم الطويل', name_en: 'QA Origin' },
      destination_city: {
        name_ar: 'مدينة الاستلام التجريبية ذات الاسم الطويل',
        name_en: 'QA Destination',
      },
      shipment_type: 'طرد تجريبي للتحقق من وضوح تفاصيل الشحنة',
      current_status: status,
      status_label: status,
      created_at: '2026-09-13T21:30:00Z',
      estimated_delivery: status === 'DELIVERED' ? null : '2026-09-16T14:00:00Z',
      tracking_timeline: statuses.slice(0, statuses.indexOf(status) + 1).map((value, index) => ({
        status: value,
        status_label: value,
        occurred_at: `2026-09-${String(13 + Math.floor(index / 2)).padStart(2, '0')}T${index % 2 ? '15' : '09'}:30:00Z`,
      })),
    },
    meta: {},
    request_id: fixtureRequestId,
  };
}

export function createTrackingFixtures(frontend, apiOrigin) {
  const state = { mode: 'RECEIVED', requests: [], unexpected: [] };
  function resolve(value, method) {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return { kind: 'continue' };
    if (url.origin === frontend && !/^\/(api|sanctum)\//.test(url.pathname))
      return { kind: 'continue' };
    if (
      url.origin !== apiOrigin ||
      url.pathname !== `/api/v1/tracking/${fixtureNumber}` ||
      method !== 'GET'
    ) {
      state.unexpected.push(`${method} ${url.pathname}`);
      return { kind: 'abort' };
    }
    state.requests.push({ method, path: url.pathname });
    const code = state.mode === 'not-found' ? 404 : state.mode === 'error' ? 503 : 200;
    return {
      kind: 'reply',
      response: {
        status: code,
        headers: {
          'access-control-allow-origin': frontend,
          'access-control-allow-credentials': 'true',
          'access-control-expose-headers': 'X-Request-ID',
          'x-request-id': fixtureRequestId,
          'cache-control': 'no-store',
          'content-type': 'application/json',
        },
        body: JSON.stringify(
          code === 200
            ? trackingFixture(state.mode)
            : {
                message: 'Synthetic service error: never display this text.',
                request_id: fixtureRequestId,
              },
        ),
      },
    };
  }
  return { state, resolve };
}
