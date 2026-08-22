import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { parseMap } from '@junixlabs/apiflow-map';
import type { MapKind } from './store';
import { historyOf, projectDir } from './store';

export interface MapSeries {
  endpoints: number[];
  screens: number[];
  calls: number[];
  unresolved: number[];
}

// cm:guard Cached by absolute path forever, with no invalidation, and that is SAFE only because a
// history file is named by the hash of its own content — the same path can never hold new bytes.
// cm:edge contract -> src/workspace/store.ts writeMap() — it is what names history by content hash.
interface Counts {
  endpoints: number;
  screens: number;
  calls: number;
  unresolved: number;
  ids: Set<string>;
}
const counted = new Map<string, Counts>();

function countsOf(file: string): Counts {
  const hit = counted.get(file);
  if (hit !== undefined) return hit;
  const map = parseMap(readFileSync(file, 'utf8'));
  const value = {
    endpoints: map.endpoints.length,
    screens: map.screens.length,
    calls: map.calls.length,
    unresolved: map.unresolved.length,
    ids: new Set(map.endpoints.map((e) => e.id)),
  };
  counted.set(file, value);
  return value;
}

export interface EndpointHistory {
  scans: Array<{ at: string }>;
  first: Record<string, number>;
}

// cm:why Sends only the endpoints that appeared LATER than the first stored scan. Every other
// endpoint has been there the whole time, and shipping 1092 identical "since scan 1" entries to the
// browser costs 60KB to say nothing.
// cm:guard Dates come from the file's mtime, never from inside the map: a .apimap carries no
// timestamp on purpose, so that re-scanning an unchanged repo produces identical bytes.
export function endpointHistory(id: string, kind: MapKind, limit = 12): EndpointHistory | null {
  const dir = join(projectDir(id), 'history');
  const files = historyOf(id, kind).slice(-limit);
  if (files.length < 2) return null;
  const scans: Array<{ at: string }> = [];
  const first: Record<string, number> = {};
  files.forEach((file, index) => {
    const full = join(dir, file);
    scans.push({ at: statSync(full).mtime.toISOString() });
    for (const endpointId of countsOf(full).ids) {
      if (!(endpointId in first)) first[endpointId] = index;
    }
  });
  for (const key of Object.keys(first)) if (first[key] === 0) delete first[key];
  return { scans, first };
}

// cm:why Returns null below three points instead of a two-point series: two dots joined by a straight
// line is not a trend, and a sparkline is read as one whether or not the data supports it.
export function mapSeries(id: string, kind: MapKind, limit = 12): MapSeries | null {
  const dir = join(projectDir(id), 'history');
  const files = historyOf(id, kind).slice(-limit);
  if (files.length < 3) return null;
  const out: MapSeries = { endpoints: [], screens: [], calls: [], unresolved: [] };
  for (const file of files) {
    const c = countsOf(join(dir, file));
    out.endpoints.push(c.endpoints);
    out.screens.push(c.screens);
    out.calls.push(c.calls);
    out.unresolved.push(c.unresolved);
  }
  return out;
}
