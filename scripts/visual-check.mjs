import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'reports/visual';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const cases = [
  ['login-desktop', '/login', 1440, 1000, 'light'],
  ['overview-desktop', '/preview', 1440, 1050, 'light'],
  ['shipments-desktop', '/preview/shipments', 1440, 1050, 'light'],
  ['detail-dark', '/preview/shipments/sample-001', 1440, 1050, 'dark'],
  ['login-mobile', '/login', 390, 844, 'light'],
  ['overview-mobile', '/preview', 390, 844, 'light'],
  ['shipments-mobile', '/preview/shipments', 390, 844, 'light'],
  ['create-mobile', '/preview/shipments/new', 390, 844, 'dark'],
  ['settings-mobile', '/preview/settings', 390, 844, 'light'],
];
const results = [];
for (const [name, route, width, height, theme] of cases) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: 'reduce',
    colorScheme: theme,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`http://127.0.0.1:3000${route}`);
  await page.locator('main h1').waitFor();
  await page.evaluate(() => document.fonts.ready);
  if (route === '/login') {
    await page.getByRole('button', { name: 'إظهار كلمة المرور' }).click();
    await page.getByRole('button', { name: 'إخفاء كلمة المرور' }).click();
  } else {
    await page.getByRole('button', { name: 'البحث والتنقل السريع' }).click();
    await page.keyboard.press('Escape');
  }
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true, caret: 'initial' });
  const overflow = await page.evaluate(() => ({
    viewport: innerWidth,
    page: document.documentElement.scrollWidth,
    overflowing: Array.from(document.querySelectorAll('main *'))
      .filter(
        (element) =>
          element.getBoundingClientRect().right > innerWidth + 1 ||
          element.getBoundingClientRect().left < -1,
      )
      .slice(0, 10)
      .map((element) => ({ tag: element.tagName, class: element.className })),
  }));
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  results.push({
    name,
    errors,
    overflow,
    violations: accessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  });
  await context.close();
}
await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
await browser.close();
