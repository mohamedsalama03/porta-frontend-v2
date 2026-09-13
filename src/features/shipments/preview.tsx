'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { shipmentFixtures } from './fixtures';
import {
  filterPreviewShipments,
  previewFilterLabels,
  updatePreviewFilters,
  type PreviewFilterKey,
} from './preview-filters';
import { ShipmentDetails, ShipmentPreviewNotice, ShipmentTable } from './presentation';
export { ShipmentCreatePreview } from './shipment-create-preview';

const cities = [...new Set(shipmentFixtures.flatMap((row) => [row.origin, row.destination]))];
const statuses = [...new Set(shipmentFixtures.map((row) => row.status.label))];

function FilterSelect({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: PreviewFilterKey;
  value: string;
  options: string[];
  onChange: (key: PreviewFilterKey, value: string) => void;
}) {
  return (
    <label className="shipment-filter-select">
      <span className="shipment-sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

/** Development-only composition: no network requests, API-shaped fixtures, or mutations. */
export function ShipmentListPreview() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const source = searchParams.toString();
  const q = searchParams.get('q') ?? '';
  const [search, setSearch] = useState({ source: q, value: q });
  if (search.source !== q) setSearch({ source: q, value: q });

  useEffect(() => {
    if (search.value === q) return;
    const timer = window.setTimeout(() => {
      const params = updatePreviewFilters(source, { q: search.value });
      router.replace(`${pathname}${params ? `?${params}` : ''}`, { scroll: false });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search.value, q, source, pathname, router]);

  function update(key: PreviewFilterKey, value: string) {
    const next = updatePreviewFilters(source, { [key]: value });
    router.push(`${pathname}${next ? `?${next}` : ''}`, { scroll: false });
  }
  const rows = filterPreviewShipments(shipmentFixtures, new URLSearchParams(source));
  const active = Object.entries(previewFilterLabels).filter(([key]) => searchParams.get(key));
  return (
    <div className="shipment-list-preview">
      <div className="shipment-page-title">
        <div>
          <h1>الشحنات</h1>
          <p>كل شحنة، من نقطة الانطلاق إلى التسليم.</p>
        </div>
        <Link className="button button-primary" href="/preview/shipments/new">
          <Plus size={17} aria-hidden="true" />
          معاينة إنشاء شحنة
        </Link>
      </div>
      <ShipmentPreviewNotice />
      <div className="shipment-status-tabs" aria-label="تصفية حسب حالة الشحنة">
        <button
          className={!searchParams.get('status') ? 'active' : ''}
          type="button"
          aria-pressed={!searchParams.get('status')}
          onClick={() => update('status', '')}
        >
          كل الشحنات<span>{new Intl.NumberFormat('ar-LY').format(shipmentFixtures.length)}</span>
        </button>
        {statuses.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={searchParams.get('status') === status}
            className={searchParams.get('status') === status ? 'active' : ''}
            onClick={() => update('status', status)}
          >
            {status}
          </button>
        ))}
      </div>
      <div className="shipment-filter-bar">
        <label className="shipment-search">
          <Search size={17} aria-hidden="true" />
          <span className="shipment-sr-only">البحث برقم التتبع أو الاسم</span>
          <input
            value={search.value}
            onChange={(event) => setSearch({ source: q, value: event.target.value })}
            placeholder="ابحث برقم التتبع أو الاسم…"
            type="search"
            autoComplete="off"
          />
        </label>
        <FilterSelect
          label="من مدينة"
          name="origin"
          value={searchParams.get('origin') ?? ''}
          options={cities}
          onChange={update}
        />
        <FilterSelect
          label="إلى مدينة"
          name="destination"
          value={searchParams.get('destination') ?? ''}
          options={cities}
          onChange={update}
        />
        <details className="shipment-more-filters">
          <summary className="button button-secondary">
            <SlidersHorizontal size={16} aria-hidden="true" />
            فلاتر إضافية
          </summary>
          <div className="shipment-expanded-filters">
            <FilterSelect
              label="نوع الشحنة"
              name="type"
              value={searchParams.get('type') ?? ''}
              options={[...new Set(shipmentFixtures.map((row) => row.type))]}
              onChange={update}
            />
            <FilterSelect
              label="الحجم"
              name="size"
              value={searchParams.get('size') ?? ''}
              options={[...new Set(shipmentFixtures.map((row) => row.size))]}
              onChange={update}
            />
            <FilterSelect
              label="السائق"
              name="driver"
              value={searchParams.get('driver') ?? ''}
              options={[...new Set(shipmentFixtures.map((row) => row.driver))].filter(
                (value) => value !== '—',
              )}
              onChange={update}
            />
            <FilterSelect
              label="الرحلة"
              name="trip"
              value={searchParams.get('trip') ?? ''}
              options={[...new Set(shipmentFixtures.map((row) => row.trip))].filter(
                (value) => value !== '—',
              )}
              onChange={update}
            />
            <FilterSelect
              label="حالة الدفع"
              name="payment"
              value={searchParams.get('payment') ?? ''}
              options={[...new Set(shipmentFixtures.map((row) => row.payment.label))]}
              onChange={update}
            />
            <label className="shipment-date-filter">
              <span>من تاريخ</span>
              <input
                type="date"
                value={searchParams.get('from') ?? ''}
                onChange={(event) => update('from', event.target.value)}
              />
            </label>
            <label className="shipment-date-filter">
              <span>إلى تاريخ</span>
              <input
                type="date"
                value={searchParams.get('to') ?? ''}
                onChange={(event) => update('to', event.target.value)}
              />
            </label>
          </div>
        </details>
      </div>
      {!!active.length && (
        <div className="shipment-filter-chips" aria-label="عوامل التصفية النشطة">
          {active.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => update(key as PreviewFilterKey, '')}
              className="shipment-filter-chip"
              aria-label={`إزالة تصفية ${label}`}
            >
              <span>
                {label}: {searchParams.get(key)}
              </span>
              <X size={13} aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            className="shipment-clear-filters"
            onClick={() => router.push(pathname, { scroll: false })}
          >
            مسح الكل
          </button>
        </div>
      )}
      <p className="shipment-results-note" role="status">
        {new Intl.NumberFormat('ar-LY').format(rows.length)} نتائج في بيانات المعاينة
      </p>
      <ShipmentTable rows={rows} />
      <p className="shipment-integration-note">
        التصفية هنا تخص الأمثلة فقط. البحث التشغيلي وترتيب النتائج والتنقل بين الصفحات بانتظار ربط
        الخدمة المعتمدة.
      </p>
    </div>
  );
}

export function ShipmentDetailPreview({ id }: { id: string }) {
  const shipment = shipmentFixtures.find((item) => item.id === id);
  if (!shipment)
    return (
      <section className="surface shipment-table-state">
        <h1>هذا المثال غير موجود</h1>
        <p>يمكنك اختيار شحنة من قائمة المعاينة.</p>
        <Link href="/preview/shipments" className="button button-primary">
          العودة إلى الشحنات
        </Link>
      </section>
    );
  return <ShipmentDetails shipment={shipment} />;
}
