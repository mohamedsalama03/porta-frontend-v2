import { api, type ApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import {
  approvedOperations,
  getAdminBranchesQuerySchema,
  getAdminBranchesResponseSchema,
  getAdminDriversQuerySchema,
  getAdminDriversResponseSchema,
  getAdminUsersQuerySchema,
  getAdminUsersResponseSchema,
} from '@/lib/api/generated';
import { can, type PermissionSubject } from '@/lib/permissions';

export type ReferenceKind = 'branch' | 'driver' | 'user';
export type ReferencePosition = { page?: number; cursor?: string };
export type ReferenceOption = { value: string; label: string };
export type ReferencePage = {
  options: ReferenceOption[];
  next: ReferencePosition | null;
  previous: ReferencePosition | null;
  pageLabel: string;
};

export const referenceDefinitions = {
  branch: { operation: approvedOperations.getAdminBranches, label: 'الفروع' },
  driver: { operation: approvedOperations.getAdminDrivers, label: 'السائقين' },
  user: { operation: approvedOperations.getAdminUsers, label: 'المستخدمين' },
} as const;

function parameters(values: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined) params.set(key, String(value));
  return `?${params.toString()}`;
}

/** Fetches exactly one approved server page; never aggregates the directory. */
export async function readReferencePage({
  kind,
  position,
  subject,
  signal,
  client = api,
}: {
  kind: ReferenceKind;
  position: ReferencePosition;
  subject: PermissionSubject | null;
  signal?: AbortSignal;
  client?: ApiClient;
}): Promise<ReferencePage> {
  const definition = referenceDefinitions[kind];
  if (!can(subject, definition.operation.permission)) throw new ApiError({ status: 403 });
  if (kind === 'branch') {
    const parsed = getAdminBranchesQuerySchema.safeParse({
      ...position,
      page: position.page ?? 1,
      per_page: 20,
    });
    if (!parsed.success) throw new ApiError({ code: 'invalid_request' });
    const response = await client.request(
      `${definition.operation.path}${parameters(parsed.data)}`,
      { schema: getAdminBranchesResponseSchema, signal },
    );
    return {
      options: response.data.map((branch) => ({ value: branch.id, label: branch.name })),
      next: response.meta.page < response.meta.last_page ? { page: response.meta.page + 1 } : null,
      previous: response.meta.page > 1 ? { page: response.meta.page - 1 } : null,
      pageLabel: `صفحة ${response.meta.page} من ${response.meta.last_page}`,
    };
  }
  if (kind === 'driver') {
    const parsed = getAdminDriversQuerySchema.safeParse({ ...position, per_page: 20 });
    if (!parsed.success) throw new ApiError({ code: 'invalid_request' });
    const response = await client.request(
      `${definition.operation.path}${parameters(parsed.data)}`,
      { schema: getAdminDriversResponseSchema, signal },
    );
    return {
      options: response.data.map((driver) => ({
        value: driver.id,
        label: `${driver.full_name} — ${driver.phone}`,
      })),
      next: response.meta.next_cursor ? { cursor: response.meta.next_cursor } : null,
      previous: response.meta.previous_cursor ? { cursor: response.meta.previous_cursor } : null,
      pageLabel: `${response.data.length} خيار في هذه الصفحة`,
    };
  }
  const parsed = getAdminUsersQuerySchema.safeParse({ ...position, per_page: 20 });
  if (!parsed.success) throw new ApiError({ code: 'invalid_request' });
  const response = await client.request(`${definition.operation.path}${parameters(parsed.data)}`, {
    schema: getAdminUsersResponseSchema,
    signal,
  });
  return {
    options: response.data.map((user) => ({
      value: user.id,
      label: `${user.name} — ${user.email}`,
    })),
    next: response.meta.next_cursor ? { cursor: response.meta.next_cursor } : null,
    previous: response.meta.previous_cursor ? { cursor: response.meta.previous_cursor } : null,
    pageLabel: `${response.data.length} خيار في هذه الصفحة`,
  };
}
