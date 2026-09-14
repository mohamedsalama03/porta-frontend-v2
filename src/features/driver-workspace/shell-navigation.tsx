'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, Package, Route, UserRound } from 'lucide-react';

const destinations = [
  { href: '/driver', label: 'الرئيسية', icon: House },
  { href: '/driver/trips', label: 'الرحلات', icon: Route },
  { href: '/driver/shipments', label: 'الشحنات', icon: Package },
  { href: '/driver/account', label: 'الحساب', icon: UserRound },
] as const;

export function DriverNavigation() {
  const pathname = usePathname();
  return (
    <nav className="driver-navigation" aria-label="أقسام مساحة السائق">
      <div className="driver-navigation-inner">
        {destinations.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || (href !== '/driver' && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className="driver-navigation-link"
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
