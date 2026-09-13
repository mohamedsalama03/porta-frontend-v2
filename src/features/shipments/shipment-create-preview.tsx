'use client';

import Link from 'next/link';
import { ArrowLeft, Info, LockKeyhole } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { shipmentPreviewDraftSchema, type ShipmentPreviewDraft } from './draft-schema';
import { ShipmentPreviewNotice } from './presentation';
import './shipments.css';

export function ShipmentCreatePreview() {
  const {
    register,
    formState: { errors },
  } = useForm<ShipmentPreviewDraft>({
    resolver: zodResolver(shipmentPreviewDraftSchema),
    mode: 'onBlur',
    defaultValues: {
      senderName: '',
      senderPhone: '',
      recipientName: '',
      recipientPhone: '',
      recipientAddress: '',
      notes: '',
    },
  });

  function field(
    name: keyof ShipmentPreviewDraft,
    label: string,
    options: { type?: string; placeholder?: string; wide?: boolean } = {},
  ) {
    return (
      <label className={`shipment-form-field${options.wide ? ' shipment-form-wide' : ''}`}>
        <span>{label}</span>
        <input
          {...register(name)}
          className="field"
          type={options.type ?? 'text'}
          placeholder={options.placeholder}
          aria-invalid={!!errors[name]}
          aria-describedby={errors[name] ? `draft-error-${name}` : undefined}
          autoComplete="off"
        />
        {errors[name] && (
          <small id={`draft-error-${name}`} role="alert" className="shipment-field-error">
            {errors[name]?.message}
          </small>
        )}
      </label>
    );
  }
  function unavailable(label: string) {
    return (
      <label className="shipment-form-field">
        <span>{label}</span>
        <select className="field" disabled>
          <option>بانتظار القيم المعتمدة من الخدمة</option>
        </select>
      </label>
    );
  }
  return (
    <div className="shipment-create-preview">
      <Link className="shipment-back-link" href="/preview/shipments">
        <ArrowLeft size={15} aria-hidden="true" />
        العودة إلى الشحنات
      </Link>
      <div className="shipment-page-title">
        <div>
          <h1>إنشاء شحنة</h1>
          <p>معاينة نموذج الإدخال. لا تُرسل البيانات ولا تُحفظ.</p>
        </div>
        <span className="shipment-draft-label">
          <LockKeyhole size={14} aria-hidden="true" />
          معاينة فقط
        </span>
      </div>
      <ShipmentPreviewNotice />
      <form
        className="shipment-create-layout"
        onSubmit={(event) => event.preventDefault()}
        noValidate
        aria-label="معاينة نموذج إنشاء شحنة"
      >
        <div className="shipment-form-sections">
          <section className="surface shipment-form-section">
            <h2>المرسل</h2>
            <div className="shipment-form-grid">
              {field('senderName', 'اسم المرسل', { placeholder: 'الاسم الكامل' })}
              {field('senderPhone', 'هاتف المرسل', { type: 'tel', placeholder: '09X XXX XXXX' })}
            </div>
          </section>
          <section className="surface shipment-form-section">
            <h2>المستلم</h2>
            <div className="shipment-form-grid">
              {field('recipientName', 'اسم المستلم', { placeholder: 'الاسم الكامل' })}
              {field('recipientPhone', 'هاتف المستلم', {
                type: 'tel',
                placeholder: '09X XXX XXXX',
              })}
              {field('recipientAddress', 'عنوان المستلم', {
                placeholder: 'المنطقة، الشارع، أقرب نقطة دالة',
                wide: true,
              })}
            </div>
          </section>
          <section className="surface shipment-form-section">
            <h2>مسار الشحنة</h2>
            <div className="shipment-form-grid">
              {unavailable('مدينة الانطلاق')}
              {unavailable('مدينة الوصول')}
            </div>
          </section>
          <section className="surface shipment-form-section">
            <h2>بيانات الشحنة</h2>
            <div className="shipment-form-grid">
              {unavailable('نوع الشحنة')}
              {unavailable('الحجم')}
              {unavailable('طريقة التسليم')}
              {unavailable('طريقة الدفع')}
            </div>
          </section>
          <section className="surface shipment-form-section">
            <h2>ملاحظات</h2>
            <label className="shipment-form-field">
              <span className="shipment-sr-only">ملاحظات الشحنة</span>
              <textarea
                {...register('notes')}
                className="field"
                rows={4}
                placeholder="أي تفاصيل تساعد فريق التوصيل…"
              />
            </label>
          </section>
        </div>
        <aside className="shipment-quote-column">
          <section className="surface shipment-quote-panel">
            <h2>ملخص السعر</h2>
            <p>يُعرض عرض السعر المعتمد بعد ربط الخدمة واختيار تفاصيل الشحنة.</p>
            <dl>
              <div>
                <dt>السعر الأساسي</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>رسوم التوصيل</dt>
                <dd>—</dd>
              </div>
              <div className="shipment-quote-total">
                <dt>الإجمالي</dt>
                <dd>—</dd>
              </div>
            </dl>
            <p className="shipment-quote-notice">
              <Info size={15} aria-hidden="true" />
              <span>لم يُحسب أو يُطلب أي سعر.</span>
            </p>
            <button
              className="button button-primary"
              type="submit"
              disabled
              aria-describedby="shipment-create-blocked"
            >
              إنشاء الشحنة
            </button>
            <p id="shipment-create-blocked">
              الإنشاء متوقف حتى اعتماد حقول الطلب والخيارات والتسعير والصلاحيات من الخدمة.
            </p>
          </section>
          <p className="shipment-draft-note">
            يمكن تجربة إدخال النصوص هنا فقط. متطلبات التحقق النهائية يحددها عقد الخدمة، والبيانات لا
            تغادر هذه الصفحة.
          </p>
        </aside>
      </form>
    </div>
  );
}
