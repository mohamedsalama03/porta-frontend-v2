'use client';

import { LogOut, UserRound } from 'lucide-react';
import { RetryButton } from '@/components/feedback/retry-button';
import { useDriverSession } from './session';

export function DriverAccount() {
  const auth = useDriverSession();
  return (
    <div className="driver-account">
      <h1>الحساب</h1>
      <p className="driver-account-intro">بيانات حسابك المستخدم لتسجيل الدخول.</p>
      <section className="driver-account-profile" aria-label="بيانات الحساب">
        <UserRound className="driver-account-symbol" aria-hidden="true" />
        <dl>
          <div>
            <dt>الاسم</dt>
            <dd>{auth.user.name}</dd>
          </div>
          <div>
            <dt>البريد الإلكتروني</dt>
            <dd>
              <bdi>{auth.user.email}</bdi>
            </dd>
          </div>
        </dl>
      </section>
      <div className="driver-account-logout">
        {auth.error && <p role="alert">{auth.error.message}</p>}
        {auth.capabilities.canLogout ? (
          <RetryButton
            error={auth.error}
            className="driver-shell-button driver-shell-button-secondary"
            retry={() => void auth.logout().catch(() => undefined)}
          >
            <LogOut aria-hidden="true" />
            تسجيل الخروج
          </RetryButton>
        ) : (
          <p>تسجيل الخروج غير متاح حالياً. حاول مجددًا بعد تفعيل الخدمة.</p>
        )}
      </div>
    </div>
  );
}
