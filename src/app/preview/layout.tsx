import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { config } from '@/lib/config';
import { ApplicationShell } from '@/components/layout';
import { PageSkeleton } from '@/components/feedback/page-skeleton';
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  if (!config.previewEnabled) notFound();
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ApplicationShell mode="preview" user={null}>
        {children}
      </ApplicationShell>
    </Suspense>
  );
}
