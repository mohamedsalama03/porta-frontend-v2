'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Eye, EyeOff, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth/provider';
import { loginCredentialsSchema, type LoginCredentials } from '@/lib/auth/contracts';
import { ApiError } from '@/lib/api/errors';
import { safeReturnPath } from '@/lib/auth/redirect';
import { getNavigationHref, getNavigationItems } from '@/lib/navigation';

export function LoginForm() {
  const { login, status, capabilities, user } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginCredentials>({
    resolver: zodResolver(loginCredentialsSchema, {
      error: (issue) =>
        issue.path?.[0] === 'email'
          ? 'أدخل بريدًا إلكترونيًا صحيحًا لا يتجاوز 254 حرفًا.'
          : 'أدخل كلمة المرور بما لا يتجاوز 1024 حرفًا.',
    }),
    defaultValues: { email: '', password: '' },
  });
  const destination = search.has('returnTo')
    ? safeReturnPath(search.get('returnTo'))
    : getNavigationHref(getNavigationItems(user, 'live')[0]?.key ?? 'settings', 'live');

  useEffect(() => {
    if (status === 'authenticated') router.replace(destination);
  }, [status, destination, router]);
  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      await login(values);
    } catch (cause) {
      const error = cause instanceof ApiError ? cause : new ApiError({ code: 'network' });
      setFailure(error);
      for (const field of ['email', 'password'] as const) {
        if (error.validationErrors[field])
          setError(field, { message: error.validationErrors[field][0] });
      }
    }
  });

  return (
    <form className="login-form" onSubmit={onSubmit} noValidate>
      {search.get('reason') === 'expired' && (
        <div className="inline-notice" role="status">
          <ShieldCheck aria-hidden="true" />
          <p>انتهت جلستك. سجّل الدخول مرة أخرى للمتابعة.</p>
        </div>
      )}
      {!capabilities.canLogin && (
        <div className="inline-notice" id="login-availability">
          <ShieldCheck aria-hidden="true" />
          <p>
            <strong>تسجيل الدخول غير متاح حالياً.</strong>
            <br />
            بانتظار تفعيل الاتصال بالخدمة المعتمدة.
          </p>
        </div>
      )}
      <div className="field">
        <label htmlFor="email">البريد الإلكتروني</label>
        <input
          id="email"
          type="email"
          dir="ltr"
          autoComplete="username"
          inputMode="email"
          maxLength={254}
          placeholder="name@company.com"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
        />
        {errors.email && (
          <p className="field-error" id="email-error">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="password">كلمة المرور</label>
        <div className="password-input">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            dir="ltr"
            autoComplete="current-password"
            maxLength={1024}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
          />
          <button
            type="button"
            className="icon-button"
            aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </div>
        {errors.password && (
          <p className="field-error" id="password-error">
            {errors.password.message}
          </p>
        )}
      </div>
      {failure && (
        <div className="inline-notice inline-error" role="alert">
          <p>
            {failure.message}
            {failure.requestId && (
              <>
                <br />
                مرجع الدعم: <bdi>{failure.requestId}</bdi>
              </>
            )}
          </p>
        </div>
      )}
      <button
        className="button button-primary login-submit"
        type="submit"
        disabled={!capabilities.canLogin || isSubmitting || status === 'loading'}
        aria-describedby={!capabilities.canLogin ? 'login-availability' : undefined}
      >
        {isSubmitting ? <LoaderCircle className="pending-icon" aria-hidden="true" /> : null}
        {isSubmitting ? 'جارٍ تسجيل الدخول' : 'تسجيل الدخول'}
        <ArrowLeft aria-hidden="true" />
      </button>
      <p className="login-security">
        <ShieldCheck size={15} aria-hidden="true" />
        دخول آمن لفريق Porta Delivery
      </p>
    </form>
  );
}
