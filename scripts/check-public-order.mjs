import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  createPublicOrderFixtures,
  fixtureIds,
  fixtureTracking,
  installPlaywrightFixtures,
  localOrigin,
} from './public-order-check-fixtures.mjs';

const base = localOrigin(process.env.PORTA_PUBLIC_CHECK_URL || 'http://localhost:3000', 'Frontend');
const apiOrigin = localOrigin(
  process.env.PORTA_PUBLIC_CHECK_API_ORIGIN || 'http://localhost:8080',
  'API',
);
const output = 'reports/public-order/visual';
const cases = [
  ['light-390', 390, 844, 'light'],
  ['light-430', 430, 932, 'light'],
  ['light-768', 768, 1024, 'light'],
  ['light-1024', 1024, 900, 'light'],
  ['light-1440', 1440, 1000, 'light'],
  ['dark-390', 390, 844, 'dark'],
];
const report = {
  scope:
    'Isolated browser presentation verification with synthetic public API responses only. No real order or live integration claim.',
  base,
  apiOrigin,
  startedAt: new Date().toISOString(),
  results: [],
  failures: [],
};
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function fill(page) {
  await page
    .getByLabel('اسم المرسل', { exact: true })
    .fill('مرسل الاختبار الآلي للاسم العربي الطويل');
  await page.getByLabel('هاتف المرسل', { exact: true }).fill('0910000001');
  await page
    .getByLabel('اسم المستلم', { exact: true })
    .fill('مستلم الاختبار الآلي للاسم العربي الطويل');
  await page.getByLabel('هاتف المستلم', { exact: true }).fill('0920000002');
  await page.getByLabel('مدينة الإرسال', { exact: true }).selectOption(fixtureIds.origin);
  await page.getByLabel('مدينة الاستلام', { exact: true }).selectOption(fixtureIds.destination);
  await page.getByLabel('نوع الشحنة', { exact: true }).selectOption(fixtureIds.type);
  await page.getByLabel('الوزن (كجم)', { exact: false }).fill('2.500');
  await page.getByRole('radio', { name: 'استلام من المكتب', exact: true }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: 'توصيل إلى الباب', exact: true })).toBeChecked();
  await page
    .getByLabel('عنوان التوصيل', { exact: true })
    .fill(
      'عنوان توضيحي للاختبار فقط، المبنى التجريبي المقابل لمكتب استلام الشحنات في المدينة التجريبية.',
    );
  await page
    .getByRole('textbox', { name: /^ملاحظات/ })
    .fill(
      'بيانات توضيحية للاختبار فقط.\nنص عربي طويل للتحقق من التفاف الملاحظات وإمكانية مراجعة البيانات على شاشة الهاتف.',
    );
  await expect(page.locator('.public-order-total')).toContainText(/1[.,]235/);
}

async function inspect(page, name, state) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  const measurements = await page.evaluate(() => {
    const shown = (node) =>
      node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
    const root = document.querySelector('.public-order-page');
    const inputs = [...root.querySelectorAll('input:not([type="radio"]), select, textarea')]
      .filter(shown)
      .map((node) => ({ id: node.id, fontPx: parseFloat(getComputedStyle(node).fontSize) }));
    const targets = [...root.querySelectorAll('a, button, input, select, textarea')]
      .filter(shown)
      .map((node) => {
        const target = node.matches('input[type="radio"]') ? node.closest('label') : node;
        const rect = target.getBoundingClientRect();
        return {
          tag: node.tagName,
          id: node.id,
          name: node.getAttribute('aria-label') || node.textContent?.trim().slice(0, 90),
          width: rect.width,
          height: rect.height,
        };
      });
    const overflowing = [...root.querySelectorAll('*')]
      .filter((node) => {
        if (
          !shown(node) ||
          node.classList.contains('sr-only') ||
          node.classList.contains('public-order-skip')
        )
          return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
      })
      .map((node) => ({ tag: node.tagName, id: node.id, className: node.className }))
      .slice(0, 20);
    const animations = document
      .getAnimations()
      .filter((animation) => {
        const target = animation.effect?.target;
        return (
          target instanceof Element &&
          !!target.closest('.public-order-page') &&
          animation.playState === 'running'
        );
      })
      .map((animation) => ({
        target: animation.effect.target.id || animation.effect.target.className,
        activeDurationMs: animation.effect.getComputedTiming().activeDuration,
      }));
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      direction: document.documentElement.dir,
      theme: document.documentElement.dataset.theme,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      // The shared reduced-motion rule intentionally keeps 0.01ms transitions;
      // these may still be pending until the next frame, without visible motion.
      activeAnimations: animations,
      runningAnimations: animations.filter((animation) => animation.activeDurationMs > 1).length,
      inputs,
      smallInputs: inputs.filter((input) => input.fontPx < 16),
      smallTargets: targets.filter((target) => target.width < 43.5 || target.height < 43.5),
      overflowing,
      activeElement: { tag: document.activeElement?.tagName, id: document.activeElement?.id },
    };
  });
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const violations = axe.violations.map(({ id, impact, description, nodes }) => ({
    id,
    impact,
    description,
    nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
  }));
  const screenshot = `${output}/${name}-${state}.png`;
  await page.screenshot({
    path: screenshot,
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
  });
  const failures = [];
  if (measurements.direction !== 'rtl') failures.push('Page direction is not RTL');
  if (
    measurements.documentWidth > measurements.viewport.width + 1 ||
    measurements.overflowing.length
  )
    failures.push('Horizontal overflow');
  if (measurements.smallInputs.length) failures.push('Input text below 16px');
  if (measurements.smallTargets.length) failures.push('Touch target below 44px');
  if (!measurements.reducedMotion || measurements.runningAnimations)
    failures.push('Reduced-motion violation');
  if (violations.length) failures.push('Axe violations');
  report.results.push({ name, state, screenshot, measurements, violations, failures });
  report.failures.push(...failures.map((failure) => `${name}/${state}: ${failure}`));
  process.stdout.write(`${name}/${state}: ${failures.length ? failures.join(', ') : 'PASS'}\n`);
}

try {
  for (const [name, width, height, theme] of cases) {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: theme,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const fixtures = createPublicOrderFixtures(base, apiOrigin);
    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    await installPlaywrightFixtures(page, fixtures);
    try {
      await page.goto(`${base}/order`, { waitUntil: 'networkidle' });
      await expect(page.getByLabel('اسم المرسل', { exact: true })).toBeEnabled();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'انتقل إلى نموذج الطلب' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('#main-content')).toBeFocused();
      await inspect(page, name, 'initial');
      await page.getByRole('button', { name: 'مراجعة الطلب', exact: true }).click();
      await expect(page.getByLabel('اسم المرسل', { exact: true })).toBeFocused();
      if (name === 'light-390') await inspect(page, name, 'validation');
      await fill(page);
      await inspect(page, name, 'filled');
      const reviewButton = page.getByRole('button', { name: 'مراجعة الطلب', exact: true });
      await reviewButton.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.public-order-summary-region')).toBeFocused();
      await expect(
        page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true }),
      ).toBeEnabled();
      await page.getByRole('button', { name: 'تعديل البيانات', exact: true }).press('Enter');
      await expect(page.getByLabel('اسم المرسل', { exact: true })).toBeFocused();
      await reviewButton.click();
      await expect(
        page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true }),
      ).toBeEnabled();
      await inspect(page, name, 'review');
      fixtures.state.orderMode = 'conflict';
      await page.getByRole('button', { name: 'تأكيد طلب الشحن', exact: true }).press('Enter');
      await expect(page.getByRole('button', { name: 'إعادة المحاولة', exact: true })).toBeEnabled();
      await expect(page.getByLabel('اسم المرسل', { exact: true })).toBeDisabled();
      await inspect(page, name, 'error');
      fixtures.state.orderMode = 'success';
      await page.getByRole('button', { name: 'إعادة المحاولة', exact: true }).press('Enter');
      await expect(
        page.getByRole('heading', { name: 'تم تسجيل طلب الشحن', exact: true }),
      ).toBeFocused();
      await expect(page.locator('.public-order-success-price')).toContainText(/1[.,]700/);
      await page.getByRole('button', { name: 'نسخ رقم التتبع', exact: true }).click();
      await expect(page.getByRole('status')).toHaveText('تم نسخ رقم التتبع.');
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(fixtureTracking);
      await inspect(page, name, 'success');
      expect(fixtures.state.orderKeys).toHaveLength(2);
      expect(new Set(fixtures.state.orderKeys).size).toBe(1);
      expect(fixtures.state.orderKeys[0]).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
      await page.reload({ waitUntil: 'networkidle' });
      await expect(
        page.getByRole('heading', { name: 'سبق تأكيد طلب الشحن', exact: true }),
      ).toBeVisible();
      expect(fixtures.state.orderKeys).toHaveLength(2);
      if (name === 'light-390') await inspect(page, name, 'refresh');
    } catch (error) {
      report.failures.push(`${name}: ${error.message}`);
      await page
        .screenshot({
          path: `${output}/${name}-interrupted.png`,
          fullPage: true,
          animations: 'disabled',
        })
        .catch(() => {});
    } finally {
      report.results.push({
        name,
        state: 'interaction-evidence',
        runtimeErrors,
        apiRequests: fixtures.state.requests,
        unexpectedRequests: fixtures.state.unexpected,
        simulatedOrderCalls: fixtures.state.orderKeys.length,
        distinctLogicalKeys: new Set(fixtures.state.orderKeys).size,
        note: 'Request values are synthetic; this is not live backend replay acceptance.',
      });
      if (runtimeErrors.length || fixtures.state.unexpected.length)
        report.failures.push(`${name}: runtime error or unexpected request`);
      await context.close();
      await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
    }
  }
} finally {
  await browser.close();
  report.completedAt = new Date().toISOString();
  report.status = report.failures.length ? 'FAIL' : 'PASS';
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
}
process.stdout.write(
  `${report.status}: ${report.results.length} records; ${report.failures.length} findings. ${output}/results.json\n`,
);
if (report.failures.length) process.exitCode = 1;
