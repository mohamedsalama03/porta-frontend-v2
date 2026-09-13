import { describe, expect, it } from 'vitest';
import {
  getCurrentModule,
  getNavigationHref,
  getNavigationItems,
  navigationItems,
  canAccessModule,
  canAccessRoute,
} from '@/lib/navigation';

describe('permission-aware navigation', () => {
  it('checks exact create permissions independently from list permissions', () => {
    expect(canAccessRoute({ permissions: ['shipments.create'] }, '/shipments/new')).toBe(true);
    expect(canAccessRoute({ permissions: ['shipments.view'] }, '/shipments/new')).toBe(false);
    expect(canAccessRoute({ permissions: ['drivers.manage'] }, '/drivers/new')).toBe(true);
    expect(canAccessRoute(null, '/trips/new')).toBe(false);
    expect(canAccessRoute({ permissions: ['shipments.create'] }, '/shipments')).toBe(false);
  });
  it('shows no protected modules without explicit capabilities', () => {
    expect(getNavigationItems(null, 'live')).toEqual([]);
    expect(
      getNavigationItems({ permissions: ['*', 'admin', 'shipments.*'] }, 'live').map(
        (item) => item.key,
      ),
    ).toEqual(['settings']);
  });

  it('only includes the exact capabilities provided by the authenticated user', () => {
    expect(
      getNavigationItems(
        { permissions: ['shipments.view', 'drivers.view', 'shipments.update'] },
        'live',
      ).map((item) => item.key),
    ).toEqual(['shipments', 'drivers', 'settings']);
  });

  it('keeps visual-preview navigation separate from protected routes', () => {
    expect(getNavigationItems(null, 'preview')).toHaveLength(navigationItems.length);
    expect(getNavigationHref('dashboard', 'preview')).toBe('/preview');
    expect(getNavigationHref('shipments', 'preview')).toBe('/preview/shipments');
    expect(getNavigationHref('dashboard', 'live')).toBe('/dashboard');
    expect(getNavigationHref('shipments', 'live')).toBe('/shipments');
  });

  it('resolves detail breadcrumbs and rejects unrelated route names', () => {
    expect(getCurrentModule('/preview/shipments/example')).toBe('shipments');
    expect(getCurrentModule('/preview')).toBe('dashboard');
    expect(getCurrentModule('/payments/example')).toBe('payments');
    expect(getCurrentModule('/unsupported')).toBeUndefined();
  });

  it('uses the approved administrative read permissions and keeps local settings available', () => {
    const subject = {
      permissions: [
        'reports.view',
        'cities.manage',
        'pricing.view',
        'payments.manage',
        'users.manage',
      ],
    };
    expect(getNavigationItems(subject, 'live').map((item) => item.key)).toEqual([
      'dashboard',
      'cities',
      'branches',
      'shipment-types',
      'pricing',
      'payments',
      'reports',
      'users',
      'settings',
    ]);
    expect(canAccessModule({ permissions: [] }, 'settings')).toBe(true);
    expect(canAccessModule(null, 'settings')).toBe(false);
    expect(canAccessModule({ permissions: [] }, undefined)).toBe(false);
    expect(canAccessModule({ permissions: ['pricing.manage'] }, 'pricing')).toBe(false);
  });
});
