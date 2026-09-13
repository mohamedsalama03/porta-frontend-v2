import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApiClient, readXsrfCookie } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

vi.mock('@/lib/config', () => ({
  config: { apiBaseUrl: null, loginPath: null, logoutPath: null, previewEnabled: false },
}));

const testBase = 'https://api.example.test';
const resultSchema = z.object({ data: z.object({ title: z.string() }) });

describe('central API transport', () => {
  it('includes credentials, disables persistent caching and validates response projections', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ data: { title: 'Approved response', secret: 'strip' }, internal: 'strip' }),
      );
    const client = createApiClient({ baseUrl: testBase, fetch: fetcher });
    const result = await client.request('/contract-test', { schema: resultSchema });
    expect(result).toEqual({ data: { title: 'Approved response' } });
    expect(fetcher).toHaveBeenCalledWith(
      `${testBase}/contract-test`,
      expect.objectContaining({
        credentials: 'include',
        cache: 'no-store',
        redirect: 'error',
        method: 'GET',
      }),
    );
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).has('Authorization')).toBe(false);
  });

  it('bootstraps and decodes the Sanctum cookie before a write', async () => {
    let cookie = '';
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (url === `${testBase}/sanctum/csrf-cookie`) {
        cookie = 'other=value; XSRF-TOKEN=token%2Bvalue%3D';
        return new Response(null, { status: 204 });
      }
      return Response.json({ data: { title: 'Saved' } });
    });
    const client = createApiClient({ baseUrl: testBase, fetch: fetcher, readCookie: () => cookie });
    await client.request('/contract-test', {
      method: 'POST',
      schema: resultSchema,
      body: { title: 'A' },
      bodySchema: z.object({ title: z.string() }),
      idempotencyKey: '3e95208d-fd25-443c-8f46-a3c3a3da9c5d',
    });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      `${testBase}/sanctum/csrf-cookie`,
      `${testBase}/contract-test`,
    ]);
    const headers = new Headers(fetcher.mock.calls[1][1]?.headers);
    expect(headers.get('X-XSRF-TOKEN')).toBe('token+value=');
    expect(headers.get('Idempotency-Key')).toBe('3e95208d-fd25-443c-8f46-a3c3a3da9c5d');
    expect(fetcher.mock.calls[1][1]?.body).toBe('{"title":"A"}');
  });

  it('stops before mutation if the browser cannot read the CSRF cookie', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl: testBase, fetch: fetcher, readCookie: () => '' });
    await expect(
      client.request('/contract-test', { method: 'DELETE', schema: z.null() }),
    ).rejects.toMatchObject({ code: 'csrf' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('requires a valid explicit request schema before making network calls', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createApiClient({ baseUrl: testBase, fetch: fetcher });
    await expect(
      client.request('/contract-test', { method: 'POST', schema: z.null(), body: { amount: 10 } }),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    await expect(
      client.request('/contract-test', {
        method: 'POST',
        schema: z.null(),
        body: { amount: -1 },
        bodySchema: z.object({ amount: z.number().positive() }),
      }),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(['https://attacker.test', '//attacker.test/path', '/\\attacker.test/path'])(
    'refuses an external or malformed API path: %s',
    async (path) => {
      const fetcher = vi.fn<typeof fetch>();
      await expect(
        createApiClient({ baseUrl: testBase, fetch: fetcher }).request(path, { schema: z.null() }),
      ).rejects.toMatchObject({ code: 'configuration' });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it('fails closed on unapproved response shapes with a support ID', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ data: { title: 45 } }, { headers: { 'X-Request-ID': 'req-validated' } }),
      );
    await expect(
      createApiClient({ baseUrl: testBase, fetch: fetcher }).request('/contract-test', {
        schema: resultSchema,
      }),
    ).rejects.toMatchObject({ code: 'invalid_response', requestId: 'req-validated' });
  });

  it('broadcasts session expiry for authenticated reads, never invalid login credentials', async () => {
    const onUnauthorized = vi.fn();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(null, { status: 401 }));
    const client = createApiClient({ baseUrl: testBase, fetch: fetcher, onUnauthorized });
    await expect(client.request('/contract-test', { schema: z.null() })).rejects.toMatchObject({
      status: 401,
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    await expect(
      client.request('/contract-test', { schema: z.null(), notifyOnUnauthorized: false }),
    ).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not retry writes after a network failure or expose raw exception details', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('Private transport diagnostic'));
    const client = createApiClient({
      baseUrl: testBase,
      fetch: fetcher,
      readCookie: () => 'XSRF-TOKEN=safe',
    });
    const result = client.request('/contract-test', {
      method: 'POST',
      schema: z.null(),
      idempotencyKey: '3e95208d-fd25-443c-8f46-a3c3a3da9c5d',
    });
    await expect(result).rejects.toMatchObject({ code: 'network' });
    await expect(result).rejects.not.toThrow('Private transport diagnostic');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('preserves cancellation and does not normalize it into a visible connection error', async () => {
    const abortController = new AbortController();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );
    const client = createApiClient({ baseUrl: testBase, fetch: fetcher });
    const pending = client.request('/contract-test', {
      schema: z.null(),
      signal: abortController.signal,
    });
    abortController.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await expect(pending).rejects.not.toBeInstanceOf(ApiError);
  });

  it('makes no request when configuration is absent', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      createApiClient({ baseUrl: null, fetch: fetcher }).request('/auth/me', { schema: z.null() }),
    ).rejects.toMatchObject({ code: 'configuration' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects malformed or header-injection cookie values', () => {
    expect(readXsrfCookie('XSRF-TOKEN=%invalid')).toBeNull();
    expect(readXsrfCookie('XSRF-TOKEN=a%0D%0AX-Injected%3Atrue')).toBeNull();
    expect(readXsrfCookie('OTHER-XSRF-TOKEN=wrong')).toBeNull();
  });

  it('rejects non-object or oversized JSON and invalid idempotency keys before transport', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createApiClient({ baseUrl: testBase, fetch: fetcher });
    for (const body of [null, [], 'text', { text: 'ع'.repeat(33_000) }]) {
      await expect(
        client.request('/contract-test', {
          method: 'POST',
          schema: z.null(),
          body,
          bodySchema: z.unknown(),
        }),
      ).rejects.toMatchObject({ code: 'invalid_request' });
    }
    for (const key of ['short-key', 'a'.repeat(129), 'a'.repeat(32) + '.', 'a'.repeat(32) + ':']) {
      await expect(
        client.request('/contract-test', { method: 'POST', schema: z.null(), idempotencyKey: key }),
      ).rejects.toMatchObject({ code: 'invalid_request' });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects duplicate query keys and fragments before transport', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = createApiClient({ baseUrl: testBase, fetch: fetcher });
    for (const path of ['/contract-test?cursor=one&cursor=two', '/contract-test#fragment']) {
      await expect(client.request(path, { schema: z.null() })).rejects.toMatchObject({
        code: 'configuration',
      });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
});
