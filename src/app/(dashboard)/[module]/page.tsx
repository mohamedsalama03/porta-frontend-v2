import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { isShellModule, moduleShells } from '@/features/modules/catalog';
import { PreferencesSettings } from '@/features/settings';
import { ShipmentListLive } from '@/features/shipments/live';
import { OperationsList, LiveReports, PaymentLedger } from '@/features/operations';
type Props = { params: Promise<{ module: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { module } = await params;
  return {
    title:
      module === 'settings'
        ? 'الإعدادات'
        : isShellModule(module)
          ? moduleShells[module].title
          : 'الصفحة غير متاحة',
  };
}
export default async function ModulePage({ params }: Props) {
  const { module } = await params;
  if (module === 'settings') return <PreferencesSettings />;
  if (!isShellModule(module)) notFound();
  if (module === 'shipments') return <ShipmentListLive />;
  if (module === 'reports') return <LiveReports />;
  if (module === 'payments') return <PaymentLedger />;
  return <OperationsList module={module} />;
}
