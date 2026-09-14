import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  getAuthMeResponseSchema,
  getAdminReportsQuerySchema,
  getAdminReportsResponseSchema,
  getCitiesResponseSchema,
  getShipmentTypesResponseSchema,
} from '../../src/lib/api/generated';
import { testSessionResponse } from '../unit/auth-fixtures';
import { createPublicOrderFixtures } from '../../scripts/public-order-check-fixtures.mjs';

test('ISA-006 dashboard loading uses valid status semantics at 390px without losing RTL or layout', async ({
  page,
  context,
  baseURL,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const origin = new URL(baseURL!).origin;
  const apiOrigin = 'http://localhost:8080';
  const catalogs = createPublicOrderFixtures(origin, apiOrigin);
  const unexpected: string[] = [];
  const session = getAuthMeResponseSchema.parse({
    ...testSessionResponse,
    data: { ...testSessionResponse.data, permissions: ['reports.view'] },
  });
  // Existing operations.test.tsx report fixture, validated against the frozen API contract.
  const report = getAdminReportsResponseSchema.parse({
    data: {
      from: '2026-09-01',
      to: '2026-09-13',
      generated_at: '2026-09-13T10:00:00Z',
      total_shipments: 18,
      delivered_shipments: 5,
      shipments_by_status: { DELIVERED: 5 },
      shipments_by_origin_city: {},
      shipments_by_destination_city: {},
      shipments_by_date: [{ date: '2026-09-13', total: 3 }],
      active_trips: 2,
      net_revenue: -1250,
      revenue_by_date: [],
      revenue_by_route: [],
      revenue_route_limit: 500,
      currency: 'LYD',
      minor_unit_scale: 3,
    },
    meta: { cache_ttl_seconds: 60, timezone: 'Africa/Tripoli' },
    request_id: testSessionResponse.request_id,
  });
  let releaseReport!: () => void;
  const pendingReport = new Promise<void>((resolve) => {
    releaseReport = resolve;
  });
  const headers = {
    'content-type': 'application/json',
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'cache-control': 'no-store',
  };

  // Every API response is synthetic; no live session, read, or write is used.
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (
      url.origin === origin &&
      !/^\/(api|sanctum)\//.test(url.pathname) &&
      ['GET', 'HEAD'].includes(method)
    )
      return route.continue();
    if (url.origin === apiOrigin && method === 'GET') {
      if (url.pathname === '/api/v1/auth/me')
        return route.fulfill({ status: 200, headers, body: JSON.stringify(session) });
      if (url.pathname === '/api/v1/admin/reports') {
        getAdminReportsQuerySchema.parse(Object.fromEntries(url.searchParams));
        await pendingReport;
        return route.fulfill({ status: 200, headers, body: JSON.stringify(report) });
      }
      if (['/api/v1/cities', '/api/v1/shipment-types'].includes(url.pathname)) {
        const result = await catalogs.resolve(request.url(), method);
        const schema =
          url.pathname === '/api/v1/cities'
            ? getCitiesResponseSchema
            : getShipmentTypesResponseSchema;
        schema.parse(JSON.parse(result.response!.body!));
        return route.fulfill(result.response!);
      }
    }
    unexpected.push(`${method} ${url.origin}${url.pathname}`);
    return route.abort('failed');
  });

  try {
    await page.goto('/dashboard');
    await expect(page.locator('.report-loading')).toBeVisible();
    const loading = page.getByRole('status').filter({ hasText: 'جارٍ تحميل التقرير' });
    await expect(loading).toHaveCount(1);
    await expect(loading).toHaveAttribute('aria-atomic', 'true');
    await expect(loading.locator('.skeleton')).toHaveCount(5);
    await expect(loading.locator('.report-metrics')).toHaveAttribute('aria-hidden', 'true');
    await expect(loading.locator('.report-chart-skeleton')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const layout = await loading.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      animations: [...element.querySelectorAll('.skeleton')].map(
        (skeleton) => getComputedStyle(skeleton).animationName,
      ),
    }));
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewport);
    expect(layout.animations.every((animation) => animation === 'none')).toBe(true);

    // Same WCAG scope as the acceptance scenario; no rule or element exclusions.
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      accessibility.violations.filter((violation) => violation.id === 'aria-prohibited-attr'),
    ).toEqual([]);
    expect(accessibility.violations).toEqual([]);

    releaseReport();
    await expect(loading).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'إجمالي الشحنات', exact: true })).toBeVisible();
    expect(unexpected).toEqual([]);
  } finally {
    releaseReport();
  }
});
