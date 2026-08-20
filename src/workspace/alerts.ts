import type { ApiMapFile, Confidence, MapMethod, SourceRef } from '../core/apimap';

export type AlertKind = 'method-mismatch' | 'fe-only-path' | 'open-auth' | 'uncalled' | 'murky-auth';

export type Severity = 'high' | 'medium' | 'low';

export interface Alert {
  kind: AlertKind;
  severity: Severity;
  endpointId: string;
  method: MapMethod;
  path: string;
  detail: string;
  bestConfidence?: Confidence;
  screens: string[];
  evidence: SourceRef[];
}

const RANK: Record<Confidence, number> = { exact: 0, inferred: 1, guess: 2 };

// cm:why An alert is what the tool UNDERSTOOD and finds dangerous; Unresolved is what it could not
// understand at all. Two different actions, so they are never counted together.
// cm:edge contract -> src/view/hub.ts — the count shown next to "Alerts" comes from alertCounts here.
export function alerts(map: ApiMapFile): Alert[] {
  const hasBe = map.endpoints.some((e) => e.source !== undefined);
  const hasFe = map.calls.length > 0;

  const declaredMethods = new Map<string, Set<MapMethod>>();
  for (const e of map.endpoints) {
    if (e.source === undefined) continue;
    const set = declaredMethods.get(e.path) ?? new Set<MapMethod>();
    set.add(e.method);
    declaredMethods.set(e.path, set);
  }

  const routeOf = new Map(map.screens.map((s) => [s.id, s.route]));
  const callsOf = new Map<string, typeof map.calls>();
  for (const call of map.calls) {
    const list = callsOf.get(call.endpointId) ?? [];
    list.push(call);
    callsOf.set(call.endpointId, list);
  }

  const context = (id: string) => {
    const calls = callsOf.get(id) ?? [];
    const best = calls.length === 0
      ? undefined
      : calls.reduce<Confidence>((acc, c) => (RANK[c.confidence] < RANK[acc] ? c.confidence : acc), 'guess');
    const screens = [...new Set(calls.map((c) => routeOf.get(c.screenId)).filter((r): r is string => r !== undefined))].sort();
    return { calls, best, screens, evidence: calls.map((c) => c.source) };
  };

  // cm:guard A guess-confidence mismatch is not a high-severity finding: the path itself was inferred
  // from a concatenation, so the "mismatch" may be an artefact of this tool, not a defect in the code.
  const bySignal = (best: Confidence | undefined): Severity =>
    best === 'exact' ? 'high' : best === 'inferred' ? 'medium' : 'low';

  const out: Alert[] = [];
  for (const e of map.endpoints) {
    const ctx = context(e.id);
    const base = { endpointId: e.id, method: e.method, path: e.path, screens: ctx.screens, evidence: ctx.evidence, bestConfidence: ctx.best };

    if (e.source === undefined && hasBe) {
      const declared = declaredMethods.get(e.path);
      if (declared !== undefined) {
        out.push({
          ...base,
          kind: 'method-mismatch',
          severity: bySignal(ctx.best),
          detail: `FE gọi ${e.method} nhưng API chỉ khai ${[...declared].sort().join(', ')} trên đường dẫn này`,
        });
      } else {
        out.push({
          ...base,
          kind: 'fe-only-path',
          severity: bySignal(ctx.best),
          detail: 'FE gọi đường dẫn này nhưng API không khai đường dẫn nào như vậy',
        });
      }
      continue;
    }

    if (e.source === undefined) continue;

    if (e.auth === false) {
      out.push({ ...base, kind: 'open-auth', severity: 'high', detail: 'Không thấy cổng chặn nào trong code' });
    } else if (e.auth === undefined) {
      out.push({ ...base, kind: 'murky-auth', severity: 'low', detail: 'Có cổng nhưng không phân loại được' });
    }

    if (hasFe && ctx.calls.length === 0) {
      out.push({ ...base, kind: 'uncalled', severity: 'low', detail: 'API khai nhưng không màn nào gọi' });
    }
  }

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) =>
    order[a.severity] - order[b.severity] || a.kind.localeCompare(b.kind) || a.path.localeCompare(b.path) || a.method.localeCompare(b.method)
  );
}

export function alertCounts(list: Alert[]): { total: number; high: number; byKind: Record<AlertKind, number> } {
  const byKind = { 'method-mismatch': 0, 'fe-only-path': 0, 'open-auth': 0, uncalled: 0, 'murky-auth': 0 };
  for (const a of list) byKind[a.kind]++;
  return { total: list.length, high: list.filter((a) => a.severity === 'high').length, byKind };
}
