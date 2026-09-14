import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import vm from 'node:vm';

// Inspect completed generated build metadata, never real authenticated resource data.
const buildId = (await readFile('.next/BUILD_ID', 'utf8')).trim();
if (!buildId) throw new Error('A completed production build is required.');
const driverRoutes = [
  '(driver)/driver',
  '(driver)/driver/trips',
  '(driver)/driver/trips/[id]',
  '(driver)/driver/shipments',
  '(driver)/driver/shipments/[id]',
  '(driver)/driver/account',
];
const comparisonRoutes = [
  '(public)/track',
  '(public)/order',
  '(dashboard)/dashboard',
  '(dashboard)/[module]',
];
const forbiddenDriverSource =
  /features\/(?:operations|catalog|public-order|public-tracking|dashboard|payments|users|shipments)\/|components\/layout\/application-shell|features\/auth\/dashboard-session/;
const tableTokens = ['getCoreRowModel', 'getFilteredRowModel', 'getPaginationRowModel'];
const records = [];
for (const route of [...driverRoutes, ...comparisonRoutes]) {
  const context = {};
  vm.runInNewContext(
    await readFile(`.next/server/app/${route}/page_client-reference-manifest.js`, 'utf8'),
    context,
    { timeout: 1000 },
  );
  const manifest = Object.values(context.__RSC_MANIFEST ?? {})[0];
  if (!manifest?.clientModules) throw new Error(`Missing client-reference manifest: ${route}`);
  const sources = Object.entries(manifest.clientModules).filter(([file]) =>
    file.replaceAll('\\', '/').includes('[project]/src/'),
  );
  const chunks = [
    ...new Set(
      sources.flatMap(([, entry]) => entry.chunks).map((file) => file.replace(/^\/_next\//, '')),
    ),
  ];
  const buffers = await Promise.all(chunks.map((file) => readFile(`.next/${file}`)));
  const clientSources = sources.map(([file]) => file.replaceAll('\\', '/'));
  const driverRoute = driverRoutes.includes(route);
  records.push({
    route,
    driverRoute,
    entryChunkCount: chunks.length,
    decodedBytes: buffers.reduce((total, buffer) => total + buffer.length, 0),
    gzipBytes: buffers.reduce((total, buffer) => total + gzipSync(buffer).length, 0),
    clientSources,
    forbiddenSources: driverRoute
      ? clientSources.filter((source) => forbiddenDriverSource.test(source))
      : [],
    driverPresentations: clientSources.filter((source) =>
      source.includes('features/driver-workspace/'),
    ),
    tableSignatures: tableTokens.filter((token) =>
      buffers.some((buffer) => buffer.includes(token)),
    ),
    chunks,
  });
}
const drivers = records.filter((record) => record.driverRoute);
const failures = drivers.flatMap((record) => {
  const reasons = [];
  if (!record.driverPresentations.length) reasons.push('no driver presentation in manifest');
  if (!record.entryChunkCount) reasons.push('no driver entry chunks');
  if (record.forbiddenSources.length) reasons.push('Admin or public presentation source imported');
  if (record.tableSignatures.length) reasons.push('Admin table signatures in entry chunks');
  return reasons.map((reason) => `${record.route}: ${reason}`);
});
for (const record of records.filter((entry) => !entry.driverRoute)) {
  if (record.driverPresentations.length) {
    failures.push(`${record.route}: driver presentation leaked into comparison route`);
  }
}
const report = {
  scope:
    'Production route-entry client chunks from the completed Next build. Decoded and independent gzip byte estimates exclude the common framework runtime and are not total navigation payloads or authenticated Admin timings. Shared authentication, permissions and generated API-contract code are intentionally allowed; Admin tables, reports, pricing and audit presentation plus public order/tracking presentation are excluded from driver routes.',
  buildId,
  measuredAt: new Date().toISOString(),
  records,
  failures,
  result: failures.length ? 'FAIL' : 'PASS',
};
await mkdir('reports/driver-interface/performance', { recursive: true });
await writeFile(
  'reports/driver-interface/performance/bundle-isolation.json',
  JSON.stringify(report, null, 2),
);
for (const driver of drivers) {
  process.stdout.write(
    `${driver.route}: ${driver.gzipBytes} bytes gzip; ${driver.decodedBytes} bytes decoded; ${driver.entryChunkCount} route-entry chunks\n`,
  );
}
process.stdout.write(
  `${report.result}: reports/driver-interface/performance/bundle-isolation.json\n`,
);
if (failures.length) process.exitCode = 1;
