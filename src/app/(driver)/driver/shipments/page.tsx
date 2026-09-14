import type { Metadata } from 'next';
import { DriverShipmentList } from '@/features/driver-workspace/shipment-list';

export const metadata: Metadata = { title: 'شحناتي' };

export default function DriverShipmentsPage() {
  return <DriverShipmentList />;
}
