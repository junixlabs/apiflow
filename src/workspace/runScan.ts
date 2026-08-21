import { spawn } from 'child_process';
import { existsSync, readFileSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { linkMaps, parseMap } from '../core/apimap';
import { findProject } from './registry';
import { projectDir, readMap, writeMap } from './store';

export interface ScanEvent {
  kind: 'log' | 'done' | 'error';
  text: string;
}

// cm:guard Resolved from this module, not from process.cwd(): `apiflow ui` is normally run from
// inside the project being looked at, and a cwd-relative path makes the scan button fail there.
const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'cli.js');

// cm:why Spawns the CLI instead of calling the scanner in-process, against the first draft of the
// plan: the scanners are synchronous and CPU-bound for ~40s on a real repo, so running them here
// freezes the event loop — no other request is served and the progress stream cannot even flush.
export function scanInBackground(
  id: string,
  kind: 'fe' | 'be',
  onEvent: (event: ScanEvent) => void
): { cancel: () => void } {
  const entry = findProject(id);
  if (entry === undefined) {
    onEvent({ kind: 'error', text: `no project named ${id}` });
    return { cancel: () => undefined };
  }
  const root = kind === 'fe' ? entry.fe : entry.be;
  if (root === undefined) {
    onEvent({ kind: 'error', text: `${id} has no ${kind.toUpperCase()} directory` });
    return { cancel: () => undefined };
  }

  // cm:guard Writes to a staging file, never straight onto the live map: the child could die halfway,
  // and a truncated .apimap in place would look like a project that suddenly lost most of its map.
  const staging = join(projectDir(id), `.${kind}.scanning.apimap`);
  const args = [CLI, kind === 'fe' ? 'scan-fe' : 'scan-be', root, `--name=${entry.name}`, `--out=${staging}`];
  if (entry.hints !== undefined && kind === 'fe') args.push(`--hints=${entry.hints}`);

  const child = spawn(process.execPath, args, { cwd: dirname(dirname(CLI)) });
  const push = (buf: Buffer) => {
    for (const line of buf.toString('utf8').split('\n')) {
      if (line.trim() !== '') onEvent({ kind: 'log', text: line });
    }
  };
  child.stdout.on('data', push);
  child.stderr.on('data', push);

  child.on('close', (code) => {
    if (code !== 0 || !existsSync(staging)) {
      onEvent({ kind: 'error', text: `scan failed (code ${String(code)})` });
      rmSync(staging, { force: true });
      return;
    }
    try {
      const map = parseMap(readFileSync(staging, 'utf8'));
      const written = writeMap(id, kind, map);
      rmSync(staging, { force: true });
      onEvent({ kind: 'log', text: `wrote ${written.file}` });
      relinkIfPossible(id, onEvent);
      onEvent({ kind: 'done', text: `${kind} done — ${map.endpoints.length} endpoints · ${map.screens.length} screens` });
    } catch (err) {
      rmSync(staging, { force: true });
      onEvent({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  });

  return { cancel: () => child.kill('SIGTERM') };
}

// cm:why Re-links right after a side is re-scanned, because a stale `linked` map is worse than none:
// it looks current and answers the impact question with half of it out of date.
export function relinkIfPossible(id: string, onEvent: (event: ScanEvent) => void): void {
  const fe = readMap(id, 'fe');
  const be = readMap(id, 'be');
  if (fe === null || be === null) return;
  const entry = findProject(id);
  const joined = linkMaps(fe, be, `${fe.metadata.name}+${be.metadata.name}`);
  writeMap(id, 'linked', joined);
  onEvent({ kind: 'log', text: `re-linked: ${joined.endpoints.length} endpoints · ${entry?.id ?? id}/linked.apimap` });
}
