import { expect, test } from '@playwright/test';
import nextEnv from '@next/env';
import {
  getCitiesResponseSchema,
  getShipmentTypesResponseSchema,
} from '../../src/lib/api/generated';

nextEnv.loadEnvConfig(process.cwd());
const origin = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!origin) throw new Error('Approved API origin is required for live checks.');

test('public booking opens with real catalogs and no staff identity or admin request', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin === origin)
      requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  const cityResponse = page.waitForResponse(`${origin}/api/v1/cities`);
  const typeResponse = page.waitForResponse(`${origin}/api/v1/shipment-types`);
  await page.goto('/order');
  await expect(page.getByRole('heading', { name: 'طلب شحن', exact: true })).toBeVisible();
  expect((await cityResponse).status()).toBe(200);
  expect((await typeResponse).status()).toBe(200);
  const cities = getCitiesResponseSchema.parse(await (await cityResponse).json()).data;
  const types = getShipmentTypesResponseSchema.parse(await (await typeResponse).json()).data;
  if (cities.length && types.length) {
    await expect(page.getByLabel('مدينة الإرسال', { exact: true })).toBeEnabled();
  } else {
    await expect(page.getByRole('heading', { name: 'الحجز غير متاح حاليًا' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'مراجعة الطلب', exact: true })).toBeDisabled();
  }
  // Development Strict Mode may cancel/remount a catalog observer; every request stays public/read-only.
  expect([...new Set(requests)].sort()).toEqual([
    'GET /api/v1/cities',
    'GET /api/v1/shipment-types',
  ]);
  await expect(page.getByRole('navigation')).toHaveCount(0);
});
