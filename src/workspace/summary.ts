import type { ApiMapFile, Confidence } from '../core/apimap';

export interface ProjectSummary {
  endpoints: number;
  screens: number;
  calls: number;
  fields: number;
  unresolved: number;
  auth: number;
  open: number;
  murky: number;
  both: number;
  uncalled: number;
  feOnly: number;
  confidence: Record<Confidence, number>;
}

// cm:edge contract -> src/cli/viewGraph.ts — the browser pane re-implements these three states as
// `stateOf` because it cannot import node code; the two must keep agreeing on what a colour means.
export function endpointState(map: ApiMapFile, endpointId: string): 'both' | 'uncalled' | 'feOnly' {
  const endpoint = map.endpoints.find((e) => e.id === endpointId);
  if (!endpoint?.source) return 'feOnly';
  return map.calls.some((c) => c.endpointId === endpointId) ? 'both' : 'uncalled';
}

export function summarize(map: ApiMapFile): ProjectSummary {
  const confidence: Record<Confidence, number> = { exact: 0, inferred: 0, guess: 0 };
  for (const call of map.calls) confidence[call.confidence]++;

  const called = new Set(map.calls.map((c) => c.endpointId));
  let both = 0;
  let uncalled = 0;
  let feOnly = 0;
  for (const e of map.endpoints) {
    if (!e.source) feOnly++;
    else if (called.has(e.id)) both++;
    else uncalled++;
  }

  return {
    endpoints: map.endpoints.length,
    screens: map.screens.length,
    calls: map.calls.length,
    fields: map.fields.length,
    unresolved: map.unresolved.length,
    auth: map.endpoints.filter((e) => e.auth === true).length,
    open: map.endpoints.filter((e) => e.auth === false).length,
    murky: map.endpoints.filter((e) => e.auth === undefined).length,
    both,
    uncalled,
    feOnly,
    confidence,
  };
}
