// cm:why Declares its own verb set rather than reusing a client library's: those unions leave out
// OPTIONS, while the Laravel and Express scanners both match `options`.
export const MAP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'UNKNOWN'] as const;
import { arr, bool, enumOf, type Infer, literal, num, obj, opt, parseWith, str } from './schema';
import { SHAPE_TYPES } from './shape';

export type MapMethod = (typeof MAP_METHODS)[number];

// cm:guard Checked, never a cast: `Route::any(...)` and `router.all(...)` name a verb this map cannot
// pin down, and `as MapMethod` let that through as a value the type says cannot exist.
export function toMapMethod(raw: string): MapMethod {
  const upper = raw.trim().toUpperCase();
  return (MAP_METHODS as readonly string[]).includes(upper) ? (upper as MapMethod) : 'UNKNOWN';
}

// cm:why Three levels, not a boolean: a generic scanner resolves most call sites only partly, and
// a map that cannot say how sure it is gets trusted for coverage it does not have.
export const CONFIDENCE_VALUES = ['exact', 'inferred', 'guess'] as const;
export type Confidence = (typeof CONFIDENCE_VALUES)[number];

// cm:guard This module's wire-format types are all `Infer<typeof ...Schema>`, never a hand-written
// interface — a shape and its validator drawn from two places is exactly the gap this file used to have.
export const sourceRefSchema = obj({ file: str(), line: num() });
export type SourceRef = Infer<typeof sourceRefSchema>;

// cm:why symbol/member ride with label so a caller-hop can re-attribute this call later: label is
// for humans, but the hop needs the exact symbol and object member it came from.
export const screenNodeSchema = obj({
  id: str(),
  label: str(),
  route: opt(str()),
  source: sourceRefSchema,
  symbol: opt(str()),
  member: opt(str()),
  viaHops: opt(num()),
});
export type ScreenNode = Infer<typeof screenNodeSchema>;

export const endpointNodeSchema = obj({
  id: str(),
  method: enumOf(MAP_METHODS),
  path: str(),
  baseUrlVar: opt(str()),
  source: opt(sourceRefSchema),
  handler: opt(str()),
  auth: opt(bool()),
  probed: opt(bool()),
  // cm:why Set only by `link`, and only on a pair it actually matched — `handler` looked like the
  // same signal but an inline arrow route has none, so it read every Express endpoint as unlinked.
  linked: opt(literal(true)),
});
export type EndpointNode = Infer<typeof endpointNodeSchema>;

export const FIELD_KIND_VALUES = ['request', 'response'] as const;
export type FieldKind = (typeof FIELD_KIND_VALUES)[number];

// cm:why Independent booleans, not an enum: declared-without-observed means the code lies, and
// observed-without-any-read means payload nobody consumes. Both need the flags to coexist.
export const fieldNodeSchema = obj({
  id: str(),
  endpointId: str(),
  path: str(),
  kind: enumOf(FIELD_KIND_VALUES),
  type: opt(enumOf(SHAPE_TYPES)),
  nullable: opt(bool()),
  optional: opt(bool()),
  declared: opt(bool()),
  observed: opt(bool()),
  declaredAs: opt(str()),
  // cm:edge contract -> packages/scan/src/shape.ts#isDictionary — set only on a `{key}` path, and it
  // holds how many keys collapsed into it: "a keyed collection this wide", not "a field".
  keys: opt(num()),
  source: opt(sourceRefSchema),
});
export type FieldNode = Infer<typeof fieldNodeSchema>;

const CHAIN_ROLE_VALUES = ['client', 'hook', 'component', 'module', 'screen'] as const;

// cm:guard `precise` is computed by `expandChains`, never stored — the schema below covers only
// what a `chainNodes` table entry has ON DISK; ChainNode adds `precise` back for in-memory callers.
const storedChainNodeSchema = obj({ file: str(), symbol: str(), line: num(), role: enumOf(CHAIN_ROLE_VALUES) });
export type ChainNode = Infer<typeof storedChainNodeSchema> & { precise: boolean };

const callEdgeShape = {
  screenId: str(),
  endpointId: str(),
  via: str(),
  confidence: enumOf(CONFIDENCE_VALUES),
  source: sourceRefSchema,
};

// cm:why The PATH, not its length: "3 hop" cannot be read, while
// `api client -> useUpdateUser -> UserEditForm -> /user/:id` can. Optional, so older maps stay v1.
export type CallEdge = Infer<ReturnType<typeof obj<typeof callEdgeShape>>> & { chain?: ChainNode[] };

// cm:guard On-disk shape ONLY. Every layer above works with `chain` inline; indices exist so a file
// path is written once instead of once per call, and `link` never has to renumber anything.
const storedCallEdgeSchema = obj({
  ...callEdgeShape,
  chain: opt(arr(num())),
  impreciseFrom: opt(num()),
});
type StoredCallEdge = Infer<typeof storedCallEdgeSchema>;

export const readEdgeSchema = obj({
  screenId: str(),
  fieldId: str(),
  confidence: enumOf(CONFIDENCE_VALUES),
  source: sourceRefSchema,
});
export type ReadEdge = Infer<typeof readEdgeSchema>;

export const unresolvedCallSchema = obj({ source: sourceRefSchema, reason: str(), snippet: str() });
export type UnresolvedCall = Infer<typeof unresolvedCallSchema>;

// cm:guard `version` is `literal(1)`, so a bad or future version fails HERE with the value it saw —
// see SPEC.md "Version policy" for what changing this number is allowed to mean.
const storedApiMapFileSchema = obj({
  version: literal(1),
  // cm:why No generatedAt: a timestamp would change every scan and defeat the byte-identical
  // guarantee below. Git already records when the map was written.
  metadata: obj({ name: str(), root: str(), generator: str() }),
  screens: arr(screenNodeSchema),
  endpoints: arr(endpointNodeSchema),
  fields: arr(fieldNodeSchema),
  calls: arr(storedCallEdgeSchema),
  reads: arr(readEdgeSchema),
  unresolved: arr(unresolvedCallSchema),
  chainNodes: opt(arr(storedChainNodeSchema)),
});
type StoredApiMapFile = Infer<typeof storedApiMapFileSchema>;

export type ApiMapFile = Omit<StoredApiMapFile, 'calls' | 'chainNodes'> & { calls: CallEdge[] };

// cm:guard Ids below derive from content, never a counter or timestamp — re-scanning an unchanged
// repo must emit a byte-identical .apimap, else every scan is a whole-file git diff.
export function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function endpointId(method: MapMethod, path: string): string {
  return `ep_${slug(`${method}-${path}`)}`;
}

export function screenId(route: string | undefined, file: string, symbol: string): string {
  return `sc_${slug(route ?? `${file}-${symbol}`)}`;
}

// cm:guard 'response' must keep producing the pre-BE id shape — a FE read and a BE declaration of
// the same field have to collide on one node, or the two maps never join.
export function fieldId(endpoint: string, path: string, kind: FieldKind = 'response'): string {
  return kind === 'response' ? `fl_${endpoint}_${slug(path)}` : `fq_${endpoint}_${slug(path)}`;
}

// cm:guard Brace-counted, not `[^}]*` — `${fmt({a:1})}` closes on the INNER brace and leaves a fake
// `/${fmt(` endpoint; a trailing `${…}` after a non-`/` is a query string and drops out entirely.
export function stripInterpolations(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '$' && input[i + 1] === '{') {
      let depth = 0;
      let j = i + 1;
      for (; j < input.length; j++) {
        if (input[j] === '{') depth++;
        else if (input[j] === '}' && --depth === 0) break;
      }
      out += j >= input.length - 1 && out.at(-1) !== '/' ? '' : '{param}';
      i = j;
      continue;
    }
    out += input[i];
  }
  return out;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// cm:guard Collapsing `/users/42` and `/users/43` onto one endpoint is what makes the map answer
// "which screen breaks"; keeping them apart would spray one endpoint across hundreds of nodes.
export function normalizePath(raw: string): string {
  let p = raw.trim();
  p = p.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '');
  // cm:guard An optional route param carries a `?` INSIDE the braces — `{country_code?}` — so it has
  // to become a param before the query string is cut, or the cut eats its closing brace.
  p = p.replace(/\{[^{}]*\?\}/g, '{param}');
  p = p.replace(/[?#].*$/, '');
  p = stripInterpolations(p);
  p = p.replace(/'\s*\+\s*[^+]+\s*\+\s*'/g, '{param}');
  if (!p.startsWith('/')) p = `/${p}`;
  p = p
    .split('/')
    .map((seg) => {
      if (!seg) return seg;
      if (seg.startsWith(':')) return '{param}';
      if (/^\{[^}]*\}$/.test(seg)) return '{param}';
      if (/^\d+$/.test(seg)) return '{param}';
      if (UUID.test(seg)) return '{param}';
      return seg;
    })
    .join('/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  // cm:guard Never returns '': `Route::get('/')` under an empty prefix collapses to `//`, and an
  // empty path breaks every id, every suffix match and every lookup that assumes a leading slash.
  return p.replace(/\/{2,}/g, '/') || '/';
}

export function createApiMap(name: string, root: string, generator: string): ApiMapFile {
  return {
    version: 1,
    metadata: { name, root, generator },
    screens: [],
    endpoints: [],
    fields: [],
    calls: [],
    reads: [],
    unresolved: [],
  };
}

// cm:why Two readers know different halves: a route manifest has the path and the gate, the mount
// site has the handler — and the handler carries the schema. Keeping the first left 72 of 106 bare.
// cm:guard `auth` resolves true > false > undefined. On disagreement the artefact claims the endpoint
// IS gated: this is the "no auth gate found" alarm, and an invented open endpoint is the acted-on error.
function mergeEndpoint(into: EndpointNode, from: EndpointNode): EndpointNode {
  const gated = into.auth === true || from.auth === true ? true : into.auth ?? from.auth;
  return {
    ...into,
    handler: into.handler ?? from.handler,
    auth: gated,
    baseUrlVar: into.baseUrlVar ?? from.baseUrlVar,
    probed: into.probed || from.probed,
    // cm:why The mount site wins the source line: it is where the route is served, and a reader that
    // recovered the handler is by construction looking at the mount rather than at the declaration.
    source: into.handler !== undefined ? into.source : from.handler !== undefined ? from.source : into.source,
  };
}

function byId<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) if (!seen.has(item.id)) seen.set(item.id, item);
  return [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function mergedById<T extends { id: string }>(items: T[], merge: (a: T, b: T) => T): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const prior = seen.get(item.id);
    seen.set(item.id, prior === undefined ? item : merge(prior, item));
  }
  return [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function edgeKey(e: CallEdge | ReadEdge): string {
  const target = 'endpointId' in e ? e.endpointId : e.fieldId;
  return `${e.screenId}|${target}|${e.source.file}:${e.source.line}`;
}

// cm:guard Determinism gate for the whole file — dedupe then sort on every list. Callers append in
// filesystem-walk order, which differs between machines.
export function finalizeApiMap(map: ApiMapFile): ApiMapFile {
  const dedupeEdges = <T extends CallEdge | ReadEdge>(edges: T[]): T[] => {
    const seen = new Map<string, T>();
    for (const e of edges) if (!seen.has(edgeKey(e))) seen.set(edgeKey(e), e);
    return [...seen.values()].sort((a, b) => edgeKey(a).localeCompare(edgeKey(b)));
  };
  return {
    ...map,
    screens: byId(map.screens),
    endpoints: mergedById(map.endpoints, mergeEndpoint),
    fields: byId(map.fields),
    calls: dedupeEdges(map.calls),
    reads: dedupeEdges(map.reads),
    unresolved: [...map.unresolved].sort((a, b) =>
      `${a.source.file}:${a.source.line}`.localeCompare(`${b.source.file}:${b.source.line}`)
    ),
  };
}

// cm:why Two gaps counted as one number and labelled as the first: on a real Laravel API, 881 of 900
// "unresolved" were known paths with no schema found. One list (format is v1), two counts.
// cm:edge lockstep -> packages/cli/src/view/hub.ts — anything printing an unresolved COUNT prints the
// two separately or says which one it means.
// cm:edge lockstep -> packages/cli/src/view/app.ts — same count, same rule.
// cm:edge lockstep -> packages/cli/src/mcp/mapTools.ts — same count, same rule.
export function unresolvedKinds(map: ApiMapFile): { paths: number; schemas: number } {
  let schemas = 0;
  for (const u of map.unresolved) if (/no request or response schema/.test(u.reason)) schemas++;
  return { paths: map.unresolved.length - schemas, schemas };
}

export type Side = 'fe' | 'be';

// cm:why Which half a map is comes from the generator string, not the file name: the same map is read
// from ~/.apiflow, from --out and from another machine, and only one of those carries a chosen name.
// cm:edge contract -> packages/cli/src/commands/scanFe.ts — writes `apiflow scan-fe/N`; a generator
// string that stops matching makes every map sideless.
// cm:edge contract -> packages/cli/src/commands/scanBe.ts — writes `apiflow scan-be/N`, same rule.
export function sideOf(map: ApiMapFile): Side | null {
  if (map.metadata.generator.includes('scan-fe')) return 'fe';
  if (map.metadata.generator.includes('scan-be')) return 'be';
  return null;
}

export interface ImpactAnswer {
  endpoint: EndpointNode | null;
  screens: Array<{ screen: ScreenNode; confidence: Confidence; source: SourceRef; chain?: ChainNode[]; callSites: number; inheritedFrom?: string; hops?: number }>;
}

// cm:why One number decides whether the reconciliation is worth showing. On a real Hono API
// (2026-08-20) the reader understood 2 of 103 routes, so the map falsely accused 88 endpoints.
// cm:why Not a tuned threshold: if the accusation would cover MORE endpoints than the API declares,
// the untrustworthy half is the reader — so those are unpaired (not compared), not FE-only (wrong).
// cm:edge lockstep -> packages/map/src/summary.ts — decides the same four buckets.
// cm:edge lockstep -> packages/map/src/alerts.ts — decides the same four buckets.
// cm:edge lockstep -> packages/cli/src/view/panes.ts#reconOf — re-implements this because a browser
// pane cannot import node code, so a change here is a change in four places.
export function bePartial(map: ApiMapFile): boolean {
  const called = new Set(map.calls.map((c) => c.endpointId));
  let declared = 0;
  let undeclaredCalled = 0;
  for (const e of map.endpoints) {
    if (e.source !== undefined) declared++;
    else if (called.has(e.id)) undeclaredCalled++;
  }
  return declared > 0 && undeclaredCalled > declared;
}

// cm:guard One entry per SCREEN, never per call: the headline is "N screen(s) break", so calling from
// two places read as twice the blast radius — 10 reported screens were 3. `callSites` keeps the rest.
// cm:why Keeps the STRONGEST confidence of the group: one exact call site is proof, and a guess
// sibling downgrading it would understate what is known.
// cm:why Read off the file name, not a stored flag, so older maps answer without a re-scan.
// `route`/`layout` wrap children; `index`/`page` are leaves that merely share the route string.
const LAYOUT_FILE = /(?:^|\/)(?:route|layout|_layout|\+layout)\.(?:tsx?|jsx?|vue|svelte|astro)$/;

const isDescendantRoute = (child: string, parent: string): boolean =>
  child !== parent && child.startsWith(parent === '/' ? '/' : `${parent}/`);

// cm:guard A layout's call belongs to every screen inside it. Without this `GET /auth/me`, gating 25
// of 27 screens, reported ONE — and an under-reporting impact answer is the unsafe kind.
function layoutDescendants(map: ApiMapFile): Map<string, ScreenNode[]> {
  const routed = map.screens.filter((s) => s.route !== undefined);
  const out = new Map<string, ScreenNode[]>();
  for (const parent of routed) {
    if (!LAYOUT_FILE.test(parent.source.file)) continue;
    const kids = routed.filter((c) => c.id !== parent.id && isDescendantRoute(c.route as string, parent.route as string));
    if (kids.length > 0) out.set(parent.id, kids);
  }
  return out;
}

export function screensAffectedByEndpoint(map: ApiMapFile, id: string): ImpactAnswer {
  const endpoint = map.endpoints.find((e) => e.id === id) ?? null;
  const rank: Record<Confidence, number> = { exact: 0, inferred: 1, guess: 2 };
  const byScreen = new Map<string, ImpactAnswer['screens'][number]>();
  for (const c of map.calls) {
    if (c.endpointId !== id) continue;
    const screen = map.screens.find((s) => s.id === c.screenId);
    if (screen === undefined) continue;
    const seen = byScreen.get(screen.id);
    if (seen === undefined) {
      byScreen.set(screen.id, { screen, confidence: c.confidence, source: c.source, chain: c.chain, callSites: 1 });
      continue;
    }
    seen.callSites += 1;
    if (rank[c.confidence] < rank[seen.confidence]) {
      seen.confidence = c.confidence;
      seen.source = c.source;
      seen.chain = c.chain;
    }
  }
  // cm:guard Inherited rows never overwrite a direct one: a screen that calls the endpoint itself
  // keeps its own call site as the evidence, and its own callSites count.
  for (const [parentId, kids] of layoutDescendants(map)) {
    const parent = byScreen.get(parentId);
    if (parent === undefined) continue;
    for (const kid of kids) {
      if (byScreen.has(kid.id)) continue;
      // cm:guard Carries the LAYOUT's hop count, not the child's: the chain on this row is the
      // layout's chain, and the child's own `viaHops` describes a different path entirely.
      byScreen.set(kid.id, { ...parent, screen: kid, inheritedFrom: parent.screen.route, hops: parent.screen.viaHops });
    }
  }
  return { endpoint, screens: [...byScreen.values()] };
}

export function screensAffectedByField(map: ApiMapFile, id: string): ImpactAnswer {
  const field = map.fields.find((f) => f.id === id);
  if (!field) return { endpoint: null, screens: [] };
  const direct = map.reads
    .filter((r) => r.fieldId === id)
    .map((r) => ({
      screen: map.screens.find((s) => s.id === r.screenId),
      confidence: r.confidence,
      source: r.source,
      callSites: 1,
    }))
    .flatMap((x) => (x.screen === undefined ? [] : [{ ...x, screen: x.screen }]));
  // cm:why A screen that calls the endpoint but has no traced read still breaks when the field
  // changes shape — reporting only traced reads would understate the blast radius.
  const viaEndpoint = screensAffectedByEndpoint(map, field.endpointId).screens.map((s) => ({
    ...s,
    confidence: 'guess' as Confidence,
  }));
  const merged = new Map<string, ImpactAnswer['screens'][number]>();
  for (const s of [...direct, ...viaEndpoint]) if (!merged.has(s.screen.id)) merged.set(s.screen.id, s);
  return {
    endpoint: map.endpoints.find((e) => e.id === field.endpointId) ?? null,
    screens: [...merged.values()],
  };
}

function mergeField(into: FieldNode, from: FieldNode): FieldNode {
  return {
    ...into,
    type: into.type ?? from.type,
    nullable: into.nullable || from.nullable,
    optional: into.optional || from.optional,
    declared: into.declared || from.declared,
    observed: into.observed || from.observed,
    source: into.source ?? from.source,
  };
}

// cm:guard The join is by endpoint id (METHOD + normalized path), so the two halves collide only
// when both normalize to the same string — matchEndpointBySuffix covers the prefix mismatch.
export function linkMaps(fe: ApiMapFile, be: ApiMapFile, name: string): ApiMapFile {
  const rewrite = new Map<string, string>();
  const linked = new Set<string>();
  for (const beEndpoint of be.endpoints) {
    const direct = fe.endpoints.find((e) => e.id === beEndpoint.id);
    if (direct) {
      linked.add(beEndpoint.id);
      continue;
    }
    const suffix = matchEndpointBySuffix(fe.endpoints, beEndpoint);
    if (suffix) {
      rewrite.set(suffix.id, beEndpoint.id);
      linked.add(beEndpoint.id);
    }
  }

  const remapId = (id: string): string => rewrite.get(id) ?? id;
  const remapField = (f: FieldNode): FieldNode => {
    const endpointId = remapId(f.endpointId);
    return { ...f, endpointId, id: fieldId(endpointId, f.path, f.kind) };
  };

  const merged = createApiMap(name, `${fe.metadata.root} + ${be.metadata.root}`, 'apiflow link/1');
  merged.screens.push(...fe.screens, ...be.screens);
  merged.endpoints.push(
    ...be.endpoints.map((e) => (linked.has(e.id) ? { ...e, linked: true as const } : e)),
    ...fe.endpoints.filter((e) => !rewrite.has(e.id) && !be.endpoints.some((b) => b.id === e.id))
  );
  merged.calls.push(...fe.calls.map((c) => ({ ...c, endpointId: remapId(c.endpointId) })), ...be.calls);

  const fieldsById = new Map<string, FieldNode>();
  for (const f of [...be.fields, ...fe.fields.map(remapField)]) {
    const existing = fieldsById.get(f.id);
    fieldsById.set(f.id, existing ? mergeField(existing, f) : f);
  }
  merged.fields.push(...fieldsById.values());

  const readRemap = new Map<string, string>();
  for (const f of fe.fields) readRemap.set(f.id, remapField(f).id);
  merged.reads.push(
    ...fe.reads.map((r) => ({ ...r, fieldId: readRemap.get(r.fieldId) ?? r.fieldId })),
    ...be.reads
  );
  merged.unresolved.push(...fe.unresolved, ...be.unresolved);
  return finalizeApiMap(merged);
}

// cm:why A frontend behind a gateway calls `/api/v2/users` while the service mounts `/users` —
// same endpoint, different id. Requiring one match and equal methods keeps GET and DELETE apart.
export function matchEndpointBySuffix(candidates: EndpointNode[], target: EndpointNode): EndpointNode | null {
  const matches = candidates.filter(
    (c) =>
      c.method === target.method &&
      c.id !== target.id &&
      (c.path.endsWith(target.path) || target.path.endsWith(c.path))
  );
  if (matches.length !== 1) return null;
  return matches[0];
}

export interface FieldAudit {
  endpoint: EndpointNode;
  field: FieldNode;
  readers: ScreenNode[];
}

// cm:why The question nobody could ask before the two halves joined: the backend serializes it,
// the tests confirm it goes over the wire, and no screen ever touches it.
export function endpointsWithTracedReads(map: ApiMapFile): Set<string> {
  const byField = new Map(map.fields.map((f) => [f.id, f.endpointId]));
  const out = new Set<string>();
  for (const read of map.reads) {
    const endpointId = byField.get(read.fieldId);
    if (endpointId) out.add(endpointId);
  }
  return out;
}

// cm:guard Only endpoints where the frontend side actually traced a read can support this claim.
// A typed client hides its fields in TS types, so "no screen reads it" there means "not analysed".
// cm:guard Kinship both ways: reading `keys` covers `keys.createdAt` (the subtree left the scan's
// sight), and reading `key.id` covers `key` (a parent is read whenever a child of it is).
export function unreadResponseFields(map: ApiMapFile): FieldAudit[] {
  const analysable = endpointsWithTracedReads(map);
  const readPaths = new Map<string, Set<string>>();
  for (const read of map.reads) {
    const field = map.fields.find((f) => f.id === read.fieldId);
    if (!field) continue;
    const paths = readPaths.get(field.endpointId) ?? new Set<string>();
    paths.add(field.path);
    readPaths.set(field.endpointId, paths);
  }

  const out: FieldAudit[] = [];
  for (const field of map.fields) {
    if (field.kind !== 'response') continue;
    if (!field.declared && !field.observed) continue;
    if (!analysable.has(field.endpointId)) continue;
    if (map.reads.some((r) => r.fieldId === field.id)) continue;
    const covered = [...(readPaths.get(field.endpointId) ?? [])].some(
      (p) => field.path.startsWith(`${p}.`) || p.startsWith(`${field.path}.`)
    );
    if (covered) continue;
    const endpoint = map.endpoints.find((e) => e.id === field.endpointId);
    if (endpoint) out.push({ endpoint, field, readers: [] });
  }
  return out;
}

// cm:why declared-but-never-observed is the failure the user asked to catch: the DTO promises a
// field the running code does not send. Only meaningful on an endpoint a probe actually reached.
export function undeliveredFields(map: ApiMapFile): FieldAudit[] {
  const probed = new Set(map.endpoints.filter((e) => e.probed).map((e) => e.id));
  return map.fields
    .filter((f) => f.kind === 'response' && f.declared && !f.observed && probed.has(f.endpointId))
    .map((field) => ({
      endpoint: map.endpoints.find((e) => e.id === field.endpointId) as EndpointNode,
      field,
      readers: map.reads
        .filter((r) => r.fieldId === field.id)
        .map((r) => map.screens.find((s) => s.id === r.screenId))
        .filter((s): s is ScreenNode => !!s),
    }));
}

// cm:guard Only endpoints the backend scan actually saw (`source`) can be orphans — an endpoint
// known solely from a frontend call has no server side to be dead, and would always list as one.
export function orphanEndpoints(map: ApiMapFile): EndpointNode[] {
  return map.endpoints.filter((e) => e.source && !map.calls.some((c) => c.endpointId === e.id));
}

export interface ScreenDependency {
  inheritedFrom?: string;
  endpoint: EndpointNode;
  confidence: Confidence;
  source: SourceRef;
  viaHops?: number;
}

// cm:why The reverse direction is the same evidence read the other way — "what does this screen eat" is the
// question a newcomer to a large FE asks, and it needs no new data, only this query.
export function endpointsForScreen(map: ApiMapFile, screenId: string): ScreenDependency[] {
  const byId = new Map(map.endpoints.map((e) => [e.id, e]));
  const screen = map.screens.find((s) => s.id === screenId);
  const out: ScreenDependency[] = [];
  for (const call of map.calls) {
    if (call.screenId !== screenId) continue;
    const endpoint = byId.get(call.endpointId);
    if (endpoint === undefined) continue;
    out.push({ endpoint, confidence: call.confidence, source: call.source, viaHops: screen?.viaHops });
  }
  // cm:edge lockstep -> packages/map/src/apimap.ts#screensAffectedByEndpoint — an endpoint a layout
  // calls must appear in its children's list too, or `impact` and `screen_deps` disagree on one pair.
  if (screen?.route !== undefined) {
    const own = new Set(out.map((d) => d.endpoint.id));
    for (const [parentId, kids] of layoutDescendants(map)) {
      if (!kids.some((k) => k.id === screenId)) continue;
      const parent = map.screens.find((s) => s.id === parentId);
      for (const call of map.calls) {
        if (call.screenId !== parentId) continue;
        const endpoint = byId.get(call.endpointId);
        if (endpoint === undefined || own.has(endpoint.id)) continue;
        own.add(endpoint.id);
        out.push({ endpoint, confidence: call.confidence, source: call.source, viaHops: parent?.viaHops, inheritedFrom: parent?.route });
      }
    }
  }
  return out.sort((a, b) =>
    a.endpoint.path.localeCompare(b.endpoint.path) || a.endpoint.method.localeCompare(b.endpoint.method)
  );
}

// cm:guard Matches by ROUTE, so every screen node carrying that route is included — one route can be
// reached through more than one module, and answering for only the first would understate the answer.
export function screenIdsForRoute(map: ApiMapFile, route: string): string[] {
  return map.screens.filter((s) => s.route === route).map((s) => s.id);
}

type ChainKey = string;

const chainKey = (n: ChainNode): ChainKey => `${n.file}|${n.symbol}|${String(n.line)}|${n.role}`;

// cm:why Interned at WRITE time, expanded at READ time, so nothing between sees an index. Chains
// repeat file paths 52% of the time on a real map: inlining cost 159% growth, interning 70%.
// cm:edge lockstep -> packages/map/src/apimap.ts#expandChains — the pair must round-trip, and a test asserts it does.
export function serializeMap(map: ApiMapFile): string {
  const table: ChainNode[] = [];
  const index = new Map<ChainKey, number>();
  const intern = (node: ChainNode): number => {
    const key = chainKey(node);
    const known = index.get(key);
    if (known !== undefined) return known;
    index.set(key, table.length);
    table.push({ file: node.file, symbol: node.symbol, line: node.line, role: node.role, precise: true });
    return table.length - 1;
  };

  const calls: StoredCallEdge[] = map.calls.map((call) => {
    const { chain, ...rest } = call;
    if (chain === undefined || chain.length === 0) return rest;
    const stored: StoredCallEdge = { ...rest, chain: chain.map(intern) };
    const lost = chain.findIndex((n) => !n.precise);
    if (lost >= 0) stored.impreciseFrom = lost;
    return stored;
  });

  const body: Record<string, unknown> = { ...map, calls };
  // cm:guard Emitted only when non-empty: a map with no chains must serialize byte-for-byte the way
  // it did before this field existed, or every stored map looks changed the first time it is rewritten.
  if (table.length > 0) body.chainNodes = table.map((n) => ({ file: n.file, symbol: n.symbol, line: n.line, role: n.role }));
  return `${JSON.stringify(body, null, 2)}\n`;
}

// cm:guard A `chain` index without a `chainNodes` table is dropped rather than trusted —
// `serializeMap` only ever emits one alongside the other, so this pair is malformed input.
// cm:guard An index out of range for the table throws instead of spreading `table[i]` as
// `undefined` — a schema check on `number` cannot see the table's length, only this can.
export function expandChains(map: StoredApiMapFile): ApiMapFile {
  const table = map.chainNodes;
  const calls: CallEdge[] = map.calls.map((call, callIndex) => {
    const { chain, impreciseFrom, ...rest } = call;
    if (chain === undefined || table === undefined) return rest;
    return {
      ...rest,
      chain: chain.map((i, position) => {
        const node = table[i];
        if (node === undefined) {
          throw new Error(
            `.apimap.calls[${String(callIndex)}].chain[${String(position)}]: index ${String(i)} is out of range for chainNodes (length ${String(table.length)})`,
          );
        }
        return { ...node, precise: impreciseFrom === undefined ? true : position < impreciseFrom };
      }),
    };
  });
  const { chainNodes: _drop, ...withoutTable } = map;
  return { ...withoutTable, calls };
}

// cm:why The whole document is validated before expansion: a `chain` index into a missing
// `chainNodes` table is a shape error, and reporting it as one here beats a bad index reaching a query.
export function parseMap(text: string): ApiMapFile {
  const raw: unknown = JSON.parse(text);
  const stored = parseWith(storedApiMapFileSchema, raw, '.apimap');
  return expandChains(stored);
}
