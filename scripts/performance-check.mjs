import { chromium } from '@playwright/test';
import lighthouse from 'lighthouse';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.PORTA_CHECK_URL || 'http://127.0.0.1:3001';
await mkdir('reports/performance', { recursive: true });
const debuggingPort = 9223;
const chrome = await chromium.launch({
  headless: true,
  args: [`--remote-debugging-port=${debuggingPort}`],
});
const summary = [];
try {
  for (const name of ['login', 'dashboard']) {
    const result = await lighthouse(`${base}/${name}`, {
      port: debuggingPort,
      output: ['html', 'json'],
      onlyCategories: ['performance', 'accessibility', 'best-practices'],
      logLevel: 'error',
    });
    if (!result) throw new Error('Lighthouse returned no result.');
    const [html, json] = result.report;
    await writeFile(`reports/performance/${name}.html`, html);
    await writeFile(`reports/performance/${name}.json`, json);
    const audits = result.lhr.audits;
    const scripts = audits['network-requests'].details.items.filter(
      (item) => item.resourceType === 'Script',
    );
    summary.push({
      route: `/${name}`,
      mode: 'production foundation; no operational data; simulated mobile navigation',
      performance: result.lhr.categories.performance.score,
      accessibility: result.lhr.categories.accessibility.score,
      bestPractices: result.lhr.categories['best-practices'].score,
      lcpMs: audits['largest-contentful-paint'].numericValue,
      cls: audits['cumulative-layout-shift'].numericValue,
      totalBlockingTimeMs: audits['total-blocking-time'].numericValue,
      inp: 'Not measured; requires real interaction/field evidence after integration.',
      scriptTransferBytes: scripts.reduce((sum, item) => sum + item.transferSize, 0),
      scriptResourceBytes: scripts.reduce((sum, item) => sum + item.resourceSize, 0),
      warnings: result.lhr.runWarnings,
    });
  }
  await writeFile('reports/performance/summary.json', JSON.stringify(summary, null, 2));
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} finally {
  await chrome.close();
}
