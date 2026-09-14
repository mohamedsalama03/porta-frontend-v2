'use client';

import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Banknote,
  CalendarDays,
  CheckCheck,
  CircleDashed,
  MapPin,
  Package2,
  RefreshCw,
  Route,
  Truck,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import {
  getAdminReportsQuerySchema,
  getAdminReportsResponseSchema,
  type Report,
} from '@/lib/api/generated';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { formatDate, formatMoney, formatNumber } from '@/lib/formatters';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { RetryButton } from '@/components/feedback/retry-button';
import { ForbiddenOperation, InvalidFilters, OperationsTable, useCatalogNames } from './shared';
import { parseUrlQuery, queryString, type OperationQuery } from './model';
import './operations.css';

export const shipmentStateLabels: Record<string, string> = {
  RECEIVED: 'تم الاستلام',
  PREPARING: 'قيد التجهيز',
  IN_TRANSIT: 'في الطريق',
  ARRIVED_CITY: 'وصلت للمدينة',
  READY_FOR_PICKUP: 'جاهزة للاستلام',
  DELIVERED: 'تم التسليم',
};

export function businessToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Tripoli',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return ['year', 'month', 'day']
    .map((key) => parts.find((part) => part.type === key)?.value)
    .join('-');
}

export function reportMetrics(report: Report, today = businessToday()) {
  const daily = report.shipments_by_date.find((entry) => entry.date === today);
  return [
    {
      label: 'إجمالي الشحنات',
      value: formatNumber(report.total_shipments),
      icon: Package2,
      note: 'خلال الفترة المحددة',
    },
    {
      label: 'الشحنات اليوم',
      value: daily ? formatNumber(daily.total) : '—',
      icon: CalendarDays,
      note: daily ? 'بحسب توقيت ليبيا' : 'اليوم غير متاح في بيانات الفترة',
    },
    {
      label: 'الرحلات النشطة',
      value: formatNumber(report.active_trips),
      icon: Route,
      note: 'وفق التقرير المعتمد',
    },
    {
      label: 'صافي الإيرادات',
      value: formatMoney(report.net_revenue),
      icon: Banknote,
      note: 'بعد الاستردادات · دينار ليبي',
    },
  ];
}

function ShipmentsChart({ data }: { data: Report['shipments_by_date'] }) {
  if (!data.length)
    return (
      <div className="empty-panel">
        <Package2 size={24} aria-hidden="true" />
        <h3>لا توجد حركة شحنات في هذه الفترة</h3>
        <p>اختر فترة أخرى لعرض البيانات المتاحة.</p>
      </div>
    );
  const width = 800;
  const height = 168;
  const max = Math.max(1, ...data.map((item) => item.total));
  const points = data
    .map(
      (item, index) =>
        `${20 + (data.length === 1 ? 0.5 : index / (data.length - 1)) * (width - 40)},${height - 16 - (item.total / max) * (height - 40)}`,
    )
    .join(' ');
  return (
    <div className="report-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="عدد الشحنات حسب التاريخ؛ القيم الدقيقة في جدول تفاصيل الفترة"
      >
        <title>حركة الشحنات خلال الفترة</title>
        {[0, 0.5, 1].map((position) => (
          <line
            key={position}
            x1="20"
            x2={width - 20}
            y1={height - 16 - position * (height - 40)}
            y2={height - 16 - position * (height - 40)}
            className="report-chart-grid"
          />
        ))}
        <polyline
          points={points}
          fill="none"
          className="report-chart-line"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {data.length === 1 && (
          <circle
            cx={width / 2}
            cy={height - 16 - (data[0].total / max) * (height - 40)}
            r="4"
            className="report-chart-point"
          />
        )}
      </svg>
      <div className="report-chart-axis">
        <span>{formatDate(data[0].date)}</span>
        <span>أعلى قيمة: {formatNumber(Math.max(...data.map((entry) => entry.total)))}</span>
        <span>{formatDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}

export function ReportContent({
  report,
  dashboard = false,
}: {
  report: Report;
  dashboard?: boolean;
}) {
  const { names } = useCatalogNames();
  const statusIcons = [CircleDashed, Truck, MapPin, CheckCheck];
  const statusKeys = ['PREPARING', 'IN_TRANSIT', 'ARRIVED_CITY', 'DELIVERED'];
  const dates = Array.from(
    new Set([
      ...report.shipments_by_date.map((item) => item.date),
      ...report.revenue_by_date.map((item) => item.date),
    ]),
  ).sort();
  const shipmentsByDate = new Map(report.shipments_by_date.map((item) => [item.date, item.total]));
  const revenueByDate = new Map(report.revenue_by_date.map((item) => [item.date, item.revenue]));
  const destinations = Object.entries(report.shipments_by_destination_city)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8);
  const totalStatuses = Object.values(report.shipments_by_status).reduce(
    (sum, value) => sum + value,
    0,
  );
  return (
    <>
      <div className="report-period">
        <CalendarDays size={15} aria-hidden="true" />
        <span>
          {formatDate(report.from)} — {formatDate(report.to)}
        </span>
        <small>
          آخر تحديث: {formatDate(report.generated_at, { hour: '2-digit', minute: '2-digit' })}
        </small>
      </div>
      <section className="report-metrics" aria-label="مؤشرات التشغيل">
        {reportMetrics(report).map(({ label, value, icon: Icon, note }) => (
          <article className="surface report-metric" key={label}>
            <div>
              <h2>{label}</h2>
              <Icon size={18} aria-hidden="true" />
            </div>
            <strong>
              <bdi>{value}</bdi>
            </strong>
            <p>{note}</p>
          </article>
        ))}
      </section>
      <section className="surface report-status-strip" aria-label="حالات الشحنات">
        {statusKeys.map((key, index) => {
          const Icon = statusIcons[index];
          const count = report.shipments_by_status[key];
          return (
            <div key={key}>
              <Icon size={19} aria-hidden="true" />
              <span>{shipmentStateLabels[key]}</span>
              <strong>{count === undefined ? '—' : formatNumber(count)}</strong>
            </div>
          );
        })}
      </section>
      <div className="report-panels">
        <section className="surface report-activity">
          <div className="operation-panel-heading">
            <h2>حركة الشحنات</h2>
            <span>عدد الشحنات يومياً</span>
          </div>
          <ShipmentsChart data={report.shipments_by_date} />
        </section>
        <section className="surface report-breakdown">
          <div className="operation-panel-heading">
            <h2>توزيع الحالات</h2>
          </div>
          {Object.entries(report.shipments_by_status).length ? (
            <ul>
              {Object.entries(report.shipments_by_status).map(([status, count]) => (
                <li key={status}>
                  <div>
                    <span>{shipmentStateLabels[status] ?? 'حالة غير مصنفة'}</span>
                    <strong>{formatNumber(count)}</strong>
                  </div>
                  <progress
                    value={count}
                    max={Math.max(1, totalStatuses)}
                    aria-label={`${shipmentStateLabels[status] ?? 'حالة غير مصنفة'}: ${formatNumber(count)}`}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="operation-note">لا توجد حالات مسجلة خلال الفترة.</p>
          )}
        </section>
      </div>
      <div className="report-panels">
        <section className="surface report-city-list">
          <div className="operation-panel-heading">
            <h2>أبرز مدن الوصول</h2>
            <span>حتى 8 مدن بحسب عدد الشحنات</span>
          </div>
          {destinations.length ? (
            <ul>
              {destinations.map(([id, count]) => (
                <li key={id}>
                  <span>{names.cities.get(id) ?? 'مدينة غير متاحة'}</span>
                  <strong>
                    {formatNumber(count)} <small>شحنة</small>
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="operation-note">لا توجد بيانات مدن لهذه الفترة.</p>
          )}
        </section>
        <section className="surface report-summary">
          <h2>قراءة الفترة</h2>
          <dl>
            <div>
              <dt>الشحنات المسلّمة</dt>
              <dd>{formatNumber(report.delivered_shipments)}</dd>
            </div>
            <div>
              <dt>المسارات في تقرير الإيراد</dt>
              <dd>{formatNumber(report.revenue_by_route.length)}</dd>
            </div>
            <div>
              <dt>المنطقة الزمنية</dt>
              <dd>ليبيا · طرابلس</dd>
            </div>
          </dl>
          <p>
            تعرض المؤشرات القيم التي أعادتها خدمة التقارير. قد يتأخر تحديث التقرير حتى دقيقة واحدة.
          </p>
          {dashboard && (
            <Link className="text-link" href="/reports">
              فتح التقارير التفصيلية
            </Link>
          )}
        </section>
      </div>
      <details className="surface report-data-details" open={!dashboard}>
        <summary>تفاصيل الفترة حسب اليوم</summary>
        <OperationsTable
          title="التفاصيل اليومية للتقرير"
          columns={['التاريخ', 'الشحنات', 'صافي الإيرادات']}
          rows={dates.map((date) => ({
            key: date,
            cells: [
              { text: formatDate(date) },
              {
                text: shipmentsByDate.has(date)
                  ? formatNumber(shipmentsByDate.get(date)!)
                  : 'غير متاح',
                numeric: true,
              },
              {
                text: revenueByDate.has(date) ? formatMoney(revenueByDate.get(date)!) : 'غير متاح',
                numeric: true,
              },
            ],
          }))}
        />
      </details>
      {!dashboard && (
        <details className="surface report-data-details">
          <summary>الإيرادات حسب المسار</summary>
          <p className="operation-note">
            يعرض التقرير حتى {formatNumber(report.revenue_route_limit)} مساراً وفق حدود الخدمة.
          </p>
          <OperationsTable
            title="إيرادات المسارات"
            columns={['من', 'إلى', 'صافي الإيراد']}
            rows={report.revenue_by_route.map((item) => ({
              key: `${item.origin_city_id}-${item.destination_city_id}`,
              cells: [
                { text: names.cities.get(item.origin_city_id) ?? 'مدينة غير متاحة' },
                { text: names.cities.get(item.destination_city_id) ?? 'مدينة غير متاحة' },
                { text: formatMoney(item.revenue), numeric: true },
              ],
            }))}
          />
        </details>
      )}
    </>
  );
}

export function LiveReports({ dashboard = false }: { dashboard?: boolean }) {
  const { user } = useAuth();
  const allowed = can(user, 'reports.view');
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const parsed = parseUrlQuery<OperationQuery>(
    getAdminReportsQuerySchema,
    new URLSearchParams(search.toString()),
  );
  const filters = parsed.success ? parsed.data : {};
  const query = useQuery({
    queryKey: ['reports', filters],
    queryFn: ({ signal }) =>
      api.request(`/api/v1/admin/reports${queryString(filters)}`, {
        schema: getAdminReportsResponseSchema,
        signal,
      }),
    enabled: allowed && parsed.success,
    staleTime: 60_000,
  });
  if (!allowed) return <ForbiddenOperation />;
  return (
    <div className="operations-page">
      <div className="page-heading">
        <div>
          <h1>{dashboard ? 'نظرة عامة' : 'التقارير'}</h1>
          <p>
            {dashboard
              ? 'كل ما تحتاجه لمتابعة حركة الشحن، في مكان واحد.'
              : 'مؤشرات الشحن والإيراد خلال الفترة التي تختارها.'}
          </p>
        </div>
        <RetryButton
          className="button button-secondary"
          disabled={query.isFetching || !parsed.success}
          error={query.error}
          retry={() => void query.refetch()}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {query.isFetching ? 'جارٍ التحديث…' : 'تحديث'}
        </RetryButton>
      </div>
      <form
        key={queryString(filters)}
        className="surface operations-filters"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const values = new URLSearchParams();
          for (const key of ['from', 'to']) {
            const value = String(data.get(key) ?? '');
            if (value) values.set(key, value);
          }
          router.push(`${pathname}${values.size ? `?${values}` : ''}`, { scroll: false });
        }}
      >
        <label>
          من تاريخ
          <input
            type="date"
            name="from"
            defaultValue={String(filters.from ?? '')}
            max={String(filters.to ?? '') || undefined}
          />
        </label>
        <label>
          إلى تاريخ
          <input
            type="date"
            name="to"
            defaultValue={String(filters.to ?? '')}
            min={String(filters.from ?? '') || undefined}
          />
        </label>
        <button className="button button-primary">عرض الفترة</button>
        {search.size > 0 && (
          <button
            className="button button-ghost"
            type="button"
            onClick={() => router.push(pathname)}
          >
            الفترة الافتراضية
          </button>
        )}
      </form>
      {!parsed.success ? (
        <InvalidFilters reset={() => router.replace(pathname)} />
      ) : query.isError ? (
        <ErrorPanel
          error={query.error instanceof ApiError ? query.error : null}
          retry={() => void query.refetch()}
        />
      ) : query.data ? (
        <ReportContent report={query.data.data} dashboard={dashboard} />
      ) : (
        <div className="report-loading" role="status" aria-atomic="true">
          <span className="sr-only">جارٍ تحميل التقرير</span>
          <div className="report-metrics" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="skeleton report-metric-skeleton" key={index} />
            ))}
          </div>
          <div className="skeleton report-chart-skeleton" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
