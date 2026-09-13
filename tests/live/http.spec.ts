import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import nextEnv from '@next/env';
import {
  getCitiesResponseSchema,
  getShipmentTypesResponseSchema,
  errorSchema,
} from '../../src/lib/api/generated';

nextEnv.loadEnvConfig(process.cwd());
const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!apiOrigin) throw new Error('Set NEXT_PUBLIC_API_BASE_URL for actual HTTP checks.');

test('actual API catalogs and unauthenticated discovery match the supplied contract', async ({
  request,
}) => {
  for (const [path, schema] of [
    ['/api/v1/cities', getCitiesResponseSchema],
    ['/api/v1/shipment-types', getShipmentTypesResponseSchema],
  ] as const) {
    const response = await request.get(`${apiOrigin}${path}`, {
      headers: { Accept: 'application/json', Origin: 'http://localhost:3000' },
    });
    expect(response.status()).toBe(200);
    expect(schema.safeParse(await response.json()).success).toBe(true);
    expect(response.headers()['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers()['access-control-allow-credentials']).toBe('true');
  }
  const response = await request.get(`${apiOrigin}/api/v1/auth/me`, {
    headers: { Accept: 'application/json', Origin: 'http://localhost:3000' },
  });
  expect(response.status()).toBe(401);
  expect(errorSchema.safeParse(await response.json()).success).toBe(true);
});

test('browser receives readable CSRF cookie and HttpOnly session on the approved hostname', async ({
  page,
  context,
}) => {
  const me = page.waitForResponse((response) => response.url() === `${apiOrigin}/api/v1/auth/me`);
  await page.goto('/login');
  expect((await me).status()).toBe(401);
  await expect(page.getByRole('button', { name: 'تسجيل الدخول', exact: true })).toBeEnabled();
  const cookies = await context.cookies();
  expect(
    cookies.some(
      (cookie) => cookie.name === 'XSRF-TOKEN' && cookie.domain === 'localhost' && !cookie.httpOnly,
    ),
  ).toBe(true);
  expect(
    cookies.some(
      (cookie) => cookie.domain === 'localhost' && cookie.httpOnly && cookie.sameSite === 'Lax',
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      document.cookie.split(';').some((part) => part.trim().startsWith('XSRF-TOKEN=')),
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('private route redirects an actual unauthenticated session and preserves safe filters', async ({
  page,
}) => {
  await page.goto('/shipments?status=IN_TRANSIT');
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fshipments%3Fstatus%3DIN_TRANSIT/);
  await expect(page.getByRole('button', { name: 'تسجيل الدخول', exact: true })).toBeEnabled();
});
