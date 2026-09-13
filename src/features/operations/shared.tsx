'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Inbox, ShieldAlert } from 'lucide-react';
import type { CursorMeta, PageMeta } from '@/lib/api/generated';
import { formatNumber } from '@/lib/formatters';
import { readCatalogNames } from './api';
import type { CatalogNames, DisplayCell, DisplayRow } from './model';

const emptyNames: CatalogNames = { cities: new Map(), types: new Map() };
export function useCatalogNames(enabled = true) {
  const query = useQuery({
    queryKey: ['catalog', 'display-names'],
    queryFn: ({ signal }) => readCatalogNames(signal),
    enabled,
    staleTime: 5 * 60_000,
  });
  return { ...query, names: query.data ?? emptyNames };
}

export function ForbiddenOperation() {
  return (
    <section className="surface empty-panel">
      <ShieldAlert size={26} aria-hidden="true" />
      <h2>هذه الصفحة غير متاحة لحسابك</h2>
      <p>صلاحيات حسابك لا تسمح بعرض هذه البيانات.</p>
    </section>
  );
}

export function InvalidFilters({ reset }: { reset: () => void }) {
  return (
    <section className="surface empty-panel" role="alert">
      <h2>تعذر استخدام عوامل التصفية</h2>
      <p>يحتوي الرابط على قيمة غير صالحة أو مكررة. أعد ضبط التصفية ثم حاول مجدداً.</p>
      <button className="button button-secondary" onClick={reset}>
        إعادة ضبط التصفية
      </button>
    </section>
  );
}

export function Cell({ cell }: { cell: DisplayCell }) {
  const content = cell.numeric ? <bdi>{cell.text}</bdi> : cell.text;
  return (
    <>
      {cell.href ? (
        <Link href={cell.href} className="text-link">
          {content}
        </Link>
      ) : cell.badge ? (
        <span className={`badge${cell.badge === 'neutral' ? '' : ` badge-${cell.badge}`}`}>
          {content}
        </span>
      ) : (
        content
      )}
      {cell.secondary && <small className="operation-cell-secondary">{cell.secondary}</small>}
    </>
  );
}

export function OperationsTable({
  title,
  columns,
  rows,
  pending,
  fetching = false,
  actions,
}: {
  title: string;
  columns: readonly string[];
  rows: DisplayRow[];
  pending?: boolean;
  fetching?: boolean;
  actions?: (row: DisplayRow) => ReactNode;
}) {
  return (
    <div
      className="operations-table-scroll"
      role="region"
      aria-label={`جدول ${title}`}
      tabIndex={0}
      aria-busy={pending || fetching}
    >
      <table className="operations-table">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={`${column}-${index}`} scope="col">
                {column || <span className="sr-only">الإجراءات</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pending ? (
            Array.from({ length: 5 }, (_, index) => (
              <tr key={index}>
                {columns.map((column, cellIndex) => (
                  <td key={`${column}-${cellIndex}`}>
                    <div className="skeleton operation-cell-skeleton" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length ? (
            rows.map((row) => (
              <tr key={row.key}>
                {row.cells.map((cell, index) => (
                  <td key={index}>
                    <Cell cell={cell} />
                  </td>
                ))}
                {actions && <td>{actions(row)}</td>}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>
                <div className="empty-panel operation-empty">
                  <Inbox size={26} aria-hidden="true" />
                  <h2>لا توجد سجلات لعرضها</h2>
                  <p>ستظهر السجلات هنا عند إضافتها أو عند تغيير عوامل التصفية.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  meta,
  count,
  busy,
  onChange,
}: {
  meta: CursorMeta | PageMeta;
  count: number;
  busy: boolean;
  onChange: (key: 'cursor' | 'page', value: string | null) => void;
}) {
  const numbered = 'page' in meta;
  const previous = numbered
    ? meta.page > 1
      ? String(meta.page - 1)
      : null
    : (meta.previous_cursor ?? null);
  const next = numbered
    ? meta.page < meta.last_page
      ? String(meta.page + 1)
      : null
    : meta.next_cursor;
  return (
    <div className="operations-pagination">
      <span>
        {numbered
          ? `${formatNumber(meta.total)} سجل · صفحة ${formatNumber(meta.page)} من ${formatNumber(meta.last_page)}`
          : `${formatNumber(count)} سجل في هذه الصفحة`}
      </span>
      <div>
        <button
          className="button button-ghost"
          disabled={!previous || busy}
          onClick={() => onChange(numbered ? 'page' : 'cursor', previous)}
        >
          <ChevronRight size={15} aria-hidden="true" />
          السابق
        </button>
        <button
          className="button button-secondary"
          disabled={!next || busy}
          onClick={() => onChange(numbered ? 'page' : 'cursor', next)}
        >
          التالي
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
