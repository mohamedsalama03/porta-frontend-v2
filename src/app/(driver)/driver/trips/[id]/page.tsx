import type { Metadata } from 'next';
import { DriverTripDetail } from '@/features/driver-workspace/trip-detail';

export const metadata: Metadata = { title: 'تفاصيل الرحلة' };

export default async function DriverTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DriverTripDetail id={id} />;
}
