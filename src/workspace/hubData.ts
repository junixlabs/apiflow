import type { HubProject } from '../view/hub';
import type { ProjectEntry } from './registry';
import { scanOrigin } from './scanOrigin';
import { readWorkspace } from './registry';
import { gitHead } from './gitInfo';
import type { MapKind } from './store';
import { readMap, statusOf } from './store';
import { summarize } from './summary';

const PREFERRED: MapKind[] = ['linked', 'fe', 'be'];

// cm:why The hub renderer takes plain numbers and knows nothing about the registry or the disk —
// this function is the only seam between them, so the same page can be baked or served live.
export function hubProjects(): HubProject[] {
  return readWorkspace().projects.map((entry) => ({
    id: entry.id,
    name: entry.name,
    fe: entry.fe,
    be: entry.be,
    hints: entry.hints,
    // cm:why The card names the revision each side sits on, same as a project header does. A list of
    // maps with no revision next to them cannot tell you which branch a stale one was taken from.
    rev: [
      ...(entry.fe === undefined ? [] : [{ kind: 'fe' as const, ...(gitHead(entry.fe) ?? {}) }]),
      ...(entry.be === undefined ? [] : [{ kind: 'be' as const, ...(gitHead(entry.be) ?? {}) }]),
    ],
    maps: statusOf(entry.id)
      .filter((status) => status.exists)
      // cm:guard A map that cannot be read is DROPPED, never zero-filled — "0 endpoint" on the card
      // reads as an empty project, which is a different claim from "this file did not load".
      .flatMap((status) => {
        const map = readMap(entry.id, status.kind);
        if (map === null) return [];
        const sum = summarize(map);
        return [{
          kind: status.kind,
          scannedAt: status.scannedAt,
          scannedFrom: staleRoot(entry, status.kind, map.metadata.root),
          endpoints: sum.endpoints,
          screens: sum.screens,
          calls: sum.calls,
          unresolved: sum.unresolved,
          open: sum.open,
          both: sum.both,
          uncalled: sum.uncalled,
          feOnly: sum.feOnly,
          unpaired: sum.unpaired,
          hasFe: sum.hasFe,
          hasBe: sum.hasBe,
        }];
      })
      .sort((a, b) => PREFERRED.indexOf(a.kind) - PREFERRED.indexOf(b.kind)),
  }));
}

// cm:why Compares the root the map RECORDS against the root the registry now points at, and returns
// the old one when they differ. Editing a project's FE directory does not move its map, so without
// this the card would show numbers scanned from a different repo and say nothing about it.
// cm:edge contract -> src/core/apimap.ts linkMaps() — a linked map's root is the two sides joined
// by " + ", which is why this checks containment for that kind instead of equality.
// cm:edge contract -> src/workspace/scanOrigin.ts — the map records the repo id, not the machine
// path, so "scanned somewhere else" is decided by running the registry path through the SAME
// function the scan used. Comparing against the raw path here would mark every map stale.
function staleRoot(entry: ProjectEntry, kind: MapKind, root: string): string | undefined {
  if (kind === 'linked') {
    const sides = [entry.fe, entry.be].filter((side): side is string => side !== undefined);
    return sides.every((side) => root.includes(scanOrigin(side))) ? undefined : root;
  }
  const now = entry[kind];
  return now !== undefined && scanOrigin(now) !== root ? root : undefined;
}

export function bestKind(project: HubProject): MapKind | null {
  for (const kind of PREFERRED) if (project.maps.some((m) => m.kind === kind)) return kind;
  return null;
}
