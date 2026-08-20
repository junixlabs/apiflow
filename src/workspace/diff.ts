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
  const coverage = at - bt;
  const trust = share(a.exact + a.inferred, at) - share(b.exact + b.inferred, bt);

  if (coverage > 0 && trust < -1) return 'Phủ rộng hơn, nhưng chắc chắn kém đi.';
  if (coverage > 0 && trust > 1) return 'Phủ rộng hơn và chắc chắn hơn.';
  if (coverage < 0 && trust > 1) return 'Phủ hẹp hơn, phần còn lại chắc hơn.';
  if (coverage < 0) return 'Phủ hẹp hơn.';
  if (Math.abs(trust) <= 1 && coverage === 0) return 'Không thay đổi đáng kể.';
  return trust < 0 ? 'Chắc chắn kém đi.' : 'Chắc chắn hơn.';
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
      const label = (v: boolean | undefined) => (v === true ? 'có auth' : v === false ? 'không auth' : 'không rõ');
      notes.push(`cổng auth: ${label(old.auth)} → ${label(e.auth)}`);
    }
    if ((old.source === undefined) !== (e.source === undefined)) {
      notes.push(e.source === undefined ? 'API không còn khai' : 'API bắt đầu khai');
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
