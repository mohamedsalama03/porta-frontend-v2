'use client';

import Link from 'next/link';
import { useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  Clipboard,
  Columns3,
  Info,
  Package,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from '@tanstack/react-table';
import type { ShipmentDetailViewModel, ShipmentLabel, ShipmentViewModel } from './view-model';
import './shipments.css';

export function ShipmentBadge({ value }: { value: ShipmentLabel }) {
  return (
    <span className={`shipment-badge shipment-badge-${value.tone}`}>
      <span aria-hidden="true" />
      {value.label}
    </span>
  );
}

export function ShipmentPreviewNotice() {
  return (
    <p className="shipment-preview-note">
      <Info size={15} aria-hidden="true" />
      <span>بيانات توضيحية — لا تمثل شحنات فعلية</span>
    </p>
  );
}

const columns: ColumnDef<ShipmentViewModel>[] = [
  {
    accessorKey: 'tracking',
    header: 'رقم التتبع',
    enableHiding: false,
    cell: ({ row }) => (
      <Link
        className="shipment-tracking"
        dir="ltr"
        href={row.original.href ?? `/preview/shipments/${row.original.id}`}
      >
        {row.original.tracking}
      </Link>
    ),
  },
  {
    accessorKey: 'sender',
    header: 'المرسل / المستلم',
    cell: ({ row }) => (
      <div className="shipment-cell-stack">
        <span>{row.original.sender}</span>
        <small>{row.original.recipient}</small>
      </div>
    ),
  },
  {
    id: 'route',
    header: 'المسار',
    enableHiding: false,
    cell: ({ row }) => (
      <div className="shipment-route">
        <span>{row.original.origin}</span>
        <ArrowLeft size={13} aria-hidden="true" />
        <span>{row.original.destination}</span>
      </div>
    ),
  },
  {
    id: 'type',
    accessorKey: 'type',
    header: 'الشحنة',
    cell: ({ row }) => (
      <div className="shipment-cell-stack">
        <span>{row.original.type}</span>
        <small>{row.original.size}</small>
      </div>
    ),
  },
  {
    id: 'status',
    header: 'الحالة',
    enableHiding: false,
    cell: ({ row }) => <ShipmentBadge value={row.original.status} />,
  },
  {
    id: 'payment',
    header: 'الدفع',
    cell: ({ row }) => (
      <span className="shipment-payment">
        {row.original.payment.tone === 'success' && <Check size={13} aria-hidden="true" />}
        {row.original.payment.label}
      </span>
    ),
  },
  { accessorKey: 'driver', header: 'السائق' },
  {
    accessorKey: 'trip',
    header: 'الرحلة',
    cell: ({ getValue }) => <bdi>{String(getValue())}</bdi>,
  },
  { accessorKey: 'price', header: 'السعر' },
  { accessorKey: 'createdLabel', header: 'تاريخ الإنشاء' },
  {
    id: 'actions',
    header: () => <span className="shipment-sr-only">الإجراءات</span>,
    enableHiding: false,
    cell: ({ row }) => (
      <Link
        className="icon-button shipment-row-link"
        href={row.original.href ?? `/preview/shipments/${row.original.id}`}
        aria-label={`عرض الشحنة ${row.original.tracking}`}
      >
        <ChevronLeft size={17} aria-hidden="true" />
      </Link>
    ),
  },
];

export function ShipmentTable({
  rows,
  state = 'ready',
  onRetry,
  footer,
  caption = 'شحنات توضيحية لمعاينة مكونات الواجهة',
}: {
  rows: ShipmentViewModel[];
  state?: 'ready' | 'loading' | 'error';
  onRetry?: () => void;
  footer?: ReactNode;
  caption?: string;
}) {
  'use no memo'; // TanStack Table v8 owns mutable table handles; keep them in this component.
  const [visibility, setVisibility] = useState<VisibilityState>({
    driver: false,
    trip: false,
    price: false,
    createdLabel: false,
  });
  const dialog = useRef<HTMLDialogElement>(null);
  // eslint-disable-next-line react-hooks/incompatible-library -- v8 mutable table handles stay inside this explicitly non-memoized component.
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility: visibility },
    onColumnVisibilityChange: setVisibility,
  });

  return (
    <section className="surface shipment-table-surface" aria-label="قائمة الشحنات">
      <div className="shipment-table-heading">
        <h2>
          سجل الشحنات{' '}
          <span className="shipment-count">
            {new Intl.NumberFormat('ar-LY').format(rows.length)}
          </span>
        </h2>
        <button
          className="button button-ghost"
          type="button"
          onClick={() => dialog.current?.showModal()}
        >
          <Columns3 size={16} aria-hidden="true" />
          الأعمدة
        </button>
      </div>
      <dialog
        ref={dialog}
        className="shipment-columns-dialog"
        aria-labelledby="shipment-columns-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="shipment-dialog-heading">
          <h2 id="shipment-columns-title">الأعمدة المعروضة</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="إغلاق خيارات الأعمدة"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        <p>اختر التفاصيل التي تحتاجها في الجدول.</p>
        {table
          .getAllLeafColumns()
          .filter((column) => column.getCanHide())
          .map((column) => (
            <label className="shipment-column-option" key={column.id}>
              <input
                type="checkbox"
                checked={column.getIsVisible()}
                onChange={column.getToggleVisibilityHandler()}
              />
              {String(column.columnDef.header)}
            </label>
          ))}
        <button
          className="button button-primary shipment-dialog-done"
          type="button"
          onClick={() => dialog.current?.close()}
        >
          تم
        </button>
      </dialog>
      {state === 'error' ? (
        <div role="alert" className="shipment-table-state">
          <Package size={28} />
          <h3>تعذّر عرض الشحنات</h3>
          <p>حاول تحميل القائمة مرة أخرى.</p>
          {onRetry && (
            <button type="button" className="button button-secondary" onClick={onRetry}>
              <RotateCcw size={16} />
              إعادة المحاولة
            </button>
          )}
        </div>
      ) : state === 'ready' && !rows.length ? (
        <div className="shipment-table-state">
          <Package size={30} aria-hidden="true" />
          <h3>لا توجد شحنات مطابقة</h3>
          <p>جرّب كلمة أخرى أو أزل بعض عوامل التصفية.</p>
        </div>
      ) : (
        <div
          className="shipment-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="جدول الشحنات، قابل للتمرير أفقيًا"
        >
          <table className="shipment-table" aria-busy={state === 'loading'}>
            <caption className="shipment-sr-only">{caption}</caption>
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => (
                    <th scope="col" key={header.id} className={`shipment-col-${header.column.id}`}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {state === 'loading'
                ? Array.from({ length: 6 }, (_, row) => (
                    <tr key={row}>
                      {table.getVisibleLeafColumns().map((column) => (
                        <td key={column.id} className={`shipment-col-${column.id}`}>
                          <span className="shipment-skeleton" />
                        </td>
                      ))}
                    </tr>
                  ))
                : table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className={`shipment-col-${cell.column.id}`}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
          {state === 'loading' && (
            <span role="status" className="shipment-sr-only">
              جارٍ تحميل الشحنات
            </span>
          )}
        </div>
      )}
      {footer ?? (
        <div className="shipment-table-footer">
          <p>معاينة محدودة بثمانية سجلات توضيحية.</p>
          <button
            className="button button-secondary"
            type="button"
            disabled
            aria-describedby="shipment-pagination-note"
          >
            التالي
            <ChevronLeft size={15} aria-hidden="true" />
          </button>
          <span id="shipment-pagination-note" className="shipment-sr-only">
            التنقل بين صفحات البيانات ينتظر ربط واجهة الخدمة المعتمدة.
          </span>
        </div>
      )}
    </section>
  );
}

function InfoRow({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="shipment-info-row">
      <dt>{label}</dt>
      <dd dir={ltr ? 'ltr' : undefined}>{value}</dd>
    </div>
  );
}

export function ShipmentDetails({ shipment }: { shipment: ShipmentDetailViewModel }) {
  const [copyState, setCopyState] = useState('');
  async function copyTracking() {
    try {
      await navigator.clipboard.writeText(shipment.tracking);
      setCopyState('تم نسخ رقم التتبع');
    } catch {
      setCopyState('تعذّر النسخ. يمكنك تحديد رقم التتبع ونسخه يدويًا.');
    }
  }
  return (
    <div className="shipment-detail">
      <Link className="shipment-back-link" href="/preview/shipments">
        <ArrowLeft size={15} aria-hidden="true" />
        العودة إلى الشحنات
      </Link>
      <div className="shipment-detail-heading">
        <div>
          <div className="shipment-tracking-heading">
            <h1 dir="ltr">{shipment.tracking}</h1>
            <button
              type="button"
              className="icon-button"
              onClick={copyTracking}
              aria-label="نسخ رقم التتبع"
            >
              <Clipboard size={17} />
            </button>
            <ShipmentBadge value={shipment.status} />
          </div>
          <p>أنشئت في {shipment.createdLabel}</p>
          <span className="shipment-copy-feedback" role="status">
            {copyState}
          </span>
        </div>
        <div className="shipment-heading-price">
          <strong>{shipment.price}</strong>
          <span>السعر من الخدمة عند الربط</span>
        </div>
      </div>
      <ShipmentPreviewNotice />
      <div className="shipment-detail-layout">
        <div className="shipment-detail-main">
          <section className="surface shipment-detail-panel">
            <h2>الأطراف</h2>
            <div className="shipment-people">
              <div>
                <h3>المرسل</h3>
                <p className="shipment-person-name">{shipment.sender}</p>
                <p dir="ltr" className="shipment-placeholder-phone">
                  {shipment.senderPhone}
                </p>
                <p className="shipment-muted">{shipment.origin}</p>
              </div>
              <div>
                <h3>المستلم</h3>
                <p className="shipment-person-name">{shipment.recipient}</p>
                <p dir="ltr" className="shipment-placeholder-phone">
                  {shipment.recipientPhone}
                </p>
                <p className="shipment-muted">{shipment.recipientAddress}</p>
              </div>
            </div>
          </section>
          <section className="surface shipment-detail-panel">
            <h2>المسار والتوصيل</h2>
            <div className="shipment-route-visual">
              <div>
                <span className="shipment-route-point" />
                <strong>{shipment.origin}</strong>
                <small>{shipment.originBranch}</small>
              </div>
              <div className="shipment-route-line" aria-hidden="true" />
              <div>
                <span className="shipment-route-point shipment-route-end" />
                <strong>{shipment.destination}</strong>
                <small>{shipment.destinationBranch}</small>
              </div>
            </div>
            <dl className="shipment-info-grid">
              <InfoRow label="طريقة التسليم" value={shipment.deliveryMethod} />
              <InfoRow label="السائق" value={shipment.driver} />
              <InfoRow label="الرحلة" value={shipment.trip} ltr />
              <InfoRow label="عنوان المستلم" value={shipment.recipientAddress} />
            </dl>
          </section>
          <section className="surface shipment-detail-panel">
            <h2>الشحنة والدفع</h2>
            <dl className="shipment-info-grid">
              <InfoRow label="نوع الشحنة" value={shipment.type} />
              <InfoRow label="الحجم" value={shipment.size} />
              <InfoRow label="حالة الدفع" value={shipment.payment.label} />
              <InfoRow label="السعر" value="غير متاح في المعاينة" />
            </dl>
          </section>
          <section className="surface shipment-detail-panel">
            <h2>الملاحظات</h2>
            <p className="shipment-notes">{shipment.notes}</p>
          </section>
        </div>
        <aside className="shipment-detail-side">
          <section className="surface shipment-detail-panel">
            <h2>مسار الحالة</h2>
            <p className="shipment-panel-note">أحداث توضيحية لهذه المعاينة</p>
            <ol className="shipment-timeline">
              {shipment.timeline.map((event, index) => (
                <li key={event.id} className={index === 0 ? 'shipment-timeline-current' : ''}>
                  <span className="shipment-timeline-point" aria-hidden="true" />
                  <h3>{event.label}</h3>
                  <p>{event.timestamp}</p>
                  {event.note && <small>{event.note}</small>}
                </li>
              ))}
            </ol>
          </section>
          <section className="shipment-actions-panel">
            <h2>إجراءات الشحنة</h2>
            <p>
              تغيير الحالة وتعيين السائق وتسجيل الدفع بانتظار ربط الخدمة وتحديد صلاحياتك والإجراءات
              المسموحة.
            </p>
            <button className="button button-secondary" disabled type="button">
              تغيير الحالة
            </button>
            <button className="button button-secondary" disabled type="button">
              تعيين سائق
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
