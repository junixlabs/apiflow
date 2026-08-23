import { realpathSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile, MapDiff } from '@junixlabs/apiflow-map';
import { diffMaps, diverged, serializeMap } from '@junixlabs/apiflow-map';
import { loadMapOrExit } from './loadMap';
import { tolerateClosedPipe } from './stdio';

export interface DiffSides {
  before: string;
  after: string;
}

// cm:guard One renderer for one MapDiff. Two panels answering the same comparison are two accounts
// of it, and nothing tells the reader which one is the real answer.
// cm:why The sides are named by the caller because only the caller knows them: for `check` they are
// the map and the code, for `diff` they are two files a user chose.
export function renderMapDiff(diff: MapDiff, sides: DiffSides): string[] {
  const lines: string[] = [];
  const show = (label: string, items: Array<{ method: string; path: string }>): void => {
    if (items.length === 0) return;
    lines.push(`### ${label} — ${items.length}`);
    for (const e of items.slice(0, 20)) lines.push(`- \`${e.method} ${e.path}\``);
    if (items.length > 20) lines.push(`- … and ${items.length - 20} more`);
    lines.push('');
  };
  show(`In ${sides.after}, missing from ${sides.before}`, diff.endpoints.added);
  show(`In ${sides.before}, gone from ${sides.after}`, diff.endpoints.removed);
  show('Changed — auth gate or declaring side', diff.endpoints.changed);
  lines.push(`**Screens**: ${diff.screens.before} → ${diff.screens.after}`);
  lines.push(`**Calls**: ${diff.calls.before} → ${diff.calls.after}`);
  lines.push(`**Fields**: ${diff.fields.before} → ${diff.fields.after}`);
  lines.push(`**Reads**: ${diff.reads.before} → ${diff.reads.after}`);
  lines.push(`**Unresolved**: ${diff.unresolved.before} → ${diff.unresolved.after}`);
  return lines;
}

export interface DiffResult {
  diverged: boolean;
  identical: boolean;
  diff: MapDiff;
}

export function diffAgainst(before: ApiMapFile, after: ApiMapFile): DiffResult {
  const diff = diffMaps(before, after);
  return { diverged: diverged(diff), identical: serializeMap(before) === serializeMap(after), diff };
}

// cm:why Byte equality is NOT the verdict here as it is in `check`: both of check's maps come from
// one scanner, so different bytes mean the code moved.
// cm:why A design map and a scan of what got built disagree on generator, root and every file:line
// by construction, so a byte verdict would fail every contract comparison this command exists for.
// cm:guard The gate is the counted surface, and the text must keep saying so — exit 0 read as "the
// files are the same" claims something this command never looked at.
export function renderDiff(result: DiffResult, beforePath: string, afterPath: string): string {
  const lines: string[] = ['## apiflow diff', ''];
  lines.push(`**Before**: ${beforePath}`);
  lines.push(`**After**: ${afterPath}`);
  lines.push('');
  if (!result.diverged) {
    if (result.identical) {
      lines.push('**Verdict**: the two maps are byte-identical.');
      return lines.join('\n');
    }
    lines.push('**Verdict**: the counted surface matches — no endpoint, and no screen, call, field,');
    lines.push('read or unresolved count differs. The bytes still differ, so something below the counts');
    lines.push('moved: metadata, a file:line, or *which* fields rather than how many.');
    lines.push('');
    lines.push(...renderMapDiff(result.diff, { before: 'the before map', after: 'the after map' }));
    return lines.join('\n');
  }
  lines.push(`**Verdict**: the two maps have diverged — ${result.diff.headline}`);
  lines.push('');
  lines.push(...renderMapDiff(result.diff, { before: 'the before map', after: 'the after map' }));
  return lines.join('\n');
}

function main(): void {
  tolerateClosedPipe();
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));

  if (positional.length < 2) {
    console.error('Usage: apiflow diff <before.apimap> <after.apimap> [--json]');
    process.exit(2);
  }
  const beforePath = resolve(positional[0]);
  const afterPath = resolve(positional[1]);

  const before = loadMapOrExit(beforePath);
  const after = loadMapOrExit(afterPath);

  // cm:guard No `sideOf()` gate here, and adding one would undo the command: refusing an
  // unrecognised generator is what makes `check` unusable on a hand-written contract map.
  const result = diffAgainst(before, after);

  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ before: beforePath, after: afterPath, ...result }, null, 2)}\n`);
  } else {
    console.log(renderDiff(result, beforePath, afterPath));
  }
  process.exit(result.diverged ? 1 : 0);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
