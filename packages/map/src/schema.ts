// cm:why Scoped to what ApiMapFile needs — str/num/bool/literal/enumOf/opt/obj/arr, no unions-of-
// objects, no recursion, no transforms — not a general validation library. Bigger duplicates `map-stays-pure`.
export interface Schema<T, Opt extends boolean = false> {
  readonly _out: T;
  readonly _opt: Opt;
  check(value: unknown, path: string, errors: string[]): boolean;
}

export type Infer<S> = S extends Schema<infer T, boolean> ? T : never;

function make<T>(check: Schema<T>['check']): Schema<T> {
  return { _out: undefined as unknown as T, _opt: false, check };
}

const typeOf = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

export function str(): Schema<string> {
  return make((v, path, errors) => {
    if (typeof v === 'string') return true;
    errors.push(`${path}: expected string, got ${typeOf(v)}`);
    return false;
  });
}

export function num(): Schema<number> {
  return make((v, path, errors) => {
    if (typeof v === 'number') return true;
    errors.push(`${path}: expected number, got ${typeOf(v)}`);
    return false;
  });
}

export function bool(): Schema<boolean> {
  return make((v, path, errors) => {
    if (typeof v === 'boolean') return true;
    errors.push(`${path}: expected boolean, got ${typeOf(v)}`);
    return false;
  });
}

export function literal<L extends string | number | boolean>(expected: L): Schema<L> {
  return make((v, path, errors) => {
    if (v === expected) return true;
    errors.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(v)}`);
    return false;
  });
}

export function enumOf<T extends readonly string[]>(values: T): Schema<T[number]> {
  return make((v, path, errors) => {
    if (typeof v === 'string' && (values as readonly string[]).includes(v)) return true;
    errors.push(`${path}: expected one of ${values.join('|')}, got ${JSON.stringify(v)}`);
    return false;
  });
}

// cm:guard `_opt` is what `obj()` reads to decide whether a key is required — the check itself
// still runs (so `route: 'not-a-string'` is still rejected), only `undefined` is let through.
export function opt<T>(inner: Schema<T>): Schema<T | undefined, true> {
  return {
    _out: undefined as unknown as T | undefined,
    _opt: true,
    check: (v, path, errors) => v === undefined || inner.check(v, path, errors),
  };
}

type AnySchema = Schema<unknown, boolean>;

// cm:guard The mapped-type split on `S[K]['_opt']` is what makes `Infer` produce an optional KEY
// (`route?: string`), not a required key typed `string | undefined` — callers build a ScreenNode without `route` at all.
type InferShape<S extends Record<string, AnySchema>> = {
  [K in keyof S as S[K]['_opt'] extends true ? never : K]: Infer<S[K]>;
} & {
  [K in keyof S as S[K]['_opt'] extends true ? K : never]?: Infer<S[K]>;
};

// cm:guard Unknown keys pass through unrejected: an externally-produced .apimap carrying a field
// this version does not know about is a compatible read, not an error — see SPEC.md "Version policy".
export function obj<S extends Record<string, AnySchema>>(shape: S): Schema<InferShape<S>> {
  return make((v, path, errors) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      errors.push(`${path}: expected object, got ${typeOf(v)}`);
      return false;
    }
    let ok = true;
    for (const key of Object.keys(shape)) {
      const child = shape[key];
      if (!child.check((v as Record<string, unknown>)[key], `${path}.${key}`, errors)) ok = false;
    }
    return ok;
  });
}

export function arr<T>(item: Schema<T>): Schema<T[]> {
  return make((v, path, errors) => {
    if (!Array.isArray(v)) {
      errors.push(`${path}: expected array, got ${typeOf(v)}`);
      return false;
    }
    let ok = true;
    v.forEach((el, i) => {
      if (!item.check(el, `${path}[${String(i)}]`, errors)) ok = false;
    });
    return ok;
  });
}

// cm:why One combined Error, not one throw per field: a caller fixing a hand-built .apimap needs
// every divergence in the first message, not one round-trip per mistake.
export function parseWith<S extends AnySchema>(schema: S, value: unknown, label: string): Infer<S> {
  const errors: string[] = [];
  schema.check(value, label, errors);
  if (errors.length > 0) throw new Error(errors.join('\n'));
  return value as Infer<S>;
}
