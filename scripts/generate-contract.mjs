import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import prettier from 'prettier';

// Deliberately scoped to the supplied OpenAPI vocabulary. New validation keywords
// fail generation so a contract change cannot silently weaken runtime validation.
const source = new URL('../contracts/porta-api-v1.openapi.json', import.meta.url);
const output = new URL('../src/lib/api/generated.ts', import.meta.url);
const raw = await readFile(source, 'utf8');
const spec = JSON.parse(raw);
const schemas = spec.components.schemas;
const allowed = new Set([
  '$ref',
  'type',
  'properties',
  'required',
  'additionalProperties',
  'maxProperties',
  'items',
  'enum',
  'const',
  'anyOf',
  'allOf',
  'if',
  'then',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'pattern',
  'format',
  'minItems',
  'maxItems',
  'uniqueItems',
  'description',
  'default',
  'example',
  'writeOnly',
]);
const schemaName = (name) => `${name[0].toLowerCase()}${name.slice(1)}Schema`;
const quote = JSON.stringify;
const definitions = [];
const visited = new Set();
const visiting = new Set();

function resolve(ref) {
  if (!ref.startsWith('#/')) throw new Error(`External references are not allowed: ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .reduce((value, key) => value[key], spec);
}

function emitComponent(name) {
  if (visited.has(name)) return;
  if (visiting.has(name)) throw new Error(`Recursive schema needs explicit support: ${name}`);
  visiting.add(name);
  const expression = emit(schemas[name]);
  definitions.push(
    `export const ${schemaName(name)} = ${expression};\nexport type ${name} = z.infer<typeof ${schemaName(name)}>;`,
  );
  visiting.delete(name);
  visited.add(name);
}

function emit(schema) {
  if (schema === true) return 'z.unknown()';
  if (schema === false) return 'z.never()';
  for (const key of Object.keys(schema)) {
    if (!allowed.has(key)) throw new Error(`Unsupported schema keyword: ${key}`);
  }
  if (schema.$ref) {
    const name = schema.$ref.split('/').at(-1);
    if (!schema.$ref.startsWith('#/components/schemas/'))
      throw new Error(`Unsupported schema reference: ${schema.$ref}`);
    emitComponent(name);
    return schemaName(name);
  }
  if (schema.anyOf) return `z.union([${schema.anyOf.map(emit).join(',')}])`;
  if (Array.isArray(schema.type))
    return `z.union([${schema.type.map((type) => emit({ ...schema, type })).join(',')}])`;
  if ('const' in schema) return `z.literal(${quote(schema.const)})`;
  if (schema.enum) {
    if (schema.enum.some((value) => typeof value !== 'string'))
      throw new Error('Non-string enum needs explicit support');
    return `z.enum(${quote(schema.enum)})`;
  }
  let code;
  switch (schema.type ?? (schema.properties || schema.required ? 'object' : undefined)) {
    case 'object': {
      const fields = Object.entries(schema.properties ?? {}).map(
        ([name, value]) =>
          `${quote(name)}: ${emit(value)}${schema.required?.includes(name) ? '' : '.optional()'}`,
      );
      if (schema.required?.some((name) => !(name in (schema.properties ?? {}))))
        throw new Error('Required property without schema needs explicit support');
      code = `${schema.additionalProperties === false ? 'z.strictObject' : 'z.looseObject'}({${fields.join(',')}})`;
      if (schema.additionalProperties && typeof schema.additionalProperties === 'object')
        code += `.catchall(${emit(schema.additionalProperties)})`;
      if (schema.maxProperties !== undefined) {
        if (!Number.isSafeInteger(schema.maxProperties) || schema.maxProperties < 0)
          throw new Error('maxProperties must be a nonnegative safe integer');
        code += `.refine((value) => Object.keys(value).length <= ${schema.maxProperties}, {message:"Too many properties"})`;
      }
      break;
    }
    case 'string': {
      const formats = {
        email: 'z.email()',
        uuid: 'z.uuid()',
        uri: 'z.url()',
        'date-time': 'z.iso.datetime({offset:true})',
        date: 'z.iso.date()',
        ulid: 'z.ulid()',
      };
      if (schema.format && !formats[schema.format])
        throw new Error(`Unsupported string format: ${schema.format}`);
      code = formats[schema.format] ?? 'z.string()';
      if (schema.minLength !== undefined) code += `.min(${schema.minLength})`;
      if (schema.maxLength !== undefined) code += `.max(${schema.maxLength})`;
      if (schema.pattern) code += `.regex(new RegExp(${quote(schema.pattern)}))`;
      break;
    }
    case 'integer':
    case 'number':
      code = schema.type === 'integer' ? 'z.number().int().safe()' : 'z.number()';
      if (schema.minimum !== undefined) code += `.min(${schema.minimum})`;
      if (schema.maximum !== undefined) code += `.max(${schema.maximum})`;
      if (schema.exclusiveMinimum !== undefined) code += `.gt(${schema.exclusiveMinimum})`;
      break;
    case 'boolean':
      code = 'z.boolean()';
      break;
    case 'null':
      code = 'z.null()';
      break;
    case 'array':
      code = `z.array(${emit(schema.items)})`;
      if (schema.minItems !== undefined) code += `.min(${schema.minItems})`;
      if (schema.maxItems !== undefined) code += `.max(${schema.maxItems})`;
      if (schema.uniqueItems)
        code +=
          '.refine((items) => new Set(items.map((item) => JSON.stringify(item))).size === items.length, {message:"Values must be unique"})';
      break;
    default:
      throw new Error(`Unsupported schema: ${quote(schema)}`);
  }
  for (const clause of schema.allOf ?? []) {
    if (!clause.if || !clause.then) throw new Error('Unsupported allOf clause');
    const condition = emit({ type: 'object', ...clause.if });
    const consequence = emit({ type: 'object', ...clause.then });
    code += `.superRefine((value, ctx) => { if (${condition}.safeParse(value).success) { const result = ${consequence}.safeParse(value); if (!result.success) for (const issue of result.error.issues) ctx.addIssue({code:'custom', path:issue.path, message:issue.message}); } })`;
  }
  return code;
}

for (const name of Object.keys(schemas)) emitComponent(name);
const operations = {};
for (const [path, item] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(item)) {
    if (!operation.operationId) continue;
    const id = operation.operationId;
    const params = (operation.parameters ?? []).map((param) =>
      param.$ref ? resolve(param.$ref) : param,
    );
    for (const [location, suffix] of [
      ['query', 'Query'],
      ['path', 'Path'],
    ]) {
      const matching = params.filter((param) => param.in === location);
      const schema = {
        type: 'object',
        additionalProperties: false,
        properties: Object.fromEntries(matching.map((param) => [param.name, param.schema])),
        required: matching.filter((param) => param.required).map((param) => param.name),
      };
      definitions.push(`export const ${id}${suffix}Schema = ${emit(schema)};`);
    }
    const body = operation.requestBody?.content?.['application/json']?.schema;
    if (body) definitions.push(`export const ${id}BodySchema = ${emit(body)};`);
    const successes = Object.entries(operation.responses).filter(([status]) =>
      /^2\d\d$/.test(status),
    );
    const responses = successes
      .map(([, response]) => response.content?.['application/json']?.schema)
      .map((schema) => (schema ? emit(schema) : 'z.null()'));
    definitions.push(
      `export const ${id}ResponseSchema = ${responses.length === 1 ? responses[0] : `z.union([${responses.join(',')}])`};`,
    );
    operations[id] = {
      path,
      method: method.toUpperCase(),
      permission: operation['x-permission'] ?? null,
      idempotent: params.some((param) => param.name === 'Idempotency-Key' && param.required),
    };
  }
}
const content = await prettier.format(
  `// Generated from contracts/porta-api-v1.openapi.json. Do not edit.\n// SHA-256: ${createHash('sha256').update(raw).digest('hex')}\nimport { z } from 'zod';\n\n${definitions.join('\n\n')}\n\nexport const approvedOperations = ${quote(operations)} as const;\n`,
  {
    ...JSON.parse(await readFile(new URL('../.prettierrc.json', import.meta.url), 'utf8')),
    parser: 'typescript',
  },
);
if (process.argv.includes('--check')) {
  const existing = await readFile(output, 'utf8');
  if (existing !== content)
    throw new Error('Generated API schemas are stale. Run npm run api:generate.');
  process.stdout.write('Generated schemas match the approved local contract.\n');
} else {
  await writeFile(output, content);
  process.stdout.write(
    `Generated ${visited.size} component schemas and ${Object.keys(operations).length} operations from the local contract.\n`,
  );
}
