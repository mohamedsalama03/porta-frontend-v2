/** Browser-check fixtures only. Never imported by application code or sent to the real API. */
export const fixtureIds = {
  origin: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  destination: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  type: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
};
export const fixtureTracking = 'PTA-260913-VISUALFIXTURE001';
export const fixtureRequestId = '123e4567-e89b-42d3-a456-426614174000';
const envelope = (data) => ({ data, meta: {}, request_id: fixtureRequestId });
const cities = [
  {
    id: fixtureIds.origin,
    name_ar: 'مدينة الإرسال التجريبية ذات الاسم العربي الطويل للاختبار فقط',
    name_en: 'Visual Fixture Origin',
    code: 'VISUAL-A',
  },
  {
    id: fixtureIds.destination,
    name_ar: 'مدينة الاستلام التجريبية ذات الاسم العربي الطويل للاختبار فقط',
    name_en: 'Visual Fixture Destination',
    code: 'VISUAL-B',
  },
];
const types = [
  {
    id: fixtureIds.type,
    name_ar: 'شحنة تجريبية ذات وصف عربي طويل للتحقق من وضوح الحقول والمراجعة',
    name_en: 'Visual Fixture Type',
    code: 'VISUAL-TYPE',
    description: 'وصف توضيحي للاختبار فقط، للتحقق من التفاف النص العربي وارتباط وصف النوع بالحقل.',
  },
];

export function localOrigin(value, label) {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `${label} must be an explicit local HTTP origin without credentials or a path.`,
    );
  }
  return url.origin;
}

export function createPublicOrderFixtures(frontendOrigin, apiOrigin) {
  if (frontendOrigin === apiOrigin)
    throw new Error('Frontend and intercepted API must be distinct.');
  const state = {
    catalogMode: 'ready',
    orderMode: 'success',
    requests: [],
    unexpected: [],
    orderKeys: [],
  };
  const cors = {
    'access-control-allow-origin': frontendOrigin,
    'access-control-allow-credentials': 'true',
    'access-control-expose-headers': 'Retry-After, X-Request-ID, Idempotency-Replayed',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type, X-XSRF-TOKEN, Idempotency-Key, X-Request-ID',
    'x-request-id': fixtureRequestId,
    'cache-control': 'no-store',
  };
  const json = (body, status = 200, extra = {}) => ({
    status,
    headers: { ...cors, 'content-type': 'application/json', ...extra },
    body: JSON.stringify(body),
  });
  const failure = (status, errors) =>
    json(
      {
        message: 'Synthetic browser-check response only.',
        request_id: fixtureRequestId,
        ...(errors ? { errors } : {}),
      },
      status,
    );

  function resolve(urlString, method, headers = {}) {
    const url = new URL(urlString);
    if (!['http:', 'https:'].includes(url.protocol)) return { kind: 'continue' };
    if (
      url.origin === frontendOrigin &&
      ['GET', 'HEAD'].includes(method) &&
      !url.pathname.startsWith('/api/') &&
      !url.pathname.startsWith('/sanctum/')
    ) {
      return { kind: 'continue' };
    }
    if (url.origin !== apiOrigin) {
      state.unexpected.push({
        method,
        url: urlString,
        reason: 'Outside isolated frontend/API origins',
      });
      return { kind: 'abort' };
    }
    state.requests.push({ method, path: url.pathname });
    if (method === 'OPTIONS')
      return { kind: 'respond', response: { status: 204, headers: cors, body: '' } };
    if (method === 'GET' && url.pathname === '/sanctum/csrf-cookie') {
      return {
        kind: 'respond',
        response: {
          status: 204,
          headers: {
            ...cors,
            'set-cookie': 'XSRF-TOKEN=isolated-public-visual-token; Path=/; SameSite=Lax',
          },
          body: '',
        },
      };
    }
    if (method === 'GET' && ['/api/v1/cities', '/api/v1/shipment-types'].includes(url.pathname)) {
      const data = url.pathname === '/api/v1/cities' ? cities : types;
      return {
        kind: 'respond',
        response:
          state.catalogMode === 'error'
            ? failure(503)
            : json(envelope(state.catalogMode === 'empty' ? [] : data)),
      };
    }
    if (method === 'POST' && url.pathname === '/api/v1/quotes')
      return {
        kind: 'respond',
        response: json(
          envelope({
            calculated_price: 1235,
            final_price: 1235,
            currency: 'LYD',
            minor_unit_scale: 3,
          }),
        ),
      };
    if (method === 'POST' && url.pathname === '/api/v1/orders') {
      state.orderKeys.push(headers['idempotency-key'] ?? '');
      if (state.orderMode === 'conflict') return { kind: 'respond', response: failure(409) };
      if (state.orderMode === 'validation')
        return {
          kind: 'respond',
          response: failure(422, { sender_phone: ['Synthetic rejected phone.'] }),
        };
      return {
        kind: 'respond',
        response: json(
          envelope({
            tracking_number: fixtureTracking,
            current_status: 'RECEIVED',
            final_price: 1700,
            currency: 'LYD',
            minor_unit_scale: 3,
          }),
          201,
        ),
      };
    }
    state.unexpected.push({
      method,
      url: urlString,
      reason: 'Undocumented/non-public operation in public route',
    });
    return { kind: 'abort' };
  }

  return { state, resolve };
}

export async function installPlaywrightFixtures(page, fixtures) {
  // The one catch-all route is installed before navigation. No API request can fall through.
  await page.route('**/*', async (route) => {
    const request = route.request();
    const result = fixtures.resolve(request.url(), request.method(), request.headers());
    if (result.kind === 'continue') return route.continue();
    if (result.kind === 'abort') return route.abort('blockedbyclient');
    return route.fulfill(result.response);
  });
}
