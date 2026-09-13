/** Presentation values only. This is intentionally not an API response schema. */
export type ShipmentTone = 'neutral' | 'info' | 'warning' | 'success';

export interface ShipmentLabel {
  label: string;
  tone: ShipmentTone;
}

export interface ShipmentViewModel {
  id: string;
  href?: string;
  tracking: string;
  sender: string;
  recipient: string;
  origin: string;
  destination: string;
  type: string;
  size: string;
  status: ShipmentLabel;
  payment: ShipmentLabel;
  driver: string;
  trip: string;
  price: string;
  createdLabel: string;
  /** ISO calendar date for isolated preview filtering, not API serialization. */
  createdDate: string;
}

export interface ShipmentDetailViewModel extends ShipmentViewModel {
  senderPhone: string;
  recipientPhone: string;
  recipientAddress: string;
  originBranch: string;
  destinationBranch: string;
  deliveryMethod: string;
  notes: string;
  timeline: Array<{ id: string; label: string; timestamp: string; note?: string }>;
}
