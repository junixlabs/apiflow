import type { MapMethod, SourceRef, UnresolvedCall } from './apimap';
import { normalizePath, toMapMethod } from './apimap';
import type { ShapeType } from './shape';
import { blankComments } from './feScanner';

export type Stack = 'laravel' | 'strapi' | 'node' | 'go' | 'python' | 'generic';

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
  receiver?: string;
  source: SourceRef;
}

export interface HandlerDef {
  name: string;
  requestSchema?: string;
  responseSchema?: string;
}

export interface BeFileScan {
  schemas: SchemaDef[];
  routes: RouteHit[];
  unresolved: UnresolvedCall[];
  // cm:why Two name-keyed indexes instead of following imports: `schemas` is already global by NAME,
  // so a handler two modules away from its mount only has to yield the NAME of the schema it
  // validates with. Measured on a real Hono API, that is the whole distance between 0 fields and the
  // request shape of every route that validates one.
  handlers?: HandlerDef[];
  // cm:why `export type Foo = z.infer<typeof fooSchema>` is how a TS+zod codebase names a shape for
  // its consumers — the route mentions the TYPE and the fields live on the schema, so without the
  // alias the response half is unreachable by name.
  aliases?: Array<{ type: string; schema: string }>;
}

export function detectStack(manifests: Record<string, string>): Stack {
  if ('artisan' in manifests || 'composer.json' in manifests) return 'laravel';
  if ('go.mod' in manifests) return 'go';
  const pkg = manifests['package.json'];
  if (pkg) return /@strapi\/strapi/.test(pkg) ? 'strapi' : 'node';
  if ('pyproject.toml' in manifests || 'requirements.txt' in manifests) return 'python';
  return 'generic';
}

// cm:why schema.json is not source but it is where Strapi declares every field of a content
// type — excluding it would leave the whole Strapi stack with routes and no shapes.
const BE_EXT = /(\.(php|[jt]sx?|mjs|cjs|go|py|rb)|content-types\/[^/]+\/schema\.json)$/;
const BE_SKIP = /(^|\/)(node_modules|vendor|dist|build|storage|__pycache__|\.git|migrations|tests?|spec)(\/|$)/;
// cm:guard A test FILE beside the code it tests, not in a tests/ directory: `src/surface.test.ts`
// held a `{ method: 'GET', path: '/nope-not-declared' }` fixture, and the route-object reader turned
// it into an endpoint the API does not serve. A fixture must never become part of the surface.
const BE_SKIP_FILE = /\.(test|spec|stories|fixture|mock)\.[jt]sx?$|(^|\/)(conftest\.py|.*_test\.go)$/;

export function isBackendFile(file: string): boolean {
  if (BE_SKIP.test(file) || BE_SKIP_FILE.test(file)) return false;
  return BE_EXT.test(file);
}

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

// cm:guard `\w*auth\w*`, not `\bauth\b`: the idioms in the wild are `dependencies.authenticate` and
// `['middleware' => 'dodgeprint_auth']`, and an exact word match calls a guarded api wide open.
const AUTH_HINT = /(\w*auth\w*|jwt|passport|requireUser|requirePermission|guard|Protected|RequireLogin|sanctum|login_required|permission_classes)/i;

// cm:guard Every extractor below returns a NORMALIZED path via normalizePath, so `:id`, `{id}`,
// `<int:id>` and `$id` all collapse to the same endpoint id the FE scanner produces.
function route(method: string, path: string, file: string, line: number, extra: Partial<RouteHit> = {}): RouteHit {
  return {
    method: toMapMethod(method),
    path: normalizePath(path),
    source: { file, line },
    ...extra,
  };
}

const LARAVEL_VERB = /Route::(get|post|put|patch|delete|options|any)\s*\(\s*(['"])([^'"]*)\2\s*,?([^;]*)/g;
// cm:guard The controller is often a STRING — `Route::apiResource('my-files', 'MyFileController')`.
// Demanding a bare class name dropped 64 of 107 resources here, a third of the api, in silence.
const LARAVEL_RESOURCE = /Route::(apiResource|resource)\s*\(\s*(['"])([^'"]*)\2\s*,\s*['"]?([\w\\]+)/g;
const LARAVEL_PREFIX = /->prefix\s*\(\s*(['"])([^'"]*)\1\s*\)|['"]prefix['"]\s*=>\s*(['"])([^'"]*)\3/g;

// cm:why Route::resource is one line that registers five endpoints. Expanding it is not a nicety —
// a Laravel map that skips it silently loses most of the API surface.
// cm:guard `update` answers on PUT *and* PATCH — Laravel registers both for one resource line, so
// emitting only PUT leaves one real endpoint per resource missing from the map.
const RESOURCE_ACTIONS: Array<[string, string, string]> = [
  ['GET', '', 'index'],
  ['POST', '', 'store'],
  ['GET', '/{id}', 'show'],
  ['PUT', '/{id}', 'update'],
  ['PATCH', '/{id}', 'update'],
  ['DELETE', '/{id}', 'destroy'],
];

// cm:guard Skips quoted strings, and cuts each header at the previous statement boundary: a fixed
// lookback window bleeds into the PRECEDING sibling group and borrows a guard that is not there.
function openBlockHeaders(content: string, upTo: number): string[] {
  const stack: string[] = [];
  let boundary = 0;
  let i = 0;
  while (i < upTo) {
    const ch = content[i];
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      while (i < upTo && content[i] !== quote) i += content[i] === '\\\\' ? 2 : 1;
      i++;
      continue;
    }
    if (ch === '/' && content[i + 1] === '/') {
      while (i < upTo && content[i] !== '\\n') i++;
      continue;
    }
    if (ch === '/' && content[i + 1] === '*') {
      i += 2;
      while (i < upTo && !(content[i] === '*' && content[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '{') {
      stack.push(content.slice(boundary, i));
      boundary = i + 1;
    } else if (ch === '}') {
      stack.pop();
      boundary = i + 1;
    } else if (ch === ';') boundary = i + 1;
    i++;
  }
  return stack;
}

// cm:why Laravel guards a whole file in one line — `Route::group(['middleware' => ['auth']], …)`
// wraps 500 routes, so a lookbehind window reports every one of them as unauthenticated.
// cm:guard Reads the middleware SLOT only: `AuthController@signIn` puts the word auth in the handler
// name, and matching that reported every login endpoint — genuinely open — as guarded.
function middlewareNames(text: string): string[] {
  const names: string[] = [];
  for (const m of text.matchAll(/['"]middleware['"]\s*=>\s*(\[[^\]]*\]|['"][^'"]*['"])/g)) {
    for (const name of m[1].matchAll(/['"]([^'"]+)['"]/g)) names.push(name[1]);
  }
  for (const m of text.matchAll(/(?:->|::)\s*middleware\s*\(\s*(\[[^\]]*\]|['"][^'"]*['"])/g)) {
    for (const name of m[1].matchAll(/['"]([^'"]+)['"]/g)) names.push(name[1]);
  }
  return names;
}

// cm:why Middleware whose job is not authentication. Anything NOT on this list and not auth-shaped is
// a gate we cannot classify, which is `undefined` — never `false`, or an unknown guard reads as open.
const NEUTRAL_MIDDLEWARE = /^(api|web|throttle|cors|bindings|cache\.headers|signed|company|localization|locale|json|log)\b/i;

function laravelGate(content: string, upTo: number, tail: string): boolean | undefined {
  const names = [...openBlockHeaders(content, upTo).flatMap(middlewareNames), ...middlewareNames(tail)];
  if (names.some((name) => AUTH_HINT.test(name))) return true;
  return names.some((name) => !NEUTRAL_MIDDLEWARE.test(name)) ? undefined : false;
}

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

// cm:guard `->only(['show'])` means THREE of the five actions do not exist. Emitting all five puts
// endpoints in the map that no request can ever reach, which is the one thing a map must not do.
// cm:guard Laravel mounts the route FILE, not the routes: `Route::prefix('api')->group(routes/api.php)`
// lives in RouteServiceProvider, so every path scanned out of that file is missing its real head.
export function laravelRouteFilePrefixes(files: Array<{ file: string; content: string }>): Map<string, string> {
  const prefixes = new Map<string, string>();

  for (const { file, content } of files) {
    if (!/RouteServiceProvider\.php$/.test(file)) continue;
    for (const statement of blankComments(content).split(';')) {
      const group = /->\s*group\s*\(\s*base_path\s*\(\s*(['"])([^'"]+)\1/.exec(statement);
      if (!group) continue;
      const prefix = /Route::\s*prefix\s*\(\s*(['"])([^'"]*)\1|->\s*prefix\s*\(\s*(['"])([^'"]*)\3/.exec(statement);
      prefixes.set(normalizeRouteFile(group[2]), prefix ? `/${(prefix[2] ?? prefix[4]).replace(/^\/+|\/+$/g, '')}` : '');
    }
  }

  // cm:why Laravel 11 moved the mount into `bootstrap/app.php` and made `api` imply the `api` prefix
  // unless `apiPrefix` says otherwise — reading only the provider misses every app on that version.
  for (const { file, content } of files) {
    if (!/bootstrap\/app\.php$/.test(file)) continue;
    const routing = /withRouting\s*\(([\s\S]*?)\)\s*(?:->|;)/.exec(blankComments(content));
    if (!routing) continue;
    const apiPrefix = /apiPrefix\s*:\s*(['"])([^'"]*)\1/.exec(routing[1]);
    for (const m of routing[1].matchAll(/(\w+)\s*:\s*[^,]*?(['"])([^'"]*routes\/[\w.-]+\.php)\2/g)) {
      const head = m[1] === 'api' ? (apiPrefix ? apiPrefix[2] : 'api') : '';
      prefixes.set(normalizeRouteFile(m[3]), head ? `/${head.replace(/^\/+|\/+$/g, '')}` : '');
    }
  }
  return prefixes;
}

function normalizeRouteFile(path: string): string {
  const match = /routes\/[\w.-]+\.php$/.exec(path.replace(/\\/g, '/'));
  return match ? match[0] : path;
}

function resourceActions(content: string, from: number): typeof RESOURCE_ACTIONS {
  const tail = content.slice(from, from + 300).split(';')[0];
  const only = /->\s*only\s*\(\s*\[([^\]]*)\]/.exec(tail);
  const except = /->\s*except\s*\(\s*\[([^\]]*)\]/.exec(tail);
  const listed = (m: RegExpExecArray) => new Set([...m[1].matchAll(/['"](\w+)['"]/g)].map((x) => x[1]));
  if (only) {
    const keep = listed(only);
    return RESOURCE_ACTIONS.filter(([, , action]) => keep.has(action));
  }
  if (except) {
    const drop = listed(except);
    return RESOURCE_ACTIONS.filter(([, , action]) => !drop.has(action));
  }
  return RESOURCE_ACTIONS;
}

function scanLaravel(file: string, raw: string): BeFileScan {
  const out: BeFileScan = { schemas: [], routes: [], unresolved: [] };
  const isRouteFile = /(^|\/)routes\//.test(file);
  // cm:guard A commented-out route is not a route: `// Route::post('/x', …)` was landing in the map
  // as a live endpoint, and `#` is a PHP line comment that the shared blanker does not know.
  const content = isRouteFile ? blankComments(raw).replace(/#[^\n]*/g, (m) => ' '.repeat(m.length)) : raw;

  if (isRouteFile) {
    for (const m of content.matchAll(LARAVEL_VERB)) {
      const prefix = laravelPrefix(content, m.index);
      const tail = m[4] ?? '';
      const handler = /\[\s*([\w\\]+)::class\s*,\s*(['"])(\w+)\2/.exec(tail);
      out.routes.push(
        route(m[1] === 'any' ? 'UNKNOWN' : m[1], `${prefix}/${m[3]}`, file, lineOf(content, m.index), {
          handler: handler ? `${handler[1].split('\\').pop()}@${handler[3]}` : undefined,
          auth: laravelGate(content, m.index, tail),
        })
      );
    }
    for (const m of content.matchAll(LARAVEL_RESOURCE)) {
      const prefix = laravelPrefix(content, m.index);
      const controller = m[4].split('\\').pop() as string;
      const guarded = laravelGate(content, m.index, content.slice(m.index, m.index + 400).split(';')[0]);
      for (const [verb, suffix, action] of resourceActions(content, m.index + m[0].length)) {
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

const STRAPI_ROUTE = /\{[^{}]*?\bmethod\s*:\s*(['"`])(GET|POST|PUT|PATCH|DELETE)\1[^{}]*?\bpath\s*:\s*(['"`])([^'"`]+)\3([\s\S]{0,200}?)\}/g;

// cm:why A route declared as DATA is not a Strapi peculiarity: a manifest of `{ method, path }`
// literals is how a codebase makes its surface reviewable in one file. Measured on a real Hono API,
// every mount is `.get(declared(SPEC), h)` with no literal at the call site, so the verb-call readers
// found 2 of 107 routes — the other 105 were sitting in a plain exported array all along.
// cm:guard Requires the path to start with `/`, unlike the Strapi form: this runs over every .ts file
// in a backend repo, and `{ method: 'POST', path: 'upload' }` in an SDK call config is not a route.
const ROUTE_OBJECT = /\{[^{}]*?\bmethod\s*:\s*(['"`])(GET|POST|PUT|PATCH|DELETE)\1[^{}]*?\bpath\s*:\s*(['"`])(\/[^'"`]*)\3/g;

// cm:why `.get(declared(HEALTH), h)` names its path through a const, which is the shape a repo lands
// on as soon as the path has to be shared between the mount and its own auth declaration. Reading the
// const in the same file recovers the mount SITE, which is better evidence than the manifest entry:
// it is where the route is actually served, and its line carries the middleware.
const SPEC_CONST = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{[^{}]*?\bmethod\s*:\s*(['"`])(GET|POST|PUT|PATCH|DELETE)\2[^{}]*?\bpath\s*:\s*(['"`])(\/[^'"`]*)\4/g;
const SPEC_MOUNT = /\.\s*(get|post|put|patch|delete|options|all)\s*\(\s*(?:[A-Za-z_$][\w$]*\s*\(\s*)?([A-Z][A-Z0-9_]{2,})\b/g;

// cm:why A DECLARED protection beats the name heuristic every time. This API states the gate on all
// 107 routes — 7 deliberately public, 100 not — and AUTH_HINT read `middlewareFor(SPEC.protection)`
// as nothing, so 95 fully guarded routes would have been reported as "no auth gate found". A false
// alarm on that particular number is worse than silence: it is the one an operator acts on.
// cm:guard Only `public`-shaped words clear the gate. An unrecognised kind counts as GUARDED, so a
// vocabulary this does not know cannot manufacture an open endpoint.
const PROTECTION_KIND = /\b(?:protection|auth|authorization|authorize|access)\s*:\s*\{[^{}]*?\b(?:kind|type|mode)\s*:\s*(['"`])(\w+)\1/;
const PUBLIC_KIND = /^(public|none|anonymous|open|unauthenticated|guest)$/i;

function declaredGate(block: string): boolean | undefined {
  const m = PROTECTION_KIND.exec(block);
  if (m === null) return undefined;
  return !PUBLIC_KIND.test(m[2]);
}
const STRAPI_CORE_ROUTER = /createCoreRouter\s*\(\s*(['"`])api::([\w-]+)\.([\w-]+)\1/g;

// cm:why Strapi declares routes as data, not calls — a `{method, path, handler}` object literal.
// No verb-call pattern matches it, which is why a generic scan finds almost nothing here.
function scanStrapi(file: string, content: string): BeFileScan {
  const out: BeFileScan = { schemas: [], routes: [], unresolved: [] };

  if (/content-types\/[^/]+\/schema\.json$/.test(file)) {
    try {
      const parsed = JSON.parse(content) as {
        info?: { singularName?: string; pluralName?: string };
        attributes?: Record<string, { type?: string; required?: boolean }>;
      };
      const name = parsed.info?.singularName;
      const attributes = parsed.attributes ?? {};
      if (name && Object.keys(attributes).length > 0) {
        out.schemas.push({
          name,
          source: { file, line: 1 },
          fields: Object.entries(attributes).map(([path, spec]) => ({
            path,
            type: strapiType(spec.type),
            optional: !spec.required,
          })),
        });
      }
    } catch {
      out.unresolved.push({ source: { file, line: 1 }, reason: 'content-type schema is not valid JSON', snippet: '' });
    }
    return out;
  }

  const apiName = /(?:^|\/)src\/api\/([\w-]+)\/routes\//.exec(file)?.[1];
  const collection = apiName ? `/${pluralize(apiName)}` : null;

  for (const m of content.matchAll(STRAPI_ROUTE)) {
    // cm:guard Read auth from THIS route object only. A fixed-size lookahead spills into the next
    // entry in the routes array and marks the previous route public whenever the next one is.
    const handler = /\bhandler\s*:\s*(['"`])([\w.-]+)\1/.exec(m[0]);
    // cm:guard Only the CRUD-shaped paths inherit the folder's content type. A custom route like
    // /agents/me/permissions/check returns something else entirely, and guessing there is worse
    const path = normalizePath(m[4]);
    const isCrud = collection !== null && (path === collection || path === `${collection}/{param}`);
    const schema = isCrud ? (apiName as string) : undefined;
    // cm:why Strapi routes are authenticated BY DEFAULT; only `auth: false` opens one up.
    const open = /\bauth\s*:\s*false/.test(m[0]);
    out.routes.push(
      route(m[2], m[4], file, lineOf(content, m.index), {
        handler: handler?.[2],
        auth: !open,
        responseSchema: m[2] === 'DELETE' ? undefined : schema,
        requestSchema: m[2] === 'POST' || m[2] === 'PUT' || m[2] === 'PATCH' ? schema : undefined,
      })
    );
  }

  for (const m of content.matchAll(STRAPI_CORE_ROUTER)) {
    const singular = m[3];
    const plural = pluralize(singular);
    for (const [verb, suffix] of [['GET', ''], ['POST', ''], ['GET', '/{id}'], ['PUT', '/{id}'], ['DELETE', '/{id}']] as const) {
      out.routes.push(
        route(verb, `/${plural}${suffix}`, file, lineOf(content, m.index), {
          handler: `${singular}.core`,
          auth: true,
          responseSchema: singular,
          requestSchema: verb === 'POST' || verb === 'PUT' ? singular : undefined,
        })
      );
    }
  }
  return out;
}

function pluralize(name: string): string {
  if (/[^aeiou]y$/.test(name)) return `${name.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(name)) return `${name}es`;
  return `${name}s`;
}

function strapiType(type: string | undefined): ShapeType {
  switch (type) {
    case 'string': case 'text': case 'richtext': case 'email': case 'uid':
    case 'enumeration': case 'date': case 'datetime': case 'time': case 'password':
      return 'string';
    case 'integer': case 'biginteger': case 'float': case 'decimal':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'component': case 'dynamiczone': case 'relation': case 'media':
      return 'object';
    case 'json':
      return 'unknown';
    default:
      return 'unknown';
  }
}

const NEST_CONTROLLER = /@Controller\s*\(\s*(['"`])?([^'"`)]*)\1?\s*\)/;
const NEST_METHOD = /@(Get|Post|Put|Patch|Delete|Options)\s*\(\s*(?:(['"`])([^'"`]*)\2)?\s*\)[\s\S]{0,600}?\b(\w+)\s*\(/g;
// cm:guard The path must start with `/`: dropping that lets `cache.get("user")` and every other
// Map/Redis read register as an HTTP route, and the receiver is needed to find its mount prefix.
const EXPRESS_ROUTE = /\b(\w+)\s*\.\s*(get|post|put|patch|delete|options|all)\s*\(\s*(['"`])(\/[^'"`]*)\3\s*,([^)]*)/g;
const EXPRESS_MOUNT = /\.\s*use\s*\(\s*(['"`])(\/[^'"`]*)\1\s*,\s*(\w+)/g;
const ZOD_INFER = /export\s+type\s+(\w+)\s*=\s*z\s*\.\s*infer\s*<\s*typeof\s+(\w+)\s*>/g;

// cm:guard Brace-balanced and quote-aware, not a regex terminator. `z.object({ a: z.string() })`
// written on ONE line has no `\n})` to stop at, so the old pattern ran on to the next multi-line
// close and swallowed the schema after it: in one real contracts file the first schema absorbed the
// second, and the second vanished from the index entirely.
function balancedFrom(src: string, open: number): { body: string; end: number } {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote !== null) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') {
      depth--;
      if (depth === 0) return { body: src.slice(open + 1, i), end: i };
    }
  }
  return { body: src.slice(open + 1), end: src.length };
}

// cm:why Only DEPTH-ZERO keys are fields of this schema. A nested `z.object({...})` describes a
// child shape, and lifting its keys into the parent invents fields the endpoint never has at top level.
function zodFields(body: string): SchemaField[] {
  const out: SchemaField[] = [];
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quote !== null) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{' || c === '(' || c === '[') { depth++; continue; }
    if (c === '}' || c === ')' || c === ']') { depth--; continue; }
    if (depth !== 0) continue;
    const key = /^([A-Za-z_$][\w$]*)\s*:/.exec(body.slice(i));
    if (key === null || (i > 0 && /[\w$.]/.test(body[i - 1]))) continue;

    // cm:guard The field's text ends at ITS OWN top-level comma. A fixed-width window ran past it and
    // read the NEXT field's `.optional()`, so a required field was reported optional — which is the
    // wrong direction: it tells a caller a field may be absent when the API always sends it.
    let j = i + key[0].length;
    let inner = 0;
    let q: string | null = null;
    for (; j < body.length; j++) {
      const d = body[j];
      if (q !== null) {
        if (d === '\\') { j++; continue; }
        if (d === q) q = null;
        continue;
      }
      if (d === "'" || d === '"' || d === '`') { q = d; continue; }
      if (d === '{' || d === '(' || d === '[') inner++;
      else if (d === '}' || d === ')' || d === ']') inner--;
      else if (d === ',' && inner === 0) break;
    }
    const text = body.slice(i + key[0].length, j);
    const type = /^\s*z\s*\.\s*(\w+)/.exec(text);
    out.push({
      path: key[1],
      type: zodType(type?.[1] ?? 'unknown'),
      optional: /\.\s*(optional|nullish|default)\s*\(/.test(text),
    });
    i = j;
  }
  return out;
}

const ZOD_HEAD = /(?:const|let|var)\s+(\w+)\s*=\s*z\s*\.\s*(object|strictObject|looseObject|discriminatedUnion|union)\s*\(/g;

// cm:why A discriminated union IS one response shape with branches. Taking the union of the members'
// keys, and marking a key optional unless every member has it, is the honest reading — reporting
// nothing would hide the whole endpoint, and reporting one branch would claim fields that may not come.
function zodSchemas(file: string, content: string): SchemaDef[] {
  const out: SchemaDef[] = [];
  for (const m of content.matchAll(ZOD_HEAD)) {
    const openParen = m.index + m[0].length - 1;
    const { body } = balancedFrom(content, openParen);
    const source = { file, line: lineOf(content, m.index) };
    if (m[2] === 'object' || m[2] === 'strictObject' || m[2] === 'looseObject') {
      const brace = body.indexOf('{');
      if (brace === -1) continue;
      const fields = zodFields(balancedFrom(body, brace).body);
      if (fields.length > 0) out.push({ name: m[1], fields, source });
      continue;
    }
    const members: SchemaField[][] = [];
    for (let i = 0; i < body.length; i++) {
      const at = /^z\s*\.\s*(?:object|strictObject|looseObject)\s*\(\s*\{/.exec(body.slice(i));
      if (at === null) continue;
      const brace = body.indexOf('{', i);
      const inner = balancedFrom(body, brace);
      members.push(zodFields(inner.body));
      i = inner.end;
    }
    if (members.length === 0) continue;
    const merged = new Map<string, SchemaField>();
    for (const member of members) {
      for (const f of member) {
        const prior = merged.get(f.path);
        merged.set(f.path, prior === undefined ? { ...f } : { ...prior, optional: prior.optional || f.optional });
      }
    }
    for (const [path, f] of merged) {
      if (!members.every((member) => member.some((x) => x.path === path))) f.optional = true;
    }
    if (merged.size > 0) out.push({ name: m[1], fields: [...merged.values()], source });
  }
  return out;
}
// cm:guard Anchored on `export const NAME =` and bounded to the next top-level `export`, so one
// handler's validator cannot be read as the next handler's.
const HANDLER_DEF = /export\s+const\s+(\w+)\s*=\s*([\s\S]*?)(?=\nexport\s|$)/g;
const VALIDATOR_ARG = /\b(?:zValidator|validator|validate)\s*\(\s*(['"`])\w+\1\s*,\s*(\w+)/;
const SCHEMA_PARSE = /\b(\w+)\s*\.\s*(?:parse|safeParse|parseAsync)\s*\(/;
// cm:why Three ways a handler names its response shape, all same-file: an explicit annotation on a
// helper it calls, `satisfies T`, and `c.json<T>`. Following an import to find a fourth would buy
// little — a codebase that annotates at all annotates in one of these.
const TYPED_RETURN = /function\s+(\w+)\s*\([\s\S]{0,600}?\)\s*:\s*([A-Z]\w*)\s*\{/g;
const SATISFIES_TYPE = /\bsatisfies\s+([A-Z]\w*)|\.\s*json\s*<\s*([A-Z]\w*)\s*>/;

function handlerDefs(content: string): HandlerDef[] {
  const returns = new Map<string, string>();
  for (const m of content.matchAll(TYPED_RETURN)) returns.set(m[1], m[2]);
  const out: HandlerDef[] = [];
  for (const m of content.matchAll(HANDLER_DEF)) {
    const block = m[2];
    const request = VALIDATOR_ARG.exec(block)?.[2] ?? SCHEMA_PARSE.exec(block)?.[1];
    const direct = SATISFIES_TYPE.exec(block);
    let response = direct?.[1] ?? direct?.[2];
    if (response === undefined) {
      for (const [fn, type] of returns) {
        if (new RegExp(`\\b${fn}\\s*\\(`).test(block)) { response = type; break; }
      }
    }
    if (request !== undefined || response !== undefined) out.push({ name: m[1], requestSchema: request, responseSchema: response });
  }
  return out;
}
const CLASS_VALIDATOR = /class\s+(\w+)\s*\{([\s\S]*?)\n\}/g;

function scanNode(file: string, content: string): BeFileScan {
  const out: BeFileScan = { schemas: [], routes: [], unresolved: [], handlers: handlerDefs(content), aliases: [] };
  for (const m of content.matchAll(ZOD_INFER)) out.aliases?.push({ type: m[1], schema: m[2] });

  out.schemas.push(...zodSchemas(file, content));

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

  // cm:edge protocol -> ROUTE_OBJECT · SPEC_CONST — both may name the same route, and that is fine:
  // endpoint ids are derived from METHOD + normalized path, so the two collapse into one endpoint and
  // the mount site wins the source line by being pushed second.
  for (const m of content.matchAll(ROUTE_OBJECT)) {
    const block = content.slice(m.index, m.index + 400);
    out.routes.push(route(m[2], m[4], file, lineOf(content, m.index), {
      auth: declaredGate(block) ?? (AUTH_HINT.test(block) || undefined),
    }));
  }

  const specs = new Map<string, { method: string; path: string; gate?: boolean }>();
  for (const m of content.matchAll(SPEC_CONST)) {
    specs.set(m[1], { method: m[3], path: m[5], gate: declaredGate(content.slice(m.index, m.index + 600)) });
  }
  for (const m of content.matchAll(SPEC_MOUNT)) {
    const spec = specs.get(m[2]);
    if (spec === undefined) continue;
    const line = content.slice(m.index, m.index + 300);
    // cm:why The handler SYMBOL is the only link from the mount to the module that validates the
    // request — `...patchPolicyRoute` names a file two directories away, and the schema index is
    // keyed by name, so the symbol is enough and no import has to be resolved.
    const handler = /\)\s*,\s*(?:\.\.\.)?([a-z_$][\w$]*)/.exec(line)?.[1];
    // cm:guard The verb at the mount wins over the verb in the const: `.post(declared(X))` where X
    // says GET is a real mismatch, and reporting the const would hide the route that is served.
    out.routes.push(route(m[1].toUpperCase(), spec.path, file, lineOf(content, m.index), {
      auth: spec.gate ?? (AUTH_HINT.test(line) || undefined),
      handler,
    }));
  }

  const mounts = new Map<string, string>();
  for (const m of content.matchAll(EXPRESS_MOUNT)) mounts.set(m[3], m[2]);

  // cm:why Express guards a whole router in one line — `router.use(deps.authenticate)` sits above
  // every route in the file, so reading only each route's own arguments misses all of them.
  const guarded = new Set<string>();
  for (const m of content.matchAll(/\b(\w+)\s*\.\s*use\s*\(\s*(?!['"`])([^)]*)\)/g)) {
    if (AUTH_HINT.test(m[2])) guarded.add(m[1]);
  }

  for (const m of content.matchAll(EXPRESS_ROUTE)) {
    const tail = m[5] ?? '';
    const block = content.slice(m.index, m.index + 900);
    const schema = /(\w+)\s*\.\s*(?:parse|safeParse)\s*\(/.exec(block);
    out.routes.push(
      route(m[2] === 'all' ? 'UNKNOWN' : m[2], m[4], file, lineOf(content, m.index), {
        auth: AUTH_HINT.test(tail) || guarded.has(m[1]),
        requestSchema: schema?.[1],
        receiver: m[1],
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
    strapi: scanStrapi,
    node: scanNode,
    go: scanGo,
    python: scanPython,
    generic: scanGeneric,
  };
  const primary = /\.php$/.test(file) ? scanLaravel
    : /\.(go)$/.test(file) ? scanGo
    : /\.py$/.test(file) ? scanPython
    : stack === 'strapi' ? scanStrapi
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
