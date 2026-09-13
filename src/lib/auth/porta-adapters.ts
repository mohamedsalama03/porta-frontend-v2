import {
  loginInputSchema,
  postAuthLoginResponseSchema,
  postAuthLogoutResponseSchema,
} from '@/lib/api/generated';
import {
  sessionResponseSchema,
  type ApprovedSessionContract,
  type ApprovedLoginContract,
  type ApprovedLogoutContract,
} from './contracts';

/** Approved operations from contracts/porta-api-v1.openapi.json. */
export const portaSessionContract: ApprovedSessionContract = {
  path: '/api/v1/auth/me',
  responseSchema: sessionResponseSchema,
};

export const portaLoginContract: ApprovedLoginContract = {
  method: 'POST',
  serialize: ({ email, password }) => ({ email, password }),
  bodySchema: loginInputSchema,
  responseSchema: postAuthLoginResponseSchema,
};

export const portaLogoutContract: ApprovedLogoutContract = {
  method: 'POST',
  responseSchema: postAuthLogoutResponseSchema,
};
