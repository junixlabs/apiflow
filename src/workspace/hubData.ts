import type { HubProject } from '../view/hub';
import { readWorkspace } from './registry';
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

export function bestKind(project: HubProject): MapKind | null {
  for (const kind of PREFERRED) if (project.maps.some((m) => m.kind === kind)) return kind;
  return null;
}
