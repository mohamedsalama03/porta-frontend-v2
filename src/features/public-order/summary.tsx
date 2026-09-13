import type { ReactNode } from 'react';
import { ArrowLeft, Pencil } from 'lucide-react';
import { formatMoney } from '@/lib/formatters';

/** Customer-facing labels retained in memory; this is not an API response type. */
export type OrderReviewData = {
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  originCity: string;
  destinationCity: string;
  shipmentType: string;
  shipmentSize: string;
  deliveryMethod: string;
  paymentMethod: string;
  weight?: string;
  deliveryAddress?: string;
  notes?: string;
};

export function OrderReviewDetails({ data }: { data: OrderReviewData }) {
  return (
    <dl className="public-order-review-details">
      <div>
        <dt>المرسل</dt>
        <dd>
          {data.senderName}
          <bdi dir="ltr" className="public-order-review-phone">
            {data.senderPhone}
          </bdi>
        </dd>
      </div>
      <div>
        <dt>المستلم</dt>
        <dd>
          {data.recipientName}
          <bdi dir="ltr" className="public-order-review-phone">
            {data.recipientPhone}
          </bdi>
        </dd>
      </div>
      <div>
        <dt>المسار</dt>
        <dd className="public-order-review-route">
          <span>{data.originCity}</span>
          <ArrowLeft size={15} aria-hidden="true" />
          <span>{data.destinationCity}</span>
        </dd>
      </div>
      <div>
        <dt>نوع الشحنة</dt>
        <dd>{data.shipmentType}</dd>
      </div>
      <div>
        <dt>حجم الشحنة</dt>
        <dd>{data.shipmentSize}</dd>
      </div>
      {data.weight && (
        <div>
          <dt>الوزن</dt>
          <dd>
            <bdi>{data.weight}</bdi>
          </dd>
        </div>
      )}
      <div>
        <dt>طريقة الاستلام</dt>
        <dd>{data.deliveryMethod}</dd>
      </div>
      {data.deliveryAddress && (
        <div>
          <dt>عنوان التوصيل</dt>
          <dd>{data.deliveryAddress}</dd>
        </div>
      )}
      <div>
        <dt>طريقة الدفع</dt>
        <dd>{data.paymentMethod}</dd>
      </div>
      {data.notes && (
        <div>
          <dt>الملاحظات</dt>
          <dd className="public-order-review-notes">{data.notes}</dd>
        </div>
      )}
    </dl>
  );
}

export function OrderSummary({
  state,
  finalPrice,
  review,
  children,
  onEdit,
}: {
  state: 'incomplete' | 'loading' | 'ready' | 'error';
  finalPrice?: number;
  review?: OrderReviewData;
  children?: ReactNode;
  onEdit?: () => void;
}) {
  return (
    <aside className="public-order-summary" aria-labelledby="public-order-summary-heading">
      <div className="public-order-summary-heading">
        <h2 id="public-order-summary-heading">السعر والمراجعة</h2>
        {review && onEdit && (
          <button className="button button-ghost" type="button" onClick={onEdit}>
            <Pencil aria-hidden="true" /> تعديل البيانات
          </button>
        )}
      </div>
      <div
        className="public-order-quote"
        aria-live="polite"
        aria-atomic="true"
        aria-busy={state === 'loading'}
      >
        {state === 'ready' && finalPrice !== undefined ? (
          <>
            <span className="public-order-total-label">إجمالي سعر الشحن</span>
            <strong className="public-order-total">
              <bdi>{formatMoney(finalPrice)}</bdi>
            </strong>
            <p className="public-order-quote-note">السعر المعروض حسب المسار وتفاصيل الشحنة.</p>
          </>
        ) : state === 'loading' ? (
          <>
            <span className="public-order-price-skeleton skeleton" aria-hidden="true" />
            <p>جارٍ تحديث السعر…</p>
          </>
        ) : state === 'error' ? (
          <p>تعذّر عرض السعر حاليًا.</p>
        ) : (
          <p>اختر المسار وتفاصيل الشحنة لعرض السعر.</p>
        )}
      </div>
      {review && (
        <div className="public-order-review">
          <p className="public-order-review-intro">راجع بيانات الطلب قبل إرساله.</p>
          <OrderReviewDetails data={review} />
        </div>
      )}
      {children && <div className="public-order-summary-actions">{children}</div>}
    </aside>
  );
}
