import { z } from 'zod';

export type ApiErrorCode =
  | 'http'
  | 'network'
  | 'invalid_response'
  | 'invalid_request'
  | 'configuration'
  | 'contract_unavailable'
  | 'csrf';

const messages: Readonly<Record<number, string>> = {
  401: 'انتهت الجلسة أو تعذّر تسجيل الدخول. يرجى تسجيل الدخول من جديد.',
  403: 'ليس لديك صلاحية لإجراء هذه العملية.',
  404: 'تعذّر العثور على المورد المطلوب.',
  409: 'تغيّرت البيانات. حمّل أحدث حالة ثم راجع العملية قبل المحاولة مجددًا.',
  419: 'انتهت صلاحية الجلسة الآمنة. حدّث الصفحة ثم حاول مجددًا.',
  422: 'يرجى مراجعة الحقول المحددة والمحاولة مجددًا.',
  429: 'طلبات كثيرة خلال وقت قصير. يرجى الانتظار قبل المحاولة مجددًا.',
  500: 'حدث خطأ أثناء معالجة الطلب. يرجى المحاولة لاحقًا.',
  503: 'الخدمة غير متاحة مؤقتًا. يرجى المحاولة لاحقًا.',
};

const codeMessages: Readonly<Record<Exclude<ApiErrorCode, 'http'>, string>> = {
  network: 'تعذّر الاتصال بالخدمة. تحقق من اتصالك ثم حاول مجددًا.',
  invalid_response: 'تعذّر قراءة استجابة الخدمة. يرجى التواصل مع الدعم.',
  invalid_request: 'يرجى مراجعة بيانات الطلب قبل الإرسال.',
  configuration: 'الاتصال بالخدمة غير مهيّأ بعد.',
  contract_unavailable: 'هذه الميزة بانتظار اعتماد عقد الربط بالخدمة.',
  csrf: 'تعذّر إنشاء جلسة آمنة. تحقق من إعدادات الاتصال بالخدمة.',
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly validationErrors: Readonly<Record<string, readonly string[]>>;
  readonly requestId: string | null;
  /** Minimum time in milliseconds before the next attempt. */
  readonly retryAfter: number | null;

  constructor(
    options: {
      status?: number;
      code?: ApiErrorCode;
      validationErrors?: Readonly<Record<string, readonly string[]>>;
      requestId?: string | null;
      retryAfter?: number | null;
    } = {},
  ) {
    const code = options.code ?? 'http';
    const status = options.status ?? 0;
    super(
      code === 'http'
        ? (messages[status] ?? 'تعذّر إتمام الطلب. يرجى المحاولة لاحقًا.')
        : codeMessages[code],
    );
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.validationErrors = options.validationErrors ?? {};
    this.requestId = options.requestId ?? null;
    this.retryAfter = options.retryAfter ?? null;
  }
}

const errorBodySchema = z.object({
  request_id: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export function safeRequestId(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : null;
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const milliseconds = Number(trimmed) * 1_000;
    return Number.isSafeInteger(Math.ceil(milliseconds)) ? Math.ceil(milliseconds) : null;
  }
  // Retry-After dates use HTTP-date, not arbitrary strings accepted by Date.parse.
  if (!/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(trimmed))
    return null;
  const date = Date.parse(trimmed);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

export function normalizeHttpError(response: Response, body: unknown, now = Date.now()): ApiError {
  const parsed = errorBodySchema.safeParse(body);
  const validationErrors: Record<string, readonly string[]> = Object.create(null);
  if (response.status === 422 && parsed.success && parsed.data.errors) {
    // Field names preserve inline placement. Unapproved backend prose is never rendered.
    for (const field of Object.keys(parsed.data.errors).slice(0, 100)) {
      if (/^[A-Za-z][A-Za-z0-9_.]{0,99}$/.test(field)) {
        validationErrors[field] = ['تحقق من قيمة هذا الحقل.'];
      }
    }
  }
  return new ApiError({
    status: response.status,
    validationErrors,
    requestId:
      safeRequestId(response.headers.get('X-Request-ID')) ??
      (parsed.success ? safeRequestId(parsed.data.request_id) : null),
    retryAfter: parseRetryAfter(response.headers.get('Retry-After'), now),
  });
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
