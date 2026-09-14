import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { AuthProvider } from '@/lib/auth/provider';
import {
  portaSessionContract,
  portaLoginContract,
  portaLogoutContract,
} from '@/lib/auth/porta-adapters';
import { notifySessionExpired } from '@/lib/auth/session-events';
import { createQueryClient } from '@/lib/query/client';
import { DriverSession } from '@/features/driver-workspace/session';
import { DriverAccount } from '@/features/driver-workspace/account';
import { driverKeys } from '@/features/driver-workspace/model';
import { LoginForm } from '@/features/auth/login-form';
import { testLogoutResponse, testSessionResponse } from './auth-fixtures';

const { getDriverTrips, replace, location } = vi.hoisted(() => ({
  getDriverTrips: vi.fn(),
  replace: vi.fn(),
  location: { pathname: '/driver', search: '' },
}));
const router = { replace };
vi.mock('@/features/driver-workspace/api', () => ({ getDriverTrips }));
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => location.pathname,
  useSearchParams: () => new URLSearchParams(location.search),
}));
vi.mock('@/lib/config', () => ({
  config: {
    apiBaseUrl: 'https://api.example.test',
    loginPath: '/api/v1/auth/login',
    logoutPath: '/api/v1/auth/logout',
    previewEnabled: false,
  },
}));

const driverSession = {
  ...testSessionResponse,
  data: {
    ...testSessionResponse.data,
    name: 'سائق الاختبار',
    email: 'driver@example.test',
    role: 'DRIVER' as const,
    permissions: [],
  },
};
const emptyTrips = {
  data: [],
  meta: { per_page: 20, next_cursor: null, previous_cursor: null },
};

function setup({
  session = driverSession,
  account = false,
  login = false,
  unauthenticated = false,
}: {
  session?: typeof testSessionResponse;
  account?: boolean;
  login?: boolean;
  unauthenticated?: boolean;
} = {}) {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
    if (url === 'https://api.example.test/api/v1/auth/me') {
      return unauthenticated ? new Response(null, { status: 401 }) : Response.json(session);
    }
    if (url === 'https://api.example.test/api/v1/auth/logout') {
      return Response.json(testLogoutResponse);
    }
    return new Response(null, { status: 401 });
  });
  const client = createApiClient({
    baseUrl: 'https://api.example.test',
    fetch: fetcher,
    readCookie: () => 'XSRF-TOKEN=test-token',
    onUnauthorized: notifySessionExpired,
  });
  const queryClient = createQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        client={client}
        sessionContract={portaSessionContract}
        loginContract={portaLoginContract}
        logoutContract={portaLogoutContract}
      >
        {login ? (
          <LoginForm />
        ) : (
          <DriverSession>{account ? <DriverAccount /> : <h1>عمل السائق المخصص</h1>}</DriverSession>
        )}
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { fetcher, client, queryClient };
}

beforeEach(() => {
  getDriverTrips.mockReset().mockResolvedValue(emptyTrips);
  replace.mockReset();
  location.pathname = '/driver';
  location.search = '';
});

describe('driver session boundary', () => {
  it('does not request scoped data or render work until identity and driver context succeed', async () => {
    let resolveContext!: (value: typeof emptyTrips) => void;
    getDriverTrips.mockImplementation(
      () =>
        new Promise<typeof emptyTrips>((resolve) => {
          resolveContext = resolve;
        }),
    );
    setup();
    expect(getDriverTrips).not.toHaveBeenCalled();
    expect(screen.queryByText('عمل السائق المخصص')).not.toBeInTheDocument();
    await waitFor(() => expect(getDriverTrips).toHaveBeenCalledTimes(1));
    expect(getDriverTrips).toHaveBeenCalledWith({ per_page: 20 }, expect.any(AbortSignal));
    expect(screen.queryByText('عمل السائق المخصص')).not.toBeInTheDocument();
    await act(async () => resolveContext(emptyTrips));
    expect(await screen.findByText('عمل السائق المخصص')).toBeInTheDocument();
  });

  it('rejects staff identities without any driver or admin request', async () => {
    const { fetcher } = setup({ session: testSessionResponse });
    expect(await screen.findByText('مساحة السائق غير متاحة لهذا الحساب')).toBeInTheDocument();
    expect(getDriverTrips).not.toHaveBeenCalled();
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/api/v1/auth/me',
    ]);
    expect(screen.queryByText('عمل السائق المخصص')).not.toBeInTheDocument();
  });

  it.each([403, 404])(
    'does not treat DRIVER role as sufficient when scoped context returns %i',
    async (status) => {
      getDriverTrips.mockRejectedValue(new ApiError({ status }));
      setup();
      expect(await screen.findByText('مساحة السائق غير متاحة لهذا الحساب')).toBeInTheDocument();
      expect(screen.queryByText('عمل السائق المخصص')).not.toBeInTheDocument();
      expect(getDriverTrips).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps work hidden after a scoped schema failure and shows only safe error prose', async () => {
    getDriverTrips.mockRejectedValue(new ApiError({ code: 'invalid_response' }));
    setup();
    expect(await screen.findByText('تعذّر تحميل مساحة السائق')).toBeInTheDocument();
    expect(screen.queryByText('عمل السائق المخصص')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('تعذّر قراءة استجابة الخدمة');
  });

  it('preserves previously authorized work on a transient refresh failure', async () => {
    const { queryClient } = setup();
    await screen.findByText('عمل السائق المخصص');
    getDriverTrips.mockRejectedValue(new ApiError({ code: 'network' }));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: driverKeys.trips({ per_page: 20 }) });
    });
    expect(screen.getByText('عمل السائق المخصص')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'قد تكون البيانات المعروضة غير محدثة',
    );
  });

  it('hides cached work immediately after scope is revoked', async () => {
    const { queryClient } = setup();
    await screen.findByText('عمل السائق المخصص');
    getDriverTrips.mockRejectedValue(new ApiError({ status: 403 }));
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: driverKeys.trips({ per_page: 20 }) });
    });
    expect(await screen.findByText('مساحة السائق غير متاحة لهذا الحساب')).toBeInTheDocument();
    expect(screen.queryByText('عمل السائق المخصص')).not.toBeInTheDocument();
  });

  it('respects Retry-After before another context request', async () => {
    getDriverTrips.mockRejectedValue(new ApiError({ status: 429, retryAfter: 60_000 }));
    setup();
    await screen.findByText('تعذّر تحميل مساحة السائق');
    const retry = screen.getByRole('button', { name: 'إعادة المحاولة' });
    expect(retry).toBeDisabled();
    fireEvent.click(retry);
    expect(getDriverTrips).toHaveBeenCalledTimes(1);
  });

  it('redirects anonymous driver visits to the same safe route', async () => {
    location.pathname = '/driver/shipments';
    location.search = 'status=IN_TRANSIT&phone=0911234567';
    setup({ unauthenticated: true });
    await waitFor(() => expect(replace).toHaveBeenCalled());
    const redirect = new URL(replace.mock.calls.at(-1)![0], 'https://frontend.example.test');
    expect(redirect.searchParams.get('returnTo')).toBe('/driver/shipments?status=IN_TRANSIT');
    expect(getDriverTrips).not.toHaveBeenCalled();
    expect(screen.queryByText('عمل السائق المخصص')).not.toBeInTheDocument();
  });

  it('uses shared expiry handling to clear driver cache and preserve a safe return route', async () => {
    location.pathname = '/driver/trips';
    const { client, queryClient } = setup();
    await screen.findByText('عمل السائق المخصص');
    queryClient.setQueryData(driverKeys.shipment('private-item'), { private: 'cached contact' });
    await act(async () => {
      await expect(
        client.request('/test-expired-session', { schema: z.null() }),
      ).rejects.toMatchObject({ status: 401 });
    });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(screen.queryByText('عمل السائق المخصص')).not.toBeInTheDocument();
    const redirect = new URL(replace.mock.calls.at(-1)![0], 'https://frontend.example.test');
    expect(redirect.searchParams.get('reason')).toBe('expired');
    expect(redirect.searchParams.get('returnTo')).toBe('/driver/trips');
  });

  it('shows minimal identity and clears all private reads on confirmed secure logout', async () => {
    const { queryClient, fetcher } = setup({ account: true });
    await screen.findByText('سائق الاختبار');
    expect(screen.getByText('driver@example.test')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(driverSession.data.id);
    expect(document.body).not.toHaveTextContent(driverSession.data.branch_id!);
    expect(document.body).not.toHaveTextContent('DRIVER');
    queryClient.setQueryData(driverKeys.shipment('private-item'), { private: 'cached contact' });
    fireEvent.click(screen.getByRole('button', { name: 'تسجيل الخروج' }));
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        'https://api.example.test/api/v1/auth/logout',
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      ),
    );
    await waitFor(() => expect(queryClient.getQueryCache().getAll()).toHaveLength(0));
    expect(screen.queryByText('سائق الاختبار')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/login');
  });
});

describe('shared driver login handoff', () => {
  it('defaults an authenticated driver to the driver home', async () => {
    setup({ login: true });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/driver'));
    expect(getDriverTrips).not.toHaveBeenCalled();
  });

  it('honors an intended driver route after shared login', async () => {
    location.search = 'returnTo=%2Fdriver%2Ftrips%3Fstatus%3DDEPARTED';
    setup({ login: true });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/driver/trips?status=DEPARTED'));
  });

  it('preserves staff login destination behavior', async () => {
    setup({ login: true, session: testSessionResponse });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/shipments'));
  });
});
