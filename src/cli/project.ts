import { realpathSync } from 'fs';
import { fileURLToPath } from 'url';
import type { ProjectEntry } from '../workspace/registry';
import { addProject, findProject, readWorkspace, removeProject, workspaceRoot } from '../workspace/registry';
import { importMap, readImportable } from '../workspace/importMap';
import { scanInBackground } from '../workspace/runScan';
import type { MapKind } from '../workspace/store';
import { readMap, statusOf } from '../workspace/store';
import { summarize } from '../workspace/summary';
import { tolerateClosedPipe } from './stdio';

const USAGE = `Usage:
  apiflow project add <name> --fe=<dir> [--be=<dir>] [--id=<slug>] [--hints=<file>]
                     [--fe-map=<file.apimap>] [--be-map=<file.apimap>]
  apiflow project import <id> --fe=<file.apimap> | --be=<file.apimap>
  apiflow project ls [--json]
  apiflow project rm <id>
  apiflow project scan <id> [--fe] [--be]

A side scanned on another machine has no directory here: copy its .apimap over and import it. The
map is content-derived and timestamp-free, so the file is the whole handover.

Workspace: ${workspaceRoot()}`;

function fmtAge(iso: string | undefined): string {
  if (iso === undefined) return 'never scanned';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
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
    return `No project in ${workspaceRoot()} yet.\n\nAdd one:\n  apiflow project add web --fe=/path/to/frontend --be=/path/to/api`;
  }
  const lines: string[] = [`## ${rows.length} project · ${workspaceRoot()}`, ''];
  for (const { entry, maps } of rows) {
    // cm:why The badge counts the MAPS, not the registered directories: a side scanned on another
    // machine has a map and no directory, and reading the registry alone printed (FE) for a project
    // that had both halves and was already reconciling them.
    const held = new Set(maps.filter((m) => m.kind !== 'linked').map((m) => m.kind.toUpperCase()));
    lines.push(`### ${entry.id}  (${[...held].sort().reverse().join('+') || 'no map'})`);
    if (entry.fe !== undefined) lines.push(`- FE  ${entry.fe}`);
    if (entry.be !== undefined) lines.push(`- BE  ${entry.be}`);
    for (const kind of ['fe', 'be'] as const) {
      if (entry[kind] !== undefined || !held.has(kind.toUpperCase())) continue;
      const root = readMap(entry.id, kind)?.metadata.root;
      lines.push(`- ${kind.toUpperCase()}  imported — scanned on ${root ?? '?'} (no directory on this machine)`);
    }
    if (maps.length === 0) lines.push('- no map yet — run `apiflow project scan <id>`');
    for (const m of maps) {
      const warn = m.unresolved > 0 ? ` · ${m.unresolved} unresolved` : '';
      const open = m.open > 0 ? ` · ${m.open} without auth` : '';
      lines.push(`- ${m.kind.padEnd(6)} ${m.endpoints} endpoints · ${m.screens} screens${open}${warn} · ${fmtAge(m.scannedAt)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function runSides(id: string, sides: Array<'fe' | 'be'>): void {
  const next = (i: number): void => {
    if (i >= sides.length) return;
    let failed = false;
    scanInBackground(id, sides[i], (event) => {
      if (event.kind === 'error') {
        failed = true;
        console.error(event.text);
      } else if (event.kind === 'done') {
        console.log(`${id}/${sides[i]} — ${event.text}`);
        next(i + 1);
      } else if (event.text.startsWith('wrote ') || event.text.startsWith('re-linked')) {
        console.log(event.text);
      }
    });
    // cm:guard The exit code is what CI reads. scanInBackground reports failure through the callback,
    // so a scan that died must still leave a non-zero code behind rather than a clean "done".
    process.on('exit', () => {
      if (failed) process.exitCode = 1;
    });
  };
  next(0);
}

function main(): void {
  tolerateClosedPipe();
  const args = process.argv.slice(2);
  const verb = args[0];
  const positional = args.slice(1).filter((a) => !a.startsWith('--'));
  const flag = (n: string): string | undefined => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

  try {
    if (verb === 'add') {
      const name = positional[0];
      if (name === undefined) throw new Error('missing project name');
      const maps: Array<{ kind: 'fe' | 'be'; file: string }> = [];
      for (const kind of ['fe', 'be'] as const) {
        const file = flag(`${kind}-map`);
        if (file !== undefined) maps.push({ kind, file });
      }
      // cm:guard Reads every map BEFORE the project is registered, so a bad path leaves no
      // half-created project behind — the import needs the project directory to exist to write into.
      for (const m of maps) readImportable(m.kind, m.file);
      const entry = addProject({
        name, fe: flag('fe'), be: flag('be'), id: flag('id'), hints: flag('hints'),
        imported: maps.map((m) => m.kind),
      });
      console.log(`Added **${entry.id}** — ${entry.name}`);
      if (entry.fe !== undefined) console.log(`- FE ${entry.fe}`);
      if (entry.be !== undefined) console.log(`- BE ${entry.be}`);
      for (const m of maps) {
        const done = importMap(entry.id, m.kind, m.file);
        console.log(`- ${m.kind.toUpperCase()} imported from ${done.from} — scanned on ${done.root}`);
      }
      console.log(`\nWorkspace: ${workspaceRoot()}`);
      return;
    }
    // cm:why Named `import`, not `add --map`, because it is the step people repeat: every time the
    // other machine re-scans, the same file lands again and the history picks up the new version.
    if (verb === 'import') {
      const id = positional[0];
      if (id === undefined) throw new Error('missing id');
      if (findProject(id) === undefined) throw new Error(`no project named ${id}`);
      const kinds = (['fe', 'be'] as const).filter((k) => flag(k) !== undefined);
      if (kinds.length === 0) throw new Error('needs --fe=<file.apimap> or --be=<file.apimap>');
      for (const kind of kinds) {
        const done = importMap(id, kind, flag(kind) as string);
        console.log(`Imported **${kind}** for ${id} from ${done.from}`);
        console.log(`- scanned on ${done.root} by ${done.generator}`);
        console.log(`- ${done.endpoints} endpoint(s) · ${done.screens} screen(s) · ${done.calls} call(s)`);
        console.log(`- written to ${done.file}`);
      }
      const entry = findProject(id) as ProjectEntry;
      const other = kinds.includes('fe') ? 'be' : 'fe';
      if (entry[other] === undefined && readMap(id, other) === null) {
        console.log(`\nNothing to reconcile against yet — ${id} has no ${other} map. Scan or import that side too.`);
      }
      return;
    }
    if (verb === 'ls' || verb === undefined) {
      const rows = collectRows();
      console.log(args.includes('--json') ? JSON.stringify(rows, null, 2) : renderList(rows));
      return;
    }
    // cm:why CI and a terminal need the same scan the UI button runs — same staging file, same
    // history write, same automatic re-link — so this reuses scanInBackground instead of shelling out
    // to scan-fe with a hand-built --out path, which is how the two would drift apart.
    if (verb === 'scan') {
      const id = positional[0];
      if (id === undefined) throw new Error('missing id');
      const entry = findProject(id);
      if (entry === undefined) throw new Error(`no project named ${id}`);
      const sides: Array<'fe' | 'be'> = [];
      const asked = args.includes('--fe') || args.includes('--be');
      if ((!asked || args.includes('--fe')) && entry.fe !== undefined) sides.push('fe');
      if ((!asked || args.includes('--be')) && entry.be !== undefined) sides.push('be');
      // cm:why Names the import when there is one: "no directory to scan" reads as a broken project,
      // when the truth is the side lives on another machine and arrives as a file.
      if (sides.length === 0) {
        const imported = (['fe', 'be'] as const)
          .filter((k) => entry[k] === undefined && readMap(id, k) !== null)
          .map((k) => `${k} (imported, scanned on ${readMap(id, k)?.metadata.root ?? '?'})`);
        const has = imported.length > 0 ? ` It has ${imported.join(' and ')} — re-import the file to update it.` : '';
        throw new Error(`${id} has no directory to scan on this machine.${has}`);
      }
      runSides(id, sides);
      return;
    }
    if (verb === 'rm') {
      const id = positional[0];
      if (id === undefined) throw new Error('missing id');
      console.log(removeProject(id) ? `Removed ${id} from the workspace (its maps stay on disk).` : `No project named ${id}.`);
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
