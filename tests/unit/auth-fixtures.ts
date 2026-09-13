import type { Me } from '@/lib/api/generated';

/** Synthetic contract-valid identities for injected unit tests only. Never sent to the API. */
export const testSessionUser: Me = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  name: 'موظف العمليات',
  email: 'operator@example.test',
  role: 'BRANCH_OPERATOR',
  branch_id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  permissions: ['shipments.view'],
};

export const testSessionResponse = {
  data: testSessionUser,
  meta: {},
  request_id: '123e4567-e89b-42d3-a456-426614174000',
};

export const testLogoutResponse = {
  data: { logged_out: true },
  meta: {},
  request_id: '123e4567-e89b-42d3-a456-426614174001',
};
