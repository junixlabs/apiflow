import { readFileSync, realpathSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile } from '@junixlabs/apiflow-map';
import type { Side } from '@junixlabs/apiflow-map';
import { parseMap, serializeMap, sideOf } from '@junixlabs/apiflow-map';
import type { MapDiff } from '@junixlabs/apiflow-map';
import { diffMaps, diverged } from '@junixlabs/apiflow-map';
import { renderMapDiff } from './diff';
import { localRootFor } from '../workspace/registry';
import { scanOrigin } from '../workspace/scanOrigin';
import { GENERATOR as BE_GENERATOR, scanBackend } from './scanBe';
import { GENERATOR as FE_GENERATOR, scanDirectory } from './scanFe';
import { tolerateClosedPipe } from './stdio';


// cm:why Drift and a reader upgrade look identical in a diff and mean opposite things: one is
// "someone changed the code", the other is "apiflow got better at reading it".
// cm:why Saying which one it is is the difference between a gate people trust and a gate people
// mute.
export function readerChanged(stored: ApiMapFile, side: Side): string | null {
  const current = side === 'fe' ? FE_GENERATOR : BE_GENERATOR;
  return stored.metadata.generator === current ? null : `${stored.metadata.generator} → ${current}`;
}

export function rescan(side: Side, root: string, name: string): ApiMapFile {
  return side === 'fe' ? scanDirectory(root, name) : scanBackend(root, name).map;
}

export interface CheckResult {
  drifted: boolean;
  identical: boolean;
  diff: MapDiff;
  structural: boolean;
}

// cm:why Byte equality is the verdict and the diff is only the explanation: a scan is deterministic
// (no timestamp, no coordinates), so different bytes means the code moved under the map.
// cm:why Deciding with the diff instead would pass a map whose confidence collapsed while the
// endpoint list held.
export function checkAgainst(stored: ApiMapFile, fresh: ApiMapFile): CheckResult {
  const identical = serializeMap(stored) === serializeMap(fresh);
  const diff = diffMaps(stored, fresh);
  return { drifted: !identical, identical, diff, structural: diverged(diff) };
}

export function renderCheck(result: CheckResult, mapPath: string, reader?: string | null): string {
  const { diff } = result;
  const lines: string[] = ['## apiflow check', ''];
  lines.push(`**Map**: ${mapPath}`);
  // cm:why Printed BEFORE the verdict, because it changes how the verdict should be read: a diff that
  // follows a reader upgrade is not evidence that anyone touched the code.
  if (reader !== undefined && reader !== null) {
    lines.push(`**Reader**: ${reader} — this map was written by an older reader, so part of any`);
    lines.push('difference below is apiflow reading the same code better, not the code changing.');
  }
  if (result.identical) {
    lines.push('');
    lines.push('The map still matches the code. Nothing to do.');
    return lines.join('\n');
  }
  // cm:why Names WHERE it drifted when no endpoint moved: "drifted" over an empty endpoint diff
  // reads as a bug in check, when the difference is real and lives in fields, unresolved or metadata.
  const surfaceMoved = diff.endpoints.added.length + diff.endpoints.removed.length + diff.endpoints.changed.length > 0;
  lines.push(`**Verdict**: the map has drifted from the code — ${diff.headline}`);
  if (!surfaceMoved) {
    lines.push('No endpoint was added, removed or changed: the difference is in the fields, the');
    lines.push('unresolved list or the metadata.');
  }
  lines.push('');
  lines.push(...renderMapDiff(diff, { before: 'the map', after: 'the code' }));
  if (!result.structural) {
    lines.push('');
    // cm:why Names the usual cause first. Measured on a live repo: same 27 screens / 182 calls, but
    // the handlers had moved and every file:line under them moved with it.
    // cm:why Blaming the scanner version sends the reader looking in the wrong repo for a change
    // that is right there in their diff.
    lines.push('Same counts, different bytes — usually code that moved, taking every file:line with it;');
    lines.push('sometimes a scanner version change. Equal counts do not mean the map is still true: the');
    lines.push('part a reader clicks is file:line, and it now points at the wrong line.');
  }
  lines.push('');
  lines.push('Refresh with: apiflow check <map> --root=<dir> --write');
  return lines.join('\n');
}

function main(): void {
  tolerateClosedPipe();
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const flag = (n: string): string | undefined => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

  if (positional.length === 0) {
    console.error('Usage: apiflow check <file.apimap> [--root=<dir>] [--write] [--json]');
    process.exit(2);
  }
  const mapPath = resolve(positional[0]);
  const stored = parseMap(readFileSync(mapPath, 'utf8'));
  const side = sideOf(stored);
  if (side === null) {
    console.error(`Cannot check a map generated by ${stored.metadata.generator}.`);
    console.error('A linked map joins two sides — check each side, then link again.');
    process.exit(2);
  }
  const root = flag('root') ?? localRootFor(stored.metadata.root);
  if (root === undefined) {
    console.error(`No idea where ${stored.metadata.root} lives on this machine. Pass --root=<dir>.`);
    process.exit(2);
  }
  const abs = resolve(root);
  // cm:guard Refuses a root from another repo instead of reporting the whole map as drift: pointing
  // check at the wrong directory would otherwise look exactly like "someone deleted every endpoint".
  const origin = scanOrigin(abs);
  if (origin !== stored.metadata.root) {
    console.error(`This map is for ${stored.metadata.root}, but ${abs} is ${origin}.`);
    process.exit(2);
  }

  const fresh = rescan(side, abs, stored.metadata.name);
  const result = checkAgainst(stored, fresh);

  if (args.includes('--write')) {
    writeFileSync(mapPath, serializeMap(fresh));
    console.log(result.identical ? `Unchanged: ${mapPath}` : `Updated: ${mapPath}`);
    return;
  }
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ map: mapPath, root: stored.metadata.root, reader: readerChanged(stored, side), ...result }, null, 2)}\n`);
  } else {
    console.log(renderCheck(result, mapPath, readerChanged(stored, side)));
  }
  process.exit(result.drifted ? 1 : 0);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
