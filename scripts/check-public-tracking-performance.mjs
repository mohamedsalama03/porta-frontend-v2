import { chromium } from '@playwright/test';
import puppeteer from 'puppeteer-core';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  createTrackingFixtures,
  fixtureNumber,
  localOrigin,
} from './public-tracking-check-fixtures.mjs';

if (process.env.PORTA_PUBLIC_PERFORMANCE_PRODUCTION !== '1')
  throw new Error(
    'Verify a completed production build and next start, then set PORTA_PUBLIC_PERFORMANCE_PRODUCTION=1.',
  );
const base = localOrigin(process.env.PORTA_PUBLIC_CHECK_URL || 'http://localhost:3001', 'Frontend');
const apiOrigin = localOrigin(
  process.env.PORTA_PUBLIC_CHECK_API_ORIGIN || 'http://localhost:8080',
  'API',
);
const buildId = (await readFile('.next/BUILD_ID', 'utf8')).trim();
if (!buildId) throw new Error('Missing production build.');
const output = 'reports/public-tracking/performance';
await mkdir(output, { recursive: true });
const report = {
  scope:
    'Production localhost lab navigation: empty shell and loaded deterministic tracking. Excludes real API latency and field INP.',
  base,
  buildId,
  startedAt: new Date().toISOString(),
  results: [],
  failures: [],
};
const browser = await puppeteer.launch({
  executablePath: chromium.executablePath(),
  headless: true,
});
try {
  for (const mode of ['mobile', 'desktop'])
    for (const state of ['empty', 'loaded']) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      const fixtures = createTrackingFixtures(base, apiOrigin);
      fixtures.state.mode = 'DELIVERED';
      await page.setRequestInterception(true);
      page.on('request', async (request) => {
        if (request.isInterceptResolutionHandled()) return;
        const result = fixtures.resolve(request.url(), request.method());
        if (result.kind === 'continue') await request.continue();
        else if (result.kind === 'abort') await request.abort('blockedbyclient');
        else await request.respond(result.response);
      });
      try {
        const result = await lighthouse(
          `${base}/track${state === 'loaded' ? `?number=${fixtureNumber}` : ''}`,
          {
            output: ['html', 'json'],
            onlyCategories: ['performance', 'accessibility', 'best-practices'],
            logLevel: 'error',
          },
          mode === 'desktop' ? desktopConfig : undefined,
          page,
        );
        if (!result) throw new Error('No Lighthouse result');
        await writeFile(`${output}/${mode}-${state}.html`, result.report[0]);
        await writeFile(`${output}/${mode}-${state}.json`, result.report[1]);
        const audits = result.lhr.audits;
        const scripts = (audits['network-requests']?.details?.items ?? []).filter(
          (item) => item.resourceType === 'Script',
        );
        const record = {
          mode,
          state,
          scores: Object.fromEntries(
            Object.entries(result.lhr.categories).map(([key, value]) => [key, value.score]),
          ),
          metrics: {
            lcpMs: audits['largest-contentful-paint']?.numericValue,
            cls: audits['cumulative-layout-shift']?.numericValue,
            tbtMs: audits['total-blocking-time']?.numericValue,
            inp: 'Not measured; no field performance claim.',
          },
          javascript: {
            transferBytes: scripts.reduce((n, s) => n + (s.transferSize ?? 0), 0),
            decodedBytes: scripts.reduce((n, s) => n + (s.resourceSize ?? 0), 0),
            resources: scripts.map(({ url, transferSize, resourceSize }) => ({
              url,
              transferSize,
              resourceSize,
            })),
          },
          runtimeError: result.lhr.runtimeError ?? null,
          warnings: result.lhr.runWarnings,
          apiCalls: fixtures.state.requests,
          unexpected: fixtures.state.unexpected,
        };
        const loaded = await page.$('.tracking-result');
        if (state === 'loaded' && !loaded)
          throw new Error('Loaded result not present; invalid performance evidence.');
        if (
          record.runtimeError ||
          record.unexpected.length ||
          scripts.some((s) =>
            /next-devtools|react-refresh|node_modules_next_dist|%5Bturbopack%5D/.test(s.url),
          )
        )
          report.failures.push(`${mode}-${state}: runtime, routing or development asset error`);
        report.results.push(record);
        process.stdout.write(
          `${mode}-${state}: performance=${record.scores.performance}, LCP=${record.metrics.lcpMs}ms, CLS=${record.metrics.cls}, TBT=${record.metrics.tbtMs}ms, JS=${record.javascript.transferBytes}bytes\n`,
        );
      } catch (error) {
        report.failures.push(`${mode}-${state}: ${error.message}`);
      } finally {
        await context.close();
        await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
      }
    }
} finally {
  await browser.close();
  report.completedAt = new Date().toISOString();
  report.status = report.failures.length ? 'FAIL' : 'MEASURED';
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
}
if (report.failures.length) process.exitCode = 1;
