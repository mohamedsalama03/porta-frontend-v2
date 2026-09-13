import { api } from '@/lib/api/client';
import {
  getAdminAuditLogsResponseSchema,
  getAdminBranchesResponseSchema,
  getAdminCitiesResponseSchema,
  getAdminDriversResponseSchema,
  getAdminPricingRulesResponseSchema,
  getAdminShipmentTypesResponseSchema,
  getAdminTripsResponseSchema,
  getAdminUsersResponseSchema,
  getCitiesResponseSchema,
  getShipmentTypesResponseSchema,
  type CursorMeta,
  type PageMeta,
} from '@/lib/api/generated';
import {
  mapAuditRow,
  mapBranchRow,
  mapCityRow,
  mapDriverRow,
  mapPricingRow,
  mapTripRow,
  mapTypeRow,
  mapUserRow,
  operationDefinitions,
  queryString,
  type CatalogNames,
  type DisplayRow,
  type OperationQuery,
  type OperationsModule,
} from './model';

export type OperationsResult = { rows: DisplayRow[]; meta: CursorMeta | PageMeta };

export async function readCatalogNames(signal: AbortSignal): Promise<CatalogNames> {
  const [cities, types] = await Promise.all([
    api.request('/api/v1/cities', { schema: getCitiesResponseSchema, signal }),
    api.request('/api/v1/shipment-types', { schema: getShipmentTypesResponseSchema, signal }),
  ]);
  return {
    cities: new Map(cities.data.map((item) => [item.id, item.name_ar])),
    types: new Map(types.data.map((item) => [item.id, item.name_ar])),
  };
}

export async function readOperations(
  module: OperationsModule,
  query: OperationQuery,
  signal: AbortSignal,
  names: CatalogNames,
): Promise<OperationsResult> {
  const suffix = queryString(operationDefinitions[module].query.parse(query));
  switch (module) {
    case 'cities': {
      const response = await api.request(`/api/v1/admin/cities${suffix}`, {
        schema: getAdminCitiesResponseSchema,
        signal,
      });
      return { rows: response.data.map(mapCityRow), meta: response.meta };
    }
    case 'branches': {
      const response = await api.request(`/api/v1/admin/branches${suffix}`, {
        schema: getAdminBranchesResponseSchema,
        signal,
      });
      return { rows: response.data.map((item) => mapBranchRow(item, names)), meta: response.meta };
    }
    case 'shipment-types': {
      const response = await api.request(`/api/v1/admin/shipment-types${suffix}`, {
        schema: getAdminShipmentTypesResponseSchema,
        signal,
      });
      return { rows: response.data.map(mapTypeRow), meta: response.meta };
    }
    case 'pricing': {
      const response = await api.request(`/api/v1/admin/pricing-rules${suffix}`, {
        schema: getAdminPricingRulesResponseSchema,
        signal,
      });
      return { rows: response.data.map((item) => mapPricingRow(item, names)), meta: response.meta };
    }
    case 'drivers': {
      const response = await api.request(`/api/v1/admin/drivers${suffix}`, {
        schema: getAdminDriversResponseSchema,
        signal,
      });
      return { rows: response.data.map(mapDriverRow), meta: response.meta };
    }
    case 'trips': {
      const response = await api.request(`/api/v1/admin/trips${suffix}`, {
        schema: getAdminTripsResponseSchema,
        signal,
      });
      return { rows: response.data.map((item) => mapTripRow(item, names)), meta: response.meta };
    }
    case 'users': {
      const response = await api.request(`/api/v1/admin/users${suffix}`, {
        schema: getAdminUsersResponseSchema,
        signal,
      });
      return { rows: response.data.map(mapUserRow), meta: response.meta };
    }
    case 'audit': {
      const response = await api.request(`/api/v1/admin/audit-logs${suffix}`, {
        schema: getAdminAuditLogsResponseSchema,
        signal,
      });
      return { rows: response.data.map(mapAuditRow), meta: response.meta };
    }
  }
}
