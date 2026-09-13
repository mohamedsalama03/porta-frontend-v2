import Link from 'next/link';
import { ArrowRight, Cable } from 'lucide-react';

export function IntegrationPending({
  title,
  description,
  homeHref = '/dashboard',
}: {
  title: string;
  description?: string;
  homeHref?: string;
}) {
  return (
    <section className="surface empty-panel">
      <div className="empty-symbol">
        <Cable aria-hidden="true" />
      </div>
      <h2>{title}</h2>
      <p>
        {description ||
          'هذه الخدمة لم تُربط بعد. ستتوفر البيانات والإجراءات بعد اكتمال الاتصال بالخدمة المعتمدة.'}
      </p>
      <Link className="button button-secondary" href={homeHref}>
        <ArrowRight aria-hidden="true" />
        العودة إلى الرئيسية
      </Link>
    </section>
  );
}
