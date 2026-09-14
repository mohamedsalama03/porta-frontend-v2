import type { Metadata } from 'next';
import { DriverHome } from '@/features/driver-workspace/home';

export const metadata: Metadata = { title: 'مساحة السائق' };

export default function DriverHomePage() {
  return <DriverHome />;
}
