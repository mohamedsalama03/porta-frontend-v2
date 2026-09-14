import { chromium } from '@playwright/test';
import puppeteer from 'puppeteer-core';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  createDriverFixtures,
  driverFixtureIds,
  driverFixtureTracking,
} from './driver-check-fixtures.mjs';

// The caller must finish the production build and independently start next start.
if (process.env.PORTA_DRIVER_PERFORMANCE_PRODUCTION !== '1') {
  throw new Error(
    'Verify a completed production build and next start, then set PORTA_DRIVER_PERFORMANCE_PRODUCTION=1.',
  );
}

function localOrigin(value, label) {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${label} must be a plain localhost origin.`);
  }
  return url.origin;
}

const base = localOrigin(process.env.PORTA_DRIVER_CHECK_URL || 'http://localhost:3001', 'Frontend');
const apiOrigin = localOrigin(
  process.env.PORTA_DRIVER_CHECK_API_ORIGIN || 'http://localhost:8080',
  'API',
);
const buildId = (await readFile('.next/BUILD_ID', 'utf8')).trim();
if (!buildId) throw new Error('A completed production build is required.');
const output = 'reports/driver-interface/performance';
await mkdir(output, { recursive: true });
const report = {
  scope:
    'Production localhost Lighthouse lab navigation of loaded driver home and trip detail, with synthetic authenticated identity and assigned work intercepted in memory. No live credentials, operational writes, real API latency or field INP are measured. These results do not establish backend ownership enforcement or a field SLA.',
  base,
  apiOrigin,
  buildId,
  startedAt: new Date().toISOString(),
  results: [],
  failures: [],
};
const routes = [
  { name: 'home', path: '/driver' },
  { name: 'trip-detail', path: `/driver/trips/${driverFixtureIds.trip}` },
];
const browser = await puppeteer.launch({
  executablePath: chromium.executablePath(),
  headless: true,
});

try {
  for (const mode of ['mobile', 'desktop']) {
    for (const route of routes) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      const fixtures = createDriverFixtures(base, apiOrigin);
      const interceptionErrors = [];
      await page.setRequestInterception(true);
      page.on('request', async (request) => {
        if (request.isInterceptResolutionHandled()) return;
        try {
          // This measurement is read-only even inside the synthetic transport.
          if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
            fixtures.state.unexpected.push(
              `MEASUREMENT WRITE BLOCKED ${request.method()} ${new URL(request.url()).pathname}`,
            );
            await request.abort('blockedbyclient');
            return;
          }
          const resolved = await fixtures.resolve(request.url(), request.method(), {
            headers: request.headers(),
          });
          if (resolved.kind === 'continue') await request.continue();
          else if (resolved.kind === 'abort') await request.abort('blockedbyclient');
          else await request.respond(resolved.response);
        } catch (error) {
          interceptionErrors.push(error.message);
          if (!request.isInterceptResolutionHandled()) {
            await request.abort('failed').catch(() => undefined);
          }
        }
      });

      const name = `${mode}-${route.name}`;
      try {
        const measured = await lighthouse(
          `${base}${route.path}`,
          {
            output: ['html', 'json'],
            onlyCategories: ['performance', 'accessibility', 'best-practices'],
            logLevel: 'error',
          },
          mode === 'desktop' ? desktopConfig : undefined,
          page,
        );
        if (!measured) throw new Error('Lighthouse did not return a measurement.');
        await writeFile(`${output}/${name}.html`, measured.report[0]);
        await writeFile(`${output}/${name}.json`, measured.report[1]);
        const { audits } = measured.lhr;
        const resources = audits['network-requests']?.details?.items ?? [];
        const scripts = resources.filter((resource) => resource.resourceType === 'Script');
        const developmentScripts = scripts.filter((resource) =>
          /next-devtools|react-refresh|node_modules_next_dist|%5Bturbopack%5D|\[turbopack\]/i.test(
            resource.url,
          ),
        );
        const record = {
          mode,
          page: route.name,
          path: route.path,
          finalUrl: measured.lhr.finalDisplayedUrl,
          scores: Object.fromEntries(
            Object.entries(measured.lhr.categories).map(([key, value]) => [key, value.score]),
          ),
          metrics: {
            fcpMs: audits['first-contentful-paint']?.numericValue ?? null,
            lcpMs: audits['largest-contentful-paint']?.numericValue ?? null,
            cls: audits['cumulative-layout-shift']?.numericValue ?? null,
            tbtMs: audits['total-blocking-time']?.numericValue ?? null,
            inp: 'Not measured; no field performance claim.',
          },
          javascript: {
            count: scripts.length,
            transferBytes: scripts.reduce((total, item) => total + (item.transferSize ?? 0), 0),
            decodedBytes: scripts.reduce((total, item) => total + (item.resourceSize ?? 0), 0),
            resources: scripts.map(({ url, transferSize, resourceSize }) => ({
              url,
              transferBytes: transferSize,
              decodedBytes: resourceSize,
            })),
          },
          runtimeError: measured.lhr.runtimeError ?? null,
          warnings: measured.lhr.runWarnings,
          apiCalls: fixtures.state.requests,
          unexpected: fixtures.state.unexpected,
          interceptionErrors,
          developmentScripts: developmentScripts.map(({ url }) => url),
        };
        const loaded = await page.evaluate(
          ({ pageName, tracking }) => {
            const main = document.querySelector('#driver-main');
            const text = main?.textContent ?? '';
            return {
              shell: Boolean(main),
              workLoaded: text.includes(tracking),
              pageLoaded:
                pageName === 'home'
                  ? text.includes('من رحلاتك') && text.includes('من شحناتك')
                  : Boolean(main?.querySelector('[aria-label="بيانات الرحلة"]')) &&
                    text.includes('شحنات الرحلة'),
            };
          },
          { pageName: route.name, tracking: driverFixtureTracking },
        );
        record.loaded = loaded;
        record.apiIsolation = {
          sessionRead: record.apiCalls.some((call) => call.path === '/api/v1/auth/me'),
          scopedTripsRead: record.apiCalls.some((call) => call.path === '/api/v1/driver/trips'),
          scopedShipmentsRead: record.apiCalls.some(
            (call) =>
              call.path === '/api/v1/driver/shipments' &&
              (route.name !== 'trip-detail' || call.query.trip_id === driverFixtureIds.trip),
          ),
          adminOrPublicCalls: record.apiCalls.filter(
            (call) => call.path !== '/api/v1/auth/me' && !call.path.startsWith('/api/v1/driver/'),
          ),
        };
        report.results.push(record);
        if (
          record.runtimeError ||
          record.unexpected.length ||
          interceptionErrors.length ||
          developmentScripts.length ||
          !Object.values(loaded).every(Boolean) ||
          !record.apiIsolation.sessionRead ||
          !record.apiIsolation.scopedTripsRead ||
          !record.apiIsolation.scopedShipmentsRead ||
          record.apiIsolation.adminOrPublicCalls.length ||
          Object.values(record.metrics).some((value) => value === null) ||
          new URL(record.finalUrl).pathname !== route.path
        ) {
          report.failures.push(`${name}: incomplete content, isolation or production measurement`);
        }
        process.stdout.write(
          `${name}: performance=${record.scores.performance}; LCP=${record.metrics.lcpMs}ms; CLS=${record.metrics.cls}; TBT=${record.metrics.tbtMs}ms; JS=${record.javascript.transferBytes} bytes\n`,
        );
      } catch (error) {
        report.failures.push(`${name}: ${error.message}`);
      } finally {
        await context.close();
        await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
      }
    }
  }
} finally {
  await browser.close();
  report.completedAt = new Date().toISOString();
  report.status = report.failures.length ? 'FAIL' : 'MEASURED';
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
}
process.stdout.write(`${report.status}: ${output}/results.json\n`);
if (report.failures.length) process.exitCode = 1;
