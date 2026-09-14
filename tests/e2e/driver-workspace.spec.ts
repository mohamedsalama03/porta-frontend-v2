import { expect, test as base, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  getAuthMeResponseSchema,
  getDriverShipmentsQuerySchema,
  getDriverShipmentsResponseSchema,
  getDriverShipmentsShipmentResponseSchema,
  getDriverTripsQuerySchema,
  getDriverTripsResponseSchema,
  getDriverTripsTripResponseSchema,
  postAuthLoginBodySchema,
  postDriverShipmentsShipmentStatusBodySchema,
} from '../../src/lib/api/generated';
import {
  createDriverFixtures,
  driverEnvelope,
  driverErrorFixture,
  driverFixtureCsrf,
  driverFixtureIds as ids,
  driverFixtureNextCursor,
  driverFixtureTracking,
  driverSessionFixture,
  driverShipmentFixture,
  driverTripFixture,
} from '../../scripts/driver-check-fixtures.mjs';

// Every API call is intercepted; synthetic identities and writes never reach a live service.
type DriverApi = ReturnType<typeof createDriverFixtures>['state'];
const shipmentPath = `/api/v1/driver/shipments/${ids.shipment}`;
const tripPath = `/api/v1/driver/trips/${ids.trip}`;
const shipmentRoute = `/driver/shipments/${ids.shipment}`;
const tripRoute = `/driver/trips/${ids.trip}`;
const test = base.extend<{ driverApi: DriverApi }>({
  driverApi: [
    async ({ context, baseURL }, use) => {
      const fixture = createDriverFixtures(new URL(baseURL!).origin);
      getAuthMeResponseSchema.parse(driverSessionFixture());
      getDriverTripsTripResponseSchema.parse(driverEnvelope(driverTripFixture()));
      getDriverShipmentsShipmentResponseSchema.parse(driverEnvelope(driverShipmentFixture()));
      getDriverTripsResponseSchema.parse(
        driverEnvelope(fixture.state.trips, { next_cursor: null }),
      );
      getDriverShipmentsResponseSchema.parse(
        driverEnvelope(fixture.state.shipments, { next_cursor: null }),
      );
      await context.addCookies([
        {
          name: 'XSRF-TOKEN',
          value: driverFixtureCsrf,
          domain: 'localhost',
          path: '/',
          sameSite: 'Lax',
        },
      ]);
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const method = request.method();
        const headers = request.headers();
        const body = request.postData() ? request.postDataJSON() : undefined;
        const query = {
          ...Object.fromEntries(url.searchParams),
          ...(url.searchParams.has('per_page')
            ? { per_page: Number(url.searchParams.get('per_page')) }
            : {}),
        };
        if (url.origin === 'http://localhost:8080' && method !== 'OPTIONS') {
          expect(headers.authorization).toBeUndefined();
          if (url.pathname === '/api/v1/driver/trips') getDriverTripsQuerySchema.parse(query);
          if (url.pathname === '/api/v1/driver/shipments')
            getDriverShipmentsQuerySchema.parse(query);
          if (method === 'POST') {
            expect(headers['x-xsrf-token']).toBe(driverFixtureCsrf);
            if (url.pathname.endsWith('/status')) {
              postDriverShipmentsShipmentStatusBodySchema.parse(body);
              expect(headers['idempotency-key']).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
            }
            if (url.pathname === '/api/v1/auth/login') postAuthLoginBodySchema.parse(body);
          }
        }
        const result = await fixture.resolve(request.url(), method, { headers, body });
        if (result.kind === 'continue') return route.continue();
        if (result.kind === 'abort') return route.abort('failed');
        return route.fulfill(result.response!);
      });
      await use(fixture.state);
      expect(
        fixture.state.unexpected,
        'Only approved session and scoped driver operations are allowed',
      ).toEqual([]);
    },
    { auto: true },
  ],
});
const driverReads = (api: DriverApi) =>
  api.requests.filter(
    (request) => request.path.startsWith('/api/v1/driver/') && request.method === 'GET',
  );
const writes = (api: DriverApi) =>
  api.requests.filter((request) => request.path.endsWith('/status'));
const refresh = (page: Page) => page.getByRole('button', { name: 'تحديث البيانات', exact: true });
const statusHeading = (page: Page, name: string) =>
  page.getByRole('heading', { name, exact: true });
const actionArea = (page: Page) =>
  page.getByRole('region', { name: 'إجراءات الشحنة', exact: true });
async function openConfirmation(page: Page, label = 'تأكيد جاهزية الاستلام') {
  await actionArea(page).getByRole('button', { name: label, exact: true }).click();
  await expect(actionArea(page).getByRole('heading', { name: label, exact: true })).toBeFocused();
  return actionArea(page).getByRole('button', { name: 'تأكيد الإجراء', exact: true });
}
async function login(page: Page) {
  await page.getByLabel('البريد الإلكتروني', { exact: true }).fill('driver@example.test');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('synthetic-test-password');
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
}
async function expectPrivateStorageEmpty(page: Page) {
  const persisted = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  );
  expect(persisted).not.toMatch(
    /DRIVERQA|2189|driver@example|synthetic-test-password|01ARZ3NDEKTSV4RRFFQ69G5FA|Idempotency-Key/,
  );
}

test('session discovery withholds private content and unauthenticated deep links safely return to login', async ({
  page,
  driverApi,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  driverApi.onRequest = async (request) => {
    if (request.path === '/api/v1/auth/me') {
      await pending;
      return { status: 401 };
    }
  };
  await page.goto(shipmentRoute);
  await expect
    .poll(() => driverApi.requests.filter((request) => request.path.endsWith('/auth/me')).length)
    .toBeGreaterThan(0);
  await expect(page.getByText(driverFixtureTracking)).toHaveCount(0);
  expect(driverReads(driverApi)).toEqual([]);
  release();
  await expect(page).toHaveURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(shipmentRoute);
  expect(driverReads(driverApi)).toEqual([]);
});

test('shared cookie login returns to the intended driver detail and rechecks scoped access', async ({
  page,
  driverApi,
}) => {
  driverApi.authenticated = false;
  await page.goto(shipmentRoute);
  await expect(page).toHaveURL(/\/login\?/);
  await login(page);
  await expect(page).toHaveURL(shipmentRoute);
  await expect(statusHeading(page, 'تفاصيل الشحنة')).toBeVisible();
  await expect(page.getByRole('main')).toContainText(driverFixtureTracking);
  const sequence = driverApi.requests.map((request) => request.path);
  const loginIndex = sequence.indexOf('/api/v1/auth/login');
  expect(sequence.indexOf('/sanctum/csrf-cookie')).toBeLessThan(loginIndex);
  expect(sequence.indexOf('/api/v1/auth/me', loginIndex)).toBeGreaterThan(loginIndex);
  expect(sequence.indexOf('/api/v1/driver/trips', loginIndex)).toBeGreaterThan(loginIndex);
  await expectPrivateStorageEmpty(page);
});

test('a staff identity cannot make driver or admin requests through the driver workspace', async ({
  page,
  driverApi,
}) => {
  driverApi.session.data.role = 'SUPER_ADMIN';
  driverApi.session.data.permissions = ['shipments.view', 'shipments.change_status', 'trips.view'];
  await page.goto(shipmentRoute);
  await expect(page.getByRole('main')).toContainText(/غير متاح|غير مسموح|ليست متاحة|غير متاحة/);
  await expect(page.getByText(driverFixtureTracking)).toHaveCount(0);
  expect(driverReads(driverApi)).toEqual([]);
});

test('DRIVER role alone does not bypass an active linked profile rejection', async ({
  page,
  driverApi,
}) => {
  driverApi.onRequest = (request) =>
    request.path === '/api/v1/driver/trips' ? { status: 403 } : undefined;
  await page.goto(shipmentRoute);
  await expect(page.getByRole('main')).toContainText(
    /غير متاح|غير مسموح|صلاحية|ليست متاحة|غير متاحة/,
  );
  expect(driverReads(driverApi).every((request) => request.path === '/api/v1/driver/trips')).toBe(
    true,
  );
  await expect(page.getByText(driverFixtureTracking)).toHaveCount(0);
});

test('home offers scoped work and accessible driver navigation without admin chrome or global stats', async ({
  page,
  driverApi,
}) => {
  await page.goto('/driver');
  await expect(page.getByRole('main')).toContainText(driverFixtureTracking);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  for (const label of ['الرئيسية', 'الرحلات', 'الشحنات', 'الحساب'])
    await expect(
      page.getByRole('navigation').getByRole('link', { name: label, exact: true }),
    ).toBeVisible();
  await expect(page.locator('.application-shell, .shell-sidebar, table')).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText(
    /الإيرادات|قواعد التسعير|سجل التدقيق|كل السائقين/,
  );
  expect(driverReads(driverApi).some((request) => request.path === '/api/v1/driver/trips')).toBe(
    true,
  );
  expect(
    driverReads(driverApi).some((request) => request.path === '/api/v1/driver/shipments'),
  ).toBe(true);
  await expectPrivateStorageEmpty(page);
});

test('trip list uses server cursors and documented status filters', async ({ page, driverApi }) => {
  driverApi.paginated = true;
  await page.goto('/driver/trips');
  await expect(statusHeading(page, 'رحلاتي')).toBeVisible();
  await expect(
    page.getByRole('link', { name: /فتح الرحلة|تفاصيل الرحلة|عرض الرحلة/ }).first(),
  ).toBeVisible();
  await page.getByRole('link', { name: 'التالي', exact: true }).click();
  await expect
    .poll(() =>
      driverReads(driverApi).some((request) => request.query.cursor === driverFixtureNextCursor),
    )
    .toBe(true);
  await page.getByLabel('حالة الرحلة', { exact: true }).selectOption('SCHEDULED');
  await expect
    .poll(() =>
      driverReads(driverApi).some(
        (request) => request.query.status === 'SCHEDULED' && !request.query.cursor,
      ),
    )
    .toBe(true);
  expect(new URL(page.url()).searchParams.get('status')).toBe('SCHEDULED');
  expect(
    driverReads(driverApi).every((request) => Number(request.query.per_page ?? 20) <= 100),
  ).toBe(true);
});

test('trip detail reads its own shipments through the scoped trip filter and uses Tripoli time', async ({
  page,
  driverApi,
}) => {
  await page.goto(tripRoute);
  await expect(statusHeading(page, 'تفاصيل الرحلة')).toBeVisible();
  await expect(page.getByRole('main')).toContainText(driverFixtureTracking);
  expect(driverReads(driverApi).some((request) => request.path === tripPath)).toBe(true);
  expect(
    driverReads(driverApi).some(
      (request) =>
        request.path === '/api/v1/driver/shipments' && request.query.trip_id === ids.trip,
    ),
  ).toBe(true);
  await expect(page.getByRole('main')).toContainText(/09:30|9:30|٠٩:٣٠|٩:٣٠/);
  await expect(
    page.getByRole('button', { name: /بدء الرحلة|إنهاء الرحلة|تأكيد الوصول/ }),
  ).toHaveCount(0);
});

test('shipment list paginates and filters without customer data in URLs', async ({
  page,
  driverApi,
}) => {
  driverApi.paginated = true;
  await page.goto('/driver/shipments');
  await expect(statusHeading(page, 'شحناتي')).toBeVisible();
  await expect(page.getByRole('main')).toContainText(driverFixtureTracking);
  await page.getByRole('link', { name: 'التالي', exact: true }).click();
  await expect
    .poll(() =>
      driverReads(driverApi).some(
        (request) =>
          request.path === '/api/v1/driver/shipments' &&
          request.query.cursor === driverFixtureNextCursor,
      ),
    )
    .toBe(true);
  await page.getByLabel('حالة الشحنة', { exact: true }).selectOption('READY_FOR_PICKUP');
  await expect
    .poll(() =>
      driverReads(driverApi).some(
        (request) => request.query.status === 'READY_FOR_PICKUP' && !request.query.cursor,
      ),
    )
    .toBe(true);
  expect(new URL(page.url()).searchParams.get('status')).toBe('READY_FOR_PICKUP');
  expect(page.url()).not.toMatch(/2189|%D8%B9%D9%86%D9%88%D8%A7%D9%86/);
});

test('shipment detail exposes only contract-supported contact, address and route context', async ({
  page,
}) => {
  await page.goto(shipmentRoute);
  await expect(statusHeading(page, 'تفاصيل الشحنة')).toBeVisible();
  await expect(page.getByRole('main')).toContainText('مستلم تجريبي');
  await expect(page.getByRole('main')).toContainText('عنوان تجريبي');
  await expect(page.locator('a[href="tel:+218920000002"]')).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText(
    /سجل التدقيق|دفتر الأستاذ|الملاحظات الداخلية|سعر الشحنة/,
  );
  await expectPrivateStorageEmpty(page);
});

test('permission-free driver reads assigned work but has no state-changing controls', async ({
  page,
  driverApi,
}) => {
  driverApi.session.data.permissions = [];
  await page.goto(shipmentRoute);
  await expect(page.getByRole('main')).toContainText(driverFixtureTracking);
  await expect(
    page.getByRole('button', { name: /تأكيد جاهزية الاستلام|تأكيد تسليم الشحنة/ }),
  ).toHaveCount(0);
  expect(writes(driverApi)).toEqual([]);
});

test('the two documented actions require inline confirmation, prevent duplicate submits and wait for authority', async ({
  page,
  driverApi,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  driverApi.onRequest = async (request) => {
    if (
      request.method === 'POST' &&
      request.path.endsWith('/status') &&
      writes(driverApi).length === 1
    ) {
      await pending;
      driverApi.shipments[0].current_status = 'READY_FOR_PICKUP';
      return { json: driverEnvelope(driverApi.shipments[0]) };
    }
  };
  await page.goto(shipmentRoute);
  const confirm = await openConfirmation(page);
  expect(writes(driverApi)).toEqual([]);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(actionArea(page)).toContainText('الحالة الحالية: وصلت للمدينة');
  await confirm.click({ clickCount: 2 });
  await expect(
    actionArea(page).getByRole('button', { name: 'جارٍ تأكيد الإجراء', exact: true }),
  ).toBeDisabled();
  expect(writes(driverApi)).toHaveLength(1);
  await expect(page.getByRole('region', { name: 'بيانات الشحنة', exact: true })).toContainText(
    'وصلت للمدينة',
  );
  await expect(statusHeading(page, 'تم تحديث حالة الشحنة')).toHaveCount(0);
  release();
  await expect(statusHeading(page, 'تم تحديث حالة الشحنة')).toBeFocused();
  await expect(page.getByRole('region', { name: 'بيانات الشحنة', exact: true })).toContainText(
    'جاهزة للاستلام',
  );
  await (await openConfirmation(page, 'تأكيد تسليم الشحنة')).click();
  await expect(page.getByRole('region', { name: 'بيانات الشحنة', exact: true })).toContainText(
    'تم التسليم',
  );
  expect(writes(driverApi).map((request) => request.body)).toEqual([
    { status: 'READY_FOR_PICKUP' },
    { status: 'DELIVERED' },
  ]);
  expect(writes(driverApi)[0].idempotencyKey).not.toBe(writes(driverApi)[1].idempotencyKey);
  await expect(actionArea(page).getByRole('button')).toHaveCount(0);
  await expectPrivateStorageEmpty(page);
});

test('confirmation cancellation restores focus and performs no operation', async ({
  page,
  driverApi,
}) => {
  await page.goto(shipmentRoute);
  await openConfirmation(page);
  await actionArea(page).getByRole('button', { name: 'رجوع', exact: true }).click();
  await expect(
    actionArea(page).getByRole('button', { name: 'تأكيد جاهزية الاستلام', exact: true }),
  ).toBeFocused();
  expect(writes(driverApi)).toEqual([]);
});

test('an uncertain network mutation retries only on explicit request with the same body and key', async ({
  page,
  driverApi,
}) => {
  driverApi.onRequest = (request) =>
    request.method === 'POST' && request.path.endsWith('/status') && writes(driverApi).length === 1
      ? { abort: true }
      : undefined;
  await page.goto(shipmentRoute);
  await (await openConfirmation(page)).click();
  await expect(actionArea(page).getByRole('alert')).toContainText(
    'تعذّر الاتصال. تحقق من الشبكة ثم حاول مجددًا.',
  );
  await expect(actionArea(page)).toContainText('لم نتلقَّ تأكيدًا نهائيًا.');
  expect(writes(driverApi)).toHaveLength(1);
  await expect(statusHeading(page, 'تم تحديث حالة الشحنة')).toHaveCount(0);
  await actionArea(page).getByRole('button', { name: 'إعادة محاولة الإجراء', exact: true }).click();
  await expect(statusHeading(page, 'تم تحديث حالة الشحنة')).toBeVisible();
  expect(writes(driverApi)).toHaveLength(2);
  expect(writes(driverApi)[0].idempotencyKey).toBe(writes(driverApi)[1].idempotencyKey);
  expect(writes(driverApi)[0].body).toEqual(writes(driverApi)[1].body);
  await expectPrivateStorageEmpty(page);
});

test('409 conflict refreshes the authoritative resource without replaying a stale operation', async ({
  page,
  driverApi,
}) => {
  driverApi.onRequest = (request) => {
    if (request.method === 'POST' && request.path.endsWith('/status')) {
      driverApi.shipments[0].current_status = 'DELIVERED';
      return { status: 409, json: driverErrorFixture() };
    }
  };
  await page.goto(shipmentRoute);
  await (await openConfirmation(page)).click();
  await expect(actionArea(page).getByRole('alert')).toContainText(
    'تم تحديث البيانات. يرجى مراجعة الحالة الحالية.',
  );
  await expect(page.getByRole('region', { name: 'بيانات الشحنة', exact: true })).toContainText(
    'تم التسليم',
  );
  expect(driverReads(driverApi).filter((request) => request.path === shipmentPath)).toHaveLength(2);
  expect(writes(driverApi)).toHaveLength(1);
  await expect(statusHeading(page, 'تم تحديث حالة الشحنة')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('PRIVATE_BACKEND_TRACE');
});

for (const status of [403, 404]) {
  test(`POST ${status} removes denied shipment details and cached list copies until authoritative reads succeed`, async ({
    page,
    driverApi,
  }) => {
    const privateRecipient = 'مستلم الشحنة المرفوضة';
    const verifiedRecipient = 'مستلم بعد إعادة التحقق';
    const otherTracking = driverApi.shipments[1].tracking_number;
    driverApi.shipments[0].recipient_name = privateRecipient;
    await page.goto('/driver/shipments');
    await expect(page.getByRole('main')).toContainText(driverFixtureTracking);
    await page.locator(`a[href="${shipmentRoute}"]`).click();
    await expect(page.locator('a[href="tel:+218920000002"]')).toBeVisible();
    driverApi.onRequest = (request) =>
      request.method === 'POST' && request.path.endsWith('/status')
        ? { status, json: driverErrorFixture() }
        : undefined;
    await (await openConfirmation(page)).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'هذا العمل غير متاح لك حاليًا.',
    );
    await expect(page.getByText(driverFixtureTracking)).toHaveCount(0);
    await expect(page.getByText(privateRecipient)).toHaveCount(0);
    await expect(page.locator('a[href="tel:+218920000002"]')).toHaveCount(0);
    await expect(actionArea(page)).toHaveCount(0);

    // A later transport failure must not restore the revoked detail or its list copy.
    driverApi.onRequest = (request) =>
      request.method === 'GET' && request.path.startsWith('/api/v1/driver/shipments')
        ? { abort: true }
        : undefined;
    await refresh(page).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('تعذّر الاتصال');
    await expect(page.getByText(privateRecipient)).toHaveCount(0);
    await expect(page.locator('a[href="tel:+218920000002"]')).toHaveCount(0);
    await page.getByRole('link', { name: 'العودة إلى الشحنات', exact: true }).click();
    await expect(statusHeading(page, 'شحناتي')).toBeVisible();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('تعذّر الاتصال');
    await expect(page.getByText(driverFixtureTracking)).toHaveCount(0);
    await expect(page.getByText(privateRecipient)).toHaveCount(0);
    await expect(page.getByRole('main')).toContainText(otherTracking);

    let releaseList!: () => void;
    let releaseDetail!: () => void;
    const freshList = new Promise<void>((resolve) => {
      releaseList = resolve;
    });
    const freshDetail = new Promise<void>((resolve) => {
      releaseDetail = resolve;
    });
    driverApi.shipments[0].recipient_name = verifiedRecipient;
    driverApi.shipments[0].current_status = 'READY_FOR_PICKUP';
    driverApi.onRequest = async (request) => {
      if (request.method === 'GET' && request.path === '/api/v1/driver/shipments') {
        await freshList;
        return { json: driverEnvelope(driverApi.shipments, { next_cursor: null }) };
      }
      if (request.method === 'GET' && request.path === shipmentPath) {
        await freshDetail;
        return { json: driverEnvelope(driverApi.shipments[0]) };
      }
    };
    const listReadsBefore = driverReads(driverApi).filter(
      (request) => request.path === '/api/v1/driver/shipments',
    ).length;
    await refresh(page).click();
    await expect
      .poll(
        () =>
          driverReads(driverApi).filter((request) => request.path === '/api/v1/driver/shipments')
            .length,
      )
      .toBe(listReadsBefore + 1);
    await expect(page.getByText(driverFixtureTracking)).toHaveCount(0);
    releaseList();
    await expect(page.getByRole('main')).toContainText(verifiedRecipient);
    await page.locator(`a[href="${shipmentRoute}"]`).click();
    await expect(statusHeading(page, 'تفاصيل الشحنة')).toBeVisible();
    await expect(page.getByText(verifiedRecipient)).toHaveCount(0);
    await expect(page.locator('a[href="tel:+218920000002"]')).toHaveCount(0);
    releaseDetail();
    await expect(page.getByRole('main')).toContainText(verifiedRecipient);
    await expect(page.getByRole('region', { name: 'بيانات الشحنة', exact: true })).toContainText(
      'جاهزة للاستلام',
    );
    await expect(page.locator('a[href="tel:+218920000002"]')).toBeVisible();
    expect(writes(driverApi)).toHaveLength(1);
    await expectPrivateStorageEmpty(page);
  });
}

test('POST 409 followed by GET 429 blocks review retries and restores fresh status only after the read succeeds', async ({
  page,
  driverApi,
}) => {
  await page.clock.install();
  let releaseFresh!: () => void;
  const freshRead = new Promise<void>((resolve) => {
    releaseFresh = resolve;
  });
  driverApi.onRequest = async (request) => {
    if (request.method === 'POST' && request.path.endsWith('/status')) {
      driverApi.shipments[0].current_status = 'DELIVERED';
      return { status: 409, json: driverErrorFixture() };
    }
    if (request.method === 'GET' && request.path === shipmentPath && writes(driverApi).length) {
      const count = driverReads(driverApi).filter((read) => read.path === shipmentPath).length;
      if (count === 2)
        return { status: 429, json: driverErrorFixture(), headers: { 'retry-after': '10' } };
      await freshRead;
      return { json: driverEnvelope(driverApi.shipments[0]) };
    }
  };
  await page.goto(shipmentRoute);
  await (await openConfirmation(page)).click();
  const review = actionArea(page).getByRole('button', {
    name: 'تحديث الحالة للمراجعة',
    exact: true,
  });
  await expect(review).toBeDisabled();
  await expect(actionArea(page).getByRole('alert')).toContainText('يرجى الانتظار');
  await expect(page.getByRole('region', { name: 'بيانات الشحنة', exact: true })).toContainText(
    'وصلت للمدينة',
  );
  await expect(statusHeading(page, 'تم تحديث حالة الشحنة')).toHaveCount(0);
  await review.dispatchEvent('click');
  await refresh(page).dispatchEvent('click');
  await page.clock.fastForward(5000);
  await expect(review).toBeDisabled();
  expect(driverReads(driverApi).filter((request) => request.path === shipmentPath)).toHaveLength(2);
  expect(writes(driverApi)).toHaveLength(1);

  await page.clock.fastForward(6000);
  await expect(review).toBeEnabled();
  expect(driverReads(driverApi).filter((request) => request.path === shipmentPath)).toHaveLength(2);
  await review.click({ clickCount: 2 });
  await expect(review).toBeDisabled();
  await expect
    .poll(() => driverReads(driverApi).filter((request) => request.path === shipmentPath).length)
    .toBe(3);
  await expect(page.getByRole('region', { name: 'بيانات الشحنة', exact: true })).toContainText(
    'وصلت للمدينة',
  );
  await expect(page.getByRole('region', { name: 'بيانات الشحنة', exact: true })).not.toContainText(
    'تم التسليم',
  );
  releaseFresh();
  await expect(page.getByRole('region', { name: 'بيانات الشحنة', exact: true })).toContainText(
    'تم التسليم',
  );
  await expect(review).toHaveCount(0);
  await expect(statusHeading(page, 'تم تحديث حالة الشحنة')).toHaveCount(0);
  expect(driverReads(driverApi).filter((request) => request.path === shipmentPath)).toHaveLength(3);
  expect(writes(driverApi)).toHaveLength(1);
});

test('422 uses safe Arabic feedback and keeps the last authoritative shipment status', async ({
  page,
  driverApi,
}) => {
  driverApi.onRequest = (request) =>
    request.method === 'POST' && request.path.endsWith('/status')
      ? {
          status: 422,
          json: { ...driverErrorFixture(), errors: { status: ['PRIVATE_DOMAIN_RULE'] } },
        }
      : undefined;
  await page.goto(shipmentRoute);
  await (await openConfirmation(page)).click();
  await expect(actionArea(page).getByRole('alert')).toContainText(
    'تعذّر قبول الإجراء. راجع بيانات الشحنة وحالتها ثم حاول مجددًا.',
  );
  await expect(page.getByRole('region', { name: 'بيانات الشحنة', exact: true })).toContainText(
    'وصلت للمدينة',
  );
  await expect(page.locator('body')).not.toContainText(/PRIVATE_BACKEND_TRACE|PRIVATE_DOMAIN_RULE/);
  expect(writes(driverApi)).toHaveLength(1);
});

test('429 respects Retry-After and retries the same operation only after deliberate interaction', async ({
  page,
  driverApi,
}) => {
  await page.clock.install();
  driverApi.onRequest = (request) =>
    request.method === 'POST' && request.path.endsWith('/status') && writes(driverApi).length === 1
      ? { status: 429, json: driverErrorFixture(), headers: { 'retry-after': '3' } }
      : undefined;
  await page.goto(shipmentRoute);
  await (await openConfirmation(page)).click();
  const retry = actionArea(page).getByRole('button', { name: 'إعادة محاولة الإجراء', exact: true });
  await expect(retry).toBeDisabled();
  await expect(actionArea(page)).toContainText(/يمكنك المحاولة بعد [123] ثانية/);
  expect(writes(driverApi)).toHaveLength(1);
  await page.clock.fastForward(3100);
  await expect(retry).toBeEnabled();
  expect(writes(driverApi)).toHaveLength(1);
  await retry.click();
  await expect(statusHeading(page, 'تم تحديث حالة الشحنة')).toBeVisible();
  expect(writes(driverApi)[0].idempotencyKey).toBe(writes(driverApi)[1].idempotencyKey);
});

for (const resource of ['trips', 'shipments'] as const) {
  test(`another driver's ${resource} returns a safe 404 without fallback or enumeration`, async ({
    page,
    driverApi,
  }) => {
    const foreign = resource === 'trips' ? ids.foreignTrip : ids.foreignShipment;
    const path = `/api/v1/driver/${resource}/${foreign}`;
    await page.goto(`/driver/${resource}/${foreign}`);
    await expect(page.getByRole('main')).toContainText(
      /غير موجود|غير متاح|لم نعثر|تعذّر|لم يعد|غير متاحة/,
    );
    await expect(page.getByText(driverFixtureTracking)).toHaveCount(0);
    expect(driverReads(driverApi).filter((request) => request.path.includes(foreign))).toHaveLength(
      1,
    );
    expect(
      driverReads(driverApi).every(
        (request) => request.path === '/api/v1/driver/trips' || request.path === path,
      ),
    ).toBe(true);
  });
}

test('unexpected administrative fields fail strict schema validation and never render', async ({
  page,
  driverApi,
}) => {
  driverApi.onRequest = (request) =>
    request.path === shipmentPath
      ? {
          json: driverEnvelope({
            ...driverShipmentFixture(),
            internal_notes: 'PRIVATE_STAFF_NOTE',
            final_price: 888123,
            audit: { email: 'private@example.test' },
          }),
        }
      : undefined;
  await page.goto(shipmentRoute);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى.',
  );
  await expect(page.getByText(driverFixtureTracking)).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(
    /PRIVATE_STAFF_NOTE|888123|private@example.test/,
  );
  await expectPrivateStorageEmpty(page);
});

test('a transient manual refresh preserves the most recent successful shipment and shows safe guidance', async ({
  page,
  driverApi,
}) => {
  await page.goto(shipmentRoute);
  await expect(page.getByRole('main')).toContainText(driverFixtureTracking);
  driverApi.onRequest = (request) => (request.path === shipmentPath ? { abort: true } : undefined);
  await refresh(page).click();
  await expect(page.getByRole('main')).toContainText(
    /تعذّر الاتصال|البيانات السابقة|قد تكون قديمة|آخر بيانات/,
  );
  await expect(page.getByRole('main')).toContainText(driverFixtureTracking);
  const count = driverReads(driverApi).filter((request) => request.path === shipmentPath).length;
  expect(count).toBe(2);
  driverApi.onRequest = undefined;
  await refresh(page).click();
  await expect
    .poll(() => driverReads(driverApi).filter((request) => request.path === shipmentPath).length)
    .toBe(3);
});

test('revoked shipment access cannot restore cached private data after a later network failure', async ({
  page,
  driverApi,
}) => {
  await page.goto(shipmentRoute);
  await expect(page.getByRole('main')).toContainText(driverFixtureTracking);
  driverApi.onRequest = (request) => (request.path === shipmentPath ? { status: 403 } : undefined);
  await refresh(page).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'هذا العمل غير متاح لك حاليًا.',
  );
  await expect(page.getByText(driverFixtureTracking)).toHaveCount(0);
  await expect(page.locator('a[href="tel:+218920000002"]')).toHaveCount(0);
  driverApi.onRequest = (request) => (request.path === shipmentPath ? { abort: true } : undefined);
  await refresh(page).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'تعذّر الاتصال. تحقق من الشبكة ثم حاول مجددًا.',
  );
  await expect(page.getByText(driverFixtureTracking)).toHaveCount(0);
  await expect(page.locator('a[href="tel:+218920000002"]')).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText('مستلم تجريبي');
});

test('operational 401 clears private content and preserves a safe login return path', async ({
  page,
  driverApi,
}) => {
  await page.goto(shipmentRoute);
  await expect(page.getByRole('main')).toContainText(driverFixtureTracking);
  driverApi.authenticated = false;
  await refresh(page).click();
  await expect(page).toHaveURL(/\/login\?/);
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(shipmentRoute);
  await expect(page.getByText('انتهت جلستك. سجّل الدخول مرة أخرى للمتابعة.')).toBeVisible();
  await expect(page.getByText(driverFixtureTracking)).toHaveCount(0);
  await expectPrivateStorageEmpty(page);
});

test('confirmed logout clears work and a subsequent session cannot inherit previous shipment data', async ({
  page,
  driverApi,
}) => {
  await page.goto(shipmentRoute);
  await expect(page.getByRole('main')).toContainText(driverFixtureTracking);
  await page.getByRole('navigation').getByRole('link', { name: 'الحساب', exact: true }).click();
  await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  expect(
    driverApi.requests.filter((request) => request.path === '/api/v1/auth/logout'),
  ).toHaveLength(1);
  await expect(page.getByText(driverFixtureTracking)).toHaveCount(0);
  driverApi.shipments = [];
  driverApi.trips = [];
  await login(page);
  await expect(page).toHaveURL(/\/driver(?:\/account)?(?:\?|$)/);
  await page
    .getByRole('navigation', { name: 'أقسام مساحة السائق' })
    .getByRole('link', { name: 'الشحنات', exact: true })
    .click();
  await expect(page.getByRole('main')).toContainText('لا توجد شحنات');
  await expect(page.getByText(driverFixtureTracking)).toHaveCount(0);
  await expectPrivateStorageEmpty(page);
});

test('empty assigned work offers refresh without administrative creation controls', async ({
  page,
  driverApi,
}) => {
  driverApi.mode = 'empty';
  await page.goto('/driver/trips');
  await expect(page.getByRole('main')).toContainText(/لا توجد رحلات/);
  await expect(refresh(page)).toBeEnabled();
  await page.getByRole('navigation').getByRole('link', { name: 'الشحنات', exact: true }).click();
  await expect(page.getByRole('main')).toContainText(/لا توجد شحنات/);
  await expect(page.getByRole('button', { name: /إنشاء|إضافة/ })).toHaveCount(0);
});

for (const width of [390, 430, 768, 1440]) {
  test(`driver shipment remains readable at ${width}px with no horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(shipmentRoute);
    await expect(page.getByRole('main')).toContainText(driverFixtureTracking);
    const layout = await page.evaluate(() => ({
      viewport: innerWidth,
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(layout.body).toBeLessThanOrEqual(layout.viewport);
    expect(layout.document).toBeLessThanOrEqual(layout.viewport);
    for (const link of await page.getByRole('navigation').getByRole('link').all()) {
      const box = await link.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`mobile driver detail has no material axe violations in ${colorScheme} mode`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto(shipmentRoute);
    await expect(page.getByRole('main')).toContainText(driverFixtureTracking);
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
