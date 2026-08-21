import type { ApiMapFile, Confidence, MapMethod } from '../core/apimap';

export interface EndpointChange {
  method: MapMethod;
  path: string;
  detail?: string;
  screens?: string[];
}

export interface MapDiff {
  endpoints: { added: EndpointChange[]; removed: EndpointChange[]; changed: EndpointChange[] };
  calls: { before: number; after: number };
  confidence: { before: Record<Confidence, number>; after: Record<Confidence, number> };
  unresolved: { before: number; after: number };
  screens: { before: number; after: number };
  headline: string;
}

const key = (method: MapMethod, path: string) => `${method} ${path}`;

function split(map: ApiMapFile): Record<Confidence, number> {
  const out: Record<Confidence, number> = { exact: 0, inferred: 0, guess: 0 };
  for (const c of map.calls) out[c.confidence]++;
  return out;
}

const share = (n: number, total: number) => (total === 0 ? 0 : (n / total) * 100);

// cm:why The headline is computed, not left to the reader: a dashboard is read as "bigger number =
// better", so a scan that saw more while knowing less has to say so in words before showing the count.
export function headlineFor(before: ApiMapFile, after: ApiMapFile): string {
  const b = split(before);
  const a = split(after);
  const bt = before.calls.length;
  const at = after.calls.length;

  // cm:why A BE map has no calls, so every one of them came out as "No meaningful change" — printed
  // directly under "the map has drifted from the code", which is a contradiction the reader has to
  // resolve alone. The BE analogue of coverage is endpoints, and of certainty, endpoints that carry a
  // declared shape.
  if (bt === 0 && at === 0) {
    const shaped = (m: ApiMapFile) => new Set(m.fields.map((f) => f.endpointId)).size;
    const cov = after.endpoints.length - before.endpoints.length;
    const trust = share(shaped(after), after.endpoints.length) - share(shaped(before), before.endpoints.length);
    if (cov > 0 && trust > 1) return 'More endpoints and more of them have a declared shape.';
    if (cov > 0) return 'More endpoints read.';
    if (cov < 0) return 'Fewer endpoints read.';
    if (trust > 1) return 'Same endpoints, more of them have a declared shape.';
    if (trust < -1) return 'Same endpoints, fewer of them have a declared shape.';
    return 'No meaningful change.';
  }
  const coverage = at - bt;
  const trust = share(a.exact + a.inferred, at) - share(b.exact + b.inferred, bt);

  if (coverage > 0 && trust < -1) return 'Wider coverage, weaker certainty.';
  if (coverage > 0 && trust > 1) return 'Wider coverage and more certainty.';
  // cm:guard Flat trust with more coverage is NOT "more certainty" — the old fallthrough said that
  // on a scan where every confidence share moved 0.0pp, and the panel under it showed the zeros.
  if (coverage > 0) return 'Wider coverage, certainty about the same.';
  if (coverage < 0 && trust > 1) return 'Narrower coverage, what is left is firmer.';
  if (coverage < 0) return 'Narrower coverage.';
  if (Math.abs(trust) <= 1) return 'No meaningful change.';
  return trust < 0 ? 'Weaker certainty.' : 'More certainty.';
}

export function diffMaps(before: ApiMapFile, after: ApiMapFile): MapDiff {
  const bIndex = new Map(before.endpoints.map((e) => [key(e.method, e.path), e]));
  const aIndex = new Map(after.endpoints.map((e) => [key(e.method, e.path), e]));

  const screensOf = (map: ApiMapFile, endpointId: string): string[] => {
    const routes = new Map(map.screens.map((s) => [s.id, s.route]));
    return [...new Set(
      map.calls.filter((c) => c.endpointId === endpointId)
        .map((c) => routes.get(c.screenId))
        .filter((r): r is string => r !== undefined)
    )].sort();
  };

  const added: EndpointChange[] = [];
  const removed: EndpointChange[] = [];
  const changed: EndpointChange[] = [];

  for (const [k, e] of aIndex) {
    if (!bIndex.has(k)) {
      added.push({ method: e.method, path: e.path, screens: screensOf(after, e.id) });
      continue;
    }
    const old = bIndex.get(k) as typeof e;
    const notes: string[] = [];
    if (old.auth !== e.auth) {
      const label = (v: boolean | undefined) => (v === true ? 'auth' : v === false ? 'no auth' : 'unknown');
      notes.push(`auth gate: ${label(old.auth)} → ${label(e.auth)}`);
    }
    if ((old.source === undefined) !== (e.source === undefined)) {
      notes.push(e.source === undefined ? 'the API stopped declaring it' : 'the API started declaring it');
    }
    if (notes.length > 0) changed.push({ method: e.method, path: e.path, detail: notes.join(' · '), screens: screensOf(after, e.id) });
  }
  for (const [k, e] of bIndex) {
    if (!aIndex.has(k)) removed.push({ method: e.method, path: e.path, screens: screensOf(before, e.id) });
  }

  const byPath = (x: EndpointChange, y: EndpointChange) => x.path.localeCompare(y.path) || x.method.localeCompare(y.method);

  return {
    endpoints: { added: added.sort(byPath), removed: removed.sort(byPath), changed: changed.sort(byPath) },
    calls: { before: before.calls.length, after: after.calls.length },
    confidence: { before: split(before), after: split(after) },
    unresolved: { before: before.unresolved.length, after: after.unresolved.length },
    screens: { before: before.screens.length, after: after.screens.length },
    headline: headlineFor(before, after),
  };
}
