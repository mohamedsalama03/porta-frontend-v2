import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  getCitiesResponseSchema,
  getShipmentTypesResponseSchema,
  postOrdersBodySchema,
  postOrdersResponseSchema,
  postQuotesResponseSchema,
} from '../../src/lib/api/generated';
import { formatMoney } from '../../src/lib/formatters';

const origin = process.env.NEXT_PUBLIC_API_BASE_URL;
const qaPrefix = process.env.PORTA_PUBLIC_QA_PREFIX;
if (!origin || !qaPrefix?.startsWith('PORTA-QA-'))
  throw new Error('Approved API and QA prefix required.');
const output = 'reports/public-order/live';

test('one disposable public UI booking uses the authoritative quote and suppresses duplicate clicks', async ({
  page,
}) => {
  // Resuming acceptance cannot silently create another shipment with the same QA run marker.
  try {
    const previous = JSON.parse(await readFile(`${output}/acceptance.json`, 'utf8'));
    if (previous.qaPrefix === qaPrefix && previous.creationStarted) {
      throw new Error(
        'This QA booking was already attempted. Inspect its evidence before starting another run.',
      );
    }
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  await mkdir(output, { recursive: true });
  const requests: { method: string; path: string }[] = [];
  let orderRequests = 0;
  let keyHash: string | null = null;
  let sentPayloadIsExact = false;
  const allowed = new Set([
    'GET /api/v1/cities',
    'GET /api/v1/shipment-types',
    'GET /sanctum/csrf-cookie',
    'POST /api/v1/quotes',
    'POST /api/v1/orders',
  ]);
  await page.route(`${origin}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') {
      await route.continue();
      return;
    }
    requests.push({ method: request.method(), path });
    if (!allowed.has(`${request.method()} ${path}`)) {
      await route.abort();
      return;
    }
    if (path === '/api/v1/orders') {
      orderRequests += 1;
      if (orderRequests > 1) {
        await route.abort();
        return;
      }
      const body = postOrdersBodySchema.parse(request.postDataJSON());
      sentPayloadIsExact =
        body.sender_name.startsWith(qaPrefix!) &&
        body.recipient_name.startsWith(qaPrefix!) &&
        !Object.hasOwn(body, 'branch_id') &&
        !Object.hasOwn(body, 'final_price');
      const key = request.headers()['idempotency-key'];
      expect(key).toMatch(/^[a-f0-9-]{36}$/i);
      expect(request.headers()['x-xsrf-token']).toBeTruthy();
      keyHash = createHash('sha256').update(key).digest('hex');
      // Evidence is persisted before the one permitted real mutation; failures never auto-retry.
      await writeFile(
        `${output}/acceptance.json`,
        JSON.stringify(
          {
            qaPrefix,
            creationStarted: true,
            startedAt: new Date().toISOString(),
            status: 'PENDING_VERIFICATION',
            keyHash,
          },
          null,
          2,
        ),
      );
    }
    await route.continue();
  });
  const cityResponse = page.waitForResponse(`${origin}/api/v1/cities`);
  const typeResponse = page.waitForResponse(`${origin}/api/v1/shipment-types`);
  await page.goto('/order');
  const cities = getCitiesResponseSchema.parse(await (await cityResponse).json()).data;
  const types = getShipmentTypesResponseSchema.parse(await (await typeResponse).json()).data;
  const source = cities.find((city) => city.code === 'QA0913A1715');
  const destination = cities.find((city) => city.code === 'QA0913B1715');
  const type = types.find((type) => type.code === 'QA0913T1715');
  expect(source?.name_ar).toContain('PORTA-QA-');
  expect(destination?.name_ar).toContain('PORTA-QA-');
  expect(type?.name_ar).toContain('PORTA-QA-');
  await page.getByLabel('اسم المرسل', { exact: true }).fill(`${qaPrefix}-مرسل-تجريبي`);
  await page.getByLabel('هاتف المرسل', { exact: true }).fill('0910000001');
  await page.getByLabel('اسم المستلم', { exact: true }).fill(`${qaPrefix}-مستلم-تجريبي`);
  await page.getByLabel('هاتف المستلم', { exact: true }).fill('0920000002');
  await page.getByLabel('مدينة الإرسال', { exact: true }).selectOption(source!.id);
  await page.getByLabel('مدينة الاستلام', { exact: true }).selectOption(destination!.id);
  const quoteResponse = page.waitForResponse(`${origin}/api/v1/quotes`);
  await page.getByLabel('نوع الشحنة', { exact: true }).selectOption(type!.id);
  await page.getByLabel('الوزن (كجم)', { exact: false }).fill('2.125');
  await page
    .getByRole('textbox', { name: 'ملاحظات (اختياري)', exact: true })
    .fill(`${qaPrefix} disposable public acceptance; no real cargo.`);
  const quoteHttp = await quoteResponse;
  expect(quoteHttp.status()).toBe(200);
  const quote = postQuotesResponseSchema.parse(await quoteHttp.json()).data;
  await expect(page.locator('.public-order-total')).toHaveText(formatMoney(quote.final_price));
  await page.getByRole('button', { name: 'مراجعة الطلب', exact: true }).click();
  await expect(page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true })).toBeEnabled();
  await page.screenshot({ path: `${output}/review-390.png`, fullPage: true });
  const orderResponse = page.waitForResponse(`${origin}/api/v1/orders`);
  await page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true }).dblclick();
  const orderHttp = await orderResponse;
  expect(orderHttp.status()).toBe(201);
  const created = postOrdersResponseSchema.parse(await orderHttp.json()).data;
  await expect(page.getByRole('heading', { name: 'تم تسجيل طلب الشحن' })).toBeVisible();
  await expect(page.locator('.public-order-tracking-number')).toHaveText(created.tracking_number);
  await expect(page.locator('.public-order-success-price')).toContainText(
    formatMoney(created.final_price),
  );
  expect(orderRequests).toBe(1);
  expect(sentPayloadIsExact).toBe(true);
  expect(requests.every(({ method, path }) => allowed.has(`${method} ${path}`))).toBe(true);
  await page.screenshot({ path: `${output}/success-390.png`, fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'سبق تأكيد طلب الشحن' })).toBeVisible();
  expect(orderRequests).toBe(1);
  expect(new URL(page.url()).search).toBe('');
  await writeFile(
    `${output}/acceptance.json`,
    JSON.stringify(
      {
        qaPrefix,
        creationStarted: true,
        completedAt: new Date().toISOString(),
        status: 'PASS',
        quote: {
          httpStatus: quoteHttp.status(),
          finalPrice: quote.final_price,
          currency: quote.currency,
        },
        created: {
          httpStatus: orderHttp.status(),
          trackingNumber: created.tracking_number,
          finalPrice: created.final_price,
          currency: created.currency,
          currentStatus: created.current_status,
        },
        orderRequests,
        keyHash,
        csrfHeaderPresent: true,
        generatedPayloadValid: sentPayloadIsExact,
        noStaffRequests: true,
        refreshDidNotResubmit: true,
        requests,
        lifecycleWrites: 0,
        financialWrites: 0,
      },
      null,
      2,
    ),
  );
});
