import type { Metadata } from 'next';
import { DriverTripList } from '@/features/driver-workspace/trip-list';

export const metadata: Metadata = { title: 'رحلاتي' };

export default function DriverTripsPage() {
  return <DriverTripList />;
}
