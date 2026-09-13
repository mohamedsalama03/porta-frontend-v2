import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { config } from '@/lib/config';
import { DashboardOverview } from '@/features/dashboard/overview';
export const metadata: Metadata = { title: 'معاينة الرئيسية' };
export default function PreviewHome() {
  if (!config.previewEnabled) notFound();
  return <DashboardOverview preview />;
}
