import { describe, expect, it, vi } from 'vitest';
vi.stubEnv('NEXT_PUBLIC_APP_MODE', 'foundation');
const { parseConfiguration } = await import('@/lib/config');

describe('environment boundary', () => {
  it('fails connected startup without an approved origin', () => {
    expect(() => parseConfiguration({})).toThrow('NEXT_PUBLIC_API_BASE_URL');
  });
  it('foundation mode never connects even if an origin was provided', () => {
    expect(
      parseConfiguration({
        NEXT_PUBLIC_APP_MODE: 'foundation',
        NEXT_PUBLIC_API_BASE_URL: 'https://api.example.test',
      }).apiBaseUrl,
    ).toBeNull();
  });
  it('disables preview in production regardless of preference', () => {
    expect(
      parseConfiguration({
        NEXT_PUBLIC_APP_MODE: 'foundation',
        NODE_ENV: 'production',
        NEXT_PUBLIC_ENABLE_PREVIEW: 'true',
      }).previewEnabled,
    ).toBe(false);
  });
  it.each([
    'https://name:secret@example.test',
    'file:///data',
    'https://example.test/api',
    'https://example.test?x=1',
  ])('rejects unsafe origins: %s', (url) => {
    expect(() => parseConfiguration({ NEXT_PUBLIC_API_BASE_URL: url })).toThrow();
  });
  it('preserves an approved origin with separately configured endpoint paths', () => {
    expect(
      parseConfiguration({
        NEXT_PUBLIC_API_BASE_URL: 'https://staging.example.test/',
        NEXT_PUBLIC_AUTH_LOGIN_PATH: '/approved/session',
      }),
    ).toMatchObject({
      apiBaseUrl: 'https://staging.example.test',
      loginPath: '/approved/session',
      logoutPath: null,
    });
  });
});
