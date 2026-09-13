import { chromium, expect } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';

const base = process.env.PORTA_CHECK_URL || 'http://localhost:3001';
const connected = process.env.PORTA_CHECK_MODE !== 'foundation';
const browser = await chromium.launch();
const page = await browser.newPage();
const result = [];
try {
  for (const path of [
    '/preview',
    '/preview/shipments',
    '/preview/shipments/sample-001',
    '/preview/settings',
  ]) {
    const response = await page.goto(`${base}${path}`);
    if (response?.status() !== 404) throw new Error(`Production preview must return 404: ${path}`);
    result.push({ path, status: response.status() });
  }
  const response = await page.goto(`${base}/login`);
  if (response?.status() !== 200) throw new Error('Production login did not render.');
  const login = page.getByRole('button', { name: 'تسجيل الدخول', exact: true });
  if (connected) await expect(login).toBeEnabled();
  else await expect(login).toBeDisabled();
  if (await page.getByRole('link', { name: 'معاينة الواجهة', exact: true }).count())
    throw new Error('Production login exposes a preview entry.');
  const headers = response.headers();
  if (!headers['x-robots-tag']?.includes('noindex'))
    throw new Error('Admin response must be noindex.');
  result.push({
    path: '/login',
    status: 200,
    mode: connected ? 'connected' : 'foundation',
    loginAvailable: connected,
    previewEntryHidden: true,
    robots: headers['x-robots-tag'],
  });
  await mkdir('reports', { recursive: true });
  await writeFile('reports/production-check.json', JSON.stringify(result, null, 2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browser.close();
}
