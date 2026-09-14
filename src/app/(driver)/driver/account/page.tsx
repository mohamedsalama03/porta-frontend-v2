import type { Metadata } from 'next';
import { DriverAccount } from '@/features/driver-workspace/account';

export const metadata: Metadata = { title: 'الحساب' };

export default function DriverAccountPage() {
  return <DriverAccount />;
}
