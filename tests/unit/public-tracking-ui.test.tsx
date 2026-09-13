import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { trackingSchema } from '@/lib/api/generated';
import { formatDate } from '@/lib/formatters';
import { TrackingResult } from '@/features/public-tracking/result';
import { TrackingTimeline } from '@/features/public-tracking/timeline';

const data = trackingSchema.parse({
  tracking_number: 'PTA-260913-UITEST01',
  origin_city: { name_ar: 'مدينة إرسال تجريبية', name_en: 'QA Origin' },
  destination_city: { name_ar: 'مدينة وصول تجريبية', name_en: 'QA Destination' },
  shipment_type: 'طرد تجريبي',
  current_status: 'READY_FOR_PICKUP',
  status_label: 'Ready',
  created_at: '2026-09-13T21:30:00Z',
  estimated_delivery: null,
  tracking_timeline: [
    { status: 'READY_FOR_PICKUP', status_label: 'Ready', occurred_at: '2026-09-14T13:15:00+00:00' },
    { status: 'RECEIVED', status_label: 'Received', occurred_at: '2026-09-13T21:30:00Z' },
  ],
});

describe('public tracking presentation', () => {
  it('preserves authoritative array order and displays absolute instants in Tripoli', () => {
    render(<TrackingTimeline events={data.tracking_timeline} />);
    const items = within(screen.getByRole('list', { name: 'سجل الشحنة' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('جاهزة للاستلام');
    expect(items[1]).toHaveTextContent('تم استلام الطلب');
    expect(items[0].querySelector('time')).toHaveAttribute('datetime', '2026-09-14T13:15:00+00:00');
    expect(items[0]).toHaveTextContent(
      formatDate('2026-09-14T13:15:00Z', { hour: '2-digit', minute: '2-digit' }),
    );
  });

  it('shows empty history without predicting any stage', () => {
    render(<TrackingTimeline events={[]} />);
    expect(screen.getByText('لم تُضف تفاصيل إلى سجل الشحنة بعد.')).toBeVisible();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('focuses current status, refreshes explicitly and omits unsupported private properties', () => {
    const onRefresh = vi.fn();
    const unexpected = {
      ...data,
      sender_phone: 'PRIVATE_PHONE',
      internal_id: 'PRIVATE_ID',
      notes: 'PRIVATE_NOTES',
      payment_ledger: 'PRIVATE_LEDGER',
      driver_name: 'PRIVATE_DRIVER',
    };
    const view = render(
      <TrackingResult
        data={unexpected}
        refreshing={false}
        refreshDisabled={false}
        onRefresh={onRefresh}
      />,
    );
    expect(screen.getByRole('heading', { name: 'جاهزة للاستلام', level: 2 })).toHaveFocus();
    expect(view.container.textContent).not.toMatch(/PRIVATE_/);
    expect(screen.queryByText('موعد التسليم المتوقع')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'تحديث الحالة' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('copies only the tracking number and announces success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(
      <TrackingResult
        data={data}
        refreshing={false}
        refreshDisabled={false}
        onRefresh={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'نسخ رقم التتبع' }));
    expect(await screen.findByText('تم نسخ رقم التتبع.')).toBeVisible();
    expect(writeText).toHaveBeenCalledExactlyOnceWith(data.tracking_number);
  });

  it('provides a manual clipboard fallback with readable selectable number', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    render(
      <TrackingResult
        data={data}
        refreshing={false}
        refreshDisabled={false}
        onRefresh={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'نسخ رقم التتبع' }));
    expect(await screen.findByText('تعذّر النسخ. حدّد رقم التتبع وانسخه يدويًا.')).toBeVisible();
    expect(screen.getByText(data.tracking_number)).toHaveAttribute('dir', 'ltr');
  });
});
