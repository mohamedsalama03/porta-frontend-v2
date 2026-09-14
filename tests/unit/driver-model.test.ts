import { describe, expect, it } from 'vitest';
import {
  driverKeys,
  driverQueryString,
  parseDriverShipmentsQuery,
  parseDriverTripsQuery,
  safeTelHref,
} from '@/features/driver-workspace/model';
import {
  driverDeliveryMethodLabels,
  driverShipmentSizeLabels,
  driverShipmentStatusLabels,
  driverStatusTarget,
  driverTripStatusLabels,
} from '@/features/driver-workspace/status';
import {
  deliveryMethodSchema,
  shipmentSizeSchema,
  shipmentStatusSchema,
  tripStatusSchema,
} from '@/lib/api/generated';
import {
  deliveryMethodLabels,
  shipmentSizeLabels,
  shipmentStatusLabels,
} from '@/features/shipments/mappers';
import { tripStatusLabels } from '@/features/operations/model';

const tripId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

describe('driver query boundaries', () => {
  it('defaults to a bounded page and accepts only documented filters', () => {
    expect(parseDriverTripsQuery(new URLSearchParams())).toEqual({
      success: true,
      data: { per_page: 20 },
    });
    expect(
      parseDriverTripsQuery(
        new URLSearchParams('status=DEPARTED&per_page=100&cursor=page%2F%2Btwo'),
      ),
    ).toEqual({
      success: true,
      data: { status: 'DEPARTED', per_page: 100, cursor: 'page/+two' },
    });
    expect(
      parseDriverShipmentsQuery(new URLSearchParams(`status=ARRIVED_CITY&trip_id=${tripId}`)),
    ).toEqual({
      success: true,
      data: { status: 'ARRIVED_CITY', trip_id: tripId, per_page: 20 },
    });
  });

  it.each([
    'status=ARRIVED&status=ARRIVED',
    'cursor=first&cursor=second',
    'per_page=20&per_page=20',
    'per_page=0',
    'per_page=101',
    'per_page=1.5',
    'per_page=0x14',
    'per_page=1e1',
    'per_page=',
    'per_page=%2020',
    'driver_id=other-driver',
    'date=2026-09-14',
    'sort=departure_at',
    'recipient_phone=0911234567',
    '__proto__=unsafe',
    `cursor=${'a'.repeat(1001)}`,
  ])('rejects malformed, duplicate or unsupported query %s', (query) => {
    expect(parseDriverTripsQuery(new URLSearchParams(query)).success).toBe(false);
    expect(parseDriverShipmentsQuery(new URLSearchParams(query)).success).toBe(false);
  });

  it('does not accept cross-resource status vocabulary or malformed trip identifiers', () => {
    expect(parseDriverTripsQuery(new URLSearchParams('status=DELIVERED')).success).toBe(false);
    expect(parseDriverShipmentsQuery(new URLSearchParams('status=DEPARTED')).success).toBe(false);
    expect(parseDriverTripsQuery(new URLSearchParams(`trip_id=${tripId}`)).success).toBe(false);
    expect(parseDriverShipmentsQuery(new URLSearchParams('trip_id=../admin')).success).toBe(false);
  });

  it('encodes opaque cursors without reinterpreting embedded URL fields or changing filter state', () => {
    const query = {
      trip_id: tripId,
      status: 'DELIVERED' as const,
      cursor: 'next/+?&status=RECEIVED#fragment',
      per_page: 20,
    };
    const encoded = driverQueryString(query);
    expect(parseDriverShipmentsQuery(new URLSearchParams(encoded))).toEqual({
      success: true,
      data: query,
    });
    expect([...new URLSearchParams(encoded).keys()]).toEqual([
      'cursor',
      'per_page',
      'status',
      'trip_id',
    ]);
  });

  it('isolates private driver keys and shares default read keys with the access probe', () => {
    expect(driverKeys.trips()).toEqual(driverKeys.trips({ per_page: 20 }));
    expect(driverKeys.shipments()).toEqual(driverKeys.shipments({ per_page: 20 }));
    const keys = [
      driverKeys.context(),
      driverKeys.me(),
      driverKeys.trips(),
      driverKeys.trip(tripId),
      driverKeys.shipments(),
      driverKeys.shipment(tripId),
    ];
    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(keys.length);
    for (const key of keys) expect(key[0]).toBe('driver-workspace');
    expect(driverKeys.shipments({ trip_id: tripId })).not.toEqual(driverKeys.shipments());
    expect(driverKeys.trips({ cursor: 'page-2' })).not.toEqual(driverKeys.trips());
  });
});

describe('driver presentation and documented action availability', () => {
  it('covers every enum and preserves the established operational vocabulary', () => {
    for (const status of shipmentStatusSchema.options) {
      expect(driverShipmentStatusLabels[status]).toBe(shipmentStatusLabels[status].label);
    }
    for (const status of tripStatusSchema.options) {
      expect(driverTripStatusLabels[status]).toBe(tripStatusLabels[status]);
    }
    for (const method of deliveryMethodSchema.options) {
      expect(driverDeliveryMethodLabels[method]).toBe(deliveryMethodLabels[method]);
    }
    for (const size of shipmentSizeSchema.options) {
      expect(driverShipmentSizeLabels[size]).toBe(shipmentSizeLabels[size]);
    }
  });

  it('exposes precisely the two approved edges only with the backend mutation permission', () => {
    for (const status of shipmentStatusSchema.options) {
      expect(driverStatusTarget(status, false)).toBeNull();
      expect(driverStatusTarget(status, true)).toBe(
        status === 'ARRIVED_CITY'
          ? 'READY_FOR_PICKUP'
          : status === 'READY_FOR_PICKUP'
            ? 'DELIVERED'
            : null,
      );
    }
  });

  it.each([
    ['+218911234567', 'tel:+218911234567'],
    ['091 123-4567', 'tel:0911234567'],
    ['٠٩١١٢٣٤٥٦٧', 'tel:0911234567'],
    ['۰۹۱۱۲۳۴۵۶۷', 'tel:0911234567'],
    ['+218 (91) 123-4567', 'tel:+218911234567'],
  ])('permits a plain documented phone representation %s', (phone, href) => {
    expect(safeTelHref(phone)).toBe(href);
  });

  it.each([
    '',
    '123',
    '*123#',
    'tel:+218911234567',
    'javascript:alert(1)',
    '+218911234567;ext=123',
    '+218911234567?body=private',
    '+218911234567\n',
    '+218911234567%0a',
    '+218911234567,123',
    '++218911234567',
    '1'.repeat(41),
  ])('leaves unsafe contact text without a dial action %s', (phone) => {
    expect(safeTelHref(phone)).toBeNull();
  });
});
