import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PublicOrderQueryProvider } from '@/features/public-order/query-provider';

describe('public order query isolation', () => {
  it('does not inherit staff data or share caches between public mounts', () => {
    const staff = new QueryClient();
    staff.setQueryData(['shared-key'], 'staff-only');
    const observed = new Map<string, QueryClient>();

    function Capture({ name }: { name: string }) {
      observed.set(name, useQueryClient());
      return null;
    }

    const view = render(
      <QueryClientProvider client={staff}>
        <PublicOrderQueryProvider>
          <Capture name="first" />
        </PublicOrderQueryProvider>
        <PublicOrderQueryProvider>
          <Capture name="second" />
        </PublicOrderQueryProvider>
      </QueryClientProvider>,
    );

    const first = observed.get('first')!;
    const second = observed.get('second')!;
    expect(first).not.toBe(staff);
    expect(second).not.toBe(first);
    expect(first.getQueryData(['shared-key'])).toBeUndefined();
    first.setQueryData(['shared-key'], 'public-only');
    expect(second.getQueryData(['shared-key'])).toBeUndefined();
    expect(staff.getQueryData(['shared-key'])).toBe('staff-only');

    view.unmount();
    first.clear();
    second.clear();
    staff.clear();
  });

  it('retains one cache across rerenders but creates a new cache after remount', () => {
    let current: QueryClient | undefined;
    function Capture() {
      current = useQueryClient();
      return null;
    }

    const element = (
      <PublicOrderQueryProvider>
        <Capture />
      </PublicOrderQueryProvider>
    );
    const firstView = render(element);
    const first = current!;
    first.setQueryData(['public-order', 'fixture'], 'in-memory-only');
    firstView.rerender(element);
    expect(current).toBe(first);
    firstView.unmount();

    const secondView = render(element);
    expect(current).not.toBe(first);
    expect(current!.getQueryData(['public-order', 'fixture'])).toBeUndefined();
    secondView.unmount();
    first.clear();
    current!.clear();
  });
});
