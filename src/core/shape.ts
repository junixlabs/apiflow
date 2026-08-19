export type ShapeType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array' | 'unknown';

export interface ShapeField {
  path: string;
  type: ShapeType;
  nullable?: boolean;
  optional?: boolean;
}

const MAX_DEPTH = 6;
const MAX_KEYS = 200;

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
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
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
