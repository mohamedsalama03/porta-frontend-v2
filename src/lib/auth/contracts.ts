import { z } from 'zod';
import { getAuthMeResponseSchema, loginInputSchema, meSchema, type Me } from '@/lib/api/generated';

export type SessionUser = Pick<Me, 'name' | 'email' | 'role' | 'permissions'>;

/** Project display identity, validated role and exact permissions; omit private identifiers. */
function projectSessionUser(user: Me): SessionUser {
  return { name: user.name, email: user.email, role: user.role, permissions: user.permissions };
}

export const sessionUserSchema = meSchema.transform(projectSessionUser);
export const sessionResponseSchema = getAuthMeResponseSchema.transform((response) => ({
  ...response,
  data: projectSessionUser(response.data),
}));
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

/** Validate the approved wire response and optionally transform it to the UI projection. */
export interface ApprovedSessionContract {
  path: string;
  responseSchema: z.ZodType<SessionResponse>;
}

/** Contract-derived limits; requiring entered text is an additional local UX check. */
export const loginCredentialsSchema = loginInputSchema.refine(
  (value) => value.password.length > 0,
  {
    error: 'أدخل كلمة المرور.',
    path: ['password'],
  },
);
export type LoginCredentials = z.infer<typeof loginCredentialsSchema>;

/** Supply only after approving the endpoint's request and response contract. */
export interface ApprovedLoginContract {
  method: 'POST';
  serialize: (credentials: LoginCredentials) => unknown;
  bodySchema: z.ZodType<unknown>;
  responseSchema: z.ZodType<unknown>;
}

export interface ApprovedLogoutContract {
  method: 'POST' | 'DELETE';
  responseSchema: z.ZodType<unknown>;
  serialize?: () => unknown;
  bodySchema?: z.ZodType<unknown>;
}
