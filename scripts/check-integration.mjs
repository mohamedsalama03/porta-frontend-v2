import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import nextEnv from '@next/env';
import {
  getCitiesResponseSchema,
  getShipmentTypesResponseSchema,
  errorSchema,
} from '../src/lib/api/generated.ts';

nextEnv.loadEnvConfig(process.cwd());
const base = new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? '');
if (
  !['http:', 'https:'].includes(base.protocol) ||
  base.pathname !== '/' ||
  base.search ||
  base.hash ||
  base.username ||
  base.password
)
  throw new Error('Configure an approved API origin first.');
const raw = await readFile(
  new URL('../contracts/porta-api-v1.openapi.json', import.meta.url),
  'utf8',
);
const spec = JSON.parse(raw);
const origin = process.env.PORTA_FRONTEND_ORIGIN || 'http://localhost:3000';
const checks = [];
for (const [path, expectedStatus, schema] of [
  ['/sanctum/csrf-cookie', 204, null],
  ['/api/v1/auth/me', 401, errorSchema],
  ['/api/v1/cities', 200, getCitiesResponseSchema],
  ['/api/v1/shipment-types', 200, getShipmentTypesResponseSchema],
]) {
  const response = await fetch(new URL(path, base), {
    headers: { Accept: 'application/json', Origin: origin },
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  const payload = response.status === 204 ? null : await response.json();
  const parsed = schema?.safeParse(payload);
  checks.push({
    path,
    status: response.status,
    expectedStatus,
    schemaValid: parsed?.success ?? true,
    issues:
      parsed && !parsed.success
        ? parsed.error.issues.map(({ path, code }) => ({ path, code }))
        : [],
    corsOrigin: response.headers.get('Access-Control-Allow-Origin'),
    credentials: response.headers.get('Access-Control-Allow-Credentials'),
    exposedHeaders: response.headers.get('Access-Control-Expose-Headers'),
    requestId: response.headers.get('X-Request-ID'),
    count: Array.isArray(payload?.data) ? payload.data.length : undefined,
    // Only names and flags: never persist cookies or private responses.
    cookies: response.headers.getSetCookie().map((cookie) => ({
      name: cookie.split('=', 1)[0],
      httpOnly: /;\s*HttpOnly/i.test(cookie),
      sameSite: cookie.match(/;\s*SameSite=([^;]+)/i)?.[1],
    })),
  });
}
const passed = checks.every(
  (check) =>
    check.status === check.expectedStatus &&
    check.schemaValid &&
    check.corsOrigin === origin &&
    check.credentials === 'true',
);
const report = {
  checkedAt: new Date().toISOString(),
  apiOrigin: base.origin,
  frontendOrigin: origin,
  contractVersion: spec.info.version,
  contractSha256: createHash('sha256').update(raw).digest('hex'),
  passed,
  scope: 'Read-only unauthenticated HTTP checks. No staff login or mutations performed.',
  checks,
};
await mkdir('reports/integration', { recursive: true });
await writeFile('reports/integration/http-check.json', JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
if (!passed) process.exitCode = 1;
