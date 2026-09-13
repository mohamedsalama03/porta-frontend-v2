'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { ApiError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { shipmentKeys } from '@/lib/query/keys';
import { ErrorPanel } from '@/components/feedback/error-panel';
import {
  getShipments,
  parseShipmentFilters,
  shipmentFilterLabels,
  updateShipmentFilters,
  type ShipmentFilterKey,
} from './api';
import { ShipmentTable } from './presentation';
import {
  paymentStatusLabels,
  shipmentSizeLabels,
  shipmentStatusLabels,
  shipmentToViewModel,
} from './mappers';
import { useShipmentCatalogs } from './live-hooks';
import './shipments.css';
export { ShipmentDetailLive } from './shipment-detail-live';
export { ShipmentCreateLive } from './shipment-create-live';

export function ShipmentListLive() {
  const { user } = useAuth();
  const allowed = can(user, 'shipments.view');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const source = params.toString();
  const urlSearch = params.get('search') ?? '';
  const [search, setSearch] = useState({ source: urlSearch, value: urlSearch });
  if (search.source !== urlSearch) setSearch({ source: urlSearch, value: urlSearch });
  const invalid = useMemo(() => {
    try {
      parseShipmentFilters(source);
      return null;
    } catch (error) {
      return error as ApiError;
    }
  }, [source]);
  const list = useQuery({
    queryKey: shipmentKeys.list({ query: source }),
    queryFn: ({ signal }) => getShipments(source, signal),
    enabled: allowed && !invalid,
  });
  const { cities, types } = useShipmentCatalogs(allowed);
  useEffect(() => {
    if (
      search.value === urlSearch ||
      (search.value.trim().length > 0 && search.value.trim().length < 3)
    )
      return;
    const timeout = window.setTimeout(() => {
      const query = updateShipmentFilters(source, { search: search.value });
      router.replace(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [search.value, urlSearch, source, pathname, router]);

  const update = (key: string, value: string | null, preserveCursor = false) => {
    const query = updateShipmentFilters(source, { [key]: value }, preserveCursor);
    router.push(`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
  };
  const select = (key: ShipmentFilterKey, options: Array<{ value: string; label: string }>) => (
    <label className="shipment-filter-select">
      <span className="shipment-sr-only">{shipmentFilterLabels[key]}</span>
      <select
        aria-label={shipmentFilterLabels[key]}
        value={params.get(key) ?? ''}
        onChange={(event) => update(key, event.target.value)}
      >
        <option value="">{shipmentFilterLabels[key]}</option>
        {options.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
  const cityOptions =
    cities.data?.data.map((city) => ({ value: city.id, label: city.name_ar })) ?? [];
  const activeFilters = Object.entries(shipmentFilterLabels).filter(([key]) => params.has(key));
  if (!allowed)
    return (
      <section className="surface shipment-table-state">
        <h1>الشحنات</h1>
        <p>ليس لديك صلاحية لعرض الشحنات.</p>
      </section>
    );
  return (
    <div className="shipment-list-preview">
      <div className="shipment-page-title">
        <div>
          <h1>الشحنات</h1>
          <p>تابع شحناتك وحدّث تفاصيلها من مكان واحد.</p>
        </div>
        {can(user, 'shipments.create') && (
          <Link className="button button-primary" href="/shipments/new">
            <Plus size={17} aria-hidden="true" />
            إنشاء شحنة
          </Link>
        )}
      </div>
      <div className="shipment-filter-bar">
        <label className="shipment-search">
          <Search size={17} aria-hidden="true" />
          <span className="shipment-sr-only">البحث برقم التتبع أو الاسم أو الهاتف</span>
          <input
            type="search"
            value={search.value}
            onChange={(event) => setSearch({ source: urlSearch, value: event.target.value })}
            placeholder="رقم التتبع، الاسم أو الهاتف…"
            maxLength={150}
            autoComplete="off"
          />
        </label>
        {select('origin_city', cityOptions)}
        {select('destination_city', cityOptions)}
        {select(
          'status',
          Object.entries(shipmentStatusLabels).map(([value, label]) => ({
            value,
            label: label.label,
          })),
        )}
        <details className="shipment-more-filters">
          <summary className="button button-secondary">
            <SlidersHorizontal size={16} aria-hidden="true" />
            فلاتر إضافية
          </summary>
          <div className="shipment-expanded-filters">
            {select(
              'shipment_type',
              types.data?.data.map((type) => ({ value: type.id, label: type.name_ar })) ?? [],
            )}
            {select(
              'shipment_size',
              Object.entries(shipmentSizeLabels).map(([value, label]) => ({ value, label })),
            )}
            {select(
              'payment_status',
              Object.entries(paymentStatusLabels).map(([value, label]) => ({
                value,
                label: label.label,
              })),
            )}
            {select('sort', [
              { value: '-created_at', label: 'الأحدث أولًا' },
              { value: 'created_at', label: 'الأقدم أولًا' },
            ])}
            {(['created_from', 'created_to'] as const).map((key) => (
              <label key={key} className="shipment-date-filter">
                <span>{shipmentFilterLabels[key]}</span>
                <input
                  type="date"
                  value={params.get(key) ?? ''}
                  onChange={(event) => update(key, event.target.value)}
                />
              </label>
            ))}
            {(['tracking_number', 'driver', 'trip'] as const).map((key) => (
              <label key={key} className="shipment-form-field">
                <span>
                  {shipmentFilterLabels[key]}
                  {key !== 'tracking_number' && ' (المعرّف)'}
                </span>
                <input
                  className="field"
                  dir="ltr"
                  defaultValue={params.get(key) ?? ''}
                  key={params.get(key) ?? ''}
                  onBlur={(event) => {
                    if (event.target.value !== (params.get(key) ?? ''))
                      update(key, event.target.value);
                  }}
                />
              </label>
            ))}
          </div>
        </details>
      </div>
      {search.value.trim().length > 0 && search.value.trim().length < 3 && (
        <p className="shipment-results-note">أدخل ثلاثة أحرف على الأقل للبحث.</p>
      )}
      {!!activeFilters.length && (
        <div className="shipment-filter-chips" aria-label="عوامل التصفية النشطة">
          {activeFilters.map(([key, label]) => (
            <button
              className="shipment-filter-chip"
              type="button"
              key={key}
              aria-label={`إزالة تصفية ${label}`}
              onClick={() => update(key, null)}
            >
              {label}
              <X size={13} aria-hidden="true" />
            </button>
          ))}
          <button
            className="shipment-clear-filters"
            type="button"
            onClick={() => router.push(pathname, { scroll: false })}
          >
            مسح الكل
          </button>
        </div>
      )}
      {invalid ? (
        <ErrorPanel error={invalid} retry={() => router.replace(pathname)} />
      ) : list.error ? (
        <ErrorPanel
          error={list.error instanceof ApiError ? list.error : null}
          retry={() => void list.refetch()}
        />
      ) : (
        <ShipmentTable
          rows={
            list.data?.data.map((shipment) =>
              shipmentToViewModel(shipment, cities.data?.data ?? [], types.data?.data ?? []),
            ) ?? []
          }
          state={list.isPending ? 'loading' : 'ready'}
          caption="الشحنات الواردة من الخدمة، الصفحة الحالية"
          footer={
            <div className="shipment-table-footer">
              <p role="status">
                {list.isFetching
                  ? 'جارٍ تحديث الشحنات…'
                  : `${list.data?.data.length ?? 0} شحنة في الصفحة الحالية`}
              </p>
              <div className="shipment-cursor-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={!list.data?.meta.previous_cursor || list.isFetching}
                  onClick={() => update('cursor', list.data?.meta.previous_cursor ?? null, true)}
                >
                  <ChevronRight size={15} />
                  السابق
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={!list.data?.meta.next_cursor || list.isFetching}
                  onClick={() => update('cursor', list.data?.meta.next_cursor ?? null, true)}
                >
                  التالي
                  <ChevronLeft size={15} />
                </button>
              </div>
            </div>
          }
        />
      )}
      {(cities.isError || types.isError) && (
        <p className="shipment-integration-note">
          تعذّر تحميل بعض أسماء المدن أو الأنواع. تظهر معرّفات الخدمة عند غياب الاسم.
        </p>
      )}
    </div>
  );
}
