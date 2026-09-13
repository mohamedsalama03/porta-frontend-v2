'use client';

import { Check, Monitor, Moon, SlidersHorizontal, Sun } from 'lucide-react';
import {
  useDensityPreference,
  useThemePreference,
  type DensityPreference,
  type ThemePreference,
} from '@/components/layout/preferences';
import './settings.css';

const themeOptions = [
  { value: 'light', label: 'فاتح', description: 'واجهة واضحة للعمل اليومي', icon: Sun },
  { value: 'dark', label: 'داكن', description: 'سطوع أقل في الإضاءة الخافتة', icon: Moon },
  {
    value: 'system',
    label: 'إعداد الجهاز',
    description: 'يتبع مظهر جهازك تلقائياً',
    icon: Monitor,
  },
] satisfies { value: ThemePreference; label: string; description: string; icon: typeof Sun }[];

const densityOptions = [
  { value: 'compact', label: 'مضغوط', description: 'صفوف أقصر لعرض معلومات أكثر.' },
  { value: 'comfortable', label: 'مريح', description: 'مساحة أوسع بين صفوف الجداول.' },
] satisfies { value: DensityPreference; label: string; description: string }[];

export function PreferencesSettings() {
  const [theme, setTheme] = useThemePreference();
  const [density, setDensity] = useDensityPreference();

  return (
    <div className="preferences-page">
      <div className="page-heading">
        <div>
          <h1>الإعدادات</h1>
          <p>اجعل مساحة العمل مناسبة لطريقتك.</p>
        </div>
      </div>
      <section className="preferences-section surface" aria-labelledby="appearance-title">
        <div className="preferences-section-heading">
          <div className="preferences-heading-icon">
            <SlidersHorizontal size={20} strokeWidth={1.65} aria-hidden="true" />
          </div>
          <div>
            <h2 id="appearance-title">تفضيلات الواجهة</h2>
            <p>تُطبّق التغييرات فوراً، وتُحفظ في هذا المتصفح.</p>
          </div>
          <span className="preferences-saved">
            <Check size={13} aria-hidden="true" />
            حفظ تلقائي
          </span>
        </div>
        <div className="preference-row">
          <div className="preference-description">
            <h3 id="theme-label">المظهر</h3>
            <p>اختر المظهر الذي يناسب بيئة عملك.</p>
          </div>
          <div className="theme-options" role="radiogroup" aria-labelledby="theme-label">
            {themeOptions.map(({ value, label, description, icon: Icon }) => (
              <label key={value} className={`theme-option${theme === value ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="theme"
                  value={value}
                  checked={theme === value}
                  onChange={() => setTheme(value)}
                />
                <span
                  className={`theme-illustration theme-illustration-${value}`}
                  aria-hidden="true"
                >
                  <span className="theme-mini-sidebar">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="theme-mini-main">
                    <span />
                    <span className="theme-mini-stats">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="theme-mini-table">
                      <i />
                      <i />
                      <i />
                    </span>
                  </span>
                </span>
                <span className="theme-option-title">
                  <Icon size={15} aria-hidden="true" />
                  <strong>{label}</strong>
                  <span className="preference-radio" aria-hidden="true">
                    {theme === value && <Check size={10} strokeWidth={3} />}
                  </span>
                </span>
                <span className="theme-option-description">{description}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="preference-row">
          <div className="preference-description">
            <h3 id="density-label">كثافة الجداول</h3>
            <p>حدد المسافة بين الصفوف في قوائم العمل.</p>
          </div>
          <div className="density-options" role="radiogroup" aria-labelledby="density-label">
            {densityOptions.map(({ value, label, description }) => (
              <label
                key={value}
                className={`density-option${density === value ? ' is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="density"
                  value={value}
                  checked={density === value}
                  onChange={() => setDensity(value)}
                />
                <span
                  className={`density-illustration density-illustration-${value}`}
                  aria-hidden="true"
                >
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
                <span className="preference-radio" aria-hidden="true">
                  {density === value && <Check size={10} strokeWidth={3} />}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="preference-row preference-static-row">
          <div className="preference-description">
            <h3>لغة الواجهة</h3>
            <p>واجهة عربية مصممة للعمل من اليمين إلى اليسار.</p>
          </div>
          <span className="preference-static-value">
            العربية<span dir="ltr">AR</span>
          </span>
        </div>
      </section>
      <section className="settings-service-note" aria-labelledby="service-settings-title">
        <SettingsNoticeIcon />
        <div>
          <h2 id="service-settings-title">إعدادات المنظومة</h2>
          <p>
            إعدادات الشركة والفروع والصلاحيات تحتاج إلى اتصال بالخدمة المعتمدة. تفضيلات هذه الصفحة
            تخص العرض في متصفحك فقط.
          </p>
        </div>
      </section>
    </div>
  );
}

function SettingsNoticeIcon() {
  return <Monitor size={20} strokeWidth={1.6} aria-hidden="true" />;
}
