import { readFileSync, realpathSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile } from '../core/apimap';
import { parseMap, serializeMap } from '../core/apimap';
import type { MapDiff } from '../workspace/diff';
import { diffMaps } from '../workspace/diff';
import { localRootFor } from '../workspace/registry';
import { scanOrigin } from '../workspace/scanOrigin';
import { scanBackend } from './scanBe';
import { scanDirectory } from './scanFe';
import { tolerateClosedPipe } from './stdio';

export type Side = 'fe' | 'be';

export function sideOf(map: ApiMapFile): Side | null {
  if (map.metadata.generator.includes('scan-fe')) return 'fe';
  if (map.metadata.generator.includes('scan-be')) return 'be';
  return null;
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
// (no timestamp, no coordinates), so different bytes means the code moved under the map. Deciding
// with the diff instead would pass a map whose confidence collapsed while the endpoint list held.
export function checkAgainst(stored: ApiMapFile, fresh: ApiMapFile): CheckResult {
  const identical = serializeMap(stored) === serializeMap(fresh);
  const diff = diffMaps(stored, fresh);
  const structural =
    diff.endpoints.added.length > 0 ||
    diff.endpoints.removed.length > 0 ||
    diff.endpoints.changed.length > 0 ||
    diff.calls.before !== diff.calls.after ||
    diff.screens.before !== diff.screens.after ||
    diff.unresolved.before !== diff.unresolved.after;
  return { drifted: !identical, identical, diff, structural };
}

export function renderCheck(result: CheckResult, mapPath: string): string {
  const { diff } = result;
  const lines: string[] = ['## apiflow check', ''];
  lines.push(`**Map**: ${mapPath}`);
  if (result.identical) {
    lines.push('');
    lines.push('Bản đồ khớp code. Không có gì phải làm.');
    return lines.join('\n');
  }
  lines.push(`**Kết luận**: bản đồ đã lệch code — ${diff.headline}`);
  lines.push('');
  const show = (label: string, items: Array<{ method: string; path: string }>): void => {
    if (items.length === 0) return;
    lines.push(`### ${label} — ${items.length}`);
    for (const e of items.slice(0, 20)) lines.push(`- \`${e.method} ${e.path}\``);
    if (items.length > 20) lines.push(`- … và ${items.length - 20} cái nữa`);
    lines.push('');
  };
  show('Endpoint mới trong code, chưa có trong bản đồ', diff.endpoints.added);
  show('Endpoint bản đồ có mà code không còn', diff.endpoints.removed);
  show('Endpoint đổi số màn gọi', diff.endpoints.changed);
  lines.push(`**Màn hình**: ${diff.screens.before} → ${diff.screens.after}`);
  lines.push(`**Lời gọi**: ${diff.calls.before} → ${diff.calls.after}`);
  lines.push(`**Unresolved**: ${diff.unresolved.before} → ${diff.unresolved.after}`);
  if (!result.structural) {
    lines.push('');
    lines.push('Không có thay đổi cấu trúc nào — khác byte nhưng cùng số liệu (thường là đổi phiên bản scanner).');
  }
  lines.push('');
  lines.push('Cập nhật bằng: apiflow check <map> --root=<dir> --write');
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
    console.error(`Không check được bản đồ do ${stored.metadata.generator} sinh ra.`);
    console.error('Bản linked ghép hai phía — check từng phía một, rồi link lại.');
    process.exit(2);
  }
  const root = flag('root') ?? localRootFor(stored.metadata.root);
  if (root === undefined) {
    console.error(`Không biết ${stored.metadata.root} nằm ở đâu trên máy này. Đưa vào bằng --root=<dir>.`);
    process.exit(2);
  }
  const abs = resolve(root);
  // cm:guard Refuses a root from another repo instead of reporting the whole map as drift: pointing
  // check at the wrong directory would otherwise look exactly like "someone deleted every endpoint".
  const origin = scanOrigin(abs);
  if (origin !== stored.metadata.root) {
    console.error(`Bản đồ này của ${stored.metadata.root}, còn ${abs} là ${origin}.`);
    process.exit(2);
  }

  const fresh = rescan(side, abs, stored.metadata.name);
  const result = checkAgainst(stored, fresh);

  if (args.includes('--write')) {
    writeFileSync(mapPath, serializeMap(fresh));
    console.log(result.identical ? `Không đổi: ${mapPath}` : `Đã cập nhật: ${mapPath}`);
    return;
  }
  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify({ map: mapPath, root: stored.metadata.root, ...result }, null, 2)}\n`);
  } else {
    console.log(renderCheck(result, mapPath));
  }
  process.exit(result.drifted ? 1 : 0);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
