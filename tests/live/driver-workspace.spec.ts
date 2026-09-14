import { expect, test } from '@playwright/test';
import nextEnv from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

nextEnv.loadEnvConfig(process.cwd());
const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL;
if (!apiOrigin) throw new Error('Approved API origin is required for driver route acceptance.');

test('anonymous driver route is guarded by a read-only live session check', async ({
  page,
  context,
  baseURL,
}) => {
  const frontend = new URL(baseURL!).origin;
  // Development StrictMode runs discovery twice in each of the driver and login
  // AuthProviders mounts. Both remain GET /auth/me; this bound also catches loops.
  const sessionReadLimit = 4;
  const requests: { method: string; path: string }[] = [];
  const blocked: {
    method: string;
    path: string;
    resourceType: string;
    origin: string;
    reasons: string[];
  }[] = [];
  const safePath = (pathname: string) =>
    pathname
      .split('/')
      .map((segment) =>
        /^[a-z][a-z_-]{0,35}$/.test(segment) || segment === 'v1' || !segment
          ? segment
          : '[redacted]',
      )
      .join('/');
  expect(await context.cookies(), 'No stored driver or staff session is imported').toEqual([]);
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === frontend && !/^\/(api|sanctum)(?:\/|$)/.test(url.pathname))
      return route.continue();
    if (
      url.origin !== apiOrigin ||
      url.pathname !== '/api/v1/auth/me' ||
      url.search ||
      request.method() !== 'GET' ||
      request.headers().authorization ||
      requests.length >= sessionReadLimit
    ) {
      blocked.push({
        method: request.method(),
        path: safePath(url.pathname),
        resourceType: request.resourceType(),
        origin:
          url.origin === apiOrigin
            ? 'approved-api'
            : url.origin === frontend
              ? 'frontend'
              : 'external',
        reasons: [
          ...(url.origin !== apiOrigin ? ['unapproved-origin'] : []),
          ...(url.pathname !== '/api/v1/auth/me' ? ['unapproved-path'] : []),
          ...(url.search ? ['query-not-permitted'] : []),
          ...(request.method() !== 'GET' ? ['unapproved-method'] : []),
          ...(request.headers().authorization ? ['unexpected-authentication-mode'] : []),
          ...(requests.length >= sessionReadLimit ? ['session-read-limit'] : []),
        ],
      });
      return route.abort('blockedbyclient');
    }
    requests.push({ method: request.method(), path: url.pathname });
    return route.continue();
  });
  let sessionStatus: number | undefined;
  const output = path.resolve('reports/driver-interface/live');
  try {
    const responsePromise = page.waitForResponse(`${apiOrigin}/api/v1/auth/me`);
    await page.goto('/driver/shipments');
    const response = await responsePromise;
    sessionStatus = response.status();
    expect(sessionStatus).toBe(401);
    await expect(page).toHaveURL(/\/login\?/);
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/driver/shipments');
    await expect(page.getByRole('heading', { name: 'شحناتي', exact: true })).toHaveCount(0);
    expect(blocked, 'No scoped operational calls or writes before authentication').toEqual([]);
  } finally {
    await mkdir(output, { recursive: true });
    await writeFile(
      path.join(output, 'anonymous-guard.json'),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          readOnly: true,
          anonymousContext: true,
          sessionStatus,
          requests,
          sessionReadLimit,
          blockedRequests: blocked.length,
          blockedDetails: blocked,
          authenticatedDriverAcceptance: 'NOT TESTED — SAFE DISPOSABLE DRIVER ACCOUNT REQUIRED',
          driverMutationAcceptance: 'NOT TESTED — SAFE DRIVER MUTATION FIXTURE REQUIRED',
        },
        null,
        2,
      ),
    );
  }
});
