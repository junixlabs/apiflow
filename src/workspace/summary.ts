import type { ApiMapFile, Confidence } from '../core/apimap';
import { bePartial } from '../core/apimap';

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
  unpaired: number;
  hasFe: boolean;
  hasBe: boolean;
  confidence: Record<Confidence, number>;
}

export type EndpointState = 'both' | 'uncalled' | 'feOnly' | 'unpaired';

// cm:guard Never says feOnly on a map with no backend side, nor uncalled on one with no frontend
// side: on a FE-only scan EVERY endpoint lacks a `source`, and calling that "API không khai" turns
// a missing half of the scan into a fabricated finding about the API.
// cm:edge contract -> src/view/panes.ts — the browser pane re-implements this as `reconOf`
// because it cannot import node code; the two must keep agreeing on what a colour means.
export function endpointState(map: ApiMapFile, endpointId: string): EndpointState {
  const hasBe = map.endpoints.some((e) => e.source !== undefined) && !bePartial(map);
  const hasFe = map.calls.length > 0;
  const endpoint = map.endpoints.find((e) => e.id === endpointId);
  const called = map.calls.some((c) => c.endpointId === endpointId);
  if (endpoint?.source === undefined) return hasBe ? 'feOnly' : 'unpaired';
  if (called) return 'both';
  return hasFe ? 'uncalled' : 'unpaired';
}

export function summarize(map: ApiMapFile): ProjectSummary {
  const confidence: Record<Confidence, number> = { exact: 0, inferred: 0, guess: 0 };
  for (const call of map.calls) confidence[call.confidence]++;

  const called = new Set(map.calls.map((c) => c.endpointId));
  // cm:guard hasBe here means "the BE half is complete enough to compare against", not "a BE map
  // exists" — that is what keeps a thin BE scan out of the feOnly column and out of the KPI strip.
  const hasBe = map.endpoints.some((e) => e.source !== undefined) && !bePartial(map);
  const hasFe = map.calls.length > 0;
  let both = 0;
  let uncalled = 0;
  let feOnly = 0;
  let unpaired = 0;
  for (const e of map.endpoints) {
    if (e.source === undefined) {
      if (hasBe) feOnly++;
      else unpaired++;
    } else if (called.has(e.id)) both++;
    else if (hasFe) uncalled++;
    else unpaired++;
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
    unpaired,
    hasFe,
    hasBe,
    confidence,
  };
}

export interface Reliability {
  exact: number;
  inferred: number;
  guess: number;
  calls: number;
}

// cm:guard Distribution of EVIDENCE, never a health score. One call at `exact` is not stronger than
// twenty calls at 90% exact, so `calls` travels with the split and any reader must show both.
// cm:edge contract -> src/view/panes.ts — the per-row micro-bar renders exactly this split.
export function endpointReliability(map: ApiMapFile): Map<string, Reliability> {
  const out = new Map<string, Reliability>();
  for (const call of map.calls) {
    const row = out.get(call.endpointId) ?? { exact: 0, inferred: 0, guess: 0, calls: 0 };
    row[call.confidence]++;
    row.calls++;
    out.set(call.endpointId, row);
  }
  return out;
}
