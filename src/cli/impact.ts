import { readFileSync, realpathSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile, Confidence, ImpactAnswer, SourceRef } from '../core/apimap';
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

export interface ImpactJson {
  query: { kind: 'endpoint' | 'field' | 'screen' | 'map'; value?: string };
  map: { name: string; root: string; endpoints: number; screens: number; calls: number; fields: number; unresolved: number };
  matches: unknown[];
  found: boolean;
}

const at = (s: SourceRef): string => `${s.file}:${s.line}`;

function mapFacts(map: ApiMapFile): ImpactJson['map'] {
  return {
    name: map.metadata.name,
    root: map.metadata.root,
    endpoints: map.endpoints.length,
    screens: map.screens.length,
    calls: map.calls.length,
    fields: map.fields.length,
    unresolved: map.unresolved.length,
  };
}

// cm:why The agent-facing shape is deliberately NOT the .apimap shape: it carries the answer plus
// the file:line evidence for it, and nothing else. A tool that hands an agent the whole map spends
// its context on data the agent then has to re-derive.
// cm:guard `unresolved` travels with every answer. An empty screen list means "nothing in the map
// consumes it", never "nothing consumes it" — dropping the count here is how that becomes a lie.
export function impactJson(map: ApiMapFile, kind: 'endpoint' | 'field', value: string, answers: ImpactAnswer[]): ImpactJson {
  const order: Record<Confidence, number> = { exact: 0, inferred: 1, guess: 2 };
  const matches = answers.map((a) => ({
    endpoint: a.endpoint === null ? null : { method: a.endpoint.method, path: a.endpoint.path },
    screens: [...a.screens]
      .sort((x, y) => order[x.confidence] - order[y.confidence])
      .map((s) => ({
        route: s.screen.route ?? null,
        label: s.screen.label,
        confidence: s.confidence,
        at: at(s.source),
        hops: s.screen.viaHops ?? 0,
        chain: (s.chain ?? []).map((c) => ({ role: c.role, symbol: c.symbol, at: at(c), precise: c.precise })),
      })),
  }));
  return { query: { kind, value }, map: mapFacts(map), matches, found: matches.some((m) => m.screens.length > 0) };
}

export function screenDepsJson(map: ApiMapFile, route: string): ImpactJson {
  const ids = screenIdsForRoute(map, route);
  const deps = ids.flatMap((id) => endpointsForScreen(map, id));
  const seen = new Map(deps.map((d) => [`${d.endpoint.id}|${d.confidence}`, d]));
  const order: Record<Confidence, number> = { exact: 0, inferred: 1, guess: 2 };
  return {
    query: { kind: 'screen', value: route },
    map: mapFacts(map),
    matches: [...seen.values()]
      .sort((a, b) => order[a.confidence] - order[b.confidence])
      .map((d) => ({
        method: d.endpoint.method,
        path: d.endpoint.path,
        confidence: d.confidence,
        at: at(d.source),
        hops: d.viaHops ?? 0,
      })),
    found: ids.length > 0,
  };
}

export function mapJson(map: ApiMapFile): ImpactJson {
  return {
    query: { kind: 'map' },
    map: mapFacts(map),
    matches: map.endpoints.map((e) => ({
      method: e.method,
      path: e.path,
      callers: map.calls.filter((c) => c.endpointId === e.id).length,
    })),
    found: map.endpoints.length > 0,
  };
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

  const asJson = args.includes('--json');
  const emit = (payload: ImpactJson): void => {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    // cm:edge protocol -> skills/apiflow-impact/skill.md — stdout stays valid JSON even when nothing
    // matched, and the verdict rides on the exit code (0 found · 2 nothing found). A hook that has to
    // parse prose to learn "no match" is a hook that reports a miss as an answer.
    process.exit(payload.found ? 0 : 2);
  };

  if (screenQuery !== undefined) {
    if (asJson) emit(screenDepsJson(map, screenQuery));
    console.log(renderScreenDeps(map, screenQuery));
    return;
  }

  if (!endpointQuery && !fieldQuery) {
    if (asJson) emit(mapJson(map));
    console.log(`## ${map.metadata.name} — ${map.endpoints.length} endpoint(s), ${map.screens.length} screen(s)`);
    console.log('');
    for (const e of map.endpoints) {
      const n = map.calls.filter((c) => c.endpointId === e.id).length;
      console.log(`- ${e.method} ${e.path} — ${n} caller(s)`);
    }
    return;
  }

  const kind = endpointQuery ? 'endpoint' : 'field';
  const query = (endpointQuery ?? fieldQuery) as string;
  const ids = endpointQuery ? resolveEndpointQuery(map, endpointQuery) : resolveFieldQuery(map, query);
  const answers = ids.map((id) =>
    endpointQuery ? screensAffectedByEndpoint(map, id) : screensAffectedByField(map, id)
  );
  if (asJson) emit(impactJson(map, kind, query, answers));
  if (ids.length === 0) {
    console.error(`No match for ${query} in ${map.metadata.name}.`);
    process.exit(2);
  }
  console.log(answers.map((a, i) => renderImpact(a, ids[i])).join('\n\n'));
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
