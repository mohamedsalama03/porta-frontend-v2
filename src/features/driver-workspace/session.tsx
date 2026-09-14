'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth/provider';
import { loginRedirectUrl } from '@/lib/auth/redirect';
import { ApiError } from '@/lib/api/errors';
import { RetryButton } from '@/components/feedback/retry-button';
import { getDriverTrips } from './api';
import { driverKeys } from './model';
import { DriverLoading } from './states';
import { useDriverRead } from './use-driver-read';

const contextQuery = { per_page: 20 } as const;

function DriverSessionState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="driver-session-state">
      <section className="driver-access-panel" aria-labelledby="driver-access-title">
        <ShieldCheck className="driver-access-icon" aria-hidden="true" />
        <h1 id="driver-access-title">{title}</h1>
        {children}
      </section>
    </main>
  );
}

/** Shared cookie session plus a successful driver-scoped read establish this boundary. */
export function DriverSession({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      router.replace(
        loginRedirectUrl(
          `${pathname}${params.size ? `?${params.toString()}` : ''}`,
          auth.sessionExpired,
        ),
      );
    }
  }, [auth.status, auth.sessionExpired, pathname, params, router]);

  if (auth.status === 'loading' || auth.status === 'unauthenticated') {
    return (
      <main className="driver-session-state">
        <DriverLoading
          message={
            auth.sessionExpired
              ? 'انتهت جلستك. جارٍ الانتقال إلى تسجيل الدخول.'
              : 'جارٍ التحقق من حسابك…'
          }
        />
      </main>
    );
  }

  if (auth.status === 'unavailable') {
    return (
      <DriverSessionState title="مساحة السائق غير متاحة حالياً">
        <p>تعذّر الاتصال بخدمة تسجيل الدخول. حاول مجددًا بعد تفعيل الخدمة.</p>
        <Link href="/login" className="driver-shell-button">
          تسجيل الدخول
        </Link>
      </DriverSessionState>
    );
  }

  if (auth.status === 'error') {
    return (
      <DriverSessionState title="تعذّر التحقق من حسابك">
        <p role="alert">{auth.error?.message}</p>
        <RetryButton
          error={auth.error}
          retry={() => void auth.refresh()}
          className="driver-shell-button"
        >
          <RefreshCw aria-hidden="true" />
          إعادة المحاولة
        </RetryButton>
      </DriverSessionState>
    );
  }

  if (auth.user?.role !== 'DRIVER') return <DriverUnavailableAccount />;

  // Unmount the scope observer at session end so cleared private caches stay empty.
  return <DriverScope>{children}</DriverScope>;
}

function DriverUnavailableAccount() {
  const auth = useAuth();
  return (
    <DriverSessionState title="مساحة السائق غير متاحة لهذا الحساب">
      <p>لا يمكن عرض عمل السائق لهذا الحساب. تواصل مع مسؤول العمليات للتحقق من الوصول.</p>
      {auth.error && <p role="alert">{auth.error.message}</p>}
      {auth.capabilities.canLogout && (
        <RetryButton
          error={auth.error}
          className="driver-shell-button"
          retry={() => void auth.logout().catch(() => undefined)}
        >
          <LogOut aria-hidden="true" />
          تسجيل الخروج
        </RetryButton>
      )}
    </DriverSessionState>
  );
}

function DriverScope({ children }: { children: ReactNode }) {
  const context = useDriverRead({
    queryKey: driverKeys.trips(contextQuery),
    queryFn: (signal) => getDriverTrips(contextQuery, signal),
  });
  const scopeRejected =
    context.error instanceof ApiError && [401, 403, 404].includes(context.error.status);
  if (scopeRejected) return <DriverUnavailableAccount />;

  const transientFailure =
    context.error instanceof ApiError &&
    (context.error.code === 'network' ||
      (context.error.code === 'http' &&
        (context.error.status === 429 || context.error.status >= 500)));

  if (context.isError && (!context.data || !transientFailure)) {
    return (
      <DriverSessionState title="تعذّر تحميل مساحة السائق">
        <p role="alert">
          {context.error instanceof ApiError
            ? context.error.message
            : 'تعذّر الاتصال بالخدمة. حاول مجددًا.'}
        </p>
        <RetryButton
          error={context.error}
          disabled={context.isFetching}
          className="driver-shell-button"
          retry={() => void context.refresh()}
        >
          <RefreshCw aria-hidden="true" />
          إعادة المحاولة
        </RetryButton>
      </DriverSessionState>
    );
  }

  if (!context.data) {
    return (
      <main className="driver-session-state">
        <DriverLoading message="جارٍ تحميل مساحة السائق…" />
      </main>
    );
  }

  return (
    <>
      {context.isError && (
        <div className="driver-scope-notice" role="status">
          تعذّر تحديث بيانات العمل. قد تكون البيانات المعروضة غير محدثة.
        </div>
      )}
      {children}
    </>
  );
}

/** Read the existing session only inside the established DriverSession boundary. */
export function useDriverSession() {
  const auth = useAuth();
  if (auth.status !== 'authenticated' || auth.user?.role !== 'DRIVER') {
    throw new Error('Driver workspace requires an authenticated driver session');
  }
  return { ...auth, user: auth.user };
}
