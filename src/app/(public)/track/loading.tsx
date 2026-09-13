import { TrackingSkeleton } from '@/features/public-tracking/skeleton';
import '@/features/public-tracking/public-tracking.css';

export default function TrackingLoading() {
  return (
    <main id="main-content" className="public-order-main tracking-main" tabIndex={-1}>
      <TrackingSkeleton />
    </main>
  );
}
