import { chromium } from '@playwright/test';
import puppeteer from 'puppeteer-core';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createPublicOrderFixtures, localOrigin } from './public-order-check-fixtures.mjs';

// Run only after `npm run build`, against the parent's independently started production server.
// The explicit acknowledgement prevents accidentally labelling dev-server timings production.
if (process.env.PORTA_PUBLIC_PERFORMANCE_PRODUCTION !== '1') {
  throw new Error(
    'Set PORTA_PUBLIC_PERFORMANCE_PRODUCTION=1 only after verifying the target is next start from the completed production build.',
  );
}
const base = localOrigin(process.env.PORTA_PUBLIC_CHECK_URL || 'http://localhost:3001', 'Frontend');
const apiOrigin = localOrigin(
  process.env.PORTA_PUBLIC_CHECK_API_ORIGIN || 'http://localhost:8080',
  'API',
);
const buildId = (await readFile('.next/BUILD_ID', 'utf8')).trim();
if (!buildId) throw new Error('A completed local production build is required.');
const output = 'reports/public-order/performance';
await mkdir(output, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: chromium.executablePath(),
  headless: true,
});
const summary = {
  scope:
    'Production public order shell/form navigation, with explicitly intercepted synthetic public catalogs. Excludes real backend latency, order writes and field INP.',
  base,
  apiOrigin,
  buildId,
  startedAt: new Date().toISOString(),
  results: [],
  failures: [],
};

try {
  for (const mode of ['mobile', 'desktop']) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const fixtures = createPublicOrderFixtures(base, apiOrigin);
    const interceptionErrors = [];
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      if (request.isInterceptResolutionHandled()) return;
      try {
        const result = fixtures.resolve(request.url(), request.method(), request.headers());
        if (result.kind === 'continue') await request.continue();
        else if (result.kind === 'abort') await request.abort('blockedbyclient');
        else await request.respond(result.response);
      } catch (error) {
        interceptionErrors.push(error.message);
        if (!request.isInterceptResolutionHandled()) await request.abort('failed').catch(() => {});
      }
    });
    try {
      const result = await lighthouse(
        `${base}/order`,
        {
          output: ['html', 'json'],
          onlyCategories: ['performance', 'accessibility', 'best-practices'],
          logLevel: 'error',
          disableStorageReset: false,
        },
        mode === 'desktop' ? desktopConfig : undefined,
        page,
      );
      if (!result) throw new Error('Lighthouse did not return a result.');
      const [html, json] = result.report;
      await writeFile(`${output}/${mode}.html`, html);
      await writeFile(`${output}/${mode}.json`, json);
      const { audits } = result.lhr;
      const resources = audits['network-requests']?.details?.items ?? [];
      const scripts = resources.filter((item) => item.resourceType === 'Script');
      const styles = resources.filter((item) => item.resourceType === 'Stylesheet');
      const developmentScripts = scripts.filter((item) =>
        /(?:node_modules_next_dist|%5Bturbopack%5D|\[turbopack\]|next-devtools|react-refresh)/i.test(
          item.url,
        ),
      );
      const bundle = (items) => ({
        count: items.length,
        transferBytes: items.reduce((sum, item) => sum + (item.transferSize ?? 0), 0),
        decodedBytes: items.reduce((sum, item) => sum + (item.resourceSize ?? 0), 0),
        resources: items.map(({ url, transferSize, resourceSize }) => ({
          url,
          transferBytes: transferSize,
          decodedBytes: resourceSize,
        })),
      });
      const metric = (id) => audits[id]?.numericValue ?? null;
      const record = {
        mode,
        finalUrl: result.lhr.finalDisplayedUrl,
        scores: Object.fromEntries(
          Object.entries(result.lhr.categories).map(([key, category]) => [key, category.score]),
        ),
        metrics: {
          firstContentfulPaintMs: metric('first-contentful-paint'),
          largestContentfulPaintMs: metric('largest-contentful-paint'),
          cumulativeLayoutShift: metric('cumulative-layout-shift'),
          totalBlockingTimeMs: metric('total-blocking-time'),
          speedIndexMs: metric('speed-index'),
          inp: 'Not measured: requires interaction/field evidence.',
        },
        javascript: bundle(scripts),
        css: bundle(styles),
        runtimeError: result.lhr.runtimeError ?? null,
        warnings: result.lhr.runWarnings,
        interceptedApiRequests: fixtures.state.requests,
        unexpectedRequests: fixtures.state.unexpected,
        interceptionErrors,
        developmentScripts: developmentScripts.map(({ url }) => url),
        simulatedOrderCalls: fixtures.state.orderKeys.length,
      };
      summary.results.push(record);
      if (record.runtimeError || interceptionErrors.length || fixtures.state.unexpected.length)
        summary.failures.push(`${mode}: runtime/interception error`);
      if (developmentScripts.length)
        summary.failures.push(
          `${mode}: development assets detected; not valid production evidence`,
        );
      if (new URL(record.finalUrl).pathname !== '/order')
        summary.failures.push(`${mode}: public route redirected`);
      if (fixtures.state.orderKeys.length)
        summary.failures.push(`${mode}: unexpected simulated order during navigation`);
      process.stdout.write(
        `${mode}: performance=${record.scores.performance}; LCP=${record.metrics.largestContentfulPaintMs}ms; CLS=${record.metrics.cumulativeLayoutShift}; TBT=${record.metrics.totalBlockingTimeMs}ms; JS=${record.javascript.transferBytes} bytes\n`,
      );
    } catch (error) {
      summary.failures.push(`${mode}: ${error.message}`);
    } finally {
      await context.close();
      await writeFile(`${output}/results.json`, JSON.stringify(summary, null, 2));
    }
  }
} finally {
  await browser.close();
  summary.completedAt = new Date().toISOString();
  summary.status = summary.failures.length ? 'FAIL' : 'MEASURED';
  await writeFile(`${output}/results.json`, JSON.stringify(summary, null, 2));
}
process.stdout.write(`${summary.status}: ${output}/results.json\n`);
if (summary.failures.length) process.exitCode = 1;
