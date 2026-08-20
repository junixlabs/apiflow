import { parseMap, serializeMap } from '../core/apimap';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { ApiMapFile } from '../core/apimap';
import { ID, workspaceRoot } from './registry';

export type MapKind = 'fe' | 'be' | 'linked';

const KINDS: MapKind[] = ['fe', 'be', 'linked'];

// cm:guard Re-checks the id against ID even though the registry did — this function turns a string
// into a filesystem path, and a caller reaching it from an HTTP route is one typo from `../../`.
export function projectDir(id: string): string {
  if (!ID.test(id)) throw new Error(`id không hợp lệ: ${id}`);
  return join(workspaceRoot(), 'projects', id);
}

export function mapPath(id: string, kind: MapKind): string {
  return join(projectDir(id), `${kind}.apimap`);
}

export function readMap(id: string, kind: MapKind): ApiMapFile | null {
  const file = mapPath(id, kind);
  if (!existsSync(file)) return null;
  const map = parseMap(readFileSync(file, 'utf8'));
  if (map.version !== 1) throw new Error(`.apimap version không hỗ trợ: ${String(map.version)}`);
  return map;
}

// cm:why History is keyed by the scan's own content hash, not by a timestamp: an unchanged repo must
// re-scan to a byte-identical map, so a timestamped copy would fake a change on every run.
export function writeMap(id: string, kind: MapKind, map: ApiMapFile): { file: string; history: string } {
  const dir = projectDir(id);
  mkdirSync(join(dir, 'history'), { recursive: true });
  const body = serializeMap(map);
  const file = mapPath(id, kind);
  writeFileSync(file, body);
  const history = join(dir, 'history', `${kind}-${contentHash(body)}.apimap`);
  if (!existsSync(history)) writeFileSync(history, body);
  return { file, history };
}

// cm:why FNV-1a by hand rather than node:crypto — this hash names a file, it guards nothing, and a
// 32-bit hex keeps the history directory readable when you list it by eye.
export function contentHash(body: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) {
    h ^= body.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export interface MapStatus {
  kind: MapKind;
  exists: boolean;
  scannedAt?: string;
}

export function statusOf(id: string): MapStatus[] {
  return KINDS.map((kind) => {
    const file = mapPath(id, kind);
    if (!existsSync(file)) return { kind, exists: false };
    return { kind, exists: true, scannedAt: statSync(file).mtime.toISOString() };
  });
}

export function historyOf(id: string, kind: MapKind): string[] {
  const dir = join(projectDir(id), 'history');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith(`${kind}-`) && f.endsWith('.apimap'))
    .sort();
}
