import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';
import type { ApiMapFile, Side } from '../core/apimap';
import { parseMap, sideOf } from '../core/apimap';
import { writeMap } from './store';

export interface ImportedMap {
  kind: Side;
  file: string;
  from: string;
  root: string;
  generator: string;
  endpoints: number;
  screens: number;
  calls: number;
}

// cm:why The whole point of a content-derived, timestamp-free .apimap is that it survives leaving the
// machine that made it. A BE that lives on another device is scanned there and the FILE travels —
// there is nothing to host, because `link` joins the two halves by endpoint id, not by network.
// cm:guard Refuses a map of the wrong half. Dropping an fe map into the be slot makes the
// reconciliation compare a side against itself and report every endpoint as agreeing.
export function readImportable(kind: Side, file: string): { map: ApiMapFile; from: string } {
  const from = resolve(file);
  if (!existsSync(from) || !statSync(from).isFile()) {
    throw new Error(`not an existing file: ${from}`);
  }
  const map = parseMap(readFileSync(from, 'utf8'));
  if (map.version !== 1) throw new Error(`unsupported .apimap version: ${String(map.version)}`);
  const side = sideOf(map);
  if (side === null) {
    throw new Error(`${from} is not a one-sided scan (generator: ${map.metadata.generator}) — import an fe or be map, not a linked one`);
  }
  if (side !== kind) {
    throw new Error(`${from} is a ${side} map, not a ${kind} map`);
  }
  return { map, from };
}

export function importMap(id: string, kind: Side, file: string): ImportedMap {
  const { map, from } = readImportable(kind, file);
  const written = writeMap(id, kind, map);
  return {
    kind,
    file: written.file,
    from,
    root: map.metadata.root,
    generator: map.metadata.generator,
    endpoints: map.endpoints.length,
    screens: map.screens.length,
    calls: map.calls.length,
  };
}
