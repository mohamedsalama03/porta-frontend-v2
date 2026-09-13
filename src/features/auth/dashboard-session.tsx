'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import { ApplicationShell } from '@/components/layout';
import { useAuth } from '@/lib/auth/provider';
import { loginRedirectUrl } from '@/lib/auth/redirect';
import { config } from '@/lib/config';
import { canAccessRoute } from '@/lib/navigation';
import { PageSkeleton } from '@/components/feedback/page-skeleton';
import { ErrorPanel } from '@/components/feedback/error-panel';

export function DashboardSession({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      const next = pathname + (params.size ? `?${params.toString()}` : '');
      router.replace(loginRedirectUrl(next, auth.sessionExpired));
    }
  }, [auth.status, auth.sessionExpired, pathname, params, router]);

  if (auth.status === 'loading' || auth.status === 'unauthenticated')
    return (
      <main className="session-loading">
        <PageSkeleton />
      </main>
    );
  if (auth.status === 'error')
    return (
      <main className="standalone-state">
        <ErrorPanel error={auth.error} retry={() => void auth.refresh()} />
      </main>
    );
  if (auth.status === 'unavailable')
    return (
      <main className="standalone-state">
        <section className="surface empty-panel">
          <div className="empty-symbol">
            <ShieldCheck aria-hidden="true" />
          </div>
          <h1>مساحة العمل قيد الإعداد</h1>
          <p>
            اكتمل تجهيز الواجهة الأساسية. تسجيل الدخول والبيانات التشغيلية ينتظران ربط الخدمة
            المعتمدة.
          </p>
          <div className="page-actions">
            <Link className="button button-primary" href="/login">
              <LogIn aria-hidden="true" />
              صفحة الدخول
            </Link>
            {config.previewEnabled && (
              <Link className="button button-secondary" href="/preview">
                معاينة الواجهة
              </Link>
            )}
          </div>
        </section>
      </main>
    );

  const allowed = canAccessRoute(auth.user, pathname);
  return (
    <ApplicationShell
      mode="live"
      user={auth.user}
      onLogout={auth.capabilities.canLogout ? auth.logout : undefined}
    >
      {allowed ? (
        children
      ) : (
        <section className="surface empty-panel">
          <div className="empty-symbol">
            <ShieldCheck aria-hidden="true" />
          </div>
          <h1>لا تملك صلاحية الوصول</h1>
          <p>اختر قسماً متاحاً من القائمة أو تواصل مع مسؤول النظام.</p>
        </section>
      )}
    </ApplicationShell>
  );
}
