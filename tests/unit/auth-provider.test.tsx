import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApiClient } from '@/lib/api/client';
import { AuthProvider, useAuth } from '@/lib/auth/provider';
import { notifySessionExpired } from '@/lib/auth/session-events';
import {
  portaSessionContract,
  portaLoginContract,
  portaLogoutContract,
} from '@/lib/auth/porta-adapters';
import { createQueryClient } from '@/lib/query/client';
import { shipmentKeys } from '@/lib/query/keys';
import { testSessionResponse as session, testLogoutResponse } from './auth-fixtures';

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
const router = { replace };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/config', () => ({
  config: {
    apiBaseUrl: 'https://api.example.test',
    loginPath: '/api/v1/auth/login',
    logoutPath: '/api/v1/auth/logout',
    previewEnabled: false,
  },
}));

function AuthProbe() {
  const { user, status, error, sessionExpired, capabilities, login, logout, refresh } = useAuth();
  return (
    <>
      <p aria-label="session status">{status}</p>
      <p aria-label="session name">{user?.name ?? 'no user'}</p>
      <p aria-label="login available">{String(capabilities.canLogin)}</p>
      <p aria-label="session available">{String(capabilities.canReadSession)}</p>
      <p aria-label="error code">{error?.status ?? 'no error'}</p>
      <p aria-label="session expired">{String(sessionExpired)}</p>
      <button
        onClick={() => {
          void login({ email: 'operator@example.test', password: 'test-only-password' }).catch(
            () => undefined,
          );
        }}
      >
        Login
      </button>
      <button
        onClick={() => {
          void logout().catch(() => undefined);
        }}
      >
        Logout
      </button>
      <button
        onClick={() => {
          void refresh();
        }}
      >
        Refresh
      </button>
    </>
  );
}

function setup(fetcher: typeof fetch, adapters: boolean, approvedSession = true) {
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
        sessionContract={approvedSession ? portaSessionContract : undefined}
        loginContract={adapters ? portaLoginContract : undefined}
        logoutContract={adapters ? portaLogoutContract : undefined}
      >
        <AuthProbe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { client, queryClient };
}

describe('session lifecycle', () => {
  it('does not read sessions or enable login with a URL but no approved session adapter', async () => {
    const fetcher = vi.fn<typeof fetch>();
    setup(fetcher, true, false);
    expect(screen.getByLabelText('session status')).toHaveTextContent('unavailable');
    expect(screen.getByLabelText('session available')).toHaveTextContent('false');
    expect(screen.getByLabelText('login available')).toHaveTextContent('false');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
      fireEvent.click(screen.getByRole('button', { name: 'Login' }));
      fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByLabelText('session status')).toHaveTextContent('unavailable');
  });

  it('keeps login unavailable with configured paths but no approved adapter', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(null, { status: 401 }));
    setup(fetcher, false);
    await waitFor(() =>
      expect(screen.getByLabelText('session status')).toHaveTextContent('unauthenticated'),
    );
    expect(screen.getByLabelText('login available')).toHaveTextContent('false');
    expect(screen.getByLabelText('session expired')).toHaveTextContent('false');
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('clears private data and safely redirects after an authenticated request expires', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        url === 'https://api.example.test/api/v1/auth/me'
          ? Response.json(session)
          : new Response(null, { status: 401 }),
      );
    const { client, queryClient } = setup(fetcher, false);
    await waitFor(() =>
      expect(screen.getByLabelText('session name')).toHaveTextContent('موظف العمليات'),
    );
    queryClient.setQueryData(shipmentKeys.list(), { private: 'records' });
    await act(async () => {
      await expect(client.request('/test-private', { schema: z.null() })).rejects.toMatchObject({
        status: 401,
      });
    });
    expect(screen.getByLabelText('session status')).toHaveTextContent('unauthenticated');
    expect(screen.getByLabelText('session name')).toHaveTextContent('no user');
    expect(screen.getByLabelText('session expired')).toHaveTextContent('true');
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(replace).toHaveBeenCalledWith(expect.stringContaining('reason=expired'));
  });

  it('does not redirect or emit session expiry after invalid login credentials', async () => {
    replace.mockClear();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (url === 'https://api.example.test/sanctum/csrf-cookie')
        return new Response(null, { status: 204 });
      return new Response(null, {
        status: url === 'https://api.example.test/api/v1/auth/login' ? 422 : 401,
      });
    });
    setup(fetcher, true);
    await waitFor(() =>
      expect(screen.getByLabelText('session status')).toHaveTextContent('unauthenticated'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(screen.getByLabelText('session status')).toHaveTextContent('unauthenticated'),
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText('session expired')).toHaveTextContent('false');
    expect(screen.getByLabelText('error code')).toHaveTextContent('422');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://api.example.test/api/v1/auth/me',
      'https://api.example.test/sanctum/csrf-cookie',
      'https://api.example.test/api/v1/auth/login',
    ]);
  });

  it('derives a successful login session only from the follow-up auth/me response', async () => {
    let signedIn = false;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (url === 'https://api.example.test/api/v1/auth/me')
        return signedIn ? Response.json(session) : new Response(null, { status: 401 });
      if (url === 'https://api.example.test/api/v1/auth/login') {
        signedIn = true;
        return Response.json(session);
      }
      return new Response(null, { status: 204 });
    });
    setup(fetcher, true);
    await waitFor(() =>
      expect(screen.getByLabelText('session status')).toHaveTextContent('unauthenticated'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() =>
      expect(screen.getByLabelText('session name')).toHaveTextContent('موظف العمليات'),
    );
    expect(screen.getByLabelText('session status')).toHaveTextContent('authenticated');
    expect(fetcher.mock.calls.at(-1)?.[0]).toBe('https://api.example.test/api/v1/auth/me');
  });

  it('purges private data and leaves the dashboard only after confirmed logout', async () => {
    replace.mockClear();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        url === 'https://api.example.test/api/v1/auth/me'
          ? Response.json(session)
          : Response.json(testLogoutResponse),
      );
    const { queryClient } = setup(fetcher, true);
    await waitFor(() =>
      expect(screen.getByLabelText('session name')).toHaveTextContent('موظف العمليات'),
    );
    queryClient.setQueryData(shipmentKeys.list(), { private: 'records' });
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() =>
      expect(screen.getByLabelText('session status')).toHaveTextContent('unauthenticated'),
    );
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(screen.getByLabelText('session name')).toHaveTextContent('no user');
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('does not inherit cached resources if cookies identify a different session during refresh', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(session))
      .mockResolvedValueOnce(
        Response.json({
          ...session,
          data: { ...session.data, name: 'مستخدم آخر', email: 'another@example.test' },
        }),
      );
    const { queryClient } = setup(fetcher, false);
    await waitFor(() =>
      expect(screen.getByLabelText('session name')).toHaveTextContent('موظف العمليات'),
    );
    queryClient.setQueryData(shipmentKeys.list(), { private: 'previous session records' });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() =>
      expect(screen.getByLabelText('session name')).toHaveTextContent('مستخدم آخر'),
    );
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('never authenticates from the login response when subsequent session discovery fails', async () => {
    replace.mockClear();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (url === 'https://api.example.test/api/v1/auth/me')
        return new Response(null, { status: 401 });
      if (url === 'https://api.example.test/api/v1/auth/login') return Response.json(session);
      return new Response(null, { status: 204 });
    });
    setup(fetcher, true);
    await waitFor(() =>
      expect(screen.getByLabelText('session status')).toHaveTextContent('unauthenticated'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4));
    await waitFor(() =>
      expect(screen.getByLabelText('session status')).toHaveTextContent('unauthenticated'),
    );
    expect(screen.getByLabelText('session name')).toHaveTextContent('no user');
    expect(replace).not.toHaveBeenCalled();
  });

  it('keeps the session visible when logout does not return the approved confirmation', async () => {
    replace.mockClear();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        url === 'https://api.example.test/api/v1/auth/me'
          ? Response.json(session)
          : Response.json({ ...testLogoutResponse, data: { logged_out: false } }),
      );
    setup(fetcher, true);
    await waitFor(() =>
      expect(screen.getByLabelText('session status')).toHaveTextContent('authenticated'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    await waitFor(() => expect(screen.getByLabelText('error code')).toHaveTextContent('200'));
    expect(screen.getByLabelText('session status')).toHaveTextContent('authenticated');
    expect(screen.getByLabelText('session name')).toHaveTextContent('موظف العمليات');
    expect(replace).not.toHaveBeenCalled();
  });
});
