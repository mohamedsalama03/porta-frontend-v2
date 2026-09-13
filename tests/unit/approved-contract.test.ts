import { describe, expect, it } from 'vitest';
import {
  approvedOperations,
  shipmentInputSchema,
  attachShipmentsInputSchema,
  moneySchema,
  getAdminShipmentsQuerySchema,
  getCitiesResponseSchema,
  userInputSchema,
} from '@/lib/api/generated';

const cityId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const shipment = {
  sender_name: 'Test sender',
  sender_phone: '0912345678',
  recipient_name: 'Test recipient',
  recipient_phone: '0923456789',
  origin_city_id: cityId,
  destination_city_id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  shipment_type_id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
  shipment_size: 'SMALL',
  delivery_method: 'DOOR_DELIVERY',
};

describe('generated approved contract boundaries', () => {
  it('requires a delivery address only when the contract conditional applies', () => {
    expect(shipmentInputSchema.safeParse(shipment).success).toBe(false);
    expect(
      shipmentInputSchema.safeParse({ ...shipment, delivery_address: 'Test address' }).success,
    ).toBe(true);
    expect(
      shipmentInputSchema.safeParse({ ...shipment, delivery_method: 'OFFICE_PICKUP' }).success,
    ).toBe(true);
    expect(
      shipmentInputSchema.safeParse({ ...shipment, delivery_address: '', final_price: 100 })
        .success,
    ).toBe(false);
  });

  it('rejects fractional/unsafe money and duplicate bulk assignment identifiers', () => {
    expect(moneySchema.safeParse(25_000).success).toBe(true);
    for (const value of [25.1, -1, 2_000_000_001, Number.MAX_SAFE_INTEGER + 1])
      expect(moneySchema.safeParse(value).success).toBe(false);
    expect(attachShipmentsInputSchema.safeParse({ shipment_ids: [cityId, cityId] }).success).toBe(
      false,
    );
  });

  it('preserves the approved cursor contract and rejects unsupported sort/filter keys', () => {
    expect(
      getAdminShipmentsQuerySchema.safeParse({
        cursor: 'opaque',
        sort: '-created_at',
        per_page: 25,
      }).success,
    ).toBe(true);
    expect(getAdminShipmentsQuerySchema.safeParse({ page: 2 }).success).toBe(false);
    expect(getAdminShipmentsQuerySchema.safeParse({ sort: 'final_price' }).success).toBe(false);
    expect(getAdminShipmentsQuerySchema.safeParse({ per_page: 101 }).success).toBe(false);
  });

  it('accepts empty real catalog envelopes but rejects missing support metadata', () => {
    const envelope = { data: [], meta: {}, request_id: '77d15473-e2e1-4171-a200-a9c4647021d3' };
    expect(getCitiesResponseSchema.safeParse(envelope).success).toBe(true);
    expect(getCitiesResponseSchema.safeParse({ data: [] }).success).toBe(false);
  });

  it('requires a branch identifier for a branch operator without assigning permissions from roles', () => {
    const input = {
      name: 'Test operator',
      email: 'operator@example.test',
      password: 'Test-Password-123',
      role: 'BRANCH_OPERATOR',
    };
    expect(userInputSchema.safeParse(input).success).toBe(false);
    expect(userInputSchema.safeParse({ ...input, branch_id: cityId }).success).toBe(true);
    expect(approvedOperations.postAdminShipments.idempotent).toBe(true);
    expect(approvedOperations.getAdminUsers.permission).toBe('users.manage');
    expect(approvedOperations.getAdminReports.path).toBe('/api/v1/admin/reports');
  });
});
