import { describe, expect, it } from 'vitest';
import { sessionResponseSchema } from '@/lib/auth/contracts';
import { loginRedirectUrl, safeReturnPath } from '@/lib/auth/redirect';
import { can, createPermissionChecker } from '@/lib/permissions';
import { testSessionResponse } from './auth-fixtures';

describe('permission presentation', () => {
  it('denies absent permissions and never promotes role names or wildcards', () => {
    expect(can(null, 'shipments.update')).toBe(false);
    expect(can({ permissions: [] }, 'shipments.update')).toBe(false);
    expect(can({ permissions: ['admin', '*', 'shipments.*'] }, 'shipments.update')).toBe(false);
    expect(can({ permissions: ['*'] }, '*')).toBe(false);
    expect(can({ permissions: ['shipments.update'] }, 'shipments.update')).toBe(true);
    expect(createPermissionChecker({ permissions: ['shipments.view'] })('shipments.update')).toBe(
      false,
    );
  });

  it('validates the approved envelope, projects safe identity fields and rejects contract violations', () => {
    expect(sessionResponseSchema.parse(testSessionResponse).data).toEqual({
      name: 'موظف العمليات',
      email: 'operator@example.test',
      permissions: ['shipments.view'],
    });
    expect(
      sessionResponseSchema.safeParse({
        ...testSessionResponse,
        data: { ...testSessionResponse.data, password_hash: 'unexpected' },
      }).success,
    ).toBe(false);
    expect(
      sessionResponseSchema.safeParse({
        data: { name: 'مستخدم', email: 'operator@example.test', role: 'admin' },
      }).success,
    ).toBe(false);
    expect(
      sessionResponseSchema.safeParse({ user: { name: 'مستخدم', permissions: [] } }).success,
    ).toBe(false);
  });
});

describe('safe authentication redirects', () => {
  it.each([
    'https://attacker.test',
    '//attacker.test',
    '/\\attacker.test',
    '/%2f%2fattacker.test',
    '/%255cattacker.test',
    'javascript:alert(1)',
    '/login',
    '/login?returnTo=/login',
    '/a/../login',
    '/%6cogin',
    '/%E0%A4%A',
  ])('rejects unsafe paths or redirect loops: %s', (path) => {
    expect(safeReturnPath(path)).toBe('/dashboard');
  });

  it('preserves encoded local filters and constructs an expiry URL', () => {
    const returnTo = '/shipments?q=two%20words%26value&status=IN_TRANSIT';
    expect(safeReturnPath(returnTo)).toBe(returnTo);
    const redirect = new URL(loginRedirectUrl(returnTo, true), 'https://frontend.example.test');
    expect(redirect.pathname).toBe('/login');
    expect(redirect.searchParams.get('returnTo')).toBe(returnTo);
    expect(redirect.searchParams.get('reason')).toBe('expired');
  });
});
