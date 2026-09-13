import { expect, test } from '@playwright/test';
import nextEnv from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getTrackingTrackingNumberResponseSchema } from '../../src/lib/api/generated';
import { trackingStatusPresentation } from '../../src/features/public-tracking/status';

nextEnv.loadEnvConfig(process.cwd());
const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!apiOrigin) throw new Error('Approved API origin is required for public tracking acceptance.');
const trackingNumber = 'PTA-260913-9B906F9B74FA87ED';
const trackingPath = `/api/v1/tracking/${trackingNumber}`;

test('existing disposable order is publicly readable without staff requests and refresh remains read-only', async ({
  page,
  context,
  baseURL,
}) => {
  const frontend = new URL(baseURL!).origin;
  const allowed: { method: string; path: string; authorizationPresent: boolean }[] = [];
  const blocked: { method: string; path: string }[] = [];
  // BrowserContext is fresh per test. Never import the staff storage state or read private admin data.
  expect((await context.cookies()).length, 'Tracking starts without any stored session').toBe(0);
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === frontend && !/^\/(api|sanctum)\//.test(url.pathname))
      return route.continue();
    if (
      url.origin !== apiOrigin ||
      url.pathname !== trackingPath ||
      url.search ||
      request.method() !== 'GET' ||
      allowed.length >= 2
    ) {
      blocked.push({ method: request.method(), path: '[unapproved request path withheld]' });
      return route.abort('blockedbyclient');
    }
    allowed.push({
      method: request.method(),
      path: url.pathname,
      authorizationPresent: Boolean(request.headers().authorization),
    });
    return route.continue();
  });
  const summary: Record<string, unknown> = {
    trackingNumber,
    readOnly: true,
    anonymousContext: true,
    operation: 'GET /api/v1/tracking/{trackingNumber}',
    startedAt: new Date().toISOString(),
  };
  const output = path.resolve('reports/public-tracking/live');
  await mkdir(output, { recursive: true });
  try {
    const responsePromise = page.waitForResponse(`${apiOrigin}${trackingPath}`);
    await page.goto(`/track?number=${trackingNumber}`);
    const response = await responsePromise;
    summary.lookupHttpStatus = response.status();
    expect(
      response.status(),
      'Existing disposable QA tracking must remain available; no substitute order is created',
    ).toBe(200);
    const parsed = getTrackingTrackingNumberResponseSchema.safeParse(await response.json());
    summary.contractValid = parsed.success;
    expect(parsed.success, 'Public response must match the generated strict allowlist').toBe(true);
    if (!parsed.success) return;
    // Persist only approved enum/count/field names, never raw body, customer data, tokens or private headers.
    summary.currentStatus = parsed.data.data.current_status;
    summary.timelineEventCount = parsed.data.data.tracking_timeline.length;
    summary.responseFields = Object.keys(parsed.data.data).sort();
    expect(parsed.data.data.tracking_number === trackingNumber).toBe(true);
    await expect(
      page.getByRole('heading', {
        level: 2,
        exact: true,
        name: trackingStatusPresentation[parsed.data.data.current_status].label,
      }),
    ).toBeVisible();
    await expect(page.getByRole('main')).toContainText(trackingNumber);
    await expect(page.getByRole('button', { name: 'تحديث الحالة', exact: true })).toBeEnabled();
    await expect(page.locator('.application-shell, .shell-sidebar')).toHaveCount(0);
    await expect(page.getByRole('navigation')).toHaveCount(0);
    const privacyDom = await page.locator('.tracking-result').evaluate((element, number) => {
      // Examine text and hidden attributes locally; only booleans leave the browser.
      const rendered = element.outerHTML.replaceAll(number, '');
      return {
        noPrivateFieldLabels:
          !/sender_phone|recipient_phone|sender_name|recipient_name|assigned_driver_id|shipment_id|staff_id|actor_id|payment_ledger|audit_metadata|internal_notes|هاتف المرسل|هاتف المستلم|اسم المرسل|اسم المستلم|رقم الهاتف|اسم السائق|هاتف السائق|ملاحظات داخلية|سجل المدفوعات|سجل التدقيق|authorization|bearer\s/i.test(
            rendered,
          ),
        noInternalIdentifiers:
          !/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b|\b[0-9A-HJKMNP-TV-Z]{26}\b/i.test(
            rendered,
          ),
        noPrivatePhoneValues: !/(?:\+218|00218|\b0)9[1-6][0-9]{7}\b/.test(rendered),
      };
    }, trackingNumber);
    summary.privacyDomChecks = privacyDom;
    summary.privacyDomPassed = Object.values(privacyDom).every(Boolean);
    expect(
      summary.privacyDomPassed,
      'Rendered tracking contains no private labels, phone values or internal identifiers',
    ).toBe(true);
    await expect(page.getByRole('list', { name: 'سجل الشحنة' }).getByRole('listitem')).toHaveCount(
      parsed.data.data.tracking_timeline.length,
    );
    const refreshPromise = page.waitForResponse(`${apiOrigin}${trackingPath}`);
    await page.getByRole('button', { name: 'تحديث الحالة', exact: true }).click();
    const refreshed = await refreshPromise;
    summary.refreshHttpStatus = refreshed.status();
    expect(refreshed.status()).toBe(200);
    const refreshedParsed = getTrackingTrackingNumberResponseSchema.safeParse(
      await refreshed.json(),
    );
    summary.refreshContractValid = refreshedParsed.success;
    expect(refreshedParsed.success).toBe(true);
    await expect(page.getByRole('button', { name: 'تحديث الحالة', exact: true })).toBeEnabled();
    expect(allowed).toHaveLength(2);
    expect(
      allowed.every((request) => request.method === 'GET' && !request.authorizationPresent),
    ).toBe(true);
    expect(blocked).toEqual([]);
    const storage = await page.evaluate(() =>
      JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
    );
    expect(storage.includes(trackingNumber)).toBe(false);
    summary.trackingPersisted = false;
    summary.result = 'PASS';
  } finally {
    await writeFile(
      path.join(output, 'acceptance.json'),
      `${JSON.stringify(
        {
          ...summary,
          requests: allowed,
          blockedRequests: blocked,
          completedAt: new Date().toISOString(),
          result: summary.result ?? 'NOT PASSED',
        },
        null,
        2,
      )}\n`,
    );
  }
});
