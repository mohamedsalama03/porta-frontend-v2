import { expect, test as base, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  getCitiesResponseSchema,
  getShipmentTypesResponseSchema,
  getTrackingTrackingNumberResponseSchema,
  postOrdersBodySchema,
  postOrdersResponseSchema,
  postQuotesBodySchema,
  postQuotesResponseSchema,
  type ShipmentStatus,
} from '../../src/lib/api/generated';

// All examples are synthetic, contract-validated fixtures. This suite blocks live API access.
const trackingA = 'PTA-260913-TRACKQA01';
const trackingB = 'PTA-260913-TRACKQA02';
const requestId = '123e4567-e89b-42d3-a456-426614174000';
const originCity = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const destinationCity = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const shipmentType = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
const statusLabels: Record<ShipmentStatus, string> = {
  RECEIVED: 'تم استلام الطلب',
  PREPARING: 'جاري التجهيز',
  IN_TRANSIT: 'خرجت في رحلة',
  ARRIVED_CITY: 'وصلت للمدينة',
  READY_FOR_PICKUP: 'جاهزة للاستلام',
  DELIVERED: 'تم التسليم',
};
const envelope = (data: unknown) => ({ data, meta: {}, request_id: requestId });
function trackingFixture(number = trackingA, status: ShipmentStatus = 'RECEIVED') {
  return getTrackingTrackingNumberResponseSchema.parse(
    envelope({
      tracking_number: number,
      origin_city: { name_ar: 'مدينة الإرسال التجريبية', name_en: 'QA Origin' },
      destination_city: { name_ar: 'مدينة الاستلام التجريبية', name_en: 'QA Destination' },
      shipment_type: 'طرد تجريبي',
      current_status: status,
      status_label: statusLabels[status],
      created_at: '2026-09-13T10:00:00Z',
      estimated_delivery: null,
      // Deliberately unusual order verifies preservation of the API sequence, not inferred lifecycle sorting.
      tracking_timeline: [
        {
          status: 'PREPARING',
          status_label: statusLabels.PREPARING,
          occurred_at: '2026-09-13T11:30:00Z',
        },
        {
          status: 'RECEIVED',
          status_label: statusLabels.RECEIVED,
          occurred_at: '2026-09-13T10:00:00Z',
        },
      ],
    }),
  );
}
type Reply = { status?: number; json?: unknown; headers?: Record<string, string>; abort?: boolean };
type RequestSummary = { method: string; path: string; number?: string };
type TrackingApi = {
  requests: RequestSummary[];
  fulfilled: string[];
  orderEnabled: boolean;
  onTracking?: (number: string, count: number) => Reply | Promise<Reply>;
};
const test = base.extend<{ trackingApi: TrackingApi }>({
  trackingApi: [
    async ({ context, baseURL }, use) => {
      const state: TrackingApi = { requests: [], fulfilled: [], orderEnabled: false };
      const unexpected: string[] = [];
      const frontend = new URL(baseURL!).origin;
      const headers = {
        'access-control-allow-origin': frontend,
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'Content-Type, X-XSRF-TOKEN, Idempotency-Key',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-expose-headers': 'Retry-After, X-Request-ID',
        'x-request-id': requestId,
      };
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname;
        const method = request.method();
        if (url.origin === frontend && !/^\/(api|sanctum)\//.test(path)) return route.continue();
        const match = /^\/api\/v1\/tracking\/(PTA-[0-9]{6}-[A-Z0-9]{6,20})$/.exec(path);
        const allowedOrder =
          state.orderEnabled &&
          new Map([
            ['/api/v1/cities', 'GET'],
            ['/api/v1/shipment-types', 'GET'],
            ['/sanctum/csrf-cookie', 'GET'],
            ['/api/v1/quotes', 'POST'],
            ['/api/v1/orders', 'POST'],
          ]).get(path);
        if (
          url.origin !== 'http://localhost:8080' ||
          url.search ||
          (!match && !allowedOrder) ||
          (method !== 'OPTIONS' && method !== (match ? 'GET' : allowedOrder))
        ) {
          unexpected.push(`${method} ${url.origin}${path}`);
          return route.abort('blockedbyclient');
        }
        if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
        expect(request.headers().authorization).toBeUndefined();
        state.requests.push({ method, path, ...(match ? { number: match[1] } : {}) });
        if (match) {
          const count = state.requests.filter((item) => item.number).length;
          const reply = (await state.onTracking?.(match[1], count)) ?? {};
          if (reply.abort) return route.abort('failed');
          await route.fulfill({
            status: reply.status ?? 200,
            headers: { ...headers, ...reply.headers },
            json: reply.json ?? trackingFixture(match[1]),
          });
          state.fulfilled.push(match[1]);
          return;
        }
        if (path === '/sanctum/csrf-cookie')
          return route.fulfill({
            status: 204,
            headers: {
              ...headers,
              'set-cookie': 'XSRF-TOKEN=tracking-handoff-test; Path=/; SameSite=Lax',
            },
          });
        if (path.endsWith('/cities'))
          return route.fulfill({
            headers,
            json: getCitiesResponseSchema.parse(
              envelope([
                {
                  id: originCity,
                  name_ar: 'مدينة الإرسال التجريبية',
                  name_en: 'QA Origin',
                  code: 'QA-A',
                },
                {
                  id: destinationCity,
                  name_ar: 'مدينة الاستلام التجريبية',
                  name_en: 'QA Destination',
                  code: 'QA-B',
                },
              ]),
            ),
          });
        if (path.endsWith('/shipment-types'))
          return route.fulfill({
            headers,
            json: getShipmentTypesResponseSchema.parse(
              envelope([
                { id: shipmentType, name_ar: 'طرد تجريبي', name_en: 'QA Parcel', code: 'QA-TYPE' },
              ]),
            ),
          });
        expect(request.headers()['x-xsrf-token']).toBe('tracking-handoff-test');
        if (path.endsWith('/quotes')) {
          postQuotesBodySchema.parse(request.postDataJSON());
          return route.fulfill({
            headers,
            json: postQuotesResponseSchema.parse(
              envelope({
                calculated_price: 1235,
                final_price: 1235,
                currency: 'LYD',
                minor_unit_scale: 3,
              }),
            ),
          });
        }
        postOrdersBodySchema.parse(request.postDataJSON());
        expect(request.headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/i);
        return route.fulfill({
          status: 201,
          headers,
          json: postOrdersResponseSchema.parse(
            envelope({
              tracking_number: trackingA,
              current_status: 'RECEIVED',
              final_price: 1235,
              currency: 'LYD',
              minor_unit_scale: 3,
            }),
          ),
        });
      });
      await use(state);
      expect(unexpected, 'No external, staff, mutation or unapproved requests').toEqual([]);
    },
    { auto: true },
  ],
});
const trackingRequests = (api: TrackingApi) => api.requests.filter((request) => request.number);
const safeError = () => ({ message: 'PRIVATE_BACKEND_TRACE', request_id: requestId });
const resultHeading = (page: Page, status: ShipmentStatus = 'RECEIVED') =>
  page.getByRole('heading', { name: statusLabels[status], exact: true, level: 2 });
async function lookup(page: Page, number = trackingA) {
  await page.getByLabel('رقم التتبع', { exact: true }).fill(number);
  await page.getByRole('button', { name: 'تتبع الشحنة', exact: true }).click();
}

test('anonymous RTL route has safe metadata, explicit search and accessible empty/invalid validation', async ({
  page,
  trackingApi,
}) => {
  await page.goto('/track');
  await expect(page).toHaveTitle('تتبع الشحنة | Porta Delivery');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex.*nofollow/);
  await expect(page.locator('.application-shell, .shell-sidebar')).toHaveCount(0);
  const input = page.getByLabel('رقم التتبع', { exact: true });
  await expect(input).toHaveAttribute('dir', 'ltr');
  await input.press('Enter');
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await input.fill('pta-260913-TRACKQA01');
  await input.press('Enter');
  await expect(input).toHaveValue('pta-260913-TRACKQA01');
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await input.fill(trackingA);
  expect(trackingRequests(trackingApi)).toHaveLength(0);
  await input.press('Enter');
  await expect(resultHeading(page)).toBeFocused();
  expect(trackingRequests(trackingApi)).toHaveLength(1);
});

test('trimmed lookup renders safe status and authoritative timeline order in Tripoli time', async ({
  page,
  trackingApi,
}) => {
  await page.goto('/track');
  await lookup(page, `  ${trackingA}  `);
  await expect(resultHeading(page)).toBeVisible();
  await expect(page.getByRole('list', { name: 'سجل الشحنة' }).getByRole('listitem')).toHaveCount(2);
  const items = page.getByRole('list', { name: 'سجل الشحنة' }).getByRole('listitem');
  await expect(items.nth(0)).toContainText(statusLabels.PREPARING);
  await expect(items.nth(1)).toContainText(statusLabels.RECEIVED);
  const times = items.locator('time');
  await expect(times.nth(0)).toHaveAttribute('datetime', '2026-09-13T11:30:00Z');
  await expect(times.nth(0)).toContainText(/13:30|1:30/);
  await expect(times.nth(1)).toContainText(/12:00/);
  await expect(page.getByRole('main')).toContainText('مدينة الإرسال التجريبية');
  await expect(page.getByRole('main')).toContainText('مدينة الاستلام التجريبية');
  expect(trackingRequests(trackingApi).map((request) => request.number)).toEqual([trackingA]);
  const url = new URL(page.url());
  expect([...url.searchParams.entries()]).toEqual([['number', trackingA]]);
  const storage = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
  expect(storage).not.toContain(trackingA);
});

test('deep link performs a single effective lookup and refresh is explicit with no focus, reconnect or polling fetches', async ({
  page,
  trackingApi,
}) => {
  await page.goto(`/track?number=${trackingA}`);
  await expect(resultHeading(page)).toBeVisible();
  expect(trackingRequests(trackingApi)).toHaveLength(1);
  await page.clock.install();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
  });
  await page.clock.fastForward(120_000);
  expect(trackingRequests(trackingApi)).toHaveLength(1);
  const refresh = page.getByRole('button', { name: 'تحديث الحالة', exact: true });
  await refresh.click();
  await expect.poll(() => trackingRequests(trackingApi).length).toBe(2);
  await expect(refresh).toBeFocused();
  await expect(resultHeading(page)).toBeVisible();
});

test('invalid and ambiguous URL numbers do not issue a lookup or expose private query data in metadata', async ({
  page,
  trackingApi,
}) => {
  for (const query of ['number=invalid', `number=${trackingA}&number=${trackingB}`]) {
    await page.goto(`/track?${query}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'تتبع الشحنة', exact: true })).toBeVisible();
    expect(trackingRequests(trackingApi)).toHaveLength(0);
  }
  await expect(page).toHaveTitle('تتبع الشحنة | Porta Delivery');
});

test('copy confirms success and clipboard denial offers a manual fallback', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`/track?number=${trackingA}`);
  await expect(resultHeading(page)).toBeVisible();
  const copy = page.getByRole('button', { name: 'نسخ رقم التتبع', exact: true });
  await copy.click();
  await expect(page.getByRole('status').filter({ hasText: 'تم نسخ رقم التتبع.' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(trackingA);
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () => Promise.reject(new DOMException('Clipboard denied', 'NotAllowedError')),
    });
  });
  await copy.click();
  await expect(page.getByRole('status').filter({ hasText: /يدويًا/ })).toBeVisible();
  await expect(page.getByRole('main')).toContainText(trackingA);
});

test('unknown tracking is safe, preserves the identifier and permits an explicit new lookup', async ({
  page,
  trackingApi,
}) => {
  trackingApi.onTracking = (_number, count) =>
    count === 1 ? { status: 404, json: safeError() } : {};
  await page.goto('/track');
  await lookup(page);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'لم نعثر على شحنة بهذا الرقم',
  );
  await expect(page.getByLabel('رقم التتبع', { exact: true })).toHaveValue(trackingA);
  await expect(page.getByText('PRIVATE_BACKEND_TRACE')).toHaveCount(0);
  await lookup(page, trackingB);
  await expect(resultHeading(page)).toBeVisible();
  expect(trackingRequests(trackingApi).map((item) => item.number)).toEqual([trackingA, trackingB]);
});

for (const failure of ['network', '503'] as const) {
  test(`${failure} refresh failure keeps the last valid result and retries only on customer action`, async ({
    page,
    trackingApi,
  }) => {
    trackingApi.onTracking = (_number, count) =>
      count === 2
        ? failure === 'network'
          ? { abort: true }
          : { status: 503, json: safeError() }
        : {};
    await page.goto(`/track?number=${trackingA}`);
    await expect(resultHeading(page)).toBeVisible();
    await page.getByRole('button', { name: 'تحديث الحالة', exact: true }).click();
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await expect(resultHeading(page)).toBeVisible();
    await expect(page.getByLabel('رقم التتبع', { exact: true })).toHaveValue(trackingA);
    await expect(page.getByText('PRIVATE_BACKEND_TRACE')).toHaveCount(0);
    if (failure === '503')
      await expect(page.getByRole('main').getByRole('alert')).toContainText(requestId);
    await page.clock.install();
    await page.clock.fastForward(120_000);
    expect(trackingRequests(trackingApi)).toHaveLength(2);
    await page.getByRole('button', { name: 'تحديث الحالة', exact: true }).click();
    await expect.poll(() => trackingRequests(trackingApi).length).toBe(3);
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  });
}

test('429 honors Retry-After across identifier edits without automatically retrying', async ({
  page,
  trackingApi,
}) => {
  trackingApi.onTracking = (_number, count) =>
    count === 1 ? { status: 429, json: safeError(), headers: { 'retry-after': '3' } } : {};
  await page.goto('/track');
  await lookup(page);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('يرجى الانتظار');
  const submit = page.getByRole('button', { name: 'تتبع الشحنة', exact: true });
  const retry = page.getByRole('button', { name: 'إعادة المحاولة', exact: true });
  await expect(submit).toBeDisabled();
  await expect(retry).toBeDisabled();
  const input = page.getByLabel('رقم التتبع', { exact: true });
  await input.fill(trackingB);
  await input.press('Enter');
  await expect(submit).toBeDisabled();
  await expect(retry).toBeDisabled();
  expect(trackingRequests(trackingApi)).toHaveLength(1);
  await expect(submit).toBeEnabled();
  await expect(retry).toBeEnabled();
  expect(trackingRequests(trackingApi)).toHaveLength(1);
  await retry.click();
  await expect(resultHeading(page)).toBeVisible();
  expect(trackingRequests(trackingApi).map((request) => request.number)).toEqual([
    trackingA,
    trackingB,
  ]);
});

test('editing cancels obsolete lookup and a delayed result cannot replace the next identifier', async ({
  page,
  trackingApi,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  trackingApi.onTracking = async (number) => {
    if (number === trackingA) await held;
    return { json: trackingFixture(number, number === trackingA ? 'RECEIVED' : 'DELIVERED') };
  };
  await page.goto('/track');
  await lookup(page);
  await expect.poll(() => trackingRequests(trackingApi).length).toBe(1);
  await expect(page.getByRole('status', { name: 'جارٍ تحميل حالة الشحنة' })).toBeVisible();
  await lookup(page, trackingB);
  await expect(resultHeading(page, 'DELIVERED')).toBeVisible();
  release();
  await expect.poll(() => trackingApi.fulfilled.includes(trackingA)).toBe(true);
  await expect(page.getByRole('main')).not.toContainText(trackingA);
  await expect(page.getByRole('main')).toContainText(trackingB);
  await expect(resultHeading(page, 'DELIVERED')).toBeVisible();
  expect(trackingRequests(trackingApi).map((request) => request.number)).toEqual([
    trackingA,
    trackingB,
  ]);
});

test('unapproved private fields invalidate the response and never render sensitive values', async ({
  page,
  trackingApi,
}) => {
  const fixture = trackingFixture();
  const privateValues = [
    'PRIVATE_SENDER_PHONE',
    'PRIVATE_RECIPIENT_NAME',
    'PRIVATE_INTERNAL_UUID',
    'PRIVATE_STAFF_ACTOR',
    'PRIVATE_DRIVER_PHONE',
    'PRIVATE_INTERNAL_NOTE',
    'PRIVATE_PAYMENT_LEDGER',
  ];
  trackingApi.onTracking = () => ({
    json: {
      ...fixture,
      data: {
        ...fixture.data,
        sender_phone: privateValues[0],
        recipient_name: privateValues[1],
        id: privateValues[2],
        staff: privateValues[3],
        driver_phone: privateValues[4],
        notes: privateValues[5],
        payments: privateValues[6],
      },
    },
  });
  await page.goto(`/track?number=${trackingA}`);
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await expect(resultHeading(page)).toHaveCount(0);
  for (const value of privateValues) await expect(page.getByText(value)).toHaveCount(0);
  expect(trackingRequests(trackingApi)).toHaveLength(1);
});

test('every approved status remains readable at mobile, tablet and desktop widths with accessible themes', async ({
  page,
  trackingApi,
}) => {
  test.setTimeout(90_000);
  let status: ShipmentStatus = 'RECEIVED';
  trackingApi.onTracking = () => ({ json: trackingFixture(trackingA, status) });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/track?number=${trackingA}`);
  await expect(resultHeading(page)).toBeVisible();
  for (const nextStatus of Object.keys(statusLabels) as ShipmentStatus[]) {
    if (nextStatus !== 'RECEIVED') {
      status = nextStatus;
      await page.getByRole('button', { name: 'تحديث الحالة', exact: true }).click();
      await expect(resultHeading(page, nextStatus)).toBeVisible();
    }
    for (const width of [390, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const metrics = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        inputFont: parseFloat(getComputedStyle(document.querySelector('main input')!).fontSize),
        controls: [...document.querySelectorAll('main input, main button')].map(
          (element) => element.getBoundingClientRect().height,
        ),
      }));
      expect(metrics.overflow, `${nextStatus} ${width}px`).toBe(false);
      expect(metrics.inputFont).toBeGreaterThanOrEqual(16);
      expect(metrics.controls.every((height) => height >= 44)).toBe(true);
    }
  }
  for (const theme of ['light', 'dark']) {
    await page.evaluate(async (value) => {
      document.documentElement.dataset.theme = value;
      document.documentElement.getBoundingClientRect();
      await Promise.all(
        document
          .getAnimations()
          .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
          .map((animation) => animation.finished.catch(() => {})),
      );
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }, theme);
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      axe.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target }) => target) })),
      theme,
    ).toEqual([]);
  }
});

test('order confirmation links only its authoritative tracking number and tracking navigation never repeats creation', async ({
  page,
  trackingApi,
}) => {
  trackingApi.orderEnabled = true;
  await page.goto('/order');
  await page.getByLabel('مدينة الإرسال', { exact: true }).selectOption(originCity);
  await page.getByLabel('مدينة الاستلام', { exact: true }).selectOption(destinationCity);
  await page.getByLabel('نوع الشحنة', { exact: true }).selectOption(shipmentType);
  await expect(page.locator('.public-order-total')).toBeVisible();
  await page.getByLabel('اسم المرسل', { exact: true }).fill('مرسل الاختبار');
  await page.getByLabel('هاتف المرسل', { exact: true }).fill('0910000002');
  await page.getByLabel('اسم المستلم', { exact: true }).fill('مستلم الاختبار');
  await page.getByLabel('هاتف المستلم', { exact: true }).fill('0920000002');
  await page.getByRole('button', { name: 'مراجعة الطلب', exact: true }).click();
  await page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'تم تسجيل طلب الشحن', exact: true }),
  ).toBeVisible();
  const trackingLink = page.getByRole('link', { name: 'تتبع الشحنة', exact: true });
  await expect(trackingLink).toHaveAttribute('href', `/track?number=${trackingA}`);
  await trackingLink.click();
  await expect(resultHeading(page)).toBeVisible();
  expect([...new URL(page.url()).searchParams.entries()]).toEqual([['number', trackingA]]);
  expect(trackingApi.requests.filter((request) => request.path.endsWith('/orders'))).toHaveLength(
    1,
  );
  expect(trackingRequests(trackingApi)).toHaveLength(1);
  for (const privateValue of ['مرسل الاختبار', 'مستلم الاختبار', '0910000002', '0920000002'])
    await expect(page.getByRole('main')).not.toContainText(privateValue);
});
