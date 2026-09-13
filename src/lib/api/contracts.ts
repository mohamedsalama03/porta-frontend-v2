import { z } from 'zod';

/** Structural helper only: each feature still needs its approved payload schema. */
export function responseEnvelope<T>(data: z.ZodType<T>) {
  return z.object({
    data,
    meta: z.record(z.string(), z.unknown()).optional(),
    request_id: z.string().optional(),
  });
}

export type ApiEnvelope<T> = {
  data: T;
  meta?: Record<string, unknown>;
  request_id?: string;
};
