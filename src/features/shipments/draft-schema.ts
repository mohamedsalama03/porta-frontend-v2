import { z } from 'zod';

/** Local form ergonomics only. It is not a create-shipment payload or business validation. */
export const shipmentPreviewDraftSchema = z.object({
  senderName: z.string().trim().min(1, 'أدخل اسمًا لتجربة هذا الحقل.'),
  senderPhone: z.string().trim(),
  recipientName: z.string().trim().min(1, 'أدخل اسمًا لتجربة هذا الحقل.'),
  recipientPhone: z.string().trim(),
  recipientAddress: z.string().trim(),
  notes: z.string().trim(),
});

export type ShipmentPreviewDraft = z.infer<typeof shipmentPreviewDraftSchema>;
