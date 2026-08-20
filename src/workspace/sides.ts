import { findProject } from './registry';
import { statusOf } from './store';
import { gitHead } from './gitInfo';

export interface SideInfo {
  kind: 'fe' | 'be';
  root: string;
  branch?: string;
  sha?: string;
  scannedAt?: string;
}

// cm:why Reads the revision from .git of each scanned root and the scan time from the map file's own
// mtime — both are facts already on disk, so a header can date the map without any scan log.
export function sidesOf(id: string): SideInfo[] {
  const entry = findProject(id);
  if (entry === undefined) return [];
  const when = new Map(statusOf(id).map((s) => [s.kind, s.scannedAt]));
  const out: SideInfo[] = [];
  for (const kind of ['fe', 'be'] as const) {
    const root = entry[kind];
    if (root === undefined) continue;
    const git = gitHead(root);
    out.push({ kind, root, branch: git?.branch, sha: git?.sha, scannedAt: when.get(kind) });
  }
  return out;
}
