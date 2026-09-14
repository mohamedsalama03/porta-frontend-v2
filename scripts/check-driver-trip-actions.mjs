import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  createDriverFixtures,
  driverEnvelope,
  driverFixtureCsrf,
  driverFixtureIds as ids,
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
const output = 'reports/driver-trip-actions/visual';
const tripPath = `/api/v1/driver/trips/${ids.trip}`;
const tripRoute = `/driver/trips/${ids.trip}`;
const states = [
  'no-action',
  'start-available',
  'start-pending',
  'start-success',
  'stale-409',
  'arrival-available',
  'complete-available',
  'completed',
  'unavailable-404',
  'confirmation',
];
const selectedStates = process.env.PORTA_DRIVER_VISUAL_STATES?.split(',') ?? states;
if (selectedStates.some((state) => !states.includes(state)))
  throw new Error('Unknown visual state selection.');
const views = [
  { width: 390, height: 844, theme: 'light' },
  { width: 430, height: 932, theme: 'light' },
  { width: 768, height: 1024, theme: 'light' },
  { width: 1440, height: 1000, theme: 'light' },
  { width: 390, height: 844, theme: 'dark' },
];
const report = {
  scope:
    'Synthetic intercepted Driver Trip Detail presentation. All shared session and scoped operations are handled locally, including bounded synthetic START requests for pending/success/conflict/unavailable states. Every unexpected API or external request is blocked. No live account, production data, or actual mutation.',
  base,
  apiOrigin,
  startedAt: new Date().toISOString(),
  reducedMotion: true,
  results: [],
  failures: [],
};
await mkdir(output, { recursive: true });
if (process.env.PORTA_DRIVER_VISUAL_STATES) {
  const previous = JSON.parse(await readFile(`${output}/results.json`, 'utf8'));
  if (previous.base !== base || previous.apiOrigin !== apiOrigin)
    throw new Error('Targeted visual refresh must use the same frontend/API origins.');
  report.startedAt = previous.startedAt;
  report.results = previous.results.filter((result) => !selectedStates.includes(result.state));
  report.failures = previous.failures.filter(
    (failure) =>
      !selectedStates.some(
        (state) => failure.endsWith(`-${state}`) || failure.includes(`-${state}:`),
      ),
  );
}
const browser = await chromium.launch({ headless: true });
try {
  for (const { width, height, theme } of views) {
    for (const state of selectedStates) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
      });
      await context.addInitScript((value) => localStorage.setItem('porta-theme', value), theme);
      await context.addCookies([
        {
          name: 'XSRF-TOKEN',
          value: driverFixtureCsrf,
          domain: new URL(apiOrigin).hostname,
          path: '/',
          sameSite: 'Lax',
        },
      ]);
      const page = await context.newPage();
      const fixtures = createDriverFixtures(base, apiOrigin);
      const data = fixtures.state;
      data.trips[0].shipments_count = 1;
      data.shipments = [data.shipments[0]];
      data.trips[0].status = 'LOADING';
      data.shipments[0].current_status = 'PREPARING';
      data.tripActions[ids.trip] = ['START'];
      if (state === 'no-action') {
        data.trips[0].status = 'SCHEDULED';
        data.tripActions[ids.trip] = [];
      }
      if (state === 'arrival-available') {
        data.trips[0].status = 'DEPARTED';
        data.shipments[0].current_status = 'IN_TRANSIT';
        data.tripActions[ids.trip] = ['CONFIRM_ARRIVAL'];
      }
      if (state === 'complete-available' || state === 'completed') {
        data.trips[0].status = state === 'completed' ? 'COMPLETED' : 'ARRIVED';
        data.shipments[0].current_status = 'DELIVERED';
        data.tripActions[ids.trip] = state === 'completed' ? [] : ['COMPLETE'];
      }
      let releasePending;
      const pending = new Promise((resolve) => {
        releasePending = resolve;
      });
      data.onRequest = async (request) => {
        if (request.path !== `${tripPath}/start` || request.method !== 'POST') return;
        if (state === 'start-pending') await pending;
        if (state === 'unavailable-404') {
          data.trips = [data.trips[1]];
          return { status: 404 };
        }
        data.trips[0].status = 'DEPARTED';
        data.shipments[0].current_status = 'IN_TRANSIT';
        data.tripActions[ids.trip] = state === 'stale-409' ? [] : ['CONFIRM_ARRIVAL'];
        if (state === 'stale-409') return { status: 409 };
        return {
          json: driverEnvelope(data.trips[0], { allowed_actions: data.tripActions[ids.trip] }),
        };
      };
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (
          url.origin === apiOrigin &&
          request.method() === 'POST' &&
          url.pathname !== `${tripPath}/start`
        ) {
          data.unexpected.push(`WRITE BLOCKED ${request.method()} ${url.pathname}`);
          return route.abort('blockedbyclient');
        }
        const result = await fixtures.resolve(request.url(), request.method(), {
          headers: request.headers(),
          body: request.postData() ? request.postDataJSON() : undefined,
        });
        if (result.kind === 'continue') return route.continue();
        if (result.kind === 'abort') return route.abort('blockedbyclient');
        return route.fulfill(result.response);
      });
      const name = `${theme}-${width}-${state}`;
      try {
        await page.goto(`${base}${tripRoute}`);
        await expect(
          page.getByRole('navigation', { name: 'أقسام مساحة السائق', exact: true }),
        ).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(
          page.getByRole('region', { name: 'بيانات الرحلة', exact: true }),
        ).toContainText('طرابلس');
        await expect(page.getByRole('main').getByRole('list')).toBeVisible();
        const area = page.getByRole('region', { name: 'إجراءات الرحلة', exact: true });
        if (
          [
            'start-pending',
            'start-success',
            'stale-409',
            'unavailable-404',
            'confirmation',
          ].includes(state)
        ) {
          await page.getByRole('button', { name: 'بدء الرحلة', exact: true }).click();
          await expect(
            area.getByRole('heading', { name: 'بدء الرحلة', exact: true }),
          ).toBeFocused();
          if (state !== 'confirmation')
            await area.getByRole('button', { name: 'تأكيد بدء الرحلة', exact: true }).click();
        }
        if (state === 'start-pending')
          await expect(
            area.getByRole('button', { name: 'جارٍ تأكيد الإجراء', exact: true }),
          ).toBeDisabled();
        if (state === 'start-success') {
          await expect(
            area.getByRole('heading', { name: 'تم بدء الرحلة بنجاح.', exact: true }),
          ).toBeVisible();
          await expect(
            page.getByRole('button', { name: 'تأكيد الوصول', exact: true }),
          ).toBeVisible();
          await expect(page.getByRole('main').getByRole('list')).toContainText('في الطريق');
        }
        if (state === 'stale-409') {
          await expect(area.getByRole('alert')).toContainText(
            'تم تحديث حالة الرحلة. يرجى مراجعة البيانات الحالية.',
          );
          await expect(page.getByRole('button', { name: 'بدء الرحلة', exact: true })).toHaveCount(
            0,
          );
        }
        if (state === 'unavailable-404') {
          await expect(page.getByRole('main').getByRole('alert')).toContainText(
            'هذا العمل غير متاح لك حاليًا.',
          );
          await expect(
            page.getByRole('region', { name: 'بيانات الرحلة', exact: true }),
          ).toHaveCount(0);
        }
        if (state === 'arrival-available')
          await expect(
            page.getByRole('button', { name: 'تأكيد الوصول', exact: true }),
          ).toBeVisible();
        if (state === 'complete-available')
          await expect(
            page.getByRole('button', { name: 'إكمال الرحلة', exact: true }),
          ).toBeVisible();
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(
            document
              .getAnimations()
              .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
              .map((animation) => animation.finished.catch(() => {})),
          );
          scrollTo(0, 0);
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
                minimum: node.matches(
                  '.driver-action-area button, .button-primary, .driver-open-link',
                )
                  ? 48
                  : 44,
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
            reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
            runningAnimations: document
              .getAnimations()
              .filter(
                (animation) =>
                  animation.effect?.target instanceof Element &&
                  animation.effect.target.closest('.driver-shell') &&
                  animation.playState === 'running' &&
                  animation.effect.getComputedTiming().activeDuration > 1,
              ).length,
            adminChrome: Boolean(
              document.querySelector('.application-shell, .shell-sidebar, .driver-shell table'),
            ),
            rawErrorVisible:
              /PRIVATE_BACKEND_TRACE|PRIVATE_STAFF|payment_ledger|internal_notes/.test(
                document.body.innerText,
              ),
            privateDataPersisted:
              /DRIVERQA|2189|driver@example|01ARZ3NDEKTSV4RRFFQ69G5FA|Idempotency-Key/.test(
                JSON.stringify({ ...localStorage, ...sessionStorage }),
              ),
          };
        });
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        const violations = axe.violations.map(({ id, impact, nodes }) => ({
          id,
          impact,
          nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
        }));
        const screenshot = `${output}/${name}.png`;
        await page.screenshot({ path: screenshot, fullPage: true });
        let actionScreenshot;
        let actionViewport;
        if (width <= 430 && state === 'confirmation') {
          // Center the whole context and controls above the existing fixed navigation.
          await area.evaluate((node) => node.scrollIntoView({ block: 'center' }));
          actionScreenshot = `${output}/${name}-action-viewport.png`;
          await page.screenshot({ path: actionScreenshot });
          actionViewport = await area.evaluate((node) => {
            const nav = document.querySelector('.driver-navigation').getBoundingClientRect();
            const buttons = [...node.querySelectorAll('button')].map((button) =>
              button.getBoundingClientRect(),
            );
            return {
              navTop: nav.top,
              buttonsBelowNav: buttons.filter(
                (button) => button.bottom > nav.top && button.top < nav.bottom,
              ).length,
            };
          });
        }
        report.results.push({
          name,
          state,
          width,
          height,
          theme,
          measures,
          axeViolations: violations,
          screenshot,
          ...(actionScreenshot ? { actionScreenshot, actionViewport } : {}),
          requests: data.requests.map(({ method, path, query }) => ({ method, path, query })),
        });
        if (
          measures.documentWidth > width ||
          measures.bodyWidth > width ||
          measures.overflowing.length ||
          measures.direction !== 'rtl' ||
          measures.theme !== theme ||
          measures.smallTargets.length ||
          measures.runningAnimations ||
          !measures.reducedMotion ||
          measures.adminChrome ||
          measures.rawErrorVisible ||
          measures.privateDataPersisted ||
          violations.length ||
          actionViewport?.buttonsBelowNav
        )
          report.failures.push(name);
      } catch (error) {
        report.failures.push(`${name}: ${error.message}`);
      } finally {
        releasePending();
        await context.close();
      }
      if (data.unexpected.length) report.failures.push(...data.unexpected);
      await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
    }
    process.stdout.write(
      `${theme} ${width}px: ${selectedStates.length} states checked; ${report.failures.length} cumulative failures\n`,
    );
  }
} finally {
  await browser.close();
  report.completedAt = new Date().toISOString();
  report.status = report.failures.length ? 'FAIL' : 'PASS';
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
}
process.stdout.write(
  `${report.status}: ${report.results.length} full-page states; ${report.failures.length} failures\n`,
);
if (report.failures.length) process.exitCode = 1;
