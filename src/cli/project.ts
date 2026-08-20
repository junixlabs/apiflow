import { realpathSync } from 'fs';
import { fileURLToPath } from 'url';
import type { ProjectEntry } from '../workspace/registry';
import { addProject, readWorkspace, removeProject, workspaceRoot } from '../workspace/registry';
import type { MapKind } from '../workspace/store';
import { readMap, statusOf } from '../workspace/store';
import { summarize } from '../workspace/summary';

const USAGE = `Usage:
  apiflow project add <tên> --fe=<thư mục> [--be=<thư mục>] [--id=<slug>] [--hints=<file>]
  apiflow project ls [--json]
  apiflow project rm <id>

Workspace: ${workspaceRoot()}`;

function fmtAge(iso: string | undefined): string {
  if (iso === undefined) return 'chưa scan';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} giờ trước` : `${Math.round(h / 24)} ngày trước`;
}

export interface ProjectRow {
  entry: ProjectEntry;
  maps: Array<{ kind: MapKind; scannedAt?: string; endpoints: number; screens: number; unresolved: number; open: number }>;
}

export function collectRows(): ProjectRow[] {
  return readWorkspace().projects.map((entry) => ({
    entry,
    maps: statusOf(entry.id)
      .filter((s) => s.exists)
      .map((s) => {
        const map = readMap(entry.id, s.kind);
        const sum = map ? summarize(map) : null;
        return {
          kind: s.kind,
          scannedAt: s.scannedAt,
          endpoints: sum?.endpoints ?? 0,
          screens: sum?.screens ?? 0,
          unresolved: sum?.unresolved ?? 0,
          open: sum?.open ?? 0,
        };
      }),
  }));
}

export function renderList(rows: ProjectRow[]): string {
  if (rows.length === 0) {
    return `Chưa có project nào trong ${workspaceRoot()}.\n\nThêm bằng:\n  apiflow project add adminhub --fe=/đường/dẫn/ui --be=/đường/dẫn/api`;
  }
  const lines: string[] = [`## ${rows.length} project · ${workspaceRoot()}`, ''];
  for (const { entry, maps } of rows) {
    const sides = [entry.fe !== undefined ? 'FE' : null, entry.be !== undefined ? 'BE' : null].filter(Boolean).join('+');
    lines.push(`### ${entry.id}  (${sides})`);
    if (entry.fe !== undefined) lines.push(`- FE  ${entry.fe}`);
    if (entry.be !== undefined) lines.push(`- BE  ${entry.be}`);
    if (maps.length === 0) lines.push('- chưa có map nào — chạy `apiflow scan-fe` / `scan-be` rồi `link`');
    for (const m of maps) {
      const warn = m.unresolved > 0 ? ` · ${m.unresolved} unresolved` : '';
      const open = m.open > 0 ? ` · ${m.open} không auth` : '';
      lines.push(`- ${m.kind.padEnd(6)} ${m.endpoints} endpoint · ${m.screens} màn${open}${warn} · ${fmtAge(m.scannedAt)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function main(): void {
  const args = process.argv.slice(2);
  const verb = args[0];
  const positional = args.slice(1).filter((a) => !a.startsWith('--'));
  const flag = (n: string): string | undefined => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

  try {
    if (verb === 'add') {
      const name = positional[0];
      if (name === undefined) throw new Error('thiếu tên project');
      const entry = addProject({ name, fe: flag('fe'), be: flag('be'), id: flag('id'), hints: flag('hints') });
      console.log(`Đã thêm **${entry.id}** — ${entry.name}`);
      if (entry.fe !== undefined) console.log(`- FE ${entry.fe}`);
      if (entry.be !== undefined) console.log(`- BE ${entry.be}`);
      console.log(`\nWorkspace: ${workspaceRoot()}`);
      return;
    }
    if (verb === 'ls' || verb === undefined) {
      const rows = collectRows();
      console.log(args.includes('--json') ? JSON.stringify(rows, null, 2) : renderList(rows));
      return;
    }
    if (verb === 'rm') {
      const id = positional[0];
      if (id === undefined) throw new Error('thiếu id');
      console.log(removeProject(id) ? `Đã xoá ${id} khỏi workspace (map vẫn còn trên đĩa).` : `Không có project nào tên ${id}.`);
      return;
    }
    console.error(USAGE);
    process.exit(1);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
