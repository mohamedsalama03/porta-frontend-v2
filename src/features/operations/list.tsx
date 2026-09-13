'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Filter, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { ApiError } from '@/lib/api/errors';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { RetryButton } from '@/components/feedback/retry-button';
import { UserActions } from '@/features/users/user-actions';
import { CatalogCreateAction, CatalogEditAction } from '@/features/catalog';
import Link from 'next/link';
import { readOperations } from './api';
import {
  operationDefinitions,
  parseUrlQuery,
  queryString,
  tripStatusLabels,
  type OperationQuery,
  type OperationsModule,
} from './model';
import {
  ForbiddenOperation,
  InvalidFilters,
  OperationsTable,
  Pagination,
  useCatalogNames,
} from './shared';
import './operations.css';

export function OperationsList({ module }: { module: OperationsModule }) {
  const { user } = useAuth();
  const definition = operationDefinitions[module];
  const allowed = can(user, definition.permission);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const parsed = parseUrlQuery<OperationQuery>(
    definition.query,
    new URLSearchParams(search.toString()),
  );
  const filters = parsed.success ? parsed.data : {};
  const needsNames = ['trips', 'branches', 'pricing'].includes(module);
  const catalog = useCatalogNames(allowed && needsNames);
  const query = useQuery({
    queryKey: ['operations', module, filters, needsNames ? catalog.dataUpdatedAt : 0],
    queryFn: ({ signal }) => readOperations(module, filters, signal, catalog.names),
    enabled: allowed && parsed.success && (!needsNames || !catalog.isPending),
    staleTime: 30_000,
  });
  const hasFilters = module === 'trips' || module === 'drivers' || module === 'pricing';
  const isCatalog =
    module === 'cities' ||
    module === 'branches' ||
    module === 'shipment-types' ||
    module === 'pricing';

  function navigateFilters(changes: Record<string, string | null>, resetPagination = true) {
    const params = new URLSearchParams(search.toString());
    if (resetPagination) {
      params.delete('cursor');
      params.delete('page');
    }
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false });
  }

  if (!allowed) return <ForbiddenOperation />;
  return (
    <div className="operations-page">
      <div className="page-heading">
        <div>
          <h1>{definition.title}</h1>
          <p>{definition.description}</p>
        </div>
        <div className="page-actions">
          {module === 'users' && <UserActions onSaved={() => void query.refetch()} />}
          {isCatalog && (
            <CatalogCreateAction module={module} onSuccess={() => void query.refetch()} />
          )}
          {module === 'trips' && can(user, 'trips.create') && (
            <Link className="button button-primary" href="/trips/new">
              إنشاء رحلة
            </Link>
          )}
          {module === 'drivers' && can(user, 'drivers.manage') && (
            <Link className="button button-primary" href="/drivers/new">
              إضافة سائق
            </Link>
          )}
          <RetryButton
            className="button button-secondary"
            error={query.error}
            retry={() => void query.refetch()}
            disabled={query.isFetching || !parsed.success}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {query.isFetching ? 'جارٍ التحديث…' : 'تحديث'}
          </RetryButton>
        </div>
      </div>
      {!parsed.success ? (
        <InvalidFilters reset={() => router.replace(pathname)} />
      ) : (
        <>
          {hasFilters && (
            <form
              key={queryString(filters)}
              className="surface operations-filters"
              onSubmit={(event) => {
                event.preventDefault();
                const values = new FormData(event.currentTarget);
                const changes: Record<string, string | null> = {};
                for (const [key, value] of values.entries()) changes[key] = String(value) || null;
                navigateFilters(changes);
              }}
            >
              {module === 'trips' && (
                <label>
                  حالة الرحلة
                  <select name="status" defaultValue={String(filters.status ?? '')}>
                    <option value="">كل الحالات</option>
                    {Object.entries(tripStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(module === 'drivers' || module === 'pricing') && (
                <label>
                  الحالة
                  <select
                    name="active"
                    defaultValue={filters.active === undefined ? '' : String(filters.active)}
                  >
                    <option value="">كل الحالات</option>
                    <option value="true">نشط</option>
                    <option value="false">غير نشط</option>
                  </select>
                </label>
              )}
              {(module === 'trips' || module === 'pricing') && (
                <>
                  <label>
                    مدينة الانطلاق
                    <select
                      name="origin_city_id"
                      defaultValue={String(filters.origin_city_id ?? '')}
                    >
                      <option value="">جميع المدن</option>
                      {Array.from(catalog.names.cities).map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    مدينة الوصول
                    <select
                      name="destination_city_id"
                      defaultValue={String(filters.destination_city_id ?? '')}
                    >
                      <option value="">جميع المدن</option>
                      {Array.from(catalog.names.cities).map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {module === 'pricing' && (
                <label>
                  نوع الشحنة
                  <select
                    name="shipment_type_id"
                    defaultValue={String(filters.shipment_type_id ?? '')}
                  >
                    <option value="">كل الأنواع</option>
                    {Array.from(catalog.names.types).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button className="button button-primary" type="submit">
                <Filter size={15} aria-hidden="true" />
                تطبيق
              </button>
              {search.size > 0 && (
                <button
                  className="button button-ghost"
                  type="button"
                  onClick={() => router.push(pathname)}
                >
                  مسح التصفية
                </button>
              )}
            </form>
          )}
          {catalog.isError && needsNames && (
            <p className="inline-notice">
              تعذر تحميل أسماء بعض المدن والأنواع. السجلات التشغيلية معروضة بالقيم المتاحة.
            </p>
          )}
          {module === 'audit' && (
            <p className="operation-note">
              يعرض هذا السجل نوع العملية وتوقيتها. لا تُعرض التفاصيل الداخلية أو بيانات الارتباط
              بالحسابات.
            </p>
          )}
          {query.isError ? (
            <ErrorPanel
              error={query.error instanceof ApiError ? query.error : null}
              retry={() => void query.refetch()}
            />
          ) : (
            <section className="surface operations-panel">
              <OperationsTable
                title={definition.title}
                columns={
                  module === 'users' || isCatalog ? [...definition.columns, ''] : definition.columns
                }
                rows={query.data?.rows ?? []}
                pending={query.isPending}
                fetching={query.isFetching}
                actions={
                  module === 'users' || isCatalog
                    ? (row) =>
                        row.record?.module === 'users' ? (
                          <UserActions
                            record={row.record.data}
                            onSaved={() => void query.refetch()}
                          />
                        ) : row.record ? (
                          <CatalogEditAction
                            record={row.record}
                            onSuccess={() => void query.refetch()}
                          />
                        ) : null
                    : undefined
                }
              />
              {query.data && (
                <Pagination
                  meta={query.data.meta}
                  count={query.data.rows.length}
                  busy={query.isFetching}
                  onChange={(key, value) => navigateFilters({ [key]: value }, false)}
                />
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
