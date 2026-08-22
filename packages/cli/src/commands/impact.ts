import { readFileSync, realpathSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile, Confidence, ImpactAnswer, MapMethod, SourceRef } from '@junixlabs/apiflow-map';
import { endpointId, endpointsForScreen, normalizePath, parseMap, screenIdsForRoute, screensAffectedByEndpoint, screensAffectedByField, toMapMethod } from '@junixlabs/apiflow-map';
import { tolerateClosedPipe } from './stdio';

export function loadMap(path: string): ApiMapFile {
  const map = parseMap(readFileSync(path, 'utf8'));
  if (map.version !== 1) throw new Error(`unsupported .apimap version: ${String(map.version)}`);
  return map;
}

// cm:guard A query that names a verb keeps that verb through the fuzzy fallback. It used to drop it:
// asking for `POST /mcp` on a map that has only DELETE and GET /mcp printed those two as the answer,
// so the reader — or an agent — concluded that POST /mcp breaks those screens. Widen the PATH, never
// the method: the method is the half the user was explicit about.
export function resolveEndpointQuery(map: ApiMapFile, query: string): string[] {
  const parts = query.trim().split(/\s+/);
  const verb = parts.length >= 2 ? toMapMethod(parts[0]) : undefined;
  if (verb !== undefined) {
    const id = endpointId(verb, normalizePath(parts.slice(1).join(' ')));
    if (map.endpoints.some((e) => e.id === id)) return [id];
  }
  const needle = normalizePath(parts[parts.length - 1]);
  const hit = (e: { method: MapMethod; path: string }) => e.path === needle || e.path.includes(needle);
  const withVerb = map.endpoints.filter((e) => hit(e) && e.method === verb);
  return (withVerb.length > 0 ? withVerb : map.endpoints.filter((e) => (verb === undefined ? hit(e) : false))).map((e) => e.id);
}

// cm:why Separate from the resolver so the caller can SAY why it found nothing: "no POST on this
// path, but DELETE and GET exist" is a different fact from "this path does not exist", and the
// second one sends someone looking for a typo that isn't there.
export function otherMethodsOn(map: ApiMapFile, query: string): string[] {
  const parts = query.trim().split(/\s+/);
  if (parts.length < 2) return [];
  const needle = normalizePath(parts.slice(1).join(' '));
  return map.endpoints
    .filter((e) => e.path === needle || e.path.includes(needle))
    .map((e) => `${e.method} ${e.path}`)
    .sort();
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
    const hops = s.hops ?? s.screen.viaHops;
    const via = hops ? ` · via ${hops} hop(s) → ${s.screen.source.file}:${s.screen.source.line}` : '';
    // cm:why A screen with no route never reached a route table — printing it like the others reads
    // as "this URL breaks", when all that is known is the module the call sits in.
    const label = s.screen.route ?? `${s.screen.label} (never reached a route)`;
    // cm:why Prints the extra call sites as a count, not as extra screen rows: the headline counts
    // screens, and a screen listed twice reads as twice the blast radius.
    const sites = s.callSites > 1 ? ` · ${s.callSites} call sites` : '';
    // cm:why Says WHERE an inherited call lives. The screen really does break, but the call site is
    // in the layout above it — printing it like an own call sends the reader to the wrong file.
    const from = s.inheritedFrom === undefined ? '' : ` · inherited from layout ${s.inheritedFrom}`;
    lines.push(`- **${label}** [${s.confidence}] — ${s.source.file}:${s.source.line}${sites}${from}${via}`);
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
    return `No screen named ${route}.\n\nScreens with a route in this map: ${known.length}` +
      (known.length > 0 ? `\nFor example: ${known.slice(0, 6).join(' · ')}` : '');
  }
  const deps = ids.flatMap((id) => endpointsForScreen(map, id));
  const seen = new Map(deps.map((d) => [`${d.endpoint.id}|${d.confidence}`, d]));
  const lines = [`## ${route} depends on ${seen.size} endpoint(s)`, ''];
  if (seen.size === 0) {
    lines.push('No call could be traced back to this screen. That is not proof none exists —');
    lines.push('check the Unresolved list in the .apimap first.');
    return lines.join('\n');
  }
  const order = { exact: 0, inferred: 1, guess: 2 };
  for (const d of [...seen.values()].sort((a, b) => order[a.confidence] - order[b.confidence])) {
    const hop = d.viaHops ? ` · ${d.viaHops} hop` : '';
    const inherited = d.inheritedFrom === undefined ? '' : ` · from layout ${d.inheritedFrom}`;
    lines.push(`- \`${d.endpoint.method} ${d.endpoint.path}\` [${d.confidence}] — ${d.source.file}:${d.source.line}${hop}${inherited}`);
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
        hops: s.hops ?? s.screen.viaHops ?? 0,
        callSites: s.callSites,
        inheritedFrom: s.inheritedFrom ?? null,
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
  tolerateClosedPipe();
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
    console.error(`Nothing matches ${query} in ${map.metadata.name}.`);
    const others = endpointQuery ? otherMethodsOn(map, query) : [];
    if (others.length > 0) console.error(`On that path the map does have: ${others.join(' · ')}`);
    process.exit(2);
  }
  console.log(answers.map((a, i) => renderImpact(a, ids[i])).join('\n\n'));
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
