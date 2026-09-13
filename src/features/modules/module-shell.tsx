import { Cable, Plus } from 'lucide-react';
import { moduleShells, type ShellModule } from './catalog';
import './modules.css';

export function ModuleShell({ module }: { module: ShellModule }) {
  const definition = moduleShells[module];
  return (
    <div className="module-shell">
      <div className="page-heading">
        <div>
          <h1>{definition.title}</h1>
          <p>{definition.description}</p>
        </div>
        {definition.action && (
          <button className="button button-primary" disabled aria-describedby="module-connection">
            <Plus aria-hidden="true" />
            {definition.action}
          </button>
        )}
      </div>
      <div className="inline-notice module-notice" id="module-connection">
        <Cable aria-hidden="true" />
        <p>
          <strong>هذا القسم بانتظار ربط الخدمة.</strong> ستتاح البيانات والإجراءات بعد اعتماد
          الاتصال. لا توجد سجلات فعلية معروضة.
        </p>
      </div>
      <section className="surface module-table">
        <div className="module-table-heading">
          <h2>{definition.title}</h2>
          <span className="badge">غير متصل</span>
        </div>
        <div className="module-table-scroll">
          <table>
            <caption className="sr-only">{definition.title} — الاتصال بالخدمة غير متاح بعد</caption>
            <thead>
              <tr>
                {definition.columns.map((column) => (
                  <th scope="col" key={column}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={definition.columns.length}>
                  <div className="empty-panel module-empty">
                    <div className="empty-symbol">
                      <Cable aria-hidden="true" />
                    </div>
                    <h3>كل التفاصيل تبدأ باتصال</h3>
                    <p>
                      سيظهر سجل {definition.title} هنا بعد اكتمال الربط، مع الأدوات المتاحة حسب
                      صلاحياتك.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="module-table-footer">
          <span>لا تتوفر بيانات للعرض</span>
          <span>تُحمّل السجلات على صفحات من الخدمة</span>
        </div>
      </section>
      {(module === 'pricing' || module === 'payments') && (
        <p className="module-footnote">
          تُعرض المبالغ المعتمدة بالدينار الليبي. تتطلب العمليات المالية تأكيداً واستجابة ناجحة من
          الخدمة.
        </p>
      )}
    </div>
  );
}
