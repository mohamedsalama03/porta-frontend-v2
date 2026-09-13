import Link from 'next/link';
import type { ReactNode } from 'react';
import { PublicOrderQueryProvider } from '@/features/public-order/query-provider';
import '@/features/public-order/public-order.css';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="public-order-page">
      <a className="public-order-skip" href="#main-content">
        انتقل إلى نموذج الطلب
      </a>
      <header className="public-order-header">
        <Link
          href="/order"
          className="public-order-brand"
          aria-label="Porta Delivery — طلب شحن"
          dir="ltr"
        >
          Porta Delivery
        </Link>
      </header>
      <PublicOrderQueryProvider>{children}</PublicOrderQueryProvider>
      <footer className="public-order-footer">
        <span dir="ltr">Porta Delivery</span>
      </footer>
    </div>
  );
}
