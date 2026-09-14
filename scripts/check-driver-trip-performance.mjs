import { chromium } from '@playwright/test';
import puppeteer from 'puppeteer-core';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import {
  createDriverFixtures,
  driverFixtureIds,
  driverFixtureTracking,
} from './driver-check-fixtures.mjs';

// Complete the production build and start next start separately before this check.
if (process.env.PORTA_DRIVER_TRIP_PERFORMANCE_PRODUCTION !== '1') {
  throw new Error(
    'Verify next build and next start, then set PORTA_DRIVER_TRIP_PERFORMANCE_PRODUCTION=1.',
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
  )
    throw new Error(`${label} must be a plain localhost origin.`);
  return url.origin;
}

const base = localOrigin(process.env.PORTA_DRIVER_CHECK_URL || 'http://localhost:3001', 'Frontend');
const apiOrigin = localOrigin(
  process.env.PORTA_DRIVER_CHECK_API_ORIGIN || 'http://localhost:8080',
  'API',
);
const output = 'reports/driver-trip-actions/performance';
const buildId = (await readFile('.next/BUILD_ID', 'utf8')).trim();
if (!buildId) throw new Error('A completed production build is required.');
const priorLab = JSON.parse(
  await readFile('reports/driver-interface/performance/results.json', 'utf8'),
);
const priorBundle = JSON.parse(
  await readFile('reports/driver-interface/performance/bundle-isolation.json', 'utf8'),
);
const manifestRoute = '(driver)/driver/trips/[id]';
const path = `/driver/trips/${driverFixtureIds.trip}`;
const baselineEntry = priorBundle.records.find((record) => record.route === manifestRoute);
if (!baselineEntry) throw new Error('The prior trip-detail bundle baseline is missing.');
await mkdir(output, { recursive: true });

if (process.env.PORTA_DRIVER_TRIP_PERFORMANCE_CAPTURE_ONLY === '1') {
  await captureExistingMeasurements();
  process.exit(0);
}

// Use the exact previous phase's entry-chunk method, excluding common framework runtime.
const manifestContext = {};
vm.runInNewContext(
  await readFile(`.next/server/app/${manifestRoute}/page_client-reference-manifest.js`, 'utf8'),
  manifestContext,
  { timeout: 1000 },
);
const manifest = Object.values(manifestContext.__RSC_MANIFEST ?? {})[0];
if (!manifest?.clientModules)
  throw new Error('The production trip-detail client manifest is missing.');
const sourceEntries = Object.entries(manifest.clientModules).filter(([file]) =>
  file.replaceAll('\\', '/').includes('[project]/src/'),
);
const clientSources = sourceEntries.map(([file]) => file.replaceAll('\\', '/'));
const chunks = [
  ...new Set(
    sourceEntries
      .flatMap(([, entry]) => entry.chunks)
      .map((file) => file.replace(/^\/_next\//, '')),
  ),
];
const buffers = await Promise.all(chunks.map((file) => readFile(`.next/${file}`)));
const forbiddenSource =
  /features\/(?:operations|catalog|public-order|public-tracking|dashboard|payments|users|shipments)\/|components\/layout\/application-shell|features\/auth\/dashboard-session|(?:tanstack\/react-table|recharts|chart\.js)/;
const tableTokens = ['getCoreRowModel', 'getFilteredRowModel', 'getPaginationRowModel'];
const bundle = {
  scope:
    'Production trip-detail client entry chunks, using the prior phase manifest method. Independent gzip estimates exclude common framework runtime; Lighthouse below separately measures total navigation JavaScript.',
  buildId,
  route: manifestRoute,
  entryChunkCount: chunks.length,
  decodedBytes: buffers.reduce((sum, buffer) => sum + buffer.length, 0),
  gzipBytes: buffers.reduce((sum, buffer) => sum + gzipSync(buffer).length, 0),
  clientSources,
  forbiddenSources: clientSources.filter((source) => forbiddenSource.test(source)),
  tableSignatures: tableTokens.filter((token) => buffers.some((buffer) => buffer.includes(token))),
  chunks,
  baseline: {
    buildId: priorBundle.buildId,
    decodedBytes: baselineEntry.decodedBytes,
    gzipBytes: baselineEntry.gzipBytes,
    source: 'reports/driver-interface/performance/bundle-isolation.json',
  },
};
bundle.delta = {
  decodedBytes: bundle.decodedBytes - bundle.baseline.decodedBytes,
  gzipBytes: bundle.gzipBytes - bundle.baseline.gzipBytes,
  decodedPercent: (bundle.decodedBytes / bundle.baseline.decodedBytes - 1) * 100,
  gzipPercent: (bundle.gzipBytes / bundle.baseline.gzipBytes - 1) * 100,
};
bundle.failures = [
  ...(!chunks.length ? ['Missing trip-detail entry chunks.'] : []),
  ...(!clientSources.some((source) => source.includes('features/driver-workspace/trip-detail'))
    ? ['Driver trip detail absent from client manifest.']
    : []),
  ...(bundle.forbiddenSources.length
    ? ['Admin/public/chart/table presentation source imported.']
    : []),
  ...(bundle.tableSignatures.length ? ['Admin table signatures in driver entry chunks.'] : []),
];
bundle.result = bundle.failures.length ? 'FAIL' : 'PASS';
await writeFile(`${output}/bundle-isolation.json`, JSON.stringify(bundle, null, 2));

const report = {
  scope:
    'Production localhost Lighthouse navigation of driver trip detail with explicit synthetic START metadata. Every API request is intercepted in memory; all writes are blocked, including synthetic writes. No live credentials, backend ownership enforcement, real API latency, field INP or field SLA is measured.',
  base,
  apiOrigin,
  buildId,
  fixture: { tripStatus: 'LOADING', allowedActions: ['START'], shipmentStatus: 'PREPARING' },
  startedAt: new Date().toISOString(),
  baseline: {
    buildId: priorLab.buildId,
    source: 'reports/driver-interface/performance/results.json',
    results: priorLab.results
      .filter((record) => record.page === 'trip-detail')
      .map(({ mode, scores, metrics, javascript }) => ({
        mode,
        scores,
        metrics,
        javascript: {
          count: javascript.count,
          transferBytes: javascript.transferBytes,
          decodedBytes: javascript.decodedBytes,
        },
      })),
  },
  bundle: {
    result: bundle.result,
    decodedBytes: bundle.decodedBytes,
    gzipBytes: bundle.gzipBytes,
    delta: bundle.delta,
  },
  results: [],
  failures: bundle.failures.map((failure) => `bundle: ${failure}`),
};

function readLoadedState(tracking) {
  const main = document.querySelector('#driver-main');
  const text = main?.textContent ?? '';
  const buttons = Array.from(main?.querySelectorAll('button') ?? []);
  return {
    shell: Boolean(main),
    tripDetail: Boolean(main?.querySelector('[aria-label="بيانات الرحلة"]')),
    shipments: text.includes('شحنات الرحلة') && text.includes(tracking),
    startCapability: buttons.some(
      (button) => button.textContent?.trim() === 'بدء الرحلة' && !button.disabled,
    ),
  };
}

function captureViewport(mode) {
  // Keep image pixels equal to CSS pixels so reviewers can inspect actual widths.
  return mode === 'mobile'
    ? { width: 412, height: 823, deviceScaleFactor: 1, isMobile: true, hasTouch: true }
    : { width: 1350, height: 940, deviceScaleFactor: 1, isMobile: false, hasTouch: false };
}

async function restoreViewportAndCapture(page, mode, name) {
  const expected = captureViewport(mode);
  // Lighthouse resets CDP emulation after audits. Explicitly restore the viewport
  // and wait for responsive layout before a separate, unmeasured review capture.
  await page.setViewport(expected);
  await page.waitForFunction(
    (tracking) => {
      const main = document.querySelector('#driver-main');
      return (
        main?.textContent?.includes(tracking) &&
        Array.from(main.querySelectorAll('button')).some(
          (button) => button.textContent?.trim() === 'بدء الرحلة' && !button.disabled,
        )
      );
    },
    { timeout: 10_000 },
    driverFixtureTracking,
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const actual = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    devicePixelRatio: window.devicePixelRatio,
    mobileLayout: window.matchMedia('(max-width: 767px)').matches,
  }));
  if (
    actual.innerWidth !== expected.width ||
    actual.clientWidth !== expected.width ||
    actual.scrollWidth > expected.width ||
    actual.mobileLayout !== (mode === 'mobile')
  ) {
    throw new Error(`Review capture viewport mismatch: ${JSON.stringify(actual)}`);
  }
  const screenshot = `${output}/${name}-verified.png`;
  await page.screenshot({ path: screenshot, fullPage: true });
  return {
    capturedAt: new Date().toISOString(),
    timing: 'Separate post-audit review capture; viewport restored after measured navigation.',
    expected,
    actual,
    screenshot,
    loaded: await page.evaluate(readLoadedState, driverFixtureTracking),
  };
}

async function installReadOnlyFixtures(page) {
  const fixtures = createDriverFixtures(base, apiOrigin);
  fixtures.state.tripActions[driverFixtureIds.trip] = ['START'];
  fixtures.state.trips[0].status = 'LOADING';
  fixtures.state.shipments.forEach((shipment) => {
    shipment.current_status = 'PREPARING';
  });
  const interceptionErrors = [];
  const blockedWrites = [];
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    if (request.isInterceptResolutionHandled()) return;
    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        blockedWrites.push(`${request.method()} ${new URL(request.url()).pathname}`);
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
      if (!request.isInterceptResolutionHandled())
        await request.abort('failed').catch(() => undefined);
    }
  });
  return { fixtures, interceptionErrors, blockedWrites };
}

async function captureExistingMeasurements() {
  const saved = JSON.parse(await readFile(`${output}/results.json`, 'utf8'));
  if (
    saved.buildId !== buildId ||
    saved.base !== base ||
    saved.apiOrigin !== apiOrigin ||
    saved.status !== 'MEASURED'
  ) {
    throw new Error(
      'Capture-only mode requires existing valid measurements for this exact build and origins.',
    );
  }
  const browser = await puppeteer.launch({
    executablePath: chromium.executablePath(),
    headless: true,
  });
  try {
    for (const mode of ['mobile', 'desktop']) {
      const name = `${mode}-trip-detail`;
      const record = saved.results.find(
        (item) => item.mode === mode && item.page === 'trip-detail',
      );
      if (!record) throw new Error(`Missing prior measurement: ${name}`);
      const rawPath = `${output}/${name}.json`;
      const raw = await readFile(rawPath);
      const originalHash = createHash('sha256').update(raw).digest('hex');
      const measured = JSON.parse(raw.toString('utf8'));
      const measuredImage = measured.audits['final-screenshot']?.details;
      if (!measuredImage?.data?.startsWith('data:image/jpeg;base64,')) {
        throw new Error(`Missing original measured screenshot: ${name}`);
      }
      const measuredScreenshot = `${output}/${name}-measured.jpg`;
      await writeFile(measuredScreenshot, Buffer.from(measuredImage.data.split(',')[1], 'base64'));
      const context = await browser.createBrowserContext();
      try {
        const page = await context.newPage();
        const { fixtures, interceptionErrors, blockedWrites } = await installReadOnlyFixtures(page);
        await page.setViewport(captureViewport(mode));
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle0' });
        const capture = await restoreViewportAndCapture(page, mode, name);
        if (
          fixtures.state.unexpected.length ||
          interceptionErrors.length ||
          blockedWrites.length ||
          !Object.values(capture.loaded).every(Boolean)
        )
          throw new Error(`Capture-only content/isolation failed: ${name}`);
        const afterHash = createHash('sha256')
          .update(await readFile(rawPath))
          .digest('hex');
        if (afterHash !== originalHash)
          throw new Error('Raw measurement changed during capture-only operation.');
        record.contentValidation.capture = {
          ...capture,
          reason:
            'Correct Lighthouse post-audit emulation reset without rerunning valid navigation metrics.',
          captureOnly: true,
          rawMeasurementSha256: originalHash,
          rawMeasurementUnchanged: true,
          measuredScreenshot,
          measuredScreenshotTiming: measuredImage.timing,
          measuredScreenEmulation: measured.configSettings.screenEmulation,
          apiCalls: fixtures.state.requests,
          unexpected: fixtures.state.unexpected,
          interceptionErrors,
          blockedWrites,
        };
        process.stdout.write(
          `${name}: restored ${capture.actual.innerWidth}px viewport; capture verified; raw metrics unchanged.\n`,
        );
      } finally {
        await context.close();
      }
    }
    await writeFile(`${output}/results.json`, JSON.stringify(saved, null, 2));
  } finally {
    await browser.close();
  }
}

const browser = await puppeteer.launch({
  executablePath: chromium.executablePath(),
  headless: true,
});
try {
  for (const mode of ['mobile', 'desktop']) {
    const name = `${mode}-trip-detail`;
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const { fixtures, interceptionErrors, blockedWrites } = await installReadOnlyFixtures(page);
    try {
      const measured = await lighthouse(
        `${base}${path}`,
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
      const scripts = (audits['network-requests']?.details?.items ?? []).filter(
        (resource) => resource.resourceType === 'Script',
      );
      const developmentScripts = scripts.filter((resource) =>
        /next-devtools|react-refresh|node_modules_next_dist|%5Bturbopack%5D|\[turbopack\]/i.test(
          resource.url,
        ),
      );
      const initialLoaded = await page.evaluate(readLoadedState, driverFixtureTracking);
      const validationStartedAt = Date.now();
      let contentWaitError = null;
      // Lighthouse's BFCache audit can reload this private no-store page after the
      // measured trace. This final hydration wait does not alter navigation metrics.
      try {
        await page.waitForFunction(
          (tracking) => {
            const main = document.querySelector('#driver-main');
            const text = main?.textContent ?? '';
            return (
              Boolean(main?.querySelector('[aria-label="بيانات الرحلة"]')) &&
              text.includes('شحنات الرحلة') &&
              text.includes(tracking) &&
              Array.from(main?.querySelectorAll('button') ?? []).some(
                (button) => button.textContent?.trim() === 'بدء الرحلة' && !button.disabled,
              )
            );
          },
          { timeout: 10_000 },
          driverFixtureTracking,
        );
      } catch (error) {
        contentWaitError = error.message;
      }
      const capture = await restoreViewportAndCapture(page, mode, name);
      const loaded = capture.loaded;
      const apiCalls = fixtures.state.requests;
      const apiIsolation = {
        sessionRead: apiCalls.some((call) => call.path === '/api/v1/auth/me'),
        scopedTripsRead: apiCalls.some((call) => call.path === '/api/v1/driver/trips'),
        tripDetailRead: apiCalls.some(
          (call) => call.path === `/api/v1/driver/trips/${driverFixtureIds.trip}`,
        ),
        scopedShipmentsRead: apiCalls.some(
          (call) =>
            call.path === '/api/v1/driver/shipments' &&
            call.query.trip_id === driverFixtureIds.trip,
        ),
        adminOrPublicCalls: apiCalls.filter(
          (call) => call.path !== '/api/v1/auth/me' && !call.path.startsWith('/api/v1/driver/'),
        ),
        writes: apiCalls.filter((call) => !['GET', 'HEAD', 'OPTIONS'].includes(call.method)),
        blockedWrites,
      };
      const record = {
        mode,
        page: 'trip-detail',
        path,
        measuredAt: new Date().toISOString(),
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
          transferBytes: scripts.reduce((sum, item) => sum + (item.transferSize ?? 0), 0),
          decodedBytes: scripts.reduce((sum, item) => sum + (item.resourceSize ?? 0), 0),
          resources: scripts.map(({ url, transferSize, resourceSize }) => ({
            url,
            transferBytes: transferSize,
            decodedBytes: resourceSize,
          })),
        },
        contentValidation: {
          timing: 'After Lighthouse audits; final hydration wait excluded from navigation metrics.',
          initialLoaded,
          waitMs: Date.now() - validationStartedAt,
          error: contentWaitError,
          screenshotRecordedDuringMeasurement: Boolean(audits['final-screenshot']?.details?.data),
          capture,
        },
        loaded,
        apiCalls,
        apiIsolation,
        unexpected: fixtures.state.unexpected,
        interceptionErrors,
        developmentScripts: developmentScripts.map(({ url }) => url),
        runtimeError: measured.lhr.runtimeError ?? null,
        warnings: measured.lhr.runWarnings,
      };
      const baseline = report.baseline.results.find((item) => item.mode === mode);
      record.comparison = baseline
        ? {
            performancePoints: (record.scores.performance - baseline.scores.performance) * 100,
            lcpMs: record.metrics.lcpMs - baseline.metrics.lcpMs,
            tbtMs: record.metrics.tbtMs - baseline.metrics.tbtMs,
            cls: record.metrics.cls - baseline.metrics.cls,
            javascriptTransferBytes:
              record.javascript.transferBytes - baseline.javascript.transferBytes,
            javascriptDecodedBytes:
              record.javascript.decodedBytes - baseline.javascript.decodedBytes,
          }
        : null;
      report.results.push(record);
      if (
        record.runtimeError ||
        record.unexpected.length ||
        interceptionErrors.length ||
        contentWaitError ||
        developmentScripts.length ||
        !Object.values(loaded).every(Boolean) ||
        !apiIsolation.sessionRead ||
        !apiIsolation.scopedTripsRead ||
        !apiIsolation.tripDetailRead ||
        !apiIsolation.scopedShipmentsRead ||
        apiIsolation.adminOrPublicCalls.length ||
        apiIsolation.writes.length ||
        blockedWrites.length ||
        Object.values(record.metrics).some((value) => value === null) ||
        new URL(record.finalUrl).pathname !== path
      )
        report.failures.push(`${name}: incomplete content, isolation or production measurement`);
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
} finally {
  await browser.close();
  report.completedAt = new Date().toISOString();
  report.status = report.failures.length ? 'FAIL' : 'MEASURED';
  await writeFile(`${output}/results.json`, JSON.stringify(report, null, 2));
}
process.stdout.write(
  `Trip detail bundle: ${bundle.decodedBytes} decoded bytes; ${bundle.gzipBytes} gzip bytes.\n${report.status}: ${output}/results.json\n`,
);
if (report.failures.length) process.exitCode = 1;
