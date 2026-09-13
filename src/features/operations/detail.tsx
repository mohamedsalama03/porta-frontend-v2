'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import {
  getAdminDriversDriverResponseSchema,
  getAdminTripsTripResponseSchema,
  getAdminTripsTripShipmentsResponseSchema,
  getAdminTripsTripShipmentsQuerySchema,
  ulidSchema,
} from '@/lib/api/generated';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { formatDate } from '@/lib/formatters';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { RetryButton } from '@/components/feedback/retry-button';
import { OperationEditButton } from './editor';
import { TripShipmentsAction } from './trip-shipments-action';
import {
  activeCell,
  cityName,
  parseUrlQuery,
  queryString,
  tripStatusCell,
  type OperationQuery,
} from './model';
import {
  Cell,
  ForbiddenOperation,
  InvalidFilters,
  OperationsTable,
  Pagination,
  useCatalogNames,
} from './shared';
import './operations.css';

export function OperationDetail({ module, id }: { module: 'trips' | 'drivers'; id: string }) {
  return module === 'trips' ? <TripDetail id={id} /> : <DriverDetail id={id} />;
}

function DriverDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const allowed = can(user, 'drivers.view');
  const valid = ulidSchema.safeParse(id).success;
  const query = useQuery({
    queryKey: ['operations', 'drivers', 'detail', id],
    queryFn: ({ signal }) =>
      api.request(`/api/v1/admin/drivers/${encodeURIComponent(id)}`, {
        schema: getAdminDriversDriverResponseSchema,
        signal,
      }),
    enabled: allowed && valid,
  });
  if (!allowed) return <ForbiddenOperation />;
  if (!valid) return <InvalidResource module="drivers" />;
  return (
    <div className="operations-page">
      <Link href="/drivers" className="text-link">
        <ArrowRight size={16} aria-hidden="true" />
        جميع السائقين
      </Link>
      <div className="page-heading operation-detail-heading">
        <div>
          <h1>{query.data?.data.full_name ?? 'تفاصيل السائق'}</h1>
          <p>بيانات السائق المسجلة لدى المنظومة.</p>
        </div>
        <div className="page-actions">
          {query.data && (
            <OperationEditButton record={{ module: 'drivers', data: query.data.data }} />
          )}
          <RetryButton
            className="button button-secondary"
            disabled={query.isFetching}
            error={query.error}
            retry={() => void query.refetch()}
          >
            <RefreshCw size={16} aria-hidden="true" />
            تحديث
          </RetryButton>
        </div>
      </div>
      {query.isError ? (
        <ErrorPanel
          error={query.error instanceof ApiError ? query.error : null}
          retry={() => void query.refetch()}
        />
      ) : query.data ? (
        <section className="surface operation-detail-section">
          <h2>بيانات السائق</h2>
          <dl>
            <div>
              <dt>الاسم الكامل</dt>
              <dd>{query.data.data.full_name}</dd>
            </div>
            <div>
              <dt>الهاتف</dt>
              <dd>
                <bdi>{query.data.data.phone}</bdi>
              </dd>
            </div>
            <div>
              <dt>رقم الرخصة</dt>
              <dd>
                <bdi>{query.data.data.license_number ?? 'غير مسجل'}</bdi>
              </dd>
            </div>
            <div>
              <dt>الحالة</dt>
              <dd>
                <Cell cell={activeCell(query.data.data.active)} />
              </dd>
            </div>
            <div>
              <dt>حساب مرتبط</dt>
              <dd>{query.data.data.user_id ? 'مرتبط بحساب مستخدم' : 'لا يوجد حساب مرتبط'}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <div className="skeleton operation-detail-skeleton" aria-label="جارٍ تحميل بيانات السائق" />
      )}
    </div>
  );
}

function InvalidResource({ module }: { module: 'trips' | 'drivers' }) {
  return (
    <section className="surface empty-panel">
      <h1>الرابط غير صالح</h1>
      <p>تحقق من رابط السجل المطلوب.</p>
      <Link className="button button-secondary" href={`/${module}`}>
        العودة إلى القائمة
      </Link>
    </section>
  );
}

function TripDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const allowed = can(user, 'trips.view');
  const valid = ulidSchema.safeParse(id).success;
  const router = useRouter();
  const search = useSearchParams();
  const parsed = parseUrlQuery<OperationQuery>(
    getAdminTripsTripShipmentsQuerySchema,
    new URLSearchParams(search.toString()),
  );
  const filters = parsed.success ? parsed.data : {};
  const names = useCatalogNames(allowed && valid);
  const query = useQuery({
    queryKey: ['operations', 'trips', 'detail', id],
    queryFn: ({ signal }) =>
      api.request(`/api/v1/admin/trips/${encodeURIComponent(id)}`, {
        schema: getAdminTripsTripResponseSchema,
        signal,
      }),
    enabled: allowed && valid,
  });
  const shipments = useQuery({
    queryKey: ['operations', 'trips', id, 'shipments', filters],
    queryFn: ({ signal }) =>
      api.request(
        `/api/v1/admin/trips/${encodeURIComponent(id)}/shipments${queryString(filters)}`,
        { schema: getAdminTripsTripShipmentsResponseSchema, signal },
      ),
    enabled: allowed && valid && parsed.success,
  });
  if (!allowed) return <ForbiddenOperation />;
  if (!valid) return <InvalidResource module="trips" />;
  const trip = query.data?.data;
  return (
    <div className="operations-page">
      <Link href="/trips" className="text-link">
        <ArrowRight size={16} aria-hidden="true" />
        جميع الرحلات
      </Link>
      <div className="page-heading operation-detail-heading">
        <div>
          <h1>
            {trip
              ? `${trip.origin_city?.name_ar ?? cityName(trip.origin_city_id, names.names)} ← ${trip.destination_city?.name_ar ?? cityName(trip.destination_city_id, names.names)}`
              : 'تفاصيل الرحلة'}
          </h1>
          <p>مسار الرحلة والسائق والشحنات المسندة إليها.</p>
        </div>
        {trip && (
          <div className="page-actions">
            <Cell cell={tripStatusCell(trip.status)} />
            <OperationEditButton record={{ module: 'trips', data: trip }} />
          </div>
        )}
      </div>
      {query.isError ? (
        <ErrorPanel
          error={query.error instanceof ApiError ? query.error : null}
          retry={() => void query.refetch()}
        />
      ) : trip ? (
        <section className="surface operation-detail-section">
          <h2>بيانات الرحلة</h2>
          <dl>
            <div>
              <dt>السائق</dt>
              <dd>{trip.driver?.full_name ?? 'غير مسند'}</dd>
            </div>
            <div>
              <dt>موعد الانطلاق</dt>
              <dd>{formatDate(trip.departure_at, { hour: '2-digit', minute: '2-digit' })}</dd>
            </div>
            <div>
              <dt>الوصول المتوقع</dt>
              <dd>
                {trip.estimated_arrival_at
                  ? formatDate(trip.estimated_arrival_at, { hour: '2-digit', minute: '2-digit' })
                  : 'غير محدد'}
              </dd>
            </div>
            <div>
              <dt>عدد الشحنات</dt>
              <dd>{trip.shipments_count ?? 'غير متاح'}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <div className="skeleton operation-detail-skeleton" aria-label="جارٍ تحميل تفاصيل الرحلة" />
      )}
      {trip && can(user, 'trips.update') && (
        <p className="operation-note">
          تغيير حالة الرحلة غير متاح هنا حتى توفر الخدمة الإجراءات المسموح بها لهذه الرحلة.
        </p>
      )}
      <div className="operation-section-heading">
        <h2 className="operation-section-title">شحنات الرحلة</h2>
        {trip && <TripShipmentsAction tripId={trip.id} />}
      </div>
      {!parsed.success ? (
        <InvalidFilters reset={() => router.replace(`/trips/${id}`)} />
      ) : shipments.isError ? (
        <ErrorPanel
          error={shipments.error instanceof ApiError ? shipments.error : null}
          retry={() => void shipments.refetch()}
        />
      ) : (
        <section className="surface operations-panel">
          <OperationsTable
            title="شحنات الرحلة"
            columns={
              can(user, 'trips.assign_shipments')
                ? ['رقم التتبع', 'المرسل', 'المستلم', 'المسار', '']
                : ['رقم التتبع', 'المرسل', 'المستلم', 'المسار']
            }
            rows={
              shipments.data?.data.map((shipment) => ({
                key: shipment.id,
                cells: [
                  {
                    text: shipment.tracking_number,
                    numeric: true,
                    href: can(user, 'shipments.view') ? `/shipments/${shipment.id}` : undefined,
                  },
                  { text: shipment.sender_name },
                  { text: shipment.recipient_name },
                  {
                    text: `${shipment.origin_city?.name_ar ?? '—'} ← ${shipment.destination_city?.name_ar ?? '—'}`,
                  },
                ],
              })) ?? []
            }
            pending={shipments.isPending}
            actions={
              can(user, 'trips.assign_shipments')
                ? (row) => (
                    <TripShipmentsAction
                      tripId={id}
                      shipment={{ id: row.key, tracking_number: row.cells[0].text }}
                    />
                  )
                : undefined
            }
          />
          {shipments.data && (
            <Pagination
              meta={shipments.data.meta}
              count={shipments.data.data.length}
              busy={shipments.isFetching}
              onChange={(_, value) => {
                const params = new URLSearchParams(search.toString());
                if (value) params.set('cursor', value);
                else params.delete('cursor');
                router.push(`/trips/${id}${params.size ? `?${params}` : ''}`, { scroll: false });
              }}
            />
          )}
        </section>
      )}
    </div>
  );
}
