import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PublicTrackingForm } from '@/features/public-tracking/tracking-form';
import { TrackingSkeleton } from '@/features/public-tracking/skeleton';
import '@/features/public-tracking/public-tracking.css';

export const metadata: Metadata = {
  title: 'تتبع الشحنة',
  description: 'أدخل رقم التتبع لمعرفة حالة شحنتك وسجل تقدمها.',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};

export default function TrackingPage() {
  return (
    <main id="main-content" className="public-order-main tracking-main" tabIndex={-1}>
      <div className="public-order-intro">
        <h1>تتبع الشحنة</h1>
        <p>اطّلع على حالة شحنتك ومراحل وصولها.</p>
      </div>
      <Suspense fallback={<TrackingSkeleton />}>
        <PublicTrackingForm />
      </Suspense>
    </main>
  );
}
