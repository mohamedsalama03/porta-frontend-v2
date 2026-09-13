import type { Metadata } from 'next';
import { LiveReports } from '@/features/operations';
export const metadata: Metadata = { title: 'الرئيسية' };
export default function DashboardPage() {
  return <LiveReports dashboard />;
}
