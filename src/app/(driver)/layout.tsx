import { Suspense, type ReactNode } from 'react';
import { AuthProviders } from '@/features/auth/auth-providers';
import { DriverSession } from '@/features/driver-workspace/session';
import { DriverShell } from '@/features/driver-workspace/shell';
import { DriverLoading } from '@/features/driver-workspace/states';
import '@/features/driver-workspace/shell.css';
import '@/features/driver-workspace/driver-workspace.css';

export default function DriverLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProviders>
      <Suspense
        fallback={
          <main className="driver-session-state">
            <DriverLoading message="جارٍ التحقق من حسابك…" />
          </main>
        }
      >
        <DriverSession>
          <DriverShell>{children}</DriverShell>
        </DriverSession>
      </Suspense>
    </AuthProviders>
  );
}
