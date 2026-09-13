'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import {
  getAdminShipmentsShipmentPaymentsQuerySchema,
  getAdminShipmentsShipmentPaymentsResponseSchema,
  ulidSchema,
} from '@/lib/api/generated';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { formatDate, formatMoney } from '@/lib/formatters';
import { ErrorPanel } from '@/components/feedback/error-panel';
import { ForbiddenOperation, InvalidFilters, OperationsTable, Pagination } from './shared';
import { parseUrlQuery, queryString, type OperationQuery } from './model';
import './operations.css';

const kindLabels = { CAPTURE: 'تحصيل', FAILURE: 'فشل دفع', REFUND: 'استرداد' };
const methodLabels = { CASH_ON_DELIVERY: 'الدفع عند الاستلام', PREPAID_TRANSFER: 'تحويل مسبق' };
const statusLabels = { PAID: 'مدفوع', FAILED: 'فشل', REFUNDED: 'مسترد' };

export function PaymentLedger() {
  const { user } = useAuth();
  const allowed = can(user, 'payments.manage');
  const search = useSearchParams();
  const router = useRouter();
  const shipment = search.get('shipment') ?? '';
  const validId = ulidSchema.safeParse(shipment).success && search.getAll('shipment').length === 1;
  const params = new URLSearchParams(search.toString());
  params.delete('shipment');
  const parsed = parseUrlQuery<OperationQuery>(
    getAdminShipmentsShipmentPaymentsQuerySchema,
    params,
  );
  const filters = parsed.success ? parsed.data : {};
  const query = useQuery({
    queryKey: ['payments', 'ledger', shipment, filters],
    queryFn: ({ signal }) =>
      api.request(
        `/api/v1/admin/shipments/${encodeURIComponent(shipment)}/payments${queryString(filters)}`,
        { schema: getAdminShipmentsShipmentPaymentsResponseSchema, signal },
      ),
    enabled: allowed && validId && parsed.success,
    staleTime: 15_000,
  });
  if (!allowed) return <ForbiddenOperation />;
  return (
    <div className="operations-page">
      <div className="page-heading">
        <div>
          <h1>المدفوعات</h1>
          <p>سجل التحصيل والاسترداد لشحنة محددة.</p>
        </div>
      </div>
      <p className="inline-notice operation-payment-notice">
        تتيح الخدمة دفتر دفعات لكل شحنة. القائمة المالية الشاملة عبر جميع الشحنات غير متاحة في هذا
        الإصدار.
      </p>
      <form
        className="surface operations-filters"
        onSubmit={(event) => {
          event.preventDefault();
          const value = String(new FormData(event.currentTarget).get('shipment') ?? '').trim();
          router.push(`/payments?${new URLSearchParams({ shipment: value })}`);
        }}
      >
        <label className="ledger-shipment-field">
          معرّف الشحنة
          <input
            name="shipment"
            dir="ltr"
            required
            defaultValue={shipment}
            placeholder="معرّف الشحنة من رابط تفاصيلها"
            maxLength={26}
            minLength={26}
            aria-describedby="ledger-help"
          />
        </label>
        <button className="button button-primary">
          <Search size={16} aria-hidden="true" />
          عرض الدفتر
        </button>
      </form>
      <p id="ledger-help" className="operation-note">
        يمكن فتح هذا الدفتر من تفاصيل الشحنة، أو إدخال المعرّف الموجود في رابطها.
      </p>
      {shipment && (!validId || !parsed.success) ? (
        <InvalidFilters reset={() => router.replace('/payments')} />
      ) : !shipment ? (
        <section className="surface empty-panel">
          <h2>اختر شحنة لعرض دفعاتها</h2>
          <p>تظهر هنا المبالغ وحالة الدفع وطريقته، كما سجلتها الخدمة.</p>
        </section>
      ) : query.isError ? (
        <ErrorPanel
          error={query.error instanceof ApiError ? query.error : null}
          retry={() => void query.refetch()}
        />
      ) : (
        <section className="surface operations-panel">
          <OperationsTable
            title="دفتر دفعات الشحنة"
            columns={['العملية', 'المبلغ', 'الحالة', 'طريقة الدفع', 'المرجع الخارجي', 'التاريخ']}
            rows={
              query.data?.data.map((item) => ({
                key: item.id,
                cells: [
                  { text: kindLabels[item.kind] },
                  { text: formatMoney(item.amount), numeric: true },
                  {
                    text: statusLabels[item.status],
                    badge:
                      item.status === 'PAID'
                        ? ('success' as const)
                        : item.status === 'FAILED'
                          ? ('danger' as const)
                          : ('neutral' as const),
                  },
                  { text: methodLabels[item.payment_method] },
                  { text: item.external_reference ?? '—', numeric: true },
                  { text: formatDate(item.created_at, { hour: '2-digit', minute: '2-digit' }) },
                ],
              })) ?? []
            }
            pending={query.isPending}
          />
          {query.data && (
            <Pagination
              meta={query.data.meta}
              count={query.data.data.length}
              busy={query.isFetching}
              onChange={(_, cursor) => {
                const next = new URLSearchParams(search.toString());
                if (cursor) next.set('cursor', cursor);
                else next.delete('cursor');
                router.push(`/payments?${next}`, { scroll: false });
              }}
            />
          )}
        </section>
      )}
    </div>
  );
}
