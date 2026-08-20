// cm:why Declares its own verb set instead of borrowing HttpMethod from the request-runner side:
// that union has no OPTIONS, while the Laravel and Express scanners both match `options`.
export const MAP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'UNKNOWN'] as const;
import type { ShapeType } from './shape';

export type MapMethod = (typeof MAP_METHODS)[number];

// cm:guard Checked, never a cast: `Route::any(...)` and `router.all(...)` name a verb this map cannot
// pin down, and `as MapMethod` let that through as a value the type says cannot exist.
export function toMapMethod(raw: string): MapMethod {
  const upper = raw.trim().toUpperCase();
  return (MAP_METHODS as readonly string[]).includes(upper) ? (upper as MapMethod) : 'UNKNOWN';
}

// cm:why Three levels, not a boolean: a generic scanner resolves most call sites only partly, and
// a map that cannot say how sure it is gets trusted for coverage it does not have.
export type Confidence = 'exact' | 'inferred' | 'guess';

export interface SourceRef {
  file: string;
  line: number;
}

export interface ScreenNode {
  id: string;
  label: string;
  route?: string;
  source: SourceRef;
  // cm:why Kept alongside label so the caller-hop can re-attribute this call later: label is for
  // humans, but the hop needs the exact symbol and object member it came from.
  symbol?: string;
  member?: string;
  viaHops?: number;
}

export interface EndpointNode {
  id: string;
  method: MapMethod;
  path: string;
  baseUrlVar?: string;
  source?: SourceRef;
  handler?: string;
  auth?: boolean;
  probed?: boolean;
  // cm:why Set only by `link`, and only on a pair it actually matched — `handler` looked like the
  // same signal but an inline arrow route has none, so it read every Express endpoint as unlinked.
  linked?: true;
}

export type FieldKind = 'request' | 'response';

// cm:why Independent booleans, not an enum: declared-without-observed means the code lies, and
// observed-without-any-read means payload nobody consumes. Both need the flags to coexist.
export interface FieldNode {
  id: string;
  endpointId: string;
  path: string;
  kind: FieldKind;
  type?: ShapeType;
  nullable?: boolean;
  optional?: boolean;
  declared?: boolean;
  observed?: boolean;
  declaredAs?: string;
  source?: SourceRef;
}

export interface ChainNode {
  file: string;
  symbol: string;
  line: number;
  role: 'client' | 'hook' | 'component' | 'module' | 'screen';
  precise: boolean;
}

export interface CallEdge {
  screenId: string;
  endpointId: string;
  via: string;
  confidence: Confidence;
  source: SourceRef;
  // cm:why The PATH, not just its length: "3 hop" cannot be read, while
  // `api client -> useUpdateUser -> UserEditForm -> /user/:id` is the answer someone can act on.
  // Optional so a map written before this field stays valid at version 1.
  chain?: ChainNode[];
}

// cm:guard On-disk shape ONLY. Every layer above works with `chain` inline; indices exist so a file
// path is written once instead of once per call, and `link` never has to renumber anything.
interface StoredCallEdge extends Omit<CallEdge, 'chain'> {
  chain?: number[];
  impreciseFrom?: number;
}

export interface ReadEdge {
  screenId: string;
  fieldId: string;
  confidence: Confidence;
  source: SourceRef;
}

export interface UnresolvedCall {
  source: SourceRef;
  reason: string;
  snippet: string;
}

export interface ApiMapFile {
  version: 1;
  // cm:why No generatedAt: a timestamp would change every scan and defeat the byte-identical
  // guarantee below. Git already records when the map was written.
  metadata: {
    name: string;
    root: string;
    generator: string;
  };
  screens: ScreenNode[];
  endpoints: EndpointNode[];
  fields: FieldNode[];
  calls: CallEdge[];
  reads: ReadEdge[];
  unresolved: UnresolvedCall[];
}

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

function byId<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) if (!seen.has(item.id)) seen.set(item.id, item);
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
    endpoints: byId(map.endpoints),
    fields: byId(map.fields),
    calls: dedupeEdges(map.calls),
    reads: dedupeEdges(map.reads),
    unresolved: [...map.unresolved].sort((a, b) =>
      `${a.source.file}:${a.source.line}`.localeCompare(`${b.source.file}:${b.source.line}`)
    ),
  };
}

export interface ImpactAnswer {
  endpoint: EndpointNode | null;
  screens: Array<{ screen: ScreenNode; confidence: Confidence; source: SourceRef; chain?: ChainNode[] }>;
}

// cm:why One number decides whether the reconciliation is worth showing at all. Measured on a real
// Hono API (2026-08-20): the reader understood 2 of 103 routes because every mount site is
// `.get(declared(SPEC), h)` with no literal path, and the map then reported 88 endpoints the API
// "does not declare" — a defect invented out of a gap in the reader. Not a tuned threshold: if the
// accusation would cover MORE endpoints than the API declares in total, the untrustworthy half is
// the reader, so those endpoints are unpaired (not compared), not FE-only (compared and wrong).
// cm:edge lockstep -> src/workspace/summary.ts · src/workspace/alerts.ts · src/view/panes.ts reconOf
// — all four decide the same four buckets; the browser pane re-implements this because it cannot
// import node code, so a change here is a change in four places.
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

export function screensAffectedByEndpoint(map: ApiMapFile, id: string): ImpactAnswer {
  const endpoint = map.endpoints.find((e) => e.id === id) ?? null;
  const screens = map.calls
    .filter((c) => c.endpointId === id)
    .map((c) => ({
      screen: map.screens.find((s) => s.id === c.screenId),
      confidence: c.confidence,
      source: c.source,
      chain: c.chain,
    }))
    .flatMap((x) => (x.screen === undefined ? [] : [{ ...x, screen: x.screen }]));
  return { endpoint, screens };
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
    }))
    .filter((x): x is { screen: ScreenNode; confidence: Confidence; source: SourceRef } => !!x.screen);
  // cm:why A screen that calls the endpoint but has no traced read still breaks when the field
  // changes shape — reporting only traced reads would understate the blast radius.
  const viaEndpoint = screensAffectedByEndpoint(map, field.endpointId).screens.map((s) => ({
    ...s,
    confidence: 'guess' as Confidence,
  }));
  const merged = new Map<string, { screen: ScreenNode; confidence: Confidence; source: SourceRef }>();
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
  endpoint: EndpointNode;
  confidence: Confidence;
  source: SourceRef;
  viaHops?: number;
}

// cm:why The reverse direction is the same evidence read the other way — "màn này ăn API nào" is the
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

// cm:why Interned at WRITE time and expanded at READ time, so nothing between the two ever sees an
// index. Node chains repeat their file paths 52% of the time on a real map (adminhub-ui) — inlining
// them cost 159% file growth, interning brings it to 70%.
// cm:edge lockstep -> expandChains — the pair must round-trip, and a test asserts it does.
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

export function expandChains(raw: unknown): ApiMapFile {
  const map = raw as Omit<ApiMapFile, 'calls'> & { chainNodes?: ChainNode[]; calls: StoredCallEdge[] };
  const table = map.chainNodes;
  if (table === undefined) return map as unknown as ApiMapFile;
  const calls: CallEdge[] = map.calls.map((call) => {
    const { chain, impreciseFrom, ...rest } = call;
    if (chain === undefined) return rest;
    return {
      ...rest,
      chain: chain.map((i, position) => ({
        ...table[i],
        precise: impreciseFrom === undefined ? true : position < impreciseFrom,
      })),
    };
  });
  const { chainNodes: _drop, ...withoutTable } = map;
  return { ...withoutTable, calls } as ApiMapFile;
}

export function parseMap(text: string): ApiMapFile {
  const map = expandChains(JSON.parse(text));
  if (map.version !== 1) throw new Error(`unsupported .apimap version: ${String(map.version)}`);
  return map;
}
