import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import vm from 'node:vm';

// Read the completed Next build, never server-rendered customer tracking data.
const buildId = (await readFile('.next/BUILD_ID', 'utf8')).trim();
const records = [];
for (const route of [
  '(public)/track',
  '(public)/order',
  '(dashboard)/dashboard',
  '(dashboard)/[module]',
]) {
  const context = {};
  vm.runInNewContext(
    await readFile(`.next/server/app/${route}/page_client-reference-manifest.js`, 'utf8'),
    context,
  );
  const manifest = Object.values(context.__RSC_MANIFEST)[0];
  const sources = Object.entries(manifest.clientModules).filter(([file]) =>
    file.includes('[project]/src/'),
  );
  const chunks = [
    ...new Set(
      sources.flatMap(([, entry]) => entry.chunks).map((file) => file.replace(/^\/_next\//, '')),
    ),
  ];
  const buffers = await Promise.all(chunks.map((file) => readFile(`.next/${file}`)));
  const tableSignatures = [
    'getCoreRowModel',
    'getFilteredRowModel',
    'getPaginationRowModel',
  ].filter((token) => buffers.some((buffer) => buffer.includes(token)));
  records.push({
    route,
    entryChunkCount: chunks.length,
    decodedBytes: buffers.reduce((total, buffer) => total + buffer.length, 0),
    gzipBytes: buffers.reduce((total, buffer) => total + gzipSync(buffer).length, 0),
    clientSources: sources.map(([file]) => file),
    tableSignatures,
    chunks,
  });
}
const tracking = records[0];
const forbiddenSources = tracking.clientSources.filter((file) =>
  /features\/(auth|operations)|application-shell|lib\/auth\/provider|lib\/permissions/.test(file),
);
const report = {
  scope:
    'Production route-entry chunks excluding common framework runtime. Size comparison, not authenticated Admin load-time measurement.',
  buildId,
  records,
  forbiddenSources,
  tableSignatures: tracking.tableSignatures,
  result: forbiddenSources.length || tracking.tableSignatures.length ? 'FAIL' : 'PASS',
};
await mkdir('reports/public-tracking/performance', { recursive: true });
await writeFile(
  'reports/public-tracking/performance/bundle-isolation.json',
  JSON.stringify(report, null, 2),
);
process.stdout.write(
  `${report.result}: ${tracking.gzipBytes} bytes gzip; ${tracking.entryChunkCount} route-entry chunks\n`,
);
if (report.result !== 'PASS') process.exitCode = 1;
