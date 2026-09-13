import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpLeft,
  Banknote,
  CalendarDays,
  ChartNoAxesCombined,
  CheckCheck,
  CircleDashed,
  MapPin,
  Package2,
  Plus,
  Route,
  Truck,
} from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import './overview.css';

const metrics = [
  { label: 'إجمالي الشحنات', caption: 'جميع الشحنات المسجلة', icon: Package2 },
  { label: 'الشحنات اليوم', caption: 'الشحنات المسجلة اليوم', icon: CalendarDays },
  { label: 'الرحلات النشطة', caption: 'الرحلات الجاري تنفيذها', icon: Route },
  { label: 'إجمالي الإيرادات', caption: 'دينار ليبي · د.ل', icon: Banknote },
];
const states = [
  { label: 'قيد التجهيز', icon: CircleDashed, tone: 'neutral' },
  { label: 'في الطريق', icon: Truck, tone: 'info' },
  { label: 'وصلت للمدينة', icon: MapPin, tone: 'warning' },
  { label: 'تم التسليم', icon: CheckCheck, tone: 'success' },
];

export function DashboardOverview({ preview = false }: { preview?: boolean }) {
  const home = preview ? '/preview' : '';
  return (
    <div className="overview">
      <div className="page-heading">
        <div>
          <h1>نظرة عامة</h1>
          <p>كل ما تحتاجه لمتابعة حركة الشحن، في مكان واحد.</p>
        </div>
        <div className="page-actions">
          <span className="overview-date">
            <CalendarDays size={15} aria-hidden="true" />
            {formatDate(new Date())}
          </span>
          {preview && (
            <Link href="/preview/shipments/new" className="button button-primary">
              <Plus aria-hidden="true" />
              معاينة إضافة شحنة
            </Link>
          )}
        </div>
      </div>
      <div className="overview-connection" role="status">
        <span className="connection-dot" />
        <div>
          <strong>بانتظار ربط البيانات التشغيلية</strong>
          <span>تظهر المؤشرات بعد اكتمال الاتصال بالخدمة. لا توجد بيانات فعلية معروضة.</span>
        </div>
      </div>
      <section className="overview-metrics" aria-label="مؤشرات التشغيل">
        {metrics.map(({ label, caption, icon: Icon }) => (
          <article key={label} className="surface metric-card">
            <div className="metric-label">
              <h2>{label}</h2>
              <Icon size={17} aria-hidden="true" />
            </div>
            <p className="metric-value" aria-label="غير متاح">
              —
            </p>
            <span>{caption}</span>
          </article>
        ))}
      </section>
      <section className="surface overview-status-strip" aria-label="حالات الشحنات">
        {states.map(({ label, icon: Icon, tone }) => (
          <div className="overview-status" key={label}>
            <span className={`status-icon status-${tone}`}>
              <Icon size={17} aria-hidden="true" />
            </span>
            <span>{label}</span>
            <strong aria-label="غير متاح">—</strong>
          </div>
        ))}
      </section>
      <div className="overview-middle">
        <section className="surface activity-panel">
          <div className="panel-heading">
            <div>
              <h2>حركة الشحنات</h2>
              <p>متابعة الشحنات خلال الفترة</p>
            </div>
            <span className="badge">لا تتوفر بيانات</span>
          </div>
          <div className="chart-unavailable">
            <div className="chart-empty-lines" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="chart-empty-content">
              <ChartNoAxesCombined size={25} strokeWidth={1.4} aria-hidden="true" />
              <h3>صورة أوضح مع أول تحديث</h3>
              <p>سيظهر اتجاه الشحنات هنا عند توفر بيانات التقارير.</p>
            </div>
          </div>
          <div className="chart-note">
            <span className="chart-legend-dot" />
            حجم الشحنات<span>المصدر: التقارير المعتمدة</span>
          </div>
        </section>
        <section className="surface overview-trips">
          <div className="panel-heading">
            <div>
              <h2>الرحلات النشطة</h2>
              <p>حركة التوصيل بين المدن</p>
            </div>
            <Link href={`${home}/trips`} className="icon-button" aria-label="عرض الرحلات">
              <ArrowUpLeft size={17} aria-hidden="true" />
            </Link>
          </div>
          <div className="trips-unavailable">
            <div className="trip-symbol">
              <Route size={28} strokeWidth={1.4} aria-hidden="true" />
            </div>
            <h3>مساراتك في مكان واحد</h3>
            <p>
              تابع المسار والسائق وحالة الرحلة
              <br />
              بعد تفعيل اتصال الخدمة.
            </p>
            <Link className="text-link" href={`${home}/trips`}>
              الانتقال إلى الرحلات
              <ArrowLeft size={14} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
      <section className="surface overview-recent">
        <div className="panel-heading">
          <div>
            <h2>آخر الشحنات</h2>
            <p>أحدث الشحنات وحالتها الحالية</p>
          </div>
          <Link className="text-link" href={`${home}/shipments`}>
            عرض الشحنات
            <ArrowLeft size={14} aria-hidden="true" />
          </Link>
        </div>
        <div className="recent-table-wrap">
          <table className="recent-table">
            <caption className="sr-only">آخر الشحنات — البيانات غير متاحة</caption>
            <thead>
              <tr>
                <th>رقم التتبع</th>
                <th>المسار</th>
                <th>المستلم</th>
                <th>الحالة</th>
                <th>الدفع</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5}>
                  <div className="recent-empty">
                    <Package2 size={21} aria-hidden="true" />
                    <div>
                      <strong>لم يتم تحميل الشحنات بعد</strong>
                      <p>ستظهر أحدث الشحنات هنا بمجرد ربط الخدمة.</p>
                    </div>
                    {preview && (
                      <Link className="button button-secondary" href="/preview/shipments">
                        استعراض نموذج الجدول
                        <ArrowLeft aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <footer className="overview-footer">
        <span>منظومة شحن وتوصيل بين المدن</span>
        <span>توقيت العرض: ليبيا</span>
      </footer>
    </div>
  );
}
