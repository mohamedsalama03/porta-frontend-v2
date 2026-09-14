import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  createDriverFixtures,
  driverFixtureIds,
  driverFixtureTracking,
} from './driver-check-fixtures.mjs';

function localOrigin(value, label) {
  const parsed = new URL(value);
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== '/'
  )
    throw new Error(`${label} must be a local HTTP origin.`);
  return parsed.origin;
}
const base = localOrigin(process.env.PORTA_DRIVER_CHECK_URL || 'http://localhost:3000', 'Frontend');
const apiOrigin = localOrigin(
  process.env.PORTA_DRIVER_CHECK_API_ORIGIN || 'http://localhost:8080',
  'API',
);
const output = 'reports/driver-interface/visual';
const states = [
  'home',
  'trips',
  'trip-detail',
  'shipments',
  'shipment-detail',
  'empty',
  'error',
  'confirmation',
];
const paths = {
  home: '/driver',
  trips: '/driver/trips',
  'trip-detail': `/driver/trips/${driverFixtureIds.trip}`,
  shipments: '/driver/shipments',
  'shipment-detail': `/driver/shipments/${driverFixtureIds.shipment}`,
  empty: '/driver',
  error: `/driver/shipments/${driverFixtureIds.shipment}`,
  confirmation: `/driver/shipments/${driverFixtureIds.shipment}`,
};
const views = [
  { width: 390, height: 844, theme: 'light', states },
  { width: 430, height: 932, theme: 'light', states },
  { width: 768, height: 1024, theme: 'light', states },
  { width: 1440, height: 1000, theme: 'light', states },
  { width: 1024, height: 900, theme: 'light', states: ['home', 'trip-detail', 'shipment-detail'] },
  { width: 390, height: 844, theme: 'dark', states },
];
const report = {
  scope:
    'Synthetic intercepted driver presentation only. Shared session and driver-scoped reads are fulfilled locally; every other API/external request is blocked. No live session, real customer data or mutation.',
  base,
  apiOrigin,
  startedAt: new Date().toISOString(),
  reducedMotion: true,
  results: [],
  failures: [],
};
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const { width, height, theme, states: cases } of views) {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: theme,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    await context.addInitScript((value) => localStorage.setItem('porta-theme', value), theme);
    const page = await context.newPage();
    const fixtures = createDriverFixtures(base, apiOrigin);
    await context.route('**/*', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === apiOrigin && !['GET', 'OPTIONS'].includes(request.method())) {
        fixtures.state.unexpected.push(`WRITE BLOCKED ${request.method()} ${url.pathname}`);
        return route.abort('blockedbyclient');
      }
      const result = await fixtures.resolve(request.url(), request.method(), {
        headers: request.headers(),
      });
      if (result.kind === 'continue') return route.continue();
      if (result.kind === 'abort') return route.abort('blockedbyclient');
      return route.fulfill(result.response);
    });
    for (const state of cases) {
      const name = `${theme}-${width}-${state}`;
      const startedRequests = fixtures.state.requests.length;
      fixtures.state.mode = state === 'empty' ? 'empty' : 'default';
      fixtures.state.onRequest =
        state === 'error'
          ? (request) =>
              request.path === `/api/v1/driver/shipments/${driverFixtureIds.shipment}`
                ? { status: 503 }
                : undefined
          : undefined;
      try {
        await page.goto(`${base}${paths[state]}`);
        await expect(
          page.getByRole('navigation', { name: 'أقسام مساحة السائق', exact: true }),
        ).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        if (state === 'empty') {
          await expect(page.getByRole('main')).toContainText('لا توجد رحلات مسندة إليك');
          await expect(page.getByRole('main')).toContainText('لا توجد شحنات مخصصة لك');
        } else if (state === 'error') {
          await expect(page.getByRole('main').getByRole('alert')).toContainText(
            'الخدمة غير متاحة مؤقتًا. حاول مرة أخرى.',
          );
        } else if (state === 'trips') {
          await expect(page.getByRole('heading', { name: 'رحلاتي', exact: true })).toBeVisible();
          await expect(
            page.getByRole('link', { name: 'فتح الرحلة', exact: true }).first(),
          ).toBeVisible();
        } else {
          await expect(page.getByRole('main')).toContainText(driverFixtureTracking);
        }
        if (state === 'confirmation') {
          await page.getByRole('button', { name: 'تأكيد جاهزية الاستلام', exact: true }).click();
          await expect(
            page.getByRole('heading', { name: 'تأكيد جاهزية الاستلام', exact: true }),
          ).toBeFocused();
          await expect(
            page.getByRole('button', { name: 'تأكيد الإجراء', exact: true }),
          ).toBeVisible();
        }
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(
            document
              .getAnimations()
              .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
              .map((animation) => animation.finished.catch(() => {})),
          );
          window.scrollTo(0, 0);
        });
        const measures = await page.evaluate(() => {
          const shown = (node) =>
            node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden';
          const root = document.querySelector('.driver-shell');
          const controls = [...root.querySelectorAll('a:not(.driver-skip-link), button, select')]
            .filter(shown)
            .map((node) => {
              const rect = node.getBoundingClientRect();
              return {
                name: node.getAttribute('aria-label') || node.textContent.trim(),
                width: rect.width,
                height: rect.height,
                minimum: node.matches('.button-primary, .driver-open-link') ? 48 : 44,
              };
            });
          const overflowing = [...root.querySelectorAll('*')]
            .filter((node) => {
              if (!shown(node) || node.matches('.driver-skip-link, .sr-only')) return false;
              const rect = node.getBoundingClientRect();
              return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
            })
            .map((node) => ({ tag: node.tagName, className: node.className }))
            .slice(0, 12);
          const animations = document.getAnimations().filter((animation) => {
            const node = animation.effect?.target;
            return (
              node instanceof Element &&
              node.closest('.driver-shell') &&
              animation.playState === 'running' &&
              animation.effect.getComputedTiming().activeDuration > 1
            );
          });
          return {
            direction: document.documentElement.dir,
            theme: document.documentElement.dataset.theme,
            viewportWidth: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            bodyWidth: document.body.scrollWidth,
            overflowing,
            controls,
            smallTargets: controls.filter(
              (control) => control.height < control.minimum - 0.5 || control.width < 43.5,
            ),
            smallInputs: [...root.querySelectorAll('input, select, textarea')]
              .filter(shown)
              .map((node) => ({
                id: node.id,
                fontSize: parseFloat(getComputedStyle(node).fontSize),
              }))
              .filter((control) => control.fontSize < 16),
            reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
            runningAnimations: animations.length,
            adminChrome: Boolean(
              document.querySelector('.application-shell, .shell-sidebar, .driver-shell table'),
            ),
            rawErrorVisible:
              /PRIVATE_BACKEND_TRACE|PRIVATE_STAFF|payment_ledger|internal_notes/.test(
                document.body.innerText,
              ),
            privateDataPersisted: /DRIVERQA|2189|driver@example|01ARZ3NDEKTSV4RRFFQ69G5FA/.test(
              JSON.stringify({ ...localStorage, ...sessionStorage }),
            ),
            navPosition: getComputedStyle(document.querySelector('.driver-navigation')).position,
          };
        });
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        const screenshot = `${output}/${name}.png`;
        await page.screenshot({ path: screenshot, fullPage: true });
        let actionScreenshot;
        if (width <= 430 && ['shipment-detail', 'confirmation'].includes(state)) {
          await page
            .getByRole('region', { name: 'إجراءات الشحنة', exact: true })
            .scrollIntoViewIfNeeded();
          actionScreenshot = `${output}/${name}-action-viewport.png`;
          await page.screenshot({ path: actionScreenshot });
        }
        const requests = fixtures.state.requests
          .slice(startedRequests)
          .map(({ method, path, query }) => ({ method, path, query }));
        const violations = axe.violations.map(({ id, impact, nodes }) => ({
          id,
          impact,
          nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
        }));
        report.results.push({
          name,
          state,
          width,
          height,
          theme,
          measures,
          axeViolations: violations,
          requests,
          screenshot,
          ...(actionScreenshot ? { actionScreenshot } : {}),
        });
        if (
          measures.documentWidth > width ||
          measures.bodyWidth > width ||
          measures.overflowing.length ||
          measures.direction !== 'rtl' ||
          measures.theme !== theme ||
          measures.smallTargets.length ||
          measures.smallInputs.length ||
          measures.runningAnimations ||
          !measures.reducedMotion ||
          measures.adminChrome ||
          measures.rawErrorVisible ||
          measures.privateDataPersisted ||
          violations.length
        )
          report.failures.push(name);
      } catch (error) {
        report.failures.push(`${name}: ${error.message}`);
      }
    }
    if (fixtures.state.unexpected.length) report.failures.push(...fixtures.state.unexpected);
    await context.close();
    await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
    process.stdout.write(
      `${theme} ${width}px: ${cases.length} states captured; ${report.failures.length} cumulative failures\n`,
    );
  }
} finally {
  await browser.close();
  report.completedAt = new Date().toISOString();
  report.status = report.failures.length ? 'FAIL' : 'PASS';
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
}
process.stdout.write(
  `${report.status}: ${report.results.length} captures; ${report.failures.length} failures\n`,
);
if (report.failures.length) process.exitCode = 1;
