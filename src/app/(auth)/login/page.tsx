import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowLeft, MapPin, Package2, Route } from 'lucide-react';
import { config } from '@/lib/config';
import { AuthProviders } from '@/features/auth/auth-providers';
import { LoginForm } from '@/features/auth/login-form';
import { PageTransition } from '@/components/ui/page-transition';
import '@/features/auth/auth.css';

export const metadata: Metadata = { title: 'تسجيل الدخول' };
export default function LoginPage() {
  return (
    <main className="login-layout">
      <section className="login-main">
        <div className="login-brand">
          <span className="login-brand-icon">
            <Package2 size={23} aria-hidden="true" />
          </span>
          <div>
            <div className="login-brand-name" dir="ltr">
              PORTA
            </div>
            <p className="login-brand-description">DELIVERY</p>
          </div>
        </div>
        <div className="login-content">
          <PageTransition>
            <h1>مرحباً بعودتك</h1>
            <p style={{ color: 'var(--muted)', marginBlock: '6px 28px' }}>
              سجّل الدخول إلى مساحة العمل الخاصة بفريقك.
            </p>
            <AuthProviders>
              <Suspense fallback={<div className="skeleton" style={{ height: 290 }} />}>
                <LoginForm />
              </Suspense>
            </AuthProviders>
          </PageTransition>
        </div>
        <footer className="login-footer">
          <span>Porta Delivery · منظومة الإدارة</span>
          {config.previewEnabled && (
            <Link className="text-link" href="/preview">
              معاينة الواجهة
              <ArrowLeft size={14} aria-hidden="true" />
            </Link>
          )}
        </footer>
      </section>
      <aside className="login-aside" aria-label="عن المنظومة">
        <div className="login-aside-title">
          <h2>
            كل شحنة،
            <br />
            خطوة أقرب.
          </h2>
          <p>مساحة واحدة لتنظيم الشحنات والرحلات ومتابعة التوصيل بين المدن.</p>
          <div className="login-route" aria-hidden="true">
            <Package2 size={24} />
            <span className="login-route-line" />
            <Route size={26} />
            <span className="login-route-line" />
            <MapPin size={24} />
          </div>
        </div>
        <p className="login-aside-foot">
          <MapPin size={16} aria-hidden="true" />
          منظومة شحن وتوصيل بين المدن
        </p>
      </aside>
    </main>
  );
}
