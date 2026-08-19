import type { MapMethod, SourceRef, UnresolvedCall } from './apimap';
import { normalizePath } from './apimap';
import type { ShapeType } from './shape';
import { blankComments } from './feScanner';

export type Stack = 'laravel' | 'node' | 'go' | 'python' | 'generic';

export interface SchemaField {
  path: string;
  type: ShapeType;
  optional?: boolean;
}

export interface SchemaDef {
  name: string;
  fields: SchemaField[];
  source: SourceRef;
}

export interface RouteHit {
  method: MapMethod;
  path: string;
  handler?: string;
  auth?: boolean;
  requestSchema?: string;
  responseSchema?: string;
  source: SourceRef;
}

export interface BeFileScan {
  schemas: SchemaDef[];
  routes: RouteHit[];
  unresolved: UnresolvedCall[];
}

export function detectStack(manifests: Record<string, string>): Stack {
  if ('artisan' in manifests || 'composer.json' in manifests) return 'laravel';
  if ('go.mod' in manifests) return 'go';
  const pkg = manifests['package.json'];
  if (pkg) return 'node';
  if ('pyproject.toml' in manifests || 'requirements.txt' in manifests) return 'python';
  return 'generic';
}

const BE_EXT = /\.(php|[jt]sx?|mjs|cjs|go|py|rb)$/;
const BE_SKIP = /(^|\/)(node_modules|vendor|dist|build|storage|__pycache__|\.git|migrations|tests?|spec)(\/|$)/;

export function isBackendFile(file: string): boolean {
  if (BE_SKIP.test(file)) return false;
  return BE_EXT.test(file);
}

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

const AUTH_HINT = /\b(auth|jwt|passport|requireUser|isAuthenticated|guard|Protected|RequireLogin|sanctum|IsAuthenticated|login_required|permission_classes)\b/i;

// cm:guard Every extractor below returns a NORMALIZED path via normalizePath, so `:id`, `{id}`,
// `<int:id>` and `$id` all collapse to the same endpoint id the FE scanner produces.
function route(method: string, path: string, file: string, line: number, extra: Partial<RouteHit> = {}): RouteHit {
  return {
    method: method.toUpperCase() as MapMethod,
    path: normalizePath(path),
    source: { file, line },
    ...extra,
  };
}

const LARAVEL_VERB = /Route::(get|post|put|patch|delete|options|any)\s*\(\s*(['"])([^'"]*)\2\s*,?([^;]*)/g;
const LARAVEL_RESOURCE = /Route::(apiResource|resource)\s*\(\s*(['"])([^'"]*)\2\s*,\s*([\w\\]+)/g;
const LARAVEL_PREFIX = /->prefix\s*\(\s*(['"])([^'"]*)\1\s*\)|['"]prefix['"]\s*=>\s*(['"])([^'"]*)\3/g;

// cm:why Route::resource is one line that registers five endpoints. Expanding it is not a nicety —
// a Laravel map that skips it silently loses most of the API surface.
const RESOURCE_ACTIONS: Array<[string, string, string]> = [
  ['GET', '', 'index'],
  ['POST', '', 'store'],
  ['GET', '/{id}', 'show'],
  ['PUT', '/{id}', 'update'],
  ['DELETE', '/{id}', 'destroy'],
];

function laravelPrefix(content: string, upTo: number): string {
  const head = content.slice(0, upTo);
  const parts: string[] = [];
  let depth = 0;
  LARAVEL_PREFIX.lastIndex = 0;
  for (const m of head.matchAll(LARAVEL_PREFIX)) {
    const value = m[2] ?? m[4];
    const after = head.slice(m.index);
    const opens = (after.match(/\{/g) ?? []).length;
    const closes = (after.match(/\}/g) ?? []).length;
    if (value && opens > closes) {
      parts.push(value);
      depth++;
    }
  }
  return depth > 0 ? `/${parts.join('/')}` : '';
}

function scanLaravel(file: string, content: string): BeFileScan {
  const out: BeFileScan = { schemas: [], routes: [], unresolved: [] };
  const isRouteFile = /(^|\/)routes\//.test(file);

  if (isRouteFile) {
    for (const m of content.matchAll(LARAVEL_VERB)) {
      const prefix = laravelPrefix(content, m.index);
      const tail = m[4] ?? '';
      const handler = /\[\s*([\w\\]+)::class\s*,\s*(['"])(\w+)\2/.exec(tail);
      out.routes.push(
        route(m[1] === 'any' ? 'UNKNOWN' : m[1], `${prefix}/${m[3]}`, file, lineOf(content, m.index), {
          handler: handler ? `${handler[1].split('\\').pop()}@${handler[3]}` : undefined,
          auth: AUTH_HINT.test(tail) || AUTH_HINT.test(content.slice(Math.max(0, m.index - 400), m.index)),
        })
      );
    }
    for (const m of content.matchAll(LARAVEL_RESOURCE)) {
      const prefix = laravelPrefix(content, m.index);
      const controller = m[4].split('\\').pop() as string;
      const guarded = AUTH_HINT.test(content.slice(Math.max(0, m.index - 400), m.index));
      for (const [verb, suffix, action] of RESOURCE_ACTIONS) {
        out.routes.push(
          route(verb, `${prefix}/${m[3]}${suffix}`, file, lineOf(content, m.index), {
            handler: `${controller}@${action}`,
            auth: guarded,
          })
        );
      }
    }
    return out;
  }

  const rules = /public\s+function\s+rules\s*\([^)]*\)\s*(?::\s*\w+\s*)?\{([\s\S]*?)\n\s*\}/.exec(content);
  const className = /class\s+(\w+)/.exec(content)?.[1];
  if (rules && className) {
    const fields: SchemaField[] = [];
    for (const m of rules[1].matchAll(/(['"])([\w.*]+)\1\s*=>\s*(['"[])([\s\S]*?)(?:\3|\])/g)) {
      const spec = m[4];
      fields.push({
        path: m[2],
        type: laravelRuleType(spec),
        optional: !/\brequired\b/.test(spec),
      });
    }
    if (fields.length > 0) {
      out.schemas.push({ name: className, fields, source: { file, line: lineOf(content, rules.index) } });
    }
  }

  const toArray = /public\s+function\s+toArray\s*\([^)]*\)\s*(?::\s*\w+\s*)?\{([\s\S]*?)\n\s*\}/.exec(content);
  if (toArray && className) {
    const fields: SchemaField[] = [];
    for (const m of toArray[1].matchAll(/(['"])([\w.]+)\1\s*=>/g)) {
      fields.push({ path: m[2], type: 'unknown' });
    }
    if (fields.length > 0) {
      out.schemas.push({ name: className, fields, source: { file, line: lineOf(content, toArray.index) } });
    }
  }
  return out;
}

function laravelRuleType(spec: string): ShapeType {
  if (/\b(integer|numeric)\b/.test(spec)) return 'number';
  if (/\bboolean\b/.test(spec)) return 'boolean';
  if (/\barray\b/.test(spec)) return 'array';
  return 'string';
}

const NEST_CONTROLLER = /@Controller\s*\(\s*(['"`])?([^'"`)]*)\1?\s*\)/;
const NEST_METHOD = /@(Get|Post|Put|Patch|Delete|Options)\s*\(\s*(?:(['"`])([^'"`]*)\2)?\s*\)[\s\S]{0,600}?\b(\w+)\s*\(/g;
const EXPRESS_ROUTE = /\b(?:app|router|api|server|r)\s*\.\s*(get|post|put|patch|delete|options|all)\s*\(\s*(['"`])([^'"`]*)\2\s*,([^)]*)/g;
const EXPRESS_MOUNT = /\.\s*use\s*\(\s*(['"`])(\/[^'"`]*)\1\s*,\s*(\w+)/g;
const ZOD_OBJECT = /(?:const|let|var)\s+(\w+)\s*=\s*z\s*\.\s*object\s*\(\s*\{([\s\S]*?)\n\s*\}\s*\)/g;
const CLASS_VALIDATOR = /class\s+(\w+)\s*\{([\s\S]*?)\n\}/g;

function scanNode(file: string, content: string): BeFileScan {
  const out: BeFileScan = { schemas: [], routes: [], unresolved: [] };

  for (const m of content.matchAll(ZOD_OBJECT)) {
    const fields: SchemaField[] = [];
    for (const f of m[2].matchAll(/(\w+)\s*:\s*z\s*\.\s*(\w+)\s*\(([\s\S]{0,80}?)\)([^,\n]*)/g)) {
      fields.push({ path: f[1], type: zodType(f[2]), optional: /optional|nullish|default/.test(f[4]) });
    }
    if (fields.length > 0) out.schemas.push({ name: m[1], fields, source: { file, line: lineOf(content, m.index) } });
  }

  for (const m of content.matchAll(CLASS_VALIDATOR)) {
    const fields: SchemaField[] = [];
    for (const f of m[2].matchAll(/(?:@\w+\([^)]*\)\s*)*\b(\w+)(\?)?\s*:\s*([\w[\]<>|]+)\s*;/g)) {
      fields.push({ path: f[1], type: tsType(f[3]), optional: f[2] === '?' });
    }
    const decorated = /@Is[A-Z]\w*\(/.test(m[2]) || /@ApiProperty/.test(m[2]);
    if (fields.length > 0 && decorated) {
      out.schemas.push({ name: m[1], fields, source: { file, line: lineOf(content, m.index) } });
    }
  }

  const controller = NEST_CONTROLLER.exec(content);
  if (controller) {
    const base = controller[2] ?? '';
    for (const m of content.matchAll(NEST_METHOD)) {
      const block = content.slice(m.index, m.index + 900);
      const body = /@Body\s*\(\s*\)\s*\w+\s*:\s*(\w+)/.exec(block);
      out.routes.push(
        route(m[1], `/${base}/${m[3] ?? ''}`, file, lineOf(content, m.index), {
          handler: m[4],
          requestSchema: body?.[1],
          auth: AUTH_HINT.test(block) || AUTH_HINT.test(content.slice(0, controller.index)),
        })
      );
    }
    return out;
  }

  const mounts = new Map<string, string>();
  for (const m of content.matchAll(EXPRESS_MOUNT)) mounts.set(m[3], m[2]);

  for (const m of content.matchAll(EXPRESS_ROUTE)) {
    const tail = m[4] ?? '';
    const block = content.slice(m.index, m.index + 900);
    const schema = /(\w+)\s*\.\s*(?:parse|safeParse)\s*\(/.exec(block);
    out.routes.push(
      route(m[1] === 'all' ? 'UNKNOWN' : m[1], m[3], file, lineOf(content, m.index), {
        auth: AUTH_HINT.test(tail),
        requestSchema: schema?.[1],
      })
    );
  }
  return out;
}

function zodType(name: string): ShapeType {
  if (name === 'string' || name === 'enum' || name === 'literal') return 'string';
  if (name === 'number' || name === 'bigint') return 'number';
  if (name === 'boolean') return 'boolean';
  if (name === 'array') return 'array';
  if (name === 'object') return 'object';
  return 'unknown';
}

function tsType(name: string): ShapeType {
  const base = name.replace(/\[\]$/, '');
  if (name.endsWith('[]') || base === 'Array') return 'array';
  if (base === 'string' || base === 'Date') return 'string';
  if (base === 'number') return 'number';
  if (base === 'boolean') return 'boolean';
  return base[0] === base[0]?.toUpperCase() ? 'object' : 'unknown';
}

const GO_VERB = /\b\w+\s*\.\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|Get|Post|Put|Patch|Delete)\s*\(\s*(["`])([^"`]*)\2\s*,([^)\n]*)/g;
const GO_HANDLEFUNC = /\bHandleFunc\s*\(\s*(["`])(?:(GET|POST|PUT|PATCH|DELETE)\s+)?([^"`]*)\1\s*,([^)\n]*)\)(\s*\.\s*Methods\s*\(\s*"(\w+)")?/g;
const GO_STRUCT = /type\s+(\w+)\s+struct\s*\{([\s\S]*?)\n\}/g;

function scanGo(file: string, content: string): BeFileScan {
  const out: BeFileScan = { schemas: [], routes: [], unresolved: [] };

  for (const m of content.matchAll(GO_STRUCT)) {
    const fields: SchemaField[] = [];
    for (const f of m[2].matchAll(/^\s*(\w+)\s+([\w[\]*.]+)\s+`[^`]*json:"([^",]+)([^"]*)"/gm)) {
      fields.push({ path: f[3], type: goType(f[2]), optional: /omitempty/.test(f[4]) });
    }
    if (fields.length > 0) out.schemas.push({ name: m[1], fields, source: { file, line: lineOf(content, m.index) } });
  }

  for (const m of content.matchAll(GO_VERB)) {
    out.routes.push(
      route(m[1], m[3], file, lineOf(content, m.index), { auth: AUTH_HINT.test(m[4] ?? '') })
    );
  }
  for (const m of content.matchAll(GO_HANDLEFUNC)) {
    const verb = m[2] ?? m[6];
    out.routes.push(
      route(verb ?? 'UNKNOWN', m[3], file, lineOf(content, m.index), { auth: AUTH_HINT.test(m[4] ?? '') })
    );
    if (!verb) {
      out.unresolved.push({
        source: { file, line: lineOf(content, m.index) },
        reason: 'route registered without a verb — handler branches on r.Method',
        snippet: m[0].split('\n')[0].trim().slice(0, 160),
      });
    }
  }
  return out;
}

function goType(name: string): ShapeType {
  const base = name.replace(/^[*[\]]+/, '');
  if (name.startsWith('[]')) return 'array';
  if (base === 'string') return 'string';
  if (/^(int|uint|float|byte|rune)/.test(base)) return 'number';
  if (base === 'bool') return 'boolean';
  return 'object';
}

const PY_DECORATOR = /@(?:\w+)\.(get|post|put|patch|delete|options|route)\s*\(\s*(['"])([^'"]*)\2([^)]*)\)\s*(?:async\s+)?def\s+(\w+)/g;
const PY_MODEL = /class\s+(\w+)\s*\(\s*(?:BaseModel|\w*Schema|\w*Serializer)[^)]*\)\s*:\s*\n([\s\S]*?)(?=\n\S|\n*$)/g;

function scanPython(file: string, content: string): BeFileScan {
  const out: BeFileScan = { schemas: [], routes: [], unresolved: [] };

  for (const m of content.matchAll(PY_MODEL)) {
    const fields: SchemaField[] = [];
    for (const f of m[2].matchAll(/^\s{2,}(\w+)\s*:\s*([\w[\], |]+?)(\s*=\s*(.+))?$/gm)) {
      const declared = f[2].trim();
      fields.push({
        path: f[1],
        type: pyType(declared),
        optional: /Optional|None/.test(declared) || f[3] !== undefined,
      });
    }
    if (fields.length > 0) out.schemas.push({ name: m[1], fields, source: { file, line: lineOf(content, m.index) } });
  }

  for (const m of content.matchAll(PY_DECORATOR)) {
    const options = m[4] ?? '';
    const block = content.slice(m.index, m.index + 700);
    const responseModel = /response_model\s*=\s*(?:List\[)?(\w+)/.exec(options);
    const methods = /methods\s*=\s*\[([^\]]*)\]/.exec(options);
    const verbs = m[1] === 'route'
      ? [...(methods?.[1] ?? '"GET"').matchAll(/['"](\w+)['"]/g)].map((x) => x[1])
      : [m[1]];
    const body = /(\w+)\s*:\s*(\w+)\s*(?:=\s*Body|[,)])/.exec(block.split('def')[1] ?? '');
    for (const verb of verbs) {
      out.routes.push(
        route(verb, m[3], file, lineOf(content, m.index), {
          handler: m[5],
          responseSchema: responseModel?.[1],
          requestSchema: body?.[2],
          auth: AUTH_HINT.test(block),
        })
      );
    }
  }
  return out;
}

function pyType(declared: string): ShapeType {
  const t = declared.replace(/Optional\[|\]/g, '').split('|')[0].trim();
  if (/^(str|datetime|date|UUID|EmailStr)/.test(t)) return 'string';
  if (/^(int|float|Decimal)/.test(t)) return 'number';
  if (/^bool/.test(t)) return 'boolean';
  if (/^(List|list|Sequence|tuple)/.test(t)) return 'array';
  if (/^(dict|Dict)/.test(t)) return 'object';
  return 'unknown';
}

// cm:why The generic pass runs for EVERY stack, not only the unlisted ones — a Laravel repo with a
// Go sidecar would otherwise lose the sidecar entirely. Duplicates collapse on the endpoint id.
const GENERIC_ROUTE = /['"`](\/(?:api|v\d)[\w\-./{}:<>]*)['"`]/g;

function scanGeneric(file: string, content: string): BeFileScan {
  const out: BeFileScan = { schemas: [], routes: [], unresolved: [] };
  for (const m of content.matchAll(GENERIC_ROUTE)) {
    const before = content.slice(Math.max(0, m.index - 60), m.index);
    const verb = /\b(get|post|put|patch|delete)\b/i.exec(before);
    if (!verb) continue;
    out.routes.push(route(verb[1], m[1], file, lineOf(content, m.index)));
  }
  return out;
}

export function scanBackendFile(file: string, rawContent: string, stack: Stack): BeFileScan {
  const content = blankComments(rawContent);
  const byStack: Record<Stack, (f: string, c: string) => BeFileScan> = {
    laravel: scanLaravel,
    node: scanNode,
    go: scanGo,
    python: scanPython,
    generic: scanGeneric,
  };
  const primary = /\.php$/.test(file) ? scanLaravel
    : /\.(go)$/.test(file) ? scanGo
    : /\.py$/.test(file) ? scanPython
    : /\.[jt]sx?$|\.mjs$|\.cjs$/.test(file) ? scanNode
    : byStack[stack];

  const result = primary(file, content);
  if (result.routes.length === 0 && stack !== 'generic') {
    const fallback = scanGeneric(file, content);
    result.routes.push(...fallback.routes);
  }
  return result;
}

export interface ClassIndex {
  [className: string]: { file: string; content: string };
}

export function indexClasses(files: Array<{ file: string; content: string }>): ClassIndex {
  const index: ClassIndex = {};
  for (const { file, content } of files) {
    for (const m of content.matchAll(/(?:^|\n)\s*(?:final\s+|abstract\s+)?class\s+(\w+)/g)) {
      if (!index[m[1]]) index[m[1]] = { file, content };
    }
  }
  return index;
}

// cm:why A Laravel route names `UserController@show`; the FormRequest and the API Resource that
// define its two shapes live in a third and fourth file. Without this hop the map has no shapes.
export function resolveHandlerSchemas(hit: RouteHit, classes: ClassIndex): RouteHit {
  if (!hit.handler || (hit.requestSchema && hit.responseSchema)) return hit;
  const [className, method] = hit.handler.split('@');
  const target = classes[className];
  if (!target || !method) return hit;

  const signature = new RegExp(`function\\s+${method}\\s*\\(([^)]*)\\)([\\s\\S]{0,1200})`);
  const found = signature.exec(target.content);
  if (!found) return hit;

  const request = /(\w*Request)\s+\$\w+/.exec(found[1]);
  const response = /\b(\w*Resource)\s*::\s*(?:collection|make)|new\s+(\w*Resource)\s*\(/.exec(found[2]);
  return {
    ...hit,
    requestSchema: hit.requestSchema ?? (request && request[1] !== 'Request' ? request[1] : undefined),
    responseSchema: hit.responseSchema ?? response?.[1] ?? response?.[2],
  };
}
