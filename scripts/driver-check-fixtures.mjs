// Synthetic fixtures for intercepted browser, visual and performance checks only.
// Never import this module into application routes or send these identities to a real API.
export const driverFixtureIds = {
  user: '01ARZ3NDEKTSV4RRFFQ69G5FAA',
  trip: '01ARZ3NDEKTSV4RRFFQ69G5FAB',
  nextTrip: '01ARZ3NDEKTSV4RRFFQ69G5FAC',
  shipment: '01ARZ3NDEKTSV4RRFFQ69G5FAD',
  nextShipment: '01ARZ3NDEKTSV4RRFFQ69G5FAE',
  foreignTrip: '01ARZ3NDEKTSV4RRFFQ69G5FAF',
  foreignShipment: '01ARZ3NDEKTSV4RRFFQ69G5FAG',
};
export const driverFixtureRequestId = '123e4567-e89b-42d3-a456-426614174000';
export const driverFixtureTracking = 'PTA-260914-DRIVERQA01';
export const driverFixtureCsrf = 'synthetic-driver-csrf';
export const driverFixtureNextCursor = 'qa-driver-next';
export const driverEnvelope = (data, meta = {}) => ({
  data,
  meta,
  request_id: driverFixtureRequestId,
});
export const driverErrorFixture = () => ({
  message: 'PRIVATE_BACKEND_TRACE_DO_NOT_RENDER',
  request_id: driverFixtureRequestId,
});
export function driverSessionFixture() {
  return driverEnvelope({
    id: driverFixtureIds.user,
    name: 'سائق الاختبار',
    email: 'driver@example.test',
    role: 'DRIVER',
    branch_id: null,
    permissions: ['shipments.change_status'],
  });
}
export function driverTripFixture() {
  return {
    id: driverFixtureIds.trip,
    origin_city: { name_ar: 'طرابلس', name_en: 'Tripoli', code: 'TIP' },
    destination_city: { name_ar: 'بنغازي', name_en: 'Benghazi', code: 'BEN' },
    departure_at: '2026-09-14T07:30:00Z',
    estimated_arrival_at: '2026-09-14T14:30:00Z',
    status: 'ARRIVED',
    shipments_count: 2,
  };
}
export function driverShipmentFixture() {
  return {
    id: driverFixtureIds.shipment,
    tracking_number: driverFixtureTracking,
    trip_id: driverFixtureIds.trip,
    current_status: 'ARRIVED_CITY',
    origin_city: { name_ar: 'طرابلس', name_en: 'Tripoli', code: 'TIP' },
    destination_city: { name_ar: 'بنغازي', name_en: 'Benghazi', code: 'BEN' },
    sender_name: 'مرسل تجريبي',
    sender_phone: '+218910000001',
    recipient_name: 'مستلم تجريبي',
    recipient_phone: '+218920000002',
    delivery_method: 'DOOR_DELIVERY',
    delivery_address: 'عنوان تجريبي — شارع الاختبار، بنغازي',
    shipment_size: 'MEDIUM',
    shipment_type: { name_ar: 'طرد تجريبي', name_en: 'QA parcel' },
  };
}

/** @typedef {{method: string, path: string, query: Record<string,string>, idempotencyKey?: string, body?: unknown}} DriverRequest */
/** @typedef {{status?: number, json?: unknown, headers?: Record<string,string>, abort?: boolean}} DriverReply */
/** @typedef {{headers?: Record<string,string>, body?: unknown}} DriverRequestDetails */

/**
 * Every API request is intercepted. Unknown operations, origins, query names and
 * writes are blocked; foreign synthetic IDs return 404 without enumeration.
 * @param {string} frontend
 * @param {string} apiOrigin
 */
export function createDriverFixtures(frontend, apiOrigin = 'http://localhost:8080') {
  const state = {
    mode: 'default',
    authenticated: true,
    session: driverSessionFixture(),
    paginated: false,
    trips: [
      driverTripFixture(),
      { ...driverTripFixture(), id: driverFixtureIds.nextTrip, status: 'SCHEDULED' },
    ],
    shipments: [
      driverShipmentFixture(),
      {
        ...driverShipmentFixture(),
        id: driverFixtureIds.nextShipment,
        tracking_number: 'PTA-260914-DRIVERQA02',
        current_status: 'READY_FOR_PICKUP',
      },
    ],
    /** @type {DriverRequest[]} */
    requests: [],
    /** @type {string[]} */
    unexpected: [],
    /** @type {((request: DriverRequest) => DriverReply | undefined | Promise<DriverReply | undefined>) | undefined} */
    onRequest: undefined,
  };
  const headers = {
    'access-control-allow-origin': frontend,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'Content-Type, X-XSRF-TOKEN, Idempotency-Key',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-expose-headers': 'Retry-After, X-Request-ID, Idempotency-Replayed',
    'x-request-id': driverFixtureRequestId,
    'cache-control': 'no-store',
    'content-type': 'application/json',
  };
  /** @param {DriverReply} reply */
  function result(reply) {
    if (reply.abort) return { kind: 'abort' };
    return {
      kind: 'reply',
      response: {
        status: reply.status ?? 200,
        headers: { ...headers, ...reply.headers },
        body: reply.status === 204 ? '' : JSON.stringify(reply.json ?? driverErrorFixture()),
      },
    };
  }
  /** @param {string} value @param {string} method @param {DriverRequestDetails} details */
  async function resolve(value, method, details = {}) {
    const url = new URL(value);
    const path = url.pathname;
    if (url.origin === frontend && !/^\/(api|sanctum)(?:\/|$)/.test(path))
      return { kind: 'continue' };
    const auth = new Map([
      ['/api/v1/auth/me', 'GET'],
      ['/sanctum/csrf-cookie', 'GET'],
      ['/api/v1/auth/login', 'POST'],
      ['/api/v1/auth/logout', 'POST'],
    ]).get(path);
    const list = /^\/api\/v1\/driver\/(trips|shipments)$/.exec(path);
    const detail =
      /^\/api\/v1\/driver\/(trips|shipments)\/([0-9A-HJKMNP-TV-Z]{26})(\/status)?$/.exec(path);
    const isStatus = detail?.[1] === 'shipments' && detail[3] === '/status';
    const allowedMethod = auth || (list || (detail && !detail[3]) ? 'GET' : isStatus ? 'POST' : '');
    const permittedQuery = list
      ? ['cursor', 'per_page', 'status', ...(list[1] === 'shipments' ? ['trip_id'] : [])]
      : [];
    if (
      url.origin !== apiOrigin ||
      !allowedMethod ||
      (method !== allowedMethod && method !== 'OPTIONS') ||
      [...url.searchParams.keys()].some((key) => !permittedQuery.includes(key)) ||
      [...new Set(url.searchParams.keys())].some(
        (key) => url.searchParams.getAll(key).length > 1,
      ) ||
      details.headers?.authorization
    ) {
      state.unexpected.push(`${method} ${path}`);
      return { kind: 'abort' };
    }
    if (method === 'OPTIONS') return result({ status: 204 });
    const body = details.body;
    if (
      isStatus &&
      (!body ||
        typeof body !== 'object' ||
        Object.keys(body).join(',') !== 'status' ||
        !('status' in body) ||
        !['READY_FOR_PICKUP', 'DELIVERED'].includes(String(body.status)) ||
        !details.headers?.['idempotency-key']?.match(/^[a-zA-Z0-9_-]{32,128}$/) ||
        details.headers?.['x-xsrf-token'] !== driverFixtureCsrf)
    ) {
      state.unexpected.push(`INVALID STATUS WRITE ${path}`);
      return { kind: 'abort' };
    }
    const request = {
      method,
      path,
      query: Object.fromEntries(url.searchParams),
      ...(isStatus
        ? { idempotencyKey: details.headers?.['idempotency-key'], body: details.body }
        : {}),
    };
    state.requests.push(request);
    const override = await state.onRequest?.(request);
    if (override) return result(override);
    if (path === '/sanctum/csrf-cookie')
      return result({
        status: 204,
        headers: { 'set-cookie': `XSRF-TOKEN=${driverFixtureCsrf}; Path=/; SameSite=Lax` },
      });
    if (path.endsWith('/auth/login')) {
      state.authenticated = true;
      return result({ json: state.session });
    }
    if (path.endsWith('/auth/logout')) {
      state.authenticated = false;
      return result({ json: driverEnvelope({ logged_out: true }) });
    }
    if (!state.authenticated) return result({ status: 401 });
    if (path.endsWith('/auth/me')) return result({ json: state.session });
    if (state.mode === 'error') return result({ status: 503 });
    if (list) {
      let data = state.mode === 'empty' ? [] : list[1] === 'trips' ? state.trips : state.shipments;
      if (url.searchParams.has('status'))
        data = data.filter(
          (item) =>
            ('status' in item ? item.status : item.current_status) ===
            url.searchParams.get('status'),
        );
      if (url.searchParams.has('trip_id'))
        data = data.filter(
          (item) => 'trip_id' in item && item.trip_id === url.searchParams.get('trip_id'),
        );
      const pageSize = Number(url.searchParams.get('per_page') ?? 20);
      const next = state.paginated && !url.searchParams.has('cursor') && data.length > 1;
      const page = state.paginated
        ? data.slice(url.searchParams.has('cursor') ? 1 : 0, url.searchParams.has('cursor') ? 2 : 1)
        : data.slice(0, pageSize);
      return result({
        json: driverEnvelope(page, {
          next_cursor: next ? driverFixtureNextCursor : null,
          previous_cursor: url.searchParams.has('cursor') ? 'qa-driver-first' : null,
          per_page: pageSize,
          has_more: next,
        }),
      });
    }
    const resource =
      detail?.[1] === 'trips'
        ? state.trips.find((trip) => trip.id === detail[2])
        : state.shipments.find((shipment) => shipment.id === detail?.[2]);
    if (!resource) return result({ status: 404 });
    if (isStatus) {
      if ('current_status' in resource && body && typeof body === 'object' && 'status' in body)
        resource.current_status = String(body.status);
    }
    return result({ json: driverEnvelope(resource) });
  }
  return { state, resolve };
}
