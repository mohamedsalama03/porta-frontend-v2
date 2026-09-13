import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShipmentDetails, ShipmentTable } from '@/features/shipments/presentation';
import { ShipmentCreatePreview } from '@/features/shipments/shipment-create-preview';
import { shipmentFixtures } from '@/features/shipments/fixtures';
import { filterPreviewShipments, updatePreviewFilters } from '@/features/shipments/preview-filters';

describe('isolated shipment component preview', () => {
  it('combines preview filters and resets cursor state without losing unrelated URL state', () => {
    const query = updatePreviewFilters('cursor=old&page=5&origin=طرابلس&panel=compact', {
      q: '  DEMO-2048  ',
      destination: 'بنغازي',
    });
    const params = new URLSearchParams(query);
    expect(params.get('cursor')).toBeNull();
    expect(params.get('page')).toBeNull();
    expect(params.get('panel')).toBe('compact');
    expect(params.get('q')).toBe('DEMO-2048');
    expect(filterPreviewShipments(shipmentFixtures, params).map((row) => row.id)).toEqual([
      'sample-001',
    ]);
  });

  it('removes individual filters and applies date boundaries within the fixture', () => {
    const params = new URLSearchParams(
      updatePreviewFilters('status=في الطريق&origin=طرابلس', { status: '' }),
    );
    expect(params.has('status')).toBe(false);
    expect(params.get('origin')).toBe('طرابلس');
    const results = filterPreviewShipments(
      shipmentFixtures,
      new URLSearchParams('from=2026-09-12&to=2026-09-12'),
    );
    expect(results.map((row) => row.id)).toEqual(['sample-005', 'sample-006', 'sample-007']);
  });

  it('has accessible detail links and does not claim next pages are available', () => {
    render(<ShipmentTable rows={[shipmentFixtures[0]]} />);
    expect(screen.getByRole('link', { name: 'عرض الشحنة DEMO-2048' })).toHaveAttribute(
      'href',
      '/preview/shipments/sample-001',
    );
    expect(screen.getByRole('button', { name: 'التالي' })).toBeDisabled();
  });

  it('offers a recovery action when supplied an error state', async () => {
    const retry = vi.fn();
    render(<ShipmentTable rows={[]} state="error" onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('تعذّر عرض الشحنات');
    await userEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('gives clipboard feedback and keeps unsupported workflow actions disabled', async () => {
    const user = userEvent.setup();
    render(<ShipmentDetails shipment={shipmentFixtures[0]} />);
    await user.click(screen.getByRole('button', { name: 'نسخ رقم التتبع' }));
    expect(await screen.findByRole('status')).toHaveTextContent('تم نسخ رقم التتبع');
    expect(await navigator.clipboard.readText()).toBe('DEMO-2048');
    expect(screen.getByRole('button', { name: 'تغيير الحالة' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'تعيين سائق' })).toBeDisabled();
  });

  it('validates local text ergonomics without enabling or simulating creation', async () => {
    const user = userEvent.setup();
    render(<ShipmentCreatePreview />);
    await user.click(screen.getByRole('textbox', { name: 'اسم المرسل' }));
    await user.tab();
    expect(await screen.findByRole('alert')).toHaveTextContent('أدخل اسمًا لتجربة هذا الحقل.');
    expect(screen.getByRole('button', { name: 'إنشاء الشحنة' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'مدينة الانطلاق' })).toBeDisabled();
    expect(screen.getByText('لم يُحسب أو يُطلب أي سعر.')).toBeVisible();
  });
});
