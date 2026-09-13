import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('login is safe and honest without an API and supports password visibility', async ({
  page,
  baseURL,
}) => {
  const backendRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL!).origin)
      backendRequests.push(request.url());
  });
  await page.goto('/login?reason=expired&returnTo=%2Fshipments');
  await expect(page.getByRole('heading', { name: 'مرحباً بعودتك' })).toBeVisible();
  await expect(page.getByText('انتهت جلستك. سجّل الدخول مرة أخرى للمتابعة.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'تسجيل الدخول', exact: true })).toBeDisabled();
  await page.getByLabel('كلمة المرور', { exact: true }).fill('local-demo-only');
  await page.getByRole('button', { name: 'إظهار كلمة المرور' }).click();
  await expect(page.getByLabel('كلمة المرور', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'إخفاء كلمة المرور' }).click();
  await expect(page.getByLabel('كلمة المرور', { exact: true })).toHaveAttribute('type', 'password');
  expect(backendRequests).toEqual([]);
});

test('unconnected dashboard never displays invented operational data', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'مساحة العمل قيد الإعداد' })).toBeVisible();
  await page.getByRole('link', { name: 'معاينة الواجهة', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'نظرة عامة' })).toBeVisible();
  await expect(page.getByText('بانتظار ربط البيانات التشغيلية')).toBeVisible();
  await expect(page.locator('.metric-value')).toHaveText(['—', '—', '—', '—']);
});

test('feature shells expose no write action and every section renders', async ({ page }) => {
  for (const section of [
    'trips',
    'drivers',
    'cities',
    'branches',
    'shipment-types',
    'pricing',
    'payments',
    'reports',
    'users',
    'audit',
  ]) {
    await page.goto(`/preview/${section}`);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByText('هذا القسم بانتظار ربط الخدمة.')).toBeVisible();
    for (const button of await page.locator('main .page-heading button').all())
      await expect(button).toBeDisabled();
  }
});

test('core views pass automated accessibility checks in both themes', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  for (const route of [
    '/login',
    '/preview',
    '/preview/shipments',
    '/preview/shipments/new',
    '/preview/shipments/sample-001',
    '/preview/settings',
  ]) {
    await page.goto(route);
    await page.locator('main h1').waitFor();
    await expect(page.locator('main h1')).toHaveCSS('visibility', 'visible');
    if (route.startsWith('/preview'))
      await expect(page.locator('.shell-main > div')).toHaveCSS('opacity', '1');
    await page.evaluate(() => document.fonts.ready);
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        `${route} ${theme}`,
      ).toEqual([]);
    }
  }
  expect(errors).toEqual([]);
});
