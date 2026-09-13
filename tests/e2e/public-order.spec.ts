import { expect, test as base, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  errorSchema,
  getCitiesResponseSchema,
  getShipmentTypesResponseSchema,
  postOrdersBodySchema,
  postOrdersResponseSchema,
  postQuotesBodySchema,
  postQuotesResponseSchema,
} from '../../src/lib/api/generated';

// Synthetic fixtures, validated against the approved contract. No request reaches the live API.
const origin = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const destination = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const shipmentType = '01ARZ3NDEKTSV4RRFFQ69G5FAX';
const requestId = '123e4567-e89b-42d3-a456-426614174000';
const tracking = 'PTA-260913-PUBLICQA01';
const envelope = (data: unknown) => ({ data, meta: {}, request_id: requestId });
const cityFixture = [
  { id: origin, name_ar: 'مدينة الإرسال التجريبية', name_en: 'QA Origin', code: 'QA-A' },
  { id: destination, name_ar: 'مدينة الاستلام التجريبية', name_en: 'QA Destination', code: 'QA-B' },
];
const typeFixture = [
  { id: shipmentType, name_ar: 'طرد تجريبي', name_en: 'QA Parcel', code: 'QA-TYPE' },
];
const created = {
  tracking_number: tracking,
  current_status: 'RECEIVED',
  final_price: 1235,
  currency: 'LYD',
  minor_unit_scale: 3,
};
const price = (amount = 1235) => ({
  calculated_price: amount,
  final_price: amount,
  currency: 'LYD',
  minor_unit_scale: 3,
});
const safeError = (errors?: Record<string, string[]>) =>
  errorSchema.parse({
    message: 'Private backend detail must never appear in the page',
    request_id: requestId,
    ...(errors ? { errors } : {}),
  });
type RecordedRequest = { path: string; body: Record<string, unknown>; key?: string; csrf?: string };
type Reply = { status?: number; data?: unknown; headers?: Record<string, string>; abort?: boolean };
type PublicApi = {
  requests: RecordedRequest[];
  paths: string[];
  empty: boolean;
  catalogStatus?: number;
  onQuote?: (request: RecordedRequest, count: number) => Promise<Reply> | Reply;
  onOrder?: (request: RecordedRequest, count: number) => Promise<Reply> | Reply;
};
const test = base.extend<{ publicApi: PublicApi }>({
  publicApi: [
    async ({ context, baseURL }, use) => {
      const state: PublicApi = { requests: [], paths: [], empty: false };
      const unexpected: string[] = [];
      const frontend = new URL(baseURL!).origin;
      const headers = {
        'access-control-allow-origin': frontend,
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'Content-Type, X-XSRF-TOKEN, Idempotency-Key',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-expose-headers': 'Retry-After, X-Request-ID',
      };
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const isApiPath = url.pathname.startsWith('/api/') || url.pathname.startsWith('/sanctum/');
        if (url.origin === frontend && !isApiPath) return route.continue();
        const path = url.pathname;
        const method = request.method();
        const allowed = new Map([
          ['/api/v1/cities', 'GET'],
          ['/api/v1/shipment-types', 'GET'],
          ['/sanctum/csrf-cookie', 'GET'],
          ['/api/v1/quotes', 'POST'],
          ['/api/v1/orders', 'POST'],
        ]);
        if (
          url.origin !== 'http://localhost:8080' ||
          !allowed.has(path) ||
          (method !== 'OPTIONS' && allowed.get(path) !== method)
        ) {
          unexpected.push(`${method} ${url.href}`);
          return route.abort('blockedbyclient');
        }
        if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
        state.paths.push(path);
        if (path === '/sanctum/csrf-cookie')
          return route.fulfill({
            status: 204,
            headers: {
              ...headers,
              'set-cookie': 'XSRF-TOKEN=public-test-csrf; Path=/; SameSite=Lax',
            },
          });
        if (method === 'GET') {
          const status = state.catalogStatus ?? 200;
          const schema = path.endsWith('/cities')
            ? getCitiesResponseSchema
            : getShipmentTypesResponseSchema;
          const data = state.empty ? [] : path.endsWith('/cities') ? cityFixture : typeFixture;
          return route.fulfill({
            status,
            headers,
            json: status >= 400 ? safeError() : schema.parse(envelope(data)),
          });
        }
        const schema = path.endsWith('/quotes') ? postQuotesBodySchema : postOrdersBodySchema;
        const record = {
          path,
          body: schema.parse(request.postDataJSON()),
          key: request.headers()['idempotency-key'],
          csrf: request.headers()['x-xsrf-token'],
        };
        state.requests.push(record);
        expect(record.csrf).toBe('public-test-csrf');
        const isOrder = path.endsWith('/orders');
        if (isOrder) {
          expect(record.key).toMatch(/^[0-9a-f-]{36}$/i);
          expect(record.body).not.toHaveProperty('branch_id');
        }
        const count = state.requests.filter((item) => item.path === path).length;
        const reply = (await (isOrder ? state.onOrder : state.onQuote)?.(record, count)) ?? {};
        if (reply.abort) return route.abort('failed');
        const status = reply.status ?? (isOrder ? 201 : 200);
        const responseSchema = isOrder ? postOrdersResponseSchema : postQuotesResponseSchema;
        const data = reply.data ?? (isOrder ? created : price());
        return route.fulfill({
          status,
          headers: { ...headers, ...reply.headers },
          json: status >= 400 ? errorSchema.parse(data) : responseSchema.parse(envelope(data)),
        });
      });
      await use(state);
      expect(unexpected, 'Unexpected external, authenticated or unapproved request').toEqual([]);
    },
    { auto: true },
  ],
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function orders(api: PublicApi) {
  return api.requests.filter((item) => item.path.endsWith('/orders'));
}
async function selectRoute(page: Page) {
  await expect(page.getByLabel('مدينة الإرسال', { exact: true })).toBeEnabled();
  await page.getByLabel('مدينة الإرسال', { exact: true }).selectOption(origin);
  await page.getByLabel('مدينة الاستلام', { exact: true }).selectOption(destination);
  await page.getByLabel('نوع الشحنة', { exact: true }).selectOption(shipmentType);
  await expect(page.locator('.public-order-total')).toBeVisible();
}
async function fillOrder(page: Page) {
  await selectRoute(page);
  await page.getByLabel('اسم المرسل', { exact: true }).fill('مرسل الاختبار');
  await page.getByLabel('هاتف المرسل', { exact: true }).fill('0910000002');
  await page.getByLabel('اسم المستلم', { exact: true }).fill('مستلم الاختبار');
  await page.getByLabel('هاتف المستلم', { exact: true }).fill('0920000002');
}
async function reviewOrder(page: Page) {
  await page.getByRole('button', { name: 'مراجعة الطلب', exact: true }).click();
  await expect(page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true })).toBeEnabled();
}

test('anonymous route is isolated from staff and required errors focus the first field', async ({
  page,
  publicApi,
}) => {
  await page.goto('/order');
  await expect(page).toHaveTitle('طلب شحن | Porta Delivery');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('heading', { name: 'طلب شحن', exact: true })).toBeVisible();
  await expect(page.locator('.application-shell, .shell-sidebar')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /تسجيل الدخول|لوحة التحكم/ })).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'انتقل إلى نموذج الطلب' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await selectRoute(page);
  await page.getByRole('button', { name: 'مراجعة الطلب', exact: true }).click();
  await expect(page.getByLabel('اسم المرسل', { exact: true })).toBeFocused();
  await expect(page.getByLabel('اسم المرسل', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(orders(publicApi)).toEqual([]);
  expect(publicApi.paths.every((path) => !/admin|auth|\/me$/.test(path))).toBe(true);
});

test('review, double-click protection, confirmation, copy and refresh retain no personal storage', async ({
  page,
  context,
  publicApi,
}) => {
  const hold = deferred();
  publicApi.onOrder = async () => {
    await hold.promise;
    return {};
  };
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/order');
  await fillOrder(page);
  await reviewOrder(page);
  await expect(page.locator('.public-order-review')).toContainText('مرسل الاختبار');
  await page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true }).dblclick();
  await expect.poll(() => orders(publicApi).length).toBe(1);
  await expect(page.getByRole('button', { name: 'جارٍ تأكيد الطلب…' })).toBeDisabled();
  expect(orders(publicApi)[0].body).toEqual({
    sender_name: 'مرسل الاختبار',
    sender_phone: '0910000002',
    recipient_name: 'مستلم الاختبار',
    recipient_phone: '0920000002',
    origin_city_id: origin,
    destination_city_id: destination,
    shipment_type_id: shipmentType,
    shipment_size: 'SMALL',
    delivery_method: 'OFFICE_PICKUP',
    payment_method: 'CASH_ON_DELIVERY',
  });
  hold.resolve();
  await expect(page.getByRole('heading', { name: 'تم تسجيل طلب الشحن' })).toBeFocused();
  await expect(page.getByText(tracking, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'نسخ رقم التتبع' }).click();
  await expect(page.getByRole('status')).toHaveText('تم نسخ رقم التتبع.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(tracking);
  const storage = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
  for (const privateValue of [
    'مرسل الاختبار',
    'مستلم الاختبار',
    '0910000002',
    '0920000002',
    tracking,
  ]) {
    expect(storage).not.toContain(privateValue);
    expect(page.url()).not.toContain(encodeURIComponent(privateValue));
  }
  await page.reload();
  await expect(page.getByRole('heading', { name: 'سبق تأكيد طلب الشحن' })).toBeVisible();
  expect(orders(publicApi)).toHaveLength(1);
  await page.getByRole('button', { name: 'طلب شحن جديد', exact: true }).click();
  await expect(page.getByLabel('اسم المرسل', { exact: true })).toHaveValue('');
});

test('door address is required and optional kg weight reaches only the reviewed order', async ({
  page,
  publicApi,
}) => {
  await page.goto('/order');
  await fillOrder(page);
  await page.getByRole('radio', { name: /^توصيل إلى الباب/ }).check();
  await expect(page.locator('.public-order-total')).toBeVisible();
  await page.getByRole('button', { name: 'مراجعة الطلب', exact: true }).click();
  await expect(page.getByLabel('عنوان التوصيل', { exact: true })).toBeFocused();
  await page.getByLabel('عنوان التوصيل', { exact: true }).fill('عنوان تجريبي للواجهة فقط');
  await page.getByLabel(/الوزن \(كجم\)/).fill('2.125');
  await page.getByRole('radio', { name: 'تحويل مسبق', exact: true }).check();
  await reviewOrder(page);
  await expect(page.locator('.public-order-review')).toContainText('2.125 كجم');
  await page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'تم تسجيل طلب الشحن' })).toBeVisible();
  expect(orders(publicApi)[0].body).toMatchObject({
    weight: 2.125,
    delivery_method: 'DOOR_DELIVERY',
    delivery_address: 'عنوان تجريبي للواجهة فقط',
    payment_method: 'PREPAID_TRANSFER',
  });
  for (const request of publicApi.requests.filter((item) => item.path.endsWith('/quotes')))
    expect(Object.keys(request.body).sort()).toEqual([
      'delivery_method',
      'destination_city_id',
      'origin_city_id',
      'shipment_size',
      'shipment_type_id',
    ]);
});

test('selection changes remove the old price immediately and clearing a route cannot create an order', async ({
  page,
  publicApi,
}) => {
  const hold = deferred();
  publicApi.onQuote = async (request) => {
    if (request.body.shipment_size === 'LARGE') {
      await hold.promise;
      return { data: price(2468) };
    }
    return {};
  };
  await page.goto('/order');
  await fillOrder(page);
  const initial = await page.locator('.public-order-total').innerText();
  await page.getByLabel('حجم الشحنة', { exact: true }).selectOption('LARGE');
  await expect(page.locator('.public-order-total')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'مراجعة الطلب', exact: true })).toBeDisabled();
  hold.resolve();
  await expect(page.locator('.public-order-total')).toBeVisible();
  await expect(page.locator('.public-order-total')).not.toHaveText(initial);
  await page.getByLabel('مدينة الاستلام', { exact: true }).selectOption('');
  await expect(page.locator('.public-order-total')).toHaveCount(0);
  await page.getByRole('button', { name: 'مراجعة الطلب', exact: true }).click();
  await expect(page.getByLabel('مدينة الاستلام', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true })).toHaveCount(0);
  expect(orders(publicApi)).toEqual([]);
});

test('422 returns editable field errors, focuses the invalid phone and creates a new corrected attempt', async ({
  page,
  publicApi,
}) => {
  publicApi.onOrder = (_request, count) =>
    count === 1
      ? { status: 422, data: safeError({ recipient_phone: ['Private validation text'] }) }
      : {};
  await page.goto('/order');
  await fillOrder(page);
  await reviewOrder(page);
  await page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true }).click();
  const phone = page.getByLabel('هاتف المستلم', { exact: true });
  await expect(phone).toBeFocused();
  await expect(phone).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('اسم المرسل', { exact: true })).toHaveValue('مرسل الاختبار');
  await expect(page.getByText('Private validation text')).toHaveCount(0);
  await phone.fill('0920000003');
  await reviewOrder(page);
  await page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'تم تسجيل طلب الشحن' })).toBeVisible();
  expect(orders(publicApi)).toHaveLength(2);
  expect(orders(publicApi)[1].body.recipient_phone).toBe('0920000003');
  expect(orders(publicApi)[1].key).not.toBe(orders(publicApi)[0].key);
});

for (const failure of ['network', 'server'] as const) {
  test(`${failure} failure keeps fields locked and retries one immutable order only on deliberate action`, async ({
    page,
    publicApi,
  }) => {
    publicApi.onOrder = (_request, count) =>
      count === 1
        ? failure === 'network'
          ? { abort: true }
          : { status: 500, data: safeError() }
        : {};
    await page.goto('/order');
    await fillOrder(page);
    await reviewOrder(page);
    await page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true }).click();
    const retry = page.getByRole('button', { name: 'إعادة المحاولة', exact: true });
    await expect(retry).toBeEnabled();
    await expect(page.getByLabel('اسم المرسل', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'تعديل البيانات' })).toHaveCount(0);
    await expect(page.getByText(/Private backend detail/)).toHaveCount(0);
    expect(orders(publicApi)).toHaveLength(1);
    await retry.click();
    await expect(page.getByRole('heading', { name: 'تم تسجيل طلب الشحن' })).toBeVisible();
    expect(orders(publicApi)).toHaveLength(2);
    expect(orders(publicApi)[1]).toEqual(orders(publicApi)[0]);
  });
}

test('409 is a safe public conflict and never implies staff editing or exposes backend content', async ({
  page,
  publicApi,
}) => {
  publicApi.onOrder = () => ({ status: 409, data: safeError() });
  await page.goto('/order');
  await fillOrder(page);
  await reviewOrder(page);
  await page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('تعارض');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(requestId);
  await expect(page.getByText(/مستخدم آخر|Private backend detail/)).toHaveCount(0);
  expect(orders(publicApi)).toHaveLength(1);
});

test('429 prevents an early retry and reuses the original key after Retry-After', async ({
  page,
  publicApi,
}) => {
  publicApi.onOrder = (_request, count) =>
    count === 1 ? { status: 429, data: safeError(), headers: { 'retry-after': '2' } } : {};
  await page.goto('/order');
  await fillOrder(page);
  await reviewOrder(page);
  await page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true }).click();
  const retry = page.getByRole('button', { name: 'إعادة المحاولة', exact: true });
  await expect(retry).toBeDisabled();
  await expect(page.getByText(/يمكنك المحاولة بعد/)).toBeVisible();
  expect(orders(publicApi)).toHaveLength(1);
  await expect(retry).toBeEnabled();
  expect(orders(publicApi)).toHaveLength(1);
  await retry.click();
  await expect(page.getByRole('heading', { name: 'تم تسجيل طلب الشحن' })).toBeVisible();
  expect(orders(publicApi)[1]).toEqual(orders(publicApi)[0]);
});

test('empty public catalogs offer no invented options or order submission', async ({
  page,
  publicApi,
}) => {
  publicApi.empty = true;
  await page.goto('/order');
  await expect(page.getByRole('heading', { name: 'الحجز غير متاح حاليًا' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'مراجعة الطلب', exact: true })).toBeDisabled();
  await expect(page.getByLabel('مدينة الإرسال', { exact: true }).locator('option')).toHaveCount(1);
  expect(publicApi.requests).toEqual([]);
});

test('catalog errors have a working public retry with no login redirect', async ({
  page,
  publicApi,
}) => {
  publicApi.catalogStatus = 403;
  await page.goto('/order');
  const retry = page.getByRole('button', { name: 'إعادة تحميل الخيارات' });
  await expect(retry).toBeEnabled();
  await expect(page.getByRole('button', { name: 'مراجعة الطلب', exact: true })).toBeDisabled();
  await expect(page).toHaveURL(/\/order$/);
  publicApi.catalogStatus = 200;
  await retry.click();
  await expect(page.getByLabel('مدينة الإرسال', { exact: true })).toBeEnabled();
  await expect(page.getByLabel('مدينة الإرسال', { exact: true }).locator('option')).toHaveCount(3);
  expect(publicApi.requests).toEqual([]);
});

test('public layouts fit phone, tablet and desktop widths with readable native controls', async ({
  page,
}) => {
  await page.goto('/order');
  await fillOrder(page);
  await page
    .getByLabel('اسم المرسل', { exact: true })
    .fill('اسم مرسل عربي طويل لاختبار وضوح النص والتفافه على الهاتف');
  await reviewOrder(page);
  for (const width of [390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      controls: [
        ...document.querySelectorAll('main input:not([type="radio"]), main select, main textarea'),
      ].map((element) => ({
        font: parseFloat(getComputedStyle(element).fontSize),
        height: element.getBoundingClientRect().height,
      })),
    }));
    expect(metrics.overflow, `horizontal overflow at ${width}`).toBe(false);
    expect(metrics.controls.every((item) => item.font >= 16 && item.height >= 44)).toBe(true);
    await expect(page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true })).toBeVisible();
  }
});

test('form, review and success pass accessibility checks in both themes and reduced motion', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/order');
  await fillOrder(page);
  await page.evaluate(() => document.fonts.ready);
  for (const stage of ['form', 'review', 'success']) {
    if (stage === 'review') await reviewOrder(page);
    if (stage === 'success') {
      await page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'تم تسجيل طلب الشحن' })).toBeVisible();
    }
    for (const theme of ['light', 'dark']) {
      const themePaint = await page.evaluate(async (value) => {
        document.documentElement.dataset.theme = value;
        const colors = () =>
          [...document.querySelectorAll<HTMLElement>('.public-order-input')].map((element) => {
            const style = getComputedStyle(element);
            return {
              id: element.id,
              color: style.color,
              background: style.backgroundColor,
              transitionDuration: style.transitionDuration,
            };
          });
        // Flush the new style so CSS transitions exist before awaiting their completion.
        const before = colors();
        const transitions = document
          .getAnimations()
          .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime));
        const animationStates = transitions.map((animation) => ({
          playState: animation.playState,
          endTime: animation.effect?.getComputedTiming().endTime,
        }));
        await Promise.all(transitions.map((animation) => animation.finished.catch(() => {})));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return { before, animationStates, after: colors() };
      }, theme);
      await test.info().attach(`${stage}-${theme}-theme-paint`, {
        body: JSON.stringify(themePaint, null, 2),
        contentType: 'application/json',
      });
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        result.violations.map((item) => ({
          id: item.id,
          nodes: item.nodes.map((node) => ({
            target: node.target,
            failureSummary: node.failureSummary,
            checks: [...node.any, ...node.all, ...node.none].map((check) => ({
              id: check.id,
              data: check.data,
            })),
          })),
        })),
        `${stage} ${theme}`,
      ).toEqual([]);
    }
  }
});
