import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApiClient } from '@/lib/api/client';

vi.mock('@/lib/config', () => ({ config: { apiBaseUrl: null } }));
afterEach(() => vi.unstubAllEnvs());

describe('safe response-contract diagnostics', () => {
  it('emits only schema paths, issue codes, static expected types and JSON kinds in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const schema = z.strictObject({
      data: z.object({ total: z.number(), contacts: z.record(z.string(), z.number()) }),
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(
        {
          data: {
            total: 'private-account-value',
            contacts: { 'secret.person@example.test': 'sensitive-value' },
          },
          auth_cookie_secret: 'never disclose',
        },
        { headers: { 'X-Request-ID': 'private-support-id' } },
      ),
    );
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetch: fetcher });
    await expect(
      client.request('/contract?private-query=secret', { schema }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
    expect(warning).toHaveBeenCalledOnce();
    const emitted = JSON.stringify(warning.mock.calls);
    expect(emitted).not.toMatch(
      /private-account-value|secret\.person|sensitive-value|auth_cookie_secret|never disclose|private-support-id|private-query|api\.example/,
    );
    expect(warning).toHaveBeenCalledWith(
      '[Porta API] Response schema mismatch',
      JSON.stringify([
        {
          code: 'invalid_type',
          path: ['data', 'total'],
          expected: 'number',
          receivedKind: 'string',
        },
        {
          code: 'invalid_type',
          path: ['data', 'contacts', '[key]'],
          expected: 'number',
          receivedKind: 'string',
        },
        { code: 'unrecognized_keys', path: [], receivedKind: 'object' },
      ]),
    );
  });

  it('distinguishes arrays, nulls and missing fields without their contents', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const schema = z.object({
      counts: z.record(z.string(), z.number()),
      total: z.number(),
      required: z.string(),
    });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ counts: ['private-value'], total: null }));
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetch: fetcher });
    await expect(client.request('/contract', { schema })).rejects.toMatchObject({
      code: 'invalid_response',
    });
    expect(warning).toHaveBeenCalledWith(
      '[Porta API] Response schema mismatch',
      JSON.stringify([
        { code: 'invalid_type', path: ['counts'], expected: 'record', receivedKind: 'array' },
        { code: 'invalid_type', path: ['total'], expected: 'number', receivedKind: 'null' },
        { code: 'invalid_type', path: ['required'], expected: 'string', receivedKind: 'missing' },
      ]),
    );
  });

  it('never emits response diagnostics in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ data: 'private-value' }));
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetch: fetcher });
    await expect(
      client.request('/contract', { schema: z.object({ data: z.number() }) }),
    ).rejects.toMatchObject({ code: 'invalid_response' });
    expect(warning).not.toHaveBeenCalled();
  });
});
