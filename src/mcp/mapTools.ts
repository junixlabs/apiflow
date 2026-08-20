import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { ApiMapFile, Confidence, ImpactAnswer } from '../core/apimap';
import { endpointsForScreen, parseMap, screenIdsForRoute, screensAffectedByEndpoint, screensAffectedByField } from '../core/apimap';
import { checkAgainst, rescan, sideOf } from '../cli/check';
import { resolveEndpointQuery, resolveFieldQuery } from '../cli/impact';
import { alertCounts, alerts } from '../workspace/alerts';
import { findProject, localRootFor, readWorkspace } from '../workspace/registry';
import type { MapKind } from '../workspace/store';
import { mapPath, readMap, statusOf } from '../workspace/store';
import { summarize } from '../workspace/summary';

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
    if (!existsSync(path)) throw new Error(`không có file ${path}`);
    return { map: parseMap(readFileSync(path, 'utf8')), label: path };
  }
  const workspace = readWorkspace();
  const id = project ?? process.env.APIFLOW_PROJECT ?? (workspace.projects.length === 1 ? workspace.projects[0].id : undefined);
  const names = workspace.projects.map((p) => p.id).join(' · ');
  if (id === undefined) throw new Error(`chưa nói project nào. Có: ${names}`);
  if (findProject(id) === undefined) throw new Error(`không có project ${id}. Có: ${names}`);
  for (const kind of PREFERRED) {
    const map = readMap(id, kind);
    if (map !== null) return { map, label: `${id}/${kind}`, id };
  }
  throw new Error(`${id} chưa scan lần nào — chạy: apiflow project scan ${id}`);
}

const at = (s: { file: string; line: number }): string => `${s.file}:${s.line}`;
const ORDER: Record<Confidence, number> = { exact: 0, inferred: 1, guess: 2 };

function counts(list: Array<{ confidence: Confidence }>): string {
  const c = { exact: 0, inferred: 0, guess: 0 };
  for (const x of list) c[x.confidence]++;
  return `exact ${c.exact} · inferred ${c.inferred} · guess ${c.guess}`;
}

// cm:guard Every answer ends with the unresolved count and the map it came from. An agent reading
// "0 màn" without those two facts will report "nothing uses this endpoint" as if it were measured.
export function footer(target: Target): string {
  return `\n(bản đồ ${target.label} · ${target.map.metadata.root} · ${target.map.unresolved.length} lời gọi chưa giải được đường dẫn — không nằm trong các số trên)`;
}

function renderImpact(target: Target, label: string, answers: ImpactAnswer[], verbose: boolean): string {
  const lines: string[] = [];
  for (const a of answers) {
    const name = a.endpoint === null ? label : `${a.endpoint.method} ${a.endpoint.path}`;
    if (a.screens.length === 0) {
      lines.push(`${name} — không màn nào trong bản đồ gọi tới.`);
      continue;
    }
    lines.push(`${name} — ${a.screens.length} màn vỡ nếu đổi (${counts(a.screens)})`);
    const sorted = [...a.screens].sort((x, y) => ORDER[x.confidence] - ORDER[y.confidence]);
    for (const s of sorted.slice(0, SCREEN_CAP)) {
      const route = s.screen.route ?? `${s.screen.label} (chưa gắn được vào route nào)`;
      lines.push(`- ${route} [${s.confidence}] ${at(s.source)}`);
      if (verbose && s.chain !== undefined && s.chain.length > 1) {
        for (const step of s.chain) lines.push(`    ${step.role} ${step.symbol}${step.precise ? '' : ' ~'} ${at(step)}`);
      }
    }
    if (sorted.length > SCREEN_CAP) lines.push(`- … và ${sorted.length - SCREEN_CAP} màn nữa`);
  }
  return lines.join('\n') + footer(target);
}

export function impactEndpointText(target: Target, endpoint: string, verbose = false): string {
  const ids = resolveEndpointQuery(target.map, endpoint);
  if (ids.length === 0) return `Không có endpoint nào khớp "${endpoint}".${footer(target)}`;
  return renderImpact(target, endpoint, ids.map((id) => screensAffectedByEndpoint(target.map, id)), verbose);
}

export function impactFieldText(target: Target, field: string): string {
  const ids = resolveFieldQuery(target.map, field);
  if (ids.length === 0) {
    return `Không có field nào tên "${field}" trong bản đồ (${target.map.fields.length} field đã truy được).${footer(target)}`;
  }
  return renderImpact(target, field, ids.map((id) => screensAffectedByField(target.map, id)), false);
}

export function screenDepsText(target: Target, route: string): string {
  const ids = screenIdsForRoute(target.map, route);
  if (ids.length === 0) {
    const known = [...new Set(target.map.screens.map((s) => s.route).filter((r): r is string => r !== undefined))].sort();
    return `Không có màn nào tên ${route}. Ví dụ có trong bản đồ: ${known.slice(0, 8).join(' · ')}${footer(target)}`;
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
    if (items.length > FIND_CAP) lines.push(`- … và ${items.length - FIND_CAP} cái nữa`);
  };
  block('endpoint', eps.map((e) => `${e.method} ${e.path}`));
  block('màn hình', screens.map((s) => s.route ?? s.label));
  block('field', [...new Set(fields.map((f) => f.path))]);
  return (lines.length === 0 ? `Không có gì khớp "${q}".` : lines.join('\n')) + footer(target);
}

export function mapHealthText(target: Target): string {
  const sum = summarize(target.map);
  const counted = alertCounts(alerts(target.map));
  const lines = [
    `${target.label} — ${target.map.metadata.root}`,
    `endpoint ${sum.endpoints} · màn ${sum.screens} · lời gọi ${sum.calls} · field ${sum.fields}`,
    `độ tin cậy: exact ${sum.confidence.exact} · inferred ${sum.confidence.inferred} · guess ${sum.confidence.guess}`,
    `đối chiếu: khớp hai phía ${sum.both} · API khai không ai gọi ${sum.uncalled} · FE gọi API không khai ${sum.feOnly} · chưa đối chiếu được ${sum.unpaired}`,
    // cm:guard The be-partial warning has to travel with the numbers, not sit in a separate tool: the
    // whole point is that the feOnly column above must not be read as a defect list when it fires.
    `alert ${counted.total} (high ${counted.high})${counted.byKind['be-partial'] > 0 ? ' — phía BE đọc được quá ít để so sánh, đừng tin cột "FE gọi, API không khai"' : ''}`,
    `unresolved ${sum.unresolved} — không nằm trong các số trên`,
  ];
  if (target.id !== undefined) {
    for (const s of statusOf(target.id).filter((x) => x.exists)) {
      lines.push(`${s.kind}: scan ${s.scannedAt ?? 'chưa'} — ${mapPath(target.id, s.kind)}`);
    }
  }
  return lines.join('\n');
}

export function mapCheckText(target: Target, side?: 'fe' | 'be'): string {
  const kind = side ?? sideOf(target.map);
  if (kind === null) {
    return 'Bản đồ linked ghép hai phía — check từng phía một (side=fe hoặc side=be, hoặc trỏ map vào file fe/be).';
  }
  const root = localRootFor(target.map.metadata.root);
  if (root === undefined) {
    return `Không biết ${target.map.metadata.root} nằm ở đâu trên máy này — thêm bằng: apiflow project add`;
  }
  const result = checkAgainst(target.map, rescan(kind, root, target.map.metadata.name));
  if (!result.drifted) return `Bản đồ ${target.label} khớp code.`;
  const lines = [`Bản đồ ${target.label} đã lệch code — ${result.diff.headline}`];
  for (const e of result.diff.endpoints.added.slice(0, 10)) lines.push(`+ ${e.method} ${e.path} (code có, bản đồ chưa)`);
  for (const e of result.diff.endpoints.removed.slice(0, 10)) lines.push(`- ${e.method} ${e.path} (bản đồ có, code không còn)`);
  lines.push(`màn ${result.diff.screens.before} → ${result.diff.screens.after} · lời gọi ${result.diff.calls.before} → ${result.diff.calls.after} · unresolved ${result.diff.unresolved.before} → ${result.diff.unresolved.after}`);
  lines.push('Cập nhật: apiflow project scan <id>');
  return lines.join('\n');
}

export function mapListText(): string {
  const workspace = readWorkspace();
  if (workspace.projects.length === 0) return 'Workspace trống — thêm bằng: apiflow project add <tên> --fe=<dir> [--be=<dir>]';
  return workspace.projects
    .map((p) => {
      const kinds = statusOf(p.id).filter((s) => s.exists).map((s) => s.kind);
      return `${p.id} — ${p.name} · ${kinds.length === 0 ? 'chưa scan' : kinds.join(', ')}`;
    })
    .join('\n');
}
