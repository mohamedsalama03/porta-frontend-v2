import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { config } from '@/lib/config';
import { isShellModule, moduleShells } from '@/features/modules/catalog';
import { ModuleShell } from '@/features/modules/module-shell';
import { PreferencesSettings } from '@/features/settings';
import { PageSkeleton } from '@/components/feedback/page-skeleton';
import {
  ShipmentListPreview,
  ShipmentDetailPreview,
  ShipmentCreatePreview,
} from '@/features/shipments/preview';
type Props = { params: Promise<{ segments: string[] }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const {
    segments: [module],
  } = await params;
  return {
    title:
      module === 'settings'
        ? 'معاينة الإعدادات'
        : isShellModule(module)
          ? `معاينة ${moduleShells[module].title}`
          : 'الصفحة غير متاحة',
  };
}
export default async function PreviewModule({ params }: Props) {
  if (!config.previewEnabled) notFound();
  const { segments } = await params;
  const [module, id] = segments;
  if (segments.length > 2) notFound();
  if (module === 'shipments') {
    if (id === 'new') return <ShipmentCreatePreview />;
    if (id) return <ShipmentDetailPreview id={id} />;
    return (
      <Suspense fallback={<PageSkeleton />}>
        <ShipmentListPreview />
      </Suspense>
    );
  }
  if (id) notFound();
  if (module === 'settings') return <PreferencesSettings />;
  if (!isShellModule(module)) notFound();
  return <ModuleShell module={module} />;
}
