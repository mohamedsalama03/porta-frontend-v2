import type { Metadata } from 'next';
import { PublicOrderForm } from '@/features/public-order/form';

export const metadata: Metadata = {
  title: 'طلب شحن',
  description: 'أدخل بيانات شحنتك بين المدن الليبية، وراجع السعر قبل إرسال الطلب.',
  robots: { index: false, follow: false, noarchive: true },
};

export default function OrderPage() {
  return (
    <main id="main-content" className="public-order-main" tabIndex={-1}>
      <div className="public-order-intro">
        <h1>طلب شحن</h1>
        <p>أدخل بيانات الشحنة، وراجع السعر قبل إرسال الطلب.</p>
      </div>
      <PublicOrderForm />
    </main>
  );
}
