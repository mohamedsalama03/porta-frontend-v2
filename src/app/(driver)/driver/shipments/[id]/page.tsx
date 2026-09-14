import type { Metadata } from 'next';
import { DriverShipmentDetail } from '@/features/driver-workspace/shipment-detail';

export const metadata: Metadata = { title: 'تفاصيل الشحنة' };

export default async function DriverShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DriverShipmentDetail id={id} />;
}
