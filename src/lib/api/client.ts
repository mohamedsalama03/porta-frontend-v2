import { z } from 'zod';
import { config } from '@/lib/config';
import { notifySessionExpired } from '@/lib/auth/session-events';
import { ApiError, isAbortError, normalizeHttpError, safeRequestId } from './errors';
import { reportResponseSchemaMismatch } from './diagnostics';

type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions<TResponse, TBody = unknown> {
  schema: z.ZodType<TResponse>;
  method?: HttpMethod;
  body?: TBody;
  bodySchema?: z.ZodType<TBody>;
  signal?: AbortSignal;
  idempotencyKey?: string;
  requestId?: string;
  /** Login and session discovery handle 401 locally, without expiry redirects. */
  notifyOnUnauthorized?: boolean;
}

export interface ApiClientOptions {
  baseUrl: string | null;
  fetch?: typeof globalThis.fetch;
  readCookie?: () => string;
  onUnauthorized?: () => void;
  now?: () => number;
}

export function readXsrfCookie(cookie: string): string | null {
  const entry = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('XSRF-TOKEN='));
  if (!entry) return null;
  try {
    const value = decodeURIComponent(entry.slice('XSRF-TOKEN='.length));
    return value && !/[\r\n]/.test(value) ? value : null;
  } catch {
    return null;
  }
}

function resolveUrl(baseUrl: string | null, path: string, atOrigin = false): string {
  if (!baseUrl) throw new ApiError({ code: 'configuration' });
  try {
    const base = new URL(baseUrl);
    if (
      !['http:', 'https:'].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.pathname !== '/' ||
      base.search ||
      base.hash
    ) {
      throw new Error('Invalid API base');
    }
    if (!path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path)) {
      throw new Error('Invalid API path');
    }
    const url = new URL(
      atOrigin ? path : `${base.pathname.replace(/\/$/, '')}${path}`,
      base.origin,
    );
    if (url.origin !== base.origin) throw new Error('Invalid API origin');
    if (url.hash || new Set(url.searchParams.keys()).size !== [...url.searchParams.keys()].length)
      throw new Error('Invalid API query');
    return url.toString();
  } catch {
    throw new ApiError({ code: 'configuration' });
  }
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createApiClient(options: ApiClientOptions) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const cookieReader =
    options.readCookie ?? (() => (typeof document === 'undefined' ? '' : document.cookie));
  const now = options.now ?? Date.now;

  async function performFetch(url: string, init: RequestInit): Promise<Response> {
    try {
      // Keep cookies and private responses out of persistent HTTP and Next.js caches.
      return await fetcher(url, {
        ...init,
        credentials: 'include',
        cache: 'no-store',
        redirect: 'error',
      });
    } catch (error: unknown) {
      if (isAbortError(error)) throw error;
      if (init.signal?.aborted) throw new DOMException('Request aborted', 'AbortError');
      throw new ApiError({ code: 'network' });
    }
  }

  async function bootstrapCsrf(signal?: AbortSignal): Promise<void> {
    const response = await performFetch(resolveUrl(options.baseUrl, '/sanctum/csrf-cookie', true), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!response.ok) throw normalizeHttpError(response, await readBody(response), now());
    if (!readXsrfCookie(cookieReader())) throw new ApiError({ code: 'csrf' });
  }

  async function request<TResponse, TBody = unknown>(
    path: string,
    requestOptions: ApiRequestOptions<TResponse, TBody>,
  ): Promise<TResponse> {
    const url = resolveUrl(options.baseUrl, path);
    const method = requestOptions.method ?? 'GET';
    const isWrite = !['GET', 'HEAD'].includes(method);
    const headers = new Headers({ Accept: 'application/json' });
    let body: string | undefined;

    if (requestOptions.body !== undefined) {
      if (!isWrite || !requestOptions.bodySchema) throw new ApiError({ code: 'invalid_request' });
      const parsed = requestOptions.bodySchema.safeParse(requestOptions.body);
      if (!parsed.success) throw new ApiError({ code: 'invalid_request' });
      if (parsed.data === null || typeof parsed.data !== 'object' || Array.isArray(parsed.data))
        throw new ApiError({ code: 'invalid_request' });
      try {
        body = JSON.stringify(parsed.data);
        if (typeof body !== 'string' || new TextEncoder().encode(body).byteLength > 65_536)
          throw new Error('Request body exceeds the contract limit');
      } catch {
        throw new ApiError({ code: 'invalid_request' });
      }
      headers.set('Content-Type', 'application/json');
    }

    if (requestOptions.idempotencyKey) {
      if (!isWrite || !/^[A-Za-z0-9_-]{32,128}$/.test(requestOptions.idempotencyKey)) {
        throw new ApiError({ code: 'invalid_request' });
      }
      headers.set('Idempotency-Key', requestOptions.idempotencyKey);
    }
    if (requestOptions.requestId) {
      if (!safeRequestId(requestOptions.requestId)) throw new ApiError({ code: 'invalid_request' });
      headers.set('X-Request-ID', requestOptions.requestId);
    }

    requestOptions.signal?.throwIfAborted();
    if (isWrite) {
      if (!readXsrfCookie(cookieReader())) await bootstrapCsrf(requestOptions.signal);
      const token = readXsrfCookie(cookieReader());
      if (!token) throw new ApiError({ code: 'csrf' });
      headers.set('X-XSRF-TOKEN', token);
    }

    const response = await performFetch(url, {
      method,
      headers,
      body,
      signal: requestOptions.signal,
    });
    const payload = await readBody(response);
    requestOptions.signal?.throwIfAborted();
    if (!response.ok) {
      if (response.status === 401 && requestOptions.notifyOnUnauthorized !== false)
        options.onUnauthorized?.();
      throw normalizeHttpError(response, payload, now());
    }
    const parsed = requestOptions.schema.safeParse(payload);
    if (!parsed.success) {
      reportResponseSchemaMismatch(requestOptions.schema, parsed.error.issues, payload);
      throw new ApiError({
        code: 'invalid_response',
        status: response.status,
        requestId: safeRequestId(response.headers.get('X-Request-ID')),
      });
    }
    return parsed.data;
  }

  return { request, bootstrapCsrf };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export const api = createApiClient({
  baseUrl: config.apiBaseUrl,
  onUnauthorized: notifySessionExpired,
});
