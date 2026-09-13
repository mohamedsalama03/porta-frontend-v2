import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  createTrackingFixtures,
  fixtureNumber,
  statuses,
  localOrigin,
} from './public-tracking-check-fixtures.mjs';

const base = localOrigin(process.env.PORTA_PUBLIC_CHECK_URL || 'http://localhost:3000', 'Frontend');
const apiOrigin = localOrigin(
  process.env.PORTA_PUBLIC_CHECK_API_ORIGIN || 'http://localhost:8080',
  'API',
);
const output = 'reports/public-tracking/visual';
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const report = {
  scope:
    'Synthetic intercepted tracking presentation only; every other external/API request blocked.',
  base,
  startedAt: new Date().toISOString(),
  results: [],
  failures: [],
};
const views = [
  [390, 844, 'light'],
  [430, 932, 'light'],
  [768, 1024, 'light'],
  [1024, 900, 'light'],
  [1440, 1000, 'light'],
  [390, 844, 'dark'],
];
try {
  for (const [width, height, theme] of views) {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: theme,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    await context.addInitScript((value) => localStorage.setItem('porta-theme', value), theme);
    const page = await context.newPage();
    const fixtures = createTrackingFixtures(base, apiOrigin);
    let releaseLoading;
    await context.route('**/*', async (route) => {
      const result = fixtures.resolve(route.request().url(), route.request().method());
      if (result.kind === 'continue') return route.continue();
      if (result.kind === 'abort') return route.abort('blockedbyclient');
      if (releaseLoading) await releaseLoading;
      await route.fulfill(result.response);
    });
    const cases = ['empty', 'loading', 'success', 'delivered', 'not-found', 'error'];
    if (width === 390 && theme === 'light')
      cases.push(...statuses.filter((s) => !['RECEIVED', 'DELIVERED'].includes(s)));
    for (const state of cases) {
      let finishLoading;
      fixtures.state.mode =
        state === 'delivered'
          ? 'DELIVERED'
          : statuses.includes(state)
            ? state
            : ['not-found', 'error'].includes(state)
              ? state
              : 'RECEIVED';
      releaseLoading =
        state === 'loading'
          ? new Promise((resolve) => {
              finishLoading = resolve;
            })
          : null;
      try {
        await page.goto(`${base}/track${state === 'empty' ? '' : `?number=${fixtureNumber}`}`);
        await expect(page.getByRole('textbox', { name: 'رقم التتبع' })).toBeVisible();
        if (state === 'loading')
          await expect(page.getByRole('status', { name: 'جارٍ تحميل حالة الشحنة' })).toBeVisible();
        else if (state === 'not-found')
          await expect(
            page.getByRole('heading', { name: 'لم نعثر على شحنة بهذا الرقم' }),
          ).toBeVisible();
        else if (state === 'error')
          await expect(
            page.getByRole('heading', {
              name: 'خدمة التتبع غير متاحة مؤقتًا. يرجى المحاولة لاحقًا.',
            }),
          ).toBeVisible();
        else if (state !== 'empty') await expect(page.getByRole('article')).toBeVisible();
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(
            document
              .getAnimations()
              .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime))
              .map((a) => a.finished.catch(() => {})),
          );
          window.scrollTo(0, 0);
        });
        const measures = await page.evaluate(() => ({
          rtl: document.documentElement.dir,
          overflow: document.documentElement.scrollWidth > innerWidth,
          inputSize: getComputedStyle(document.querySelector('#tracking-number')).fontSize,
          targets: [...document.querySelectorAll('main input, main button, header a')]
            .filter((n) => n.getClientRects().length)
            .map((n) => ({
              name: n.getAttribute('aria-label') || n.textContent?.trim(),
              height: n.getBoundingClientRect().height,
            })),
          privateText:
            /Synthetic service error|PRIVATE_|sender_phone|recipient_phone|driver_phone|payment_ledger/.test(
              document.body.innerText,
            ),
        }));
        const axe = await new AxeBuilder({ page }).analyze();
        const name = `${theme}-${width}-${state}`;
        await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
        report.results.push({
          name,
          state,
          width,
          height,
          theme,
          measures,
          axeViolations: axe.violations.map(({ id, impact, nodes }) => ({
            id,
            impact,
            count: nodes.length,
          })),
          screenshot: `${output}/${name}.png`,
        });
        if (
          measures.overflow ||
          measures.rtl !== 'rtl' ||
          parseFloat(measures.inputSize) < 16 ||
          measures.targets.some((t) => t.height < 44) ||
          measures.privateText ||
          axe.violations.length
        )
          report.failures.push(name);
      } catch (error) {
        report.failures.push(`${theme}-${width}-${state}: ${error.message}`);
      } finally {
        finishLoading?.();
        releaseLoading = null;
      }
    }
    if (fixtures.state.unexpected.length) report.failures.push(...fixtures.state.unexpected);
    await context.close();
    await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
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
