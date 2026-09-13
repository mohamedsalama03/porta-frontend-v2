import { z } from 'zod';

const expectedTypes = new Set([
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'record',
  'undefined',
  'null',
  'date',
  'bigint',
  'symbol',
  'never',
  'unknown',
  'any',
  'int',
  'function',
  'map',
  'set',
  'promise',
  'void',
]);

function unwrap(schema: z.ZodType): z.ZodType {
  for (let depth = 0; depth < 12; depth++) {
    if (
      schema instanceof z.ZodOptional ||
      schema instanceof z.ZodNullable ||
      schema instanceof z.ZodDefault ||
      schema instanceof z.ZodReadonly
    ) {
      const inner: unknown = schema.unwrap();
      if (!(inner instanceof z.ZodType)) break;
      schema = inner;
    } else if (schema instanceof z.ZodPipe && schema.in instanceof z.ZodType) schema = schema.in;
    else break;
  }
  return schema;
}

/** Names come from the schema itself; dynamic record keys and array indexes are redacted. */
function schemaPath(root: z.ZodType, path: readonly PropertyKey[]): string[] {
  let current: z.ZodType | null = root;
  return path.slice(0, 12).map((part) => {
    if (!current) return '[field]';
    const schema = unwrap(current);
    if (
      schema instanceof z.ZodObject &&
      typeof part === 'string' &&
      Object.hasOwn(schema.shape, part)
    ) {
      const child: unknown = schema.shape[part];
      current = child instanceof z.ZodType ? child : null;
      return part;
    }
    if (schema instanceof z.ZodArray && typeof part === 'number') {
      current = schema.element instanceof z.ZodType ? schema.element : null;
      return '[]';
    }
    if (schema instanceof z.ZodRecord) {
      current = schema.valueType instanceof z.ZodType ? schema.valueType : null;
      return '[key]';
    }
    current = null;
    return '[field]';
  });
}

type JsonKind = 'null' | 'array' | 'object' | 'string' | 'number' | 'boolean' | 'missing';

function receivedKindAt(payload: unknown, path: readonly PropertyKey[]): JsonKind {
  let value: unknown = payload;
  for (const part of path) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part))
      return 'missing';
    value = Reflect.get(value, part);
  }
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'object':
      return 'object';
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'missing';
  }
}

/** Never log payloads, received values, validation messages, request paths, or identity data. */
export function reportResponseSchemaMismatch(
  schema: z.ZodType,
  issues: readonly z.ZodIssue[],
  payload: unknown,
): void {
  if (process.env.NODE_ENV !== 'development') return;
  const safeIssues = issues.slice(0, 20).map((issue) => ({
    code: issue.code,
    path: schemaPath(schema, issue.path),
    ...('expected' in issue &&
    typeof issue.expected === 'string' &&
    expectedTypes.has(issue.expected)
      ? { expected: issue.expected }
      : {}),
    receivedKind: receivedKindAt(payload, issue.path),
  }));
  console.warn('[Porta API] Response schema mismatch', JSON.stringify(safeIssues));
}
