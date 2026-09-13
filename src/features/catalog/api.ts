import { api, type ApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { createIdempotentAction } from '@/lib/api/idempotency';
import {
  getCitiesResponseSchema,
  getShipmentTypesResponseSchema,
  ulidSchema,
} from '@/lib/api/generated';
import { can, type PermissionSubject } from '@/lib/permissions';
import { catalogDefinitions, type CatalogModule } from './model';

export async function readCatalogOptions(kind: 'city' | 'shipment-type', signal: AbortSignal) {
  const response =
    kind === 'city'
      ? await api.request('/api/v1/cities', { schema: getCitiesResponseSchema, signal })
      : await api.request('/api/v1/shipment-types', {
          schema: getShipmentTypesResponseSchema,
          signal,
        });
  return response.data.map((item) => ({ value: item.id, label: item.name_ar }));
}

export function createCatalogAction({
  module,
  id,
  payload,
  subject,
  client = api,
}: {
  module: CatalogModule;
  id?: string;
  payload: Record<string, unknown>;
  subject: PermissionSubject | null;
  client?: ApiClient;
}) {
  const definition = catalogDefinitions[module];
  const target = id === undefined ? definition.create : definition.edit;
  if (!can(subject, target.operation.permission)) throw new ApiError({ status: 403 });
  if (id !== undefined && !ulidSchema.safeParse(id).success)
    throw new ApiError({ code: 'invalid_request' });
  const parsed = target.body.safeParse(payload);
  if (!parsed.success || !Object.keys(parsed.data).length)
    throw new ApiError({ code: 'invalid_request' });
  const body = Object.freeze(structuredClone(parsed.data));
  const path =
    id === undefined ? target.operation.path : target.operation.path.replace(/\{[^}]+\}/, id);
  return createIdempotentAction((key) =>
    client.request(path, {
      method: target.operation.method,
      body,
      bodySchema: target.body,
      schema: target.response,
      idempotencyKey: key,
    }),
  );
}
