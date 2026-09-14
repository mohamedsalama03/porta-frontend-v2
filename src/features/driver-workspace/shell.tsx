import Link from 'next/link';
import type { ReactNode } from 'react';
import { PackageCheck } from 'lucide-react';
import { DriverNavigation } from './shell-navigation';

export function DriverShell({ children }: { children: ReactNode }) {
  return (
    <div className="driver-shell">
      <a href="#driver-main" className="driver-skip-link">
        الانتقال إلى المحتوى
      </a>
      <header className="driver-header">
        <div className="driver-header-inner">
          <Link href="/driver" className="driver-brand" aria-label="Porta — مساحة السائق">
            <PackageCheck aria-hidden="true" />
            <span dir="ltr">Porta</span>
          </Link>
          <span className="driver-header-label">مساحة السائق</span>
        </div>
      </header>
      <DriverNavigation />
      <main id="driver-main" className="driver-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
