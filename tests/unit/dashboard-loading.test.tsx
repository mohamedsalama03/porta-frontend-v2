import { afterEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { LiveReports } from '@/features/operations/reports';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard',
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { permissions: ['reports.view'] } }),
}));
vi.mock('@/lib/config', () => ({ config: { apiBaseUrl: 'http://localhost:8080' } }));

afterEach(() => vi.restoreAllMocks());

it.each([true, false])(
  'announces report loading once and hides decorative skeletons (dashboard=%s)',
  (dashboard) => {
    vi.spyOn(api, 'request').mockImplementation(() => new Promise(() => {}));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <LiveReports dashboard={dashboard} />
      </QueryClientProvider>,
    );

    const status = screen.getByRole('status');
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(status).toHaveTextContent('جارٍ تحميل التقرير');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(status).not.toHaveAttribute('aria-label');
    expect(status.querySelector('.report-metrics')).toHaveAttribute('aria-hidden', 'true');
    expect(status.querySelector('.report-chart-skeleton')).toHaveAttribute('aria-hidden', 'true');
    expect(status.querySelectorAll('.report-metric-skeleton')).toHaveLength(4);

    unmount();
    client.clear();
  },
);
