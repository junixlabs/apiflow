export type ShapeType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array' | 'unknown';

export interface ShapeField {
  path: string;
  type: ShapeType;
  nullable?: boolean;
  optional?: boolean;
  keys?: number;
}

const MAX_DEPTH = 6;
const MAX_KEYS = 200;

// cm:why A DICTIONARY is not a shape. `GET /api/v1/languages` returns the i18n table, and its 100
// `data.en.validation.*` keys are translation ids — data, not fields. Recording them as fields put 263
// of one endpoint's "fields" into a map where the whole API had 354, and an endpoint that gains a
// translation string would read as an endpoint that gained a field.
// cm:guard The threshold is measured, and it is deliberately CONSERVATIVE: across two Zod-read APIs
// (1,126 endpoints of ground truth) the widest genuine record has 15 children, and every genuine
// record node in the probed bodies has at most 11 AND mixed value types. The dictionaries found were
// 100, 65, 47, 34 and 25 keys, all single-typed. Under-collapsing leaves noise; over-collapsing
// DELETES real field names, so when the two conditions disagree the field names survive.
const DICT_MIN_KEYS = 20;
const DICT_SAMPLE = 5;

function typeOf(value: unknown): ShapeType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'string': return 'string';
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'object': return 'object';
    default: return 'unknown';
  }
}

// cm:why Many sibling keys that all hold the SAME shape are a keyed collection, not a record — the
// keys are values. Collapsing them is the array rule applied to an object: `{key}` is to a dictionary
// what dropping the index is to a list.
export function isDictionary(entries: Array<[string, unknown]>): boolean {
  if (entries.length < DICT_MIN_KEYS) return false;
  const shapes = new Set(entries.map(([, value]) => typeOf(value)));
  return shapes.size === 1;
}

// cm:guard Array elements collapse onto ONE path — `data[0].email` and `data[1].email` are the same
// field. Indexing them apart would make a 100-row response look like 100 distinct fields.
export function shapeOf(body: unknown, prefix = '', depth = 0, out: ShapeField[] = []): ShapeField[] {
  if (depth > MAX_DEPTH || out.length > MAX_KEYS) return out;
  const type = typeOf(body);

  if (type === 'array') {
    const items = body as unknown[];
    for (const item of items.slice(0, 20)) shapeOf(item, prefix, depth + 1, out);
    return out;
  }
  if (type === 'object') {
    const entries = Object.entries(body as Record<string, unknown>);
    if (isDictionary(entries)) {
      const path = prefix ? `${prefix}.{key}` : '{key}';
      const valueType = typeOf(entries[0]?.[1]);
      // cm:why The COUNT is kept. "a dictionary of 100 strings" is a fact about the response; dropping
      // it would make a collapse indistinguishable from an endpoint that returns one field.
      upsert(out, { path, type: valueType, keys: entries.length });
      // cm:edge protocol -> the array branch above — sample several values into the ONE collapsed path
      // for the same reason a list samples 20 items: one member is not evidence of the member shape.
      if (valueType === 'object' || valueType === 'array') {
        for (const [, value] of entries.slice(0, DICT_SAMPLE)) shapeOf(value, path, depth + 1, out);
      }
      return out;
    }
    for (const [key, value] of entries) {
      const path = prefix ? `${prefix}.${key}` : key;
      const valueType = typeOf(value);
      upsert(out, { path, type: valueType, nullable: value === null });
      if (valueType === 'object' || valueType === 'array') shapeOf(value, path, depth + 1, out);
    }
  }
  return out;
}

// cm:why Two samples of the same endpoint disagree constantly — a nullable column, an absent
// optional key. Widening rather than overwriting is what keeps repeated probes from flapping.
function upsert(out: ShapeField[], field: ShapeField): void {
  const existing = out.find((f) => f.path === field.path);
  if (!existing) {
    out.push(field);
    return;
  }
  existing.nullable = existing.nullable || field.nullable;
  if (field.keys !== undefined) existing.keys = Math.max(existing.keys ?? 0, field.keys);
  if (existing.type === field.type) return;
  if (existing.type === 'null') existing.type = field.type;
  else if (field.type === 'null') existing.nullable = true;
  else existing.type = 'unknown';
}

export function mergeShapes(a: ShapeField[], b: ShapeField[]): ShapeField[] {
  const out = a.map((f) => ({ ...f }));
  const seen = new Set(a.map((f) => f.path));
  for (const field of b) {
    if (seen.has(field.path)) upsert(out, field);
    else {
      out.push({ ...field });
      seen.add(field.path);
    }
  }
  for (const field of out) {
    if (!b.some((f) => f.path === field.path) || !a.some((f) => f.path === field.path)) {
      field.optional = true;
    }
  }
  return out.sort((x, y) => x.path.localeCompare(y.path));
}
