'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, type ApiClient } from '@/lib/api/client';
import { ApiError, isAbortError } from '@/lib/api/errors';
import { config } from '@/lib/config';
import { clearPrivateQueryCache } from '@/lib/query/client';
import {
  loginCredentialsSchema,
  type ApprovedSessionContract,
  type ApprovedLoginContract,
  type ApprovedLogoutContract,
  type LoginCredentials,
  type SessionUser,
} from './contracts';
import { loginRedirectUrl } from './redirect';
import { subscribeToSessionExpiry } from './session-events';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unavailable' | 'error';

interface AuthContextValue {
  user: SessionUser | null;
  status: AuthStatus;
  error: ApiError | null;
  sessionExpired: boolean;
  capabilities: { canLogin: boolean; canLogout: boolean; canReadSession: boolean };
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function asSafeError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError({ code: 'network' });
}

export function AuthProvider({
  children,
  client = api,
  sessionContract,
  loginContract,
  logoutContract,
}: {
  children: ReactNode;
  client?: ApiClient;
  sessionContract?: ApprovedSessionContract;
  loginContract?: ApprovedLoginContract;
  logoutContract?: ApprovedLogoutContract;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(
    config.apiBaseUrl && sessionContract ? 'loading' : 'unavailable',
  );
  const [error, setError] = useState<ApiError | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const authenticated = useRef(false);

  const capabilities = useMemo(
    () => ({
      canReadSession: Boolean(config.apiBaseUrl && sessionContract),
      canLogin: Boolean(config.apiBaseUrl && sessionContract && config.loginPath && loginContract),
      canLogout: Boolean(
        config.apiBaseUrl && sessionContract && config.logoutPath && logoutContract,
      ),
    }),
    [sessionContract, loginContract, logoutContract],
  );

  const expireSession = useCallback(() => {
    controller.current?.abort();
    authenticated.current = false;
    clearPrivateQueryCache(queryClient);
    setUser(null);
    setStatus('unauthenticated');
    setError(new ApiError({ status: 401 }));
    setSessionExpired(true);
    // Invalid login credentials never publish expiry events. Avoid login loops.
    if (typeof window !== 'undefined' && !/^\/login(?:\/|$)/.test(window.location.pathname)) {
      router.replace(
        loginRedirectUrl(`${window.location.pathname}${window.location.search}`, true),
      );
    }
  }, [queryClient, router]);

  const beginRequest = useCallback(() => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setStatus('loading');
    setError(null);
    setSessionExpired(false);
    return next;
  }, []);

  const readSession = useCallback(
    async (signal: AbortSignal): Promise<SessionUser> => {
      if (!sessionContract) throw new ApiError({ code: 'contract_unavailable' });
      const response = await client.request(sessionContract.path, {
        schema: sessionContract.responseSchema,
        signal,
        notifyOnUnauthorized: false,
      });
      return response.data;
    },
    [client, sessionContract],
  );

  const receiveSession = useCallback(
    (session: SessionUser, current: AbortController) => {
      if (current.signal.aborted || controller.current !== current) return;
      // The UI projection omits private identifiers; a refreshed cookie session
      // must not inherit resource data cached under the previously read session.
      clearPrivateQueryCache(queryClient);
      authenticated.current = true;
      setUser(session);
      setStatus('authenticated');
    },
    [queryClient],
  );

  const handleSessionFailure = useCallback(
    (cause: unknown, current: AbortController) => {
      if (isAbortError(cause) || current.signal.aborted || controller.current !== current) return;
      const safeError = asSafeError(cause);
      if (safeError.status === 401 && authenticated.current) {
        expireSession();
        return;
      }
      authenticated.current = false;
      clearPrivateQueryCache(queryClient);
      setUser(null);
      setError(safeError);
      setStatus(safeError.status === 401 ? 'unauthenticated' : 'error');
    },
    [expireSession, queryClient],
  );

  const refresh = useCallback(async () => {
    if (!capabilities.canReadSession) return;
    const current = beginRequest();
    await readSession(current.signal).then(
      (session) => receiveSession(session, current),
      (cause: unknown) => handleSessionFailure(cause, current),
    );
  }, [
    beginRequest,
    capabilities.canReadSession,
    handleSessionFailure,
    readSession,
    receiveSession,
  ]);

  useEffect(() => {
    if (!capabilities.canReadSession) {
      authenticated.current = false;
      clearPrivateQueryCache(queryClient);
      return;
    }
    const unsubscribe = subscribeToSessionExpiry(expireSession);
    const current = new AbortController();
    controller.current = current;
    void readSession(current.signal).then(
      (session) => receiveSession(session, current),
      (cause: unknown) => handleSessionFailure(cause, current),
    );
    return () => {
      unsubscribe();
      controller.current?.abort();
    };
  }, [
    capabilities.canReadSession,
    handleSessionFailure,
    expireSession,
    queryClient,
    readSession,
    receiveSession,
  ]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      if (!capabilities.canLogin || !config.loginPath || !loginContract) {
        throw new ApiError({ code: 'contract_unavailable' });
      }
      const validated = loginCredentialsSchema.safeParse(credentials);
      if (!validated.success) throw new ApiError({ code: 'invalid_request' });
      const current = beginRequest();
      authenticated.current = false;
      clearPrivateQueryCache(queryClient);
      setUser(null);
      try {
        await client.bootstrapCsrf(current.signal);
        await client.request(config.loginPath, {
          method: loginContract.method,
          body: loginContract.serialize(validated.data),
          bodySchema: loginContract.bodySchema,
          schema: loginContract.responseSchema,
          signal: current.signal,
          notifyOnUnauthorized: false,
        });
        const session = await readSession(current.signal);
        if (current.signal.aborted || controller.current !== current) return;
        authenticated.current = true;
        setUser(session);
        setStatus('authenticated');
      } catch (cause: unknown) {
        if (isAbortError(cause) || current.signal.aborted || controller.current !== current)
          throw cause;
        const safeError = asSafeError(cause);
        setError(safeError);
        setStatus('unauthenticated');
        throw safeError;
      }
    },
    [beginRequest, capabilities.canLogin, client, loginContract, queryClient, readSession],
  );

  const logout = useCallback(async () => {
    if (!capabilities.canLogout || !config.logoutPath || !logoutContract) {
      throw new ApiError({ code: 'contract_unavailable' });
    }
    const current = beginRequest();
    try {
      await client.request(config.logoutPath, {
        method: logoutContract.method,
        body: logoutContract.serialize?.(),
        bodySchema: logoutContract.bodySchema,
        schema: logoutContract.responseSchema,
        signal: current.signal,
        notifyOnUnauthorized: false,
      });
      if (current.signal.aborted || controller.current !== current) return;
      authenticated.current = false;
      clearPrivateQueryCache(queryClient);
      setUser(null);
      setStatus('unauthenticated');
      setSessionExpired(false);
      router.replace('/login');
    } catch (cause: unknown) {
      if (isAbortError(cause) || current.signal.aborted || controller.current !== current)
        throw cause;
      const safeError = asSafeError(cause);
      if (safeError.status === 401) {
        expireSession();
        return;
      }
      setError(safeError);
      setStatus(authenticated.current ? 'authenticated' : 'error');
      throw safeError;
    }
  }, [
    beginRequest,
    capabilities.canLogout,
    client,
    expireSession,
    logoutContract,
    queryClient,
    router,
  ]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: capabilities.canReadSession ? user : null,
      status: capabilities.canReadSession ? status : 'unavailable',
      error: capabilities.canReadSession ? error : null,
      sessionExpired: capabilities.canReadSession && sessionExpired,
      capabilities,
      login,
      logout,
      refresh,
    }),
    [user, status, error, sessionExpired, capabilities, login, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth requires AuthProvider');
  return value;
}
