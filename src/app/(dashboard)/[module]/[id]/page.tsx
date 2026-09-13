import { notFound } from 'next/navigation';
import { ShipmentCreateLive, ShipmentDetailLive } from '@/features/shipments/live';
import { OperationDetail, OperationsCreatePage } from '@/features/operations';
import { IntegrationPending } from '@/components/feedback/integration-pending';
import { isShellModule } from '@/features/modules/catalog';
export default async function DetailPage({
  params,
}: {
  params: Promise<{ module: string; id: string }>;
}) {
  const { module, id } = await params;
  if (module === 'shipments')
    return id === 'new' ? <ShipmentCreateLive /> : <ShipmentDetailLive id={id} />;
  if (module === 'trips' || module === 'drivers')
    return id === 'new' ? (
      <OperationsCreatePage module={module} />
    ) : (
      <OperationDetail module={module} id={id} />
    );
  if (!isShellModule(module)) notFound();
  return (
    <IntegrationPending
      title="تفاصيل السجل بانتظار الاتصال"
      description="تحتاج هذه الصفحة إلى بيانات معتمدة من الخدمة. أعد فتحها بعد اكتمال الربط."
      homeHref={`/${module}`}
    />
  );
}
