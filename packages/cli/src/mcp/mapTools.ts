import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { ApiMapFile, Confidence, ImpactAnswer } from '@junixlabs/apiflow-map';
import { endpointsForScreen, parseMap, screenIdsForRoute, screensAffectedByEndpoint, screensAffectedByField, sideOf, unresolvedKinds } from '@junixlabs/apiflow-map';
import { checkAgainst, rescan } from '../commands/check';
import { otherMethodsOn, resolveEndpointQuery, resolveFieldQuery } from '../commands/impact';
import { alertCounts, alerts } from '@junixlabs/apiflow-map';
import { findProject, localRootFor, readWorkspace } from '../workspace/registry';
import type { MapKind } from '../workspace/store';
import { mapPath, readMap, statusOf } from '../workspace/store';
import { summarize } from '@junixlabs/apiflow-map';

const SCREEN_CAP = 15;
const FIND_CAP = 20;
const PREFERRED: MapKind[] = ['linked', 'fe', 'be'];

export interface Target {
  map: ApiMapFile;
  label: string;
  id?: string;
}

// cm:why Resolution order is project id → explicit file → the only project in the workspace. An agent
// asking "which screens break" almost never knows a map path, and guessing one for it would answer
// from whichever file happened to be newest.
export function resolveTarget(project?: string, mapFile?: string): Target {
  if (mapFile !== undefined) {
    const path = resolve(mapFile);
    if (!existsSync(path)) throw new Error(`no such file: ${path}`);
    return { map: parseMap(readFileSync(path, 'utf8')), label: path };
  }
  const workspace = readWorkspace();
  const id = project ?? process.env.APIFLOW_PROJECT ?? (workspace.projects.length === 1 ? workspace.projects[0].id : undefined);
  const names = workspace.projects.map((p) => p.id).join(' · ');
  if (id === undefined) throw new Error(`no project named. Available: ${names}`);
  if (findProject(id) === undefined) throw new Error(`no project ${id}. Available: ${names}`);
  for (const kind of PREFERRED) {
    const map = readMap(id, kind);
    if (map !== null) return { map, label: `${id}/${kind}`, id };
  }
  throw new Error(`${id} has never been scanned — run: apiflow project scan ${id}`);
}

const at = (s: { file: string; line: number }): string => `${s.file}:${s.line}`;
const ORDER: Record<Confidence, number> = { exact: 0, inferred: 1, guess: 2 };

function counts(list: Array<{ confidence: Confidence }>): string {
  const c = { exact: 0, inferred: 0, guess: 0 };
  for (const x of list) c[x.confidence]++;
  return `exact ${c.exact} · inferred ${c.inferred} · guess ${c.guess}`;
}

// cm:guard Every answer ends with the unresolved count and the map it came from. An agent reading
// "0 screens" without those two facts will report "nothing uses this endpoint" as if it were measured.
export function footer(target: Target): string {
  return `\n(map ${target.label} · ${target.map.metadata.root} · ${unresolvedKinds(target.map).paths} calls whose path could not be resolved, ${unresolvedKinds(target.map).schemas} endpoints with no schema read — neither is part of the numbers above)`;
}

function renderImpact(target: Target, label: string, answers: ImpactAnswer[], verbose: boolean): string {
  const lines: string[] = [];
  for (const a of answers) {
    const name = a.endpoint === null ? label : `${a.endpoint.method} ${a.endpoint.path}`;
    if (a.screens.length === 0) {
      lines.push(`${name} — no screen in this map calls it.`);
      continue;
    }
    lines.push(`${name} — ${a.screens.length} screen(s) break if this changes (${counts(a.screens)})`);
    const sorted = [...a.screens].sort((x, y) => ORDER[x.confidence] - ORDER[y.confidence]);
    for (const s of sorted.slice(0, SCREEN_CAP)) {
      const route = s.screen.route ?? `${s.screen.label} (no route attached)`;
      lines.push(`- ${route} [${s.confidence}] ${at(s.source)}${s.callSites > 1 ? ` · ${s.callSites} call sites` : ''}${s.inheritedFrom === undefined ? '' : ` · inherited from layout ${s.inheritedFrom}`}`);
      if (verbose && s.chain !== undefined && s.chain.length > 1) {
        for (const step of s.chain) lines.push(`    ${step.role} ${step.symbol}${step.precise ? '' : ' ~'} ${at(step)}`);
      }
    }
    if (sorted.length > SCREEN_CAP) lines.push(`- … and ${sorted.length - SCREEN_CAP} more screen(s)`);
  }
  return lines.join('\n') + footer(target);
}

export function impactEndpointText(target: Target, endpoint: string, verbose = false): string {
  const ids = resolveEndpointQuery(target.map, endpoint);
  if (ids.length === 0) {
    // cm:why Names the verbs that DO exist on that path. "No match" alone sends the agent hunting
    // for a typo in the path when the real answer is that this path has no POST.
    const others = otherMethodsOn(target.map, endpoint);
    const hint = others.length > 0 ? ` On that same path the map does have: ${others.join(' · ')}.` : '';
    return `No endpoint matches "${endpoint}".${hint}${footer(target)}`;
  }
  return renderImpact(target, endpoint, ids.map((id) => screensAffectedByEndpoint(target.map, id)), verbose);
}

export function impactFieldText(target: Target, field: string): string {
  const ids = resolveFieldQuery(target.map, field);
  if (ids.length === 0) {
    return `No field named "${field}" in this map (${target.map.fields.length} field(s) traced).${footer(target)}`;
  }
  return renderImpact(target, field, ids.map((id) => screensAffectedByField(target.map, id)), false);
}

export function screenDepsText(target: Target, route: string): string {
  const ids = screenIdsForRoute(target.map, route);
  if (ids.length === 0) {
    const known = [...new Set(target.map.screens.map((s) => s.route).filter((r): r is string => r !== undefined))].sort();
    return `No screen named ${route}. Examples from this map: ${known.slice(0, 8).join(' · ')}${footer(target)}`;
  }
  const deps = ids.flatMap((id) => endpointsForScreen(target.map, id));
  const seen = new Map(deps.map((d) => [`${d.endpoint.id}|${d.confidence}`, d]));
  const rows = [...seen.values()].sort((a, b) => ORDER[a.confidence] - ORDER[b.confidence]);
  const lines = [`${route} — ${rows.length} endpoint (${counts(rows)})`];
  for (const d of rows) lines.push(`- ${d.endpoint.method} ${d.endpoint.path} [${d.confidence}] ${at(d.source)}`);
  return lines.join('\n') + footer(target);
}

export function findText(target: Target, q: string): string {
  const needle = q.trim().toLowerCase();
  const eps = target.map.endpoints.filter((e) => `${e.method} ${e.path}`.toLowerCase().includes(needle));
  const screens = target.map.screens.filter((s) => `${s.route ?? ''} ${s.label}`.toLowerCase().includes(needle));
  const fields = target.map.fields.filter((f) => f.path.toLowerCase().includes(needle));
  const lines: string[] = [];
  const block = (title: string, items: string[]): void => {
    if (items.length === 0) return;
    lines.push(`${title} — ${items.length}`);
    for (const i of items.slice(0, FIND_CAP)) lines.push(`- ${i}`);
    if (items.length > FIND_CAP) lines.push(`- … and ${items.length - FIND_CAP} more`);
  };
  block('endpoint', eps.map((e) => `${e.method} ${e.path}`));
  block('screens', screens.map((s) => s.route ?? s.label));
  block('field', [...new Set(fields.map((f) => f.path))]);
  return (lines.length === 0 ? `Nothing matches "${q}".` : lines.join('\n')) + footer(target);
}

export function mapHealthText(target: Target): string {
  const sum = summarize(target.map);
  const counted = alertCounts(alerts(target.map));
  const lines = [
    `${target.label} — ${target.map.metadata.root}`,
    `endpoints ${sum.endpoints} · screens ${sum.screens} · calls ${sum.calls} · fields ${sum.fields}`,
    `confidence: exact ${sum.confidence.exact} · inferred ${sum.confidence.inferred} · guess ${sum.confidence.guess}`,
    `reconciliation: both sides ${sum.both} · declared but uncalled ${sum.uncalled} · FE-only ${sum.feOnly} · unpaired ${sum.unpaired}`,
    // cm:guard The be-partial warning has to travel with the numbers, not sit in a separate tool: the
    // whole point is that the feOnly column above must not be read as a defect list when it fires.
    `alert ${counted.total} (high ${counted.high})${counted.byKind['be-partial'] > 0 ? ' — too little of the BE was read to compare, do not trust the FE-only column' : ''}`,
    `unresolved ${sum.unresolved} — not part of the numbers above`,
  ];
  if (target.id !== undefined) {
    for (const s of statusOf(target.id).filter((x) => x.exists)) {
      lines.push(`${s.kind}: scanned ${s.scannedAt ?? 'never'} — ${mapPath(target.id, s.kind)}`);
    }
  }
  return lines.join('\n');
}

export function mapCheckText(target: Target, side?: 'fe' | 'be'): string {
  const kind = side ?? sideOf(target.map);
  if (kind === null) {
    return 'A linked map joins both sides — check one side at a time (side=fe or side=be, or point map at the fe/be file).';
  }
  const root = localRootFor(target.map.metadata.root);
  if (root === undefined) {
    return `Nothing on this machine says where ${target.map.metadata.root} lives — add it with: apiflow project add`;
  }
  const result = checkAgainst(target.map, rescan(kind, root, target.map.metadata.name));
  if (!result.drifted) return `Map ${target.label} still matches the code.`;
  const lines = [`Map ${target.label} has drifted from the code — ${result.diff.headline}`];
  for (const e of result.diff.endpoints.added.slice(0, 10)) lines.push(`+ ${e.method} ${e.path} (in the code, not in the map)`);
  for (const e of result.diff.endpoints.removed.slice(0, 10)) lines.push(`- ${e.method} ${e.path} (in the map, gone from the code)`);
  lines.push(`screens ${result.diff.screens.before} → ${result.diff.screens.after} · calls ${result.diff.calls.before} → ${result.diff.calls.after} · unresolved ${result.diff.unresolved.before} → ${result.diff.unresolved.after}`);
  lines.push('Refresh with: apiflow project scan <id>');
  return lines.join('\n');
}

export function mapListText(): string {
  const workspace = readWorkspace();
  if (workspace.projects.length === 0) return 'The workspace is empty — add one with: apiflow project add <name> --fe=<dir> [--be=<dir>]';
  return workspace.projects
    .map((p) => {
      const kinds = statusOf(p.id).filter((s) => s.exists).map((s) => s.kind);
      return `${p.id} — ${p.name} · ${kinds.length === 0 ? 'not scanned' : kinds.join(', ')}`;
    })
    .join('\n');
}
