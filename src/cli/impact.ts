import { readFileSync, realpathSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile, ImpactAnswer } from '../core/apimap';
import { endpointId, endpointsForScreen, normalizePath, parseMap, screenIdsForRoute, screensAffectedByEndpoint, screensAffectedByField, toMapMethod } from '../core/apimap';

export function loadMap(path: string): ApiMapFile {
  const map = parseMap(readFileSync(path, 'utf8'));
  if (map.version !== 1) throw new Error(`unsupported .apimap version: ${String(map.version)}`);
  return map;
}

export function resolveEndpointQuery(map: ApiMapFile, query: string): string[] {
  const parts = query.trim().split(/\s+/);
  if (parts.length >= 2) {
    const id = endpointId(toMapMethod(parts[0]), normalizePath(parts.slice(1).join(' ')));
    if (map.endpoints.some((e) => e.id === id)) return [id];
  }
  const needle = normalizePath(parts[parts.length - 1]);
  return map.endpoints.filter((e) => e.path === needle || e.path.includes(needle)).map((e) => e.id);
}

export function resolveFieldQuery(map: ApiMapFile, query: string): string[] {
  const needle = query.trim().toLowerCase();
  return map.fields
    .filter((f) => f.path.toLowerCase() === needle || f.path.toLowerCase().includes(needle))
    .map((f) => f.id);
}

export function renderImpact(answer: ImpactAnswer, label: string): string {
  const lines: string[] = [];
  const target = answer.endpoint ? `${answer.endpoint.method} ${answer.endpoint.path}` : label;
  lines.push(`## Impact — ${target}`);
  lines.push('');
  if (answer.screens.length === 0) {
    lines.push('No screen in this map consumes it.');
    lines.push('');
    lines.push('That is not proof nothing does — check the Unresolved list in the .apimap first.');
    return lines.join('\n');
  }
  lines.push(`${answer.screens.length} screen(s) break if this changes:`);
  lines.push('');
  const order = { exact: 0, inferred: 1, guess: 2 };
  for (const s of [...answer.screens].sort((a, b) => order[a.confidence] - order[b.confidence])) {
    const via = s.screen.viaHops ? ` · via ${s.screen.viaHops} hop(s) → ${s.screen.source.file}:${s.screen.source.line}` : '';
    // cm:why A screen with no route never reached a route table — printing it like the others reads
    // as "this URL breaks", when all that is known is the module the call sits in.
    const label = s.screen.route ?? `${s.screen.label} (chưa gắn được vào route nào)`;
    lines.push(`- **${label}** [${s.confidence}] — ${s.source.file}:${s.source.line}${via}`);
    // cm:why Prints the chain, not the hop COUNT: "3 hop" cannot be checked by hand, while every
    // step with its file:line can — and that is the difference between a claim and evidence.
    if (s.chain !== undefined && s.chain.length > 1) {
      for (const [i, step] of s.chain.entries()) {
        const arrow = i === 0 ? '  ' : '  ↳ ';
        const mark = step.precise ? '' : ' ~';
        lines.push(`${arrow}${step.role.padEnd(9)} ${step.symbol}${mark}  ${step.file}:${step.line}`);
      }
    }
  }
  return lines.join('\n');
}

export function renderScreenDeps(map: ApiMapFile, route: string): string {
  const ids = screenIdsForRoute(map, route);
  if (ids.length === 0) {
    const known = [...new Set(map.screens.map((s) => s.route).filter((r): r is string => r !== undefined))].sort();
    return `Không có màn nào tên ${route}.\n\nMàn có route trong map: ${known.length}` +
      (known.length > 0 ? `\nVí dụ: ${known.slice(0, 6).join(' · ')}` : '');
  }
  const deps = ids.flatMap((id) => endpointsForScreen(map, id));
  const seen = new Map(deps.map((d) => [`${d.endpoint.id}|${d.confidence}`, d]));
  const lines = [`## ${route} phụ thuộc ${seen.size} endpoint`, ''];
  if (seen.size === 0) {
    lines.push('Không lời gọi nào truy được về màn này. Đó không phải bằng chứng là không có —');
    lines.push('xem danh sách Unresolved trong file .apimap.');
    return lines.join('\n');
  }
  const order = { exact: 0, inferred: 1, guess: 2 };
  for (const d of [...seen.values()].sort((a, b) => order[a.confidence] - order[b.confidence])) {
    const hop = d.viaHops ? ` · ${d.viaHops} hop` : '';
    lines.push(`- \`${d.endpoint.method} ${d.endpoint.path}\` [${d.confidence}] — ${d.source.file}:${d.source.line}${hop}`);
  }
  return lines.join('\n');
}

function main(): void {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const flag = (n: string): string | undefined => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

  if (positional.length === 0) {
    console.error('Usage: apiflow impact <file.apimap> [--endpoint="GET /api/users"] [--field=email] [--screen=/user/:id]');
    process.exit(1);
  }
  const map = loadMap(resolve(positional[0]));

  const endpointQuery = flag('endpoint');
  const fieldQuery = flag('field');
  const screenQuery = flag('screen');

  if (screenQuery !== undefined) {
    console.log(renderScreenDeps(map, screenQuery));
    return;
  }

  if (!endpointQuery && !fieldQuery) {
    console.log(`## ${map.metadata.name} — ${map.endpoints.length} endpoint(s), ${map.screens.length} screen(s)`);
    console.log('');
    for (const e of map.endpoints) {
      const n = map.calls.filter((c) => c.endpointId === e.id).length;
      console.log(`- ${e.method} ${e.path} — ${n} caller(s)`);
    }
    return;
  }

  const ids = endpointQuery ? resolveEndpointQuery(map, endpointQuery) : resolveFieldQuery(map, fieldQuery as string);
  if (ids.length === 0) {
    console.error(`No match for ${endpointQuery ?? fieldQuery} in ${map.metadata.name}.`);
    process.exit(2);
  }
  const answers = ids.map((id) =>
    endpointQuery ? screensAffectedByEndpoint(map, id) : screensAffectedByField(map, id)
  );
  console.log(answers.map((a, i) => renderImpact(a, ids[i])).join('\n\n'));
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
