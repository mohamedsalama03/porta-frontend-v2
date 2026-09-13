'use client';

import { useQuery } from '@tanstack/react-query';
import { getShipmentCities, getShipmentTypes } from './api';

export function useShipmentCatalogs(enabled = true) {
  const cities = useQuery({
    queryKey: ['catalog', 'active-cities'],
    queryFn: ({ signal }) => getShipmentCities(signal),
    enabled,
    staleTime: 5 * 60_000,
  });
  const types = useQuery({
    queryKey: ['catalog', 'active-shipment-types'],
    queryFn: ({ signal }) => getShipmentTypes(signal),
    enabled,
    staleTime: 5 * 60_000,
  });
  return { cities, types };
}
