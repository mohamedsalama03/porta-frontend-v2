import { Suspense } from 'react';
import { AuthProviders } from '@/features/auth/auth-providers';
import { DashboardSession } from '@/features/auth/dashboard-session';
import { PageSkeleton } from '@/components/feedback/page-skeleton';
import '@/features/auth/auth.css';
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProviders>
      <Suspense
        fallback={
          <main className="session-loading">
            <PageSkeleton />
          </main>
        }
      >
        <DashboardSession>{children}</DashboardSession>
      </Suspense>
    </AuthProviders>
  );
}
