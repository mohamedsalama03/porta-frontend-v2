import { expect, test as base, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  getDriverTripsTripResponseSchema,
  postDriverTripsTripStartBodySchema,
  postDriverTripsTripArriveBodySchema,
  postDriverTripsTripCompleteBodySchema,
} from '../../src/lib/api/generated';
import {
  createDriverFixtures,
  driverEnvelope,
  driverErrorFixture,
  driverFixtureCsrf,
  driverFixtureIds as ids,
  driverTripFixture,
} from '../../scripts/driver-check-fixtures.mjs';

// All session, trip, and shipment traffic is intercepted. No synthetic write reaches HTTP.
type DriverApi = ReturnType<typeof createDriverFixtures>['state'];
const tripPath = `/api/v1/driver/trips/${ids.trip}`;
const tripRoute = `/driver/trips/${ids.trip}`;
const shipmentRoute = `/driver/shipments/${ids.shipment}`;
const actions = {
  START: { label: 'بدء الرحلة', confirm: 'تأكيد بدء الرحلة', suffix: 'start' },
  CONFIRM_ARRIVAL: {
    label: 'تأكيد الوصول',
    confirm: 'تأكيد الوصول إلى الوجهة',
    suffix: 'arrive',
  },
  COMPLETE: { label: 'إكمال الرحلة', confirm: 'تأكيد إكمال الرحلة', suffix: 'complete' },
} as const;
type TripAction = keyof typeof actions;
const area = (page: Page) => page.getByRole('region', { name: 'إجراءات الرحلة', exact: true });
const button = (page: Page, action: TripAction) =>
  page.getByRole('button', { name: actions[action].label, exact: true });
const refresh = (page: Page) =>
  page.getByRole('button', { name: 'تحديث البيانات', exact: true }).first();
const writes = (api: DriverApi) =>
  api.requests.filter(
    (request) => request.method === 'POST' && /\/(start|arrive|complete)$/.test(request.path),
  );
const detailReads = (api: DriverApi) =>
  api.requests.filter((request) => request.method === 'GET' && request.path === tripPath);
const listReads = (api: DriverApi) =>
  api.requests.filter(
    (request) => request.method === 'GET' && request.path === '/api/v1/driver/trips',
  );
const response = (api: DriverApi, capabilities = api.tripActions[ids.trip] ?? []) =>
  driverEnvelope(api.trips[0], { allowed_actions: capabilities });
async function confirm(page: Page, action: TripAction) {
  await button(page, action).click();
  await expect(
    area(page).getByRole('heading', { name: actions[action].label, exact: true }),
  ).toBeFocused();
  await expect(area(page)).toContainText('طرابلس');
  await expect(area(page)).toContainText('بنغازي');
  return area(page).getByRole('button', { name: actions[action].confirm, exact: true });
}
async function login(page: Page) {
  await page.getByLabel('البريد الإلكتروني', { exact: true }).fill('driver@example.test');
  await page.getByLabel('كلمة المرور', { exact: true }).fill('synthetic-trip-test-password');
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click();
}
const test = base.extend<{ driverApi: DriverApi }>({
  driverApi: [
    async ({ context, baseURL }, use) => {
      const fixture = createDriverFixtures(new URL(baseURL!).origin);
      getDriverTripsTripResponseSchema.parse(
        driverEnvelope(driverTripFixture(), { allowed_actions: [] }),
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
        if (url.origin === 'http://localhost:8080' && method === 'POST') {
          expect(headers.authorization).toBeUndefined();
          expect(headers['x-xsrf-token']).toBe(driverFixtureCsrf);
          if (/\/(start|arrive|complete)$/.test(url.pathname)) {
            expect(headers['idempotency-key']).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
            expect(body).toEqual({});
            const schema = url.pathname.endsWith('/start')
              ? postDriverTripsTripStartBodySchema
              : url.pathname.endsWith('/arrive')
                ? postDriverTripsTripArriveBodySchema
                : postDriverTripsTripCompleteBodySchema;
            schema.parse(body);
          }
        }
        const result = await fixture.resolve(request.url(), method, { headers, body });
        if (result.kind === 'continue') return route.continue();
        if (result.kind === 'abort') return route.abort('failed');
        return route.fulfill(result.response!);
      });
      await use(fixture.state);
      expect(fixture.state.unexpected, 'No unapproved API, origin, or request shape').toEqual([]);
    },
    { auto: true },
  ],
});

test('lowercase trip links use canonical response identity for confirmed actions', async ({
  page,
  driverApi,
}) => {
  driverApi.tripActions[ids.trip] = ['START'];
  driverApi.onRequest = (request) => {
    if (request.method === 'GET' && request.path === tripPath.toLowerCase())
      return { json: response(driverApi) };
    if (request.method === 'POST' && request.path === `${tripPath}/start`) {
      driverApi.trips[0] = { ...driverApi.trips[0], status: 'DEPARTED' };
      driverApi.tripActions[ids.trip] = [];
      return { json: response(driverApi) };
    }
  };
  await page.goto(tripRoute.toLowerCase());
  await (await confirm(page, 'START')).click();
  await expect(
    area(page).getByRole('heading', { name: 'تم بدء الرحلة بنجاح.', exact: true }),
  ).toBeVisible();
  await expect(area(page)).toContainText('لا توجد إجراءات متاحة حاليًا.');
  expect(writes(driverApi)).toHaveLength(1);
  expect(writes(driverApi)[0].path).toBe(`${tripPath}/start`);
  expect(detailReads(driverApi).length).toBeGreaterThanOrEqual(1);
});

for (const status of ['SCHEDULED', 'LOADING', 'DEPARTED', 'ARRIVED', 'COMPLETED', 'CANCELLED']) {
  test(`${status} with empty metadata exposes no trip mutation`, async ({ page, driverApi }) => {
    driverApi.trips[0].status = status;
    await page.goto(tripRoute);
    await expect(page.getByRole('heading', { name: 'تفاصيل الرحلة', exact: true })).toBeVisible();
    await expect(page.getByRole('main')).toContainText('طرابلس');
    for (const action of Object.keys(actions) as TripAction[])
      await expect(button(page, action)).toHaveCount(0);
    expect(writes(driverApi)).toHaveLength(0);
  });
}

for (const action of Object.keys(actions) as TripAction[]) {
  test(`${action} is discovered only from metadata even on a SCHEDULED display status`, async ({
    page,
    driverApi,
  }) => {
    driverApi.trips[0].status = 'SCHEDULED';
    driverApi.tripActions[ids.trip] = [action];
    // Trip operations declare no additional permission. Do not invent trips.update.
    driverApi.session.data.permissions = [];
    await page.goto(tripRoute);
    await expect(button(page, action)).toBeVisible();
    for (const other of Object.keys(actions) as TripAction[])
      if (other !== action) await expect(button(page, other)).toHaveCount(0);
    await expect(area(page)).not.toContainText('PRIVATE_');
    expect(writes(driverApi)).toHaveLength(0);
  });
}

test('multiple capabilities remain available only on current detail and manual refresh removes them', async ({
  page,
  driverApi,
}) => {
  driverApi.tripActions[ids.trip] = ['COMPLETE', 'START', 'CONFIRM_ARRIVAL'];
  await page.goto('/driver');
  for (const action of Object.keys(actions) as TripAction[])
    await expect(button(page, action)).toHaveCount(0);
  await page.getByRole('navigation').getByRole('link', { name: 'الرحلات', exact: true }).click();
  for (const action of Object.keys(actions) as TripAction[])
    await expect(button(page, action)).toHaveCount(0);
  await page.locator(`a[href="${tripRoute}"]`).click();
  for (const action of Object.keys(actions) as TripAction[])
    await expect(button(page, action)).toBeVisible();
  driverApi.tripActions[ids.trip] = [];
  await refresh(page).click();
  for (const action of Object.keys(actions) as TripAction[])
    await expect(button(page, action)).toHaveCount(0);
  expect(writes(driverApi)).toHaveLength(0);
});

for (const [name, metadata] of [
  ['unknown action', { allowed_actions: ['REASSIGN'] }],
  ['duplicate action', { allowed_actions: ['START', 'START'] }],
  ['missing actions', {}],
] as const) {
  test(`${name} metadata fails closed without rendering unapproved controls`, async ({
    page,
    driverApi,
  }) => {
    driverApi.onRequest = (request) =>
      request.path === tripPath
        ? { json: driverEnvelope(driverApi.trips[0], metadata) }
        : undefined;
    await page.goto(tripRoute);
    await expect(page.getByRole('main').getByRole('alert')).toContainText('الخدمة غير متاحة');
    for (const action of Object.keys(actions) as TripAction[])
      await expect(button(page, action)).toHaveCount(0);
    await expect(page.getByRole('main')).not.toContainText('REASSIGN');
    expect(writes(driverApi)).toHaveLength(0);
  });
}

test('cancel and Escape return focus without sending a request', async ({ page, driverApi }) => {
  driverApi.tripActions[ids.trip] = ['START'];
  await page.goto(tripRoute);
  await confirm(page, 'START');
  await area(page).getByRole('button', { name: 'رجوع', exact: true }).click();
  await expect(button(page, 'START')).toBeFocused();
  await confirm(page, 'START');
  await page.keyboard.press('Escape');
  await expect(button(page, 'START')).toBeFocused();
  expect(writes(driverApi)).toHaveLength(0);
});

test('metadata drives START, arrival, shipment actions, and COMPLETE with authoritative cascades', async ({
  page,
  driverApi,
}) => {
  driverApi.trips = [{ ...driverTripFixture(), status: 'LOADING', shipments_count: 1 }];
  driverApi.shipments = [driverApi.shipments[0]];
  driverApi.shipments[0].current_status = 'PREPARING';
  driverApi.tripActions[ids.trip] = ['START'];
  let releaseStart!: () => void;
  const pendingStart = new Promise<void>((resolve) => {
    releaseStart = resolve;
  });
  driverApi.onRequest = async (request) => {
    if (request.method !== 'POST') return;
    if (request.path === `${tripPath}/start`) {
      await pendingStart;
      driverApi.trips[0].status = 'DEPARTED';
      driverApi.shipments[0].current_status = 'IN_TRANSIT';
      driverApi.tripActions[ids.trip] = ['CONFIRM_ARRIVAL'];
      // Mutation metadata deliberately differs from the fresh detail snapshot.
      return { json: response(driverApi, []) };
    }
    if (request.path === `${tripPath}/arrive`) {
      driverApi.trips[0].status = 'ARRIVED';
      driverApi.shipments[0].current_status = 'ARRIVED_CITY';
      driverApi.tripActions[ids.trip] = [];
      return { json: response(driverApi) };
    }
    if (request.path.endsWith('/status')) {
      const target = (request.body as { status: string }).status;
      driverApi.shipments[0].current_status = target;
      if (target === 'DELIVERED') driverApi.tripActions[ids.trip] = ['COMPLETE'];
      return { json: driverEnvelope(driverApi.shipments[0]) };
    }
    if (request.path === `${tripPath}/complete`) {
      driverApi.trips[0].status = 'COMPLETED';
      driverApi.tripActions[ids.trip] = [];
      return { json: response(driverApi) };
    }
  };
  await page.goto(tripRoute);
  const start = await confirm(page, 'START');
  await start.click({ clickCount: 2 });
  await expect.poll(() => writes(driverApi).length).toBe(1);
  await expect(area(page)).toContainText(/جارٍ/);
  await expect(page.getByRole('main')).toContainText('قيد التحميل');
  await expect(page.getByRole('main').getByRole('list')).toContainText('قيد التجهيز');
  await expect(page.getByRole('main').getByRole('list')).not.toContainText('في الطريق');
  releaseStart();
  await expect(button(page, 'CONFIRM_ARRIVAL')).toBeVisible();
  await expect(page.getByRole('main')).toContainText('غادرت');
  await expect(page.getByRole('main').getByRole('list')).toContainText('في الطريق');
  expect(detailReads(driverApi)).toHaveLength(2);
  await (await confirm(page, 'CONFIRM_ARRIVAL')).click();
  await expect(button(page, 'CONFIRM_ARRIVAL')).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('list')).toContainText('وصلت للمدينة');
  await expect(button(page, 'COMPLETE')).toHaveCount(0);
  const readsBeforeShipment = detailReads(driverApi).length;
  await page.locator(`a[href="${shipmentRoute}"]`).click();
  const shipmentArea = page.getByRole('region', { name: 'إجراءات الشحنة', exact: true });
  for (const label of ['تأكيد جاهزية الاستلام', 'تأكيد تسليم الشحنة']) {
    await shipmentArea.getByRole('button', { name: label, exact: true }).click();
    await shipmentArea.getByRole('button', { name: 'تأكيد الإجراء', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'تم تحديث حالة الشحنة', exact: true }),
    ).toBeVisible();
  }
  await expect.poll(() => detailReads(driverApi).length).toBeGreaterThan(readsBeforeShipment);
  await page.locator(`a[href="${tripRoute}"]`).click();
  await expect(button(page, 'COMPLETE')).toBeVisible();
  await (await confirm(page, 'COMPLETE')).click();
  await expect(page.getByRole('main')).toContainText('مكتملة');
  for (const action of Object.keys(actions) as TripAction[])
    await expect(button(page, action)).toHaveCount(0);
  expect(writes(driverApi).map((request) => request.path)).toEqual(
    ['start', 'arrive', 'complete'].map((suffix) => `${tripPath}/${suffix}`),
  );
  expect(new Set(writes(driverApi).map((request) => request.idempotencyKey)).size).toBe(3);
  for (const request of writes(driverApi)) expect(request.body).toEqual({});
});

test('replayed success with stale capabilities waits for fresh detail before another action', async ({
  page,
  driverApi,
}) => {
  driverApi.tripActions[ids.trip] = ['START'];
  let release!: () => void;
  const fresh = new Promise<void>((resolve) => {
    release = resolve;
  });
  driverApi.onRequest = async (request) => {
    if (request.path === `${tripPath}/start`) {
      driverApi.trips[0].status = 'DEPARTED';
      return { json: response(driverApi, ['START']), headers: { 'idempotency-replayed': 'true' } };
    }
    if (request.path === tripPath && writes(driverApi).length) {
      await fresh;
      return { json: response(driverApi, ['CONFIRM_ARRIVAL']) };
    }
  };
  await page.goto(tripRoute);
  await (await confirm(page, 'START')).click();
  await expect.poll(() => detailReads(driverApi).length).toBe(2);
  await expect(button(page, 'START')).toHaveCount(0);
  await expect(button(page, 'CONFIRM_ARRIVAL')).toHaveCount(0);
  release();
  await expect(button(page, 'CONFIRM_ARRIVAL')).toBeVisible();
  expect(writes(driverApi)).toHaveLength(1);
});

test('409 immediately refreshes metadata and removes stale START without automatic retry', async ({
  page,
  driverApi,
}) => {
  driverApi.tripActions[ids.trip] = ['START'];
  driverApi.onRequest = (request) => {
    if (request.path === `${tripPath}/start`) {
      driverApi.tripActions[ids.trip] = [];
      return { status: 409, json: driverErrorFixture() };
    }
  };
  await page.goto(tripRoute);
  await (await confirm(page, 'START')).click();
  await expect(area(page).getByRole('alert')).toContainText(
    'تم تحديث حالة الرحلة. يرجى مراجعة البيانات الحالية.',
  );
  await expect(button(page, 'START')).toHaveCount(0);
  expect(detailReads(driverApi)).toHaveLength(2);
  expect(writes(driverApi)).toHaveLength(1);
  await expect(page.getByRole('main')).not.toContainText('PRIVATE_BACKEND_TRACE');
});

test('404 revokes actionable detail and refreshes assigned lists without Admin fallback', async ({
  page,
  driverApi,
}) => {
  driverApi.trips[0].origin_city.name_ar = 'مدينة الرحلة المسحوبة';
  driverApi.tripActions[ids.trip] = ['START'];
  await page.goto('/driver/trips');
  await page.locator(`a[href="${tripRoute}"]`).click();
  const listsBefore = listReads(driverApi).length;
  driverApi.onRequest = (request) => {
    if (request.path === `${tripPath}/start`) {
      driverApi.trips = [driverApi.trips[1]];
      return { status: 404, json: driverErrorFixture() };
    }
  };
  await button(page, 'START').click();
  await area(page).getByRole('button', { name: actions.START.confirm, exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'هذا العمل غير متاح لك حاليًا.',
  );
  await expect(page.getByRole('main')).not.toContainText('مدينة الرحلة المسحوبة');
  await expect(button(page, 'START')).toHaveCount(0);
  await expect.poll(() => listReads(driverApi).length).toBeGreaterThan(listsBefore);
  await page.getByRole('link', { name: 'العودة إلى الرحلات', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'رحلاتي', exact: true })).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText('مدينة الرحلة المسحوبة');
  expect(driverApi.requests.some((request) => request.path.includes('/admin/'))).toBe(false);
  expect(writes(driverApi)).toHaveLength(1);
});

for (const outcome of ['network', '503', '429'] as const) {
  test(`${outcome} retains one immutable attempt and retries only after deliberate interaction`, async ({
    page,
    driverApi,
  }) => {
    await page.clock.install();
    driverApi.tripActions[ids.trip] = ['START'];
    driverApi.onRequest = (request) => {
      if (request.path !== `${tripPath}/start`) return;
      if (writes(driverApi).length === 1)
        return outcome === 'network'
          ? { abort: true }
          : {
              status: Number(outcome),
              json: driverErrorFixture(),
              headers: outcome === '429' ? { 'retry-after': '3' } : undefined,
            };
      driverApi.trips[0].status = 'DEPARTED';
      driverApi.tripActions[ids.trip] = [];
      return { json: response(driverApi) };
    };
    await page.goto(tripRoute);
    await (await confirm(page, 'START')).click();
    const retry = area(page).getByRole('button', { name: 'إعادة المحاولة', exact: true });
    await expect(retry).toBeVisible();
    if (outcome === '429') await expect(retry).toBeDisabled();
    await page.clock.fastForward(4000);
    await expect(retry).toBeEnabled();
    expect(writes(driverApi)).toHaveLength(1);
    await retry.click();
    await expect(page.getByRole('main')).toContainText('غادرت');
    expect(writes(driverApi)).toHaveLength(2);
    expect(writes(driverApi)[1]).toEqual(writes(driverApi)[0]);
    await expect(page.getByRole('main')).not.toContainText('PRIVATE_BACKEND_TRACE');
  });
}

test('422 preserves authoritative status and shows safe feedback without raw validation', async ({
  page,
  driverApi,
}) => {
  driverApi.tripActions[ids.trip] = ['START'];
  driverApi.onRequest = (request) =>
    request.path === `${tripPath}/start`
      ? { status: 422, json: { ...driverErrorFixture(), errors: { notes: ['PRIVATE_RULE'] } } }
      : undefined;
  await page.goto(tripRoute);
  await (await confirm(page, 'START')).click();
  await expect(area(page).getByRole('alert')).toContainText(/تعذّر قبول|راجع/);
  await expect(page.getByRole('main')).not.toContainText(/PRIVATE_RULE|PRIVATE_BACKEND_TRACE/);
  expect(writes(driverApi)).toHaveLength(1);
});

for (const sessionEnd of ['logout', 'expiry'] as const) {
  test(`${sessionEnd} clears uncertain attempts before another driver session`, async ({
    page,
    driverApi,
  }) => {
    driverApi.tripActions[ids.trip] = ['START'];
    driverApi.onRequest = (request) =>
      request.path === `${tripPath}/start` ? { abort: true } : undefined;
    await page.goto(tripRoute);
    await (await confirm(page, 'START')).click();
    await expect(
      area(page).getByRole('button', { name: 'إعادة المحاولة', exact: true }),
    ).toBeVisible();
    const previousKey = writes(driverApi)[0].idempotencyKey;
    if (sessionEnd === 'logout') {
      await page.getByRole('navigation').getByRole('link', { name: 'الحساب', exact: true }).click();
      await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
    } else {
      driverApi.authenticated = false;
      await refresh(page).click();
    }
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    driverApi.onRequest = undefined;
    driverApi.session.data.id = '01ARZ3NDEKTSV4RRFFQ69G5FAH';
    driverApi.session.data.name = 'سائق جلسة جديدة';
    await login(page);
    if (!page.url().endsWith(tripRoute)) {
      await page
        .getByRole('navigation')
        .getByRole('link', { name: 'الرحلات', exact: true })
        .click();
      await page.locator(`a[href="${tripRoute}"]`).click();
    }
    await expect(button(page, 'START')).toBeVisible();
    await expect(
      area(page).getByRole('button', { name: 'إعادة المحاولة', exact: true }),
    ).toHaveCount(0);
    await (await confirm(page, 'START')).click();
    await expect.poll(() => writes(driverApi).length).toBe(2);
    expect(writes(driverApi)[1].idempotencyKey).not.toBe(previousKey);
    const storage = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    expect(storage).not.toContain(previousKey!);
    expect(storage).not.toContain('synthetic-trip-test-password');
  });
}

for (const width of [390, 430, 768, 1440]) {
  test(`trip confirmation retains context, 48px targets, and no overflow at ${width}px`, async ({
    page,
    driverApi,
  }) => {
    driverApi.tripActions[ids.trip] = ['START'];
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(tripRoute);
    const target = await confirm(page, 'START');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const box = await target.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(48);
    const overflow = await page.evaluate(
      () => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(area(page)).toContainText('وصلت');
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`trip confirmation keyboard and accessibility checks pass in ${colorScheme} mode`, async ({
    page,
    driverApi,
  }) => {
    driverApi.tripActions[ids.trip] = ['START'];
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto(tripRoute);
    await button(page, 'START').focus();
    await page.keyboard.press('Enter');
    await expect(
      area(page).getByRole('heading', { name: actions.START.label, exact: true }),
    ).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(button(page, 'START')).toBeFocused();
  });
}
