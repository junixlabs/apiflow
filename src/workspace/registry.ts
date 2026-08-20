import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { isAbsolute, join, resolve } from 'path';

export interface ProjectEntry {
  id: string;
  name: string;
  fe?: string;
  be?: string;
  hints?: string;
}

export interface Workspace {
  version: 1;
  projects: ProjectEntry[];
}

export const ID = /^[a-z0-9][a-z0-9-]{0,62}$/;

// cm:why Env-overridable so a test never touches the real workspace, and so a machine can keep more
// than one — the path is read on every call, never captured at import time.
export function workspaceRoot(): string {
  const override = process.env.APIFLOW_HOME;
  return override !== undefined && override !== '' ? resolve(override) : join(homedir(), '.apiflow');
}

function workspaceFile(): string {
  return join(workspaceRoot(), 'workspace.json');
}

export function slug(name: string): string {
  const out = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
  return ID.test(out) ? out : '';
}

export function readWorkspace(): Workspace {
  const file = workspaceFile();
  if (!existsSync(file)) return { version: 1, projects: [] };
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as Workspace;
  if (parsed.version !== 1) throw new Error(`unsupported workspace version: ${String(parsed.version)}`);
  return { version: 1, projects: parsed.projects ?? [] };
}

export function writeWorkspace(workspace: Workspace): void {
  mkdirSync(workspaceRoot(), { recursive: true });
  const sorted = [...workspace.projects].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(workspaceFile(), `${JSON.stringify({ version: 1, projects: sorted }, null, 2)}\n`);
}

export function findProject(id: string): ProjectEntry | undefined {
  return readWorkspace().projects.find((p) => p.id === id);
}

// cm:guard Every root is stored absolute and verified to be a directory HERE, so no other layer has
// to re-check it — the server resolves an id to a path and must never widen what a path may be.
export function checkRoot(label: string, value: string): string {
  const abs = isAbsolute(value) ? value : resolve(value);
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    throw new Error(`${label} không phải một thư mục đang tồn tại: ${abs}`);
  }
  return abs;
}

export interface AddOptions {
  name: string;
  fe?: string;
  be?: string;
  hints?: string;
  id?: string;
}

export function addProject(options: AddOptions): ProjectEntry {
  const id = options.id !== undefined && options.id !== '' ? options.id : slug(options.name);
  if (!ID.test(id)) throw new Error(`id không hợp lệ (chỉ a-z, 0-9, dấu gạch): ${id}`);
  if (options.fe === undefined && options.be === undefined) {
    throw new Error('cần ít nhất một trong --fe hoặc --be');
  }
  const workspace = readWorkspace();
  if (workspace.projects.some((p) => p.id === id)) throw new Error(`project đã tồn tại: ${id}`);

  const entry: ProjectEntry = { id, name: options.name };
  if (options.fe !== undefined) entry.fe = checkRoot('--fe', options.fe);
  if (options.be !== undefined) entry.be = checkRoot('--be', options.be);
  if (options.hints !== undefined) entry.hints = resolve(options.hints);

  writeWorkspace({ version: 1, projects: [...workspace.projects, entry] });
  return entry;
}

export function removeProject(id: string): boolean {
  const workspace = readWorkspace();
  const kept = workspace.projects.filter((p) => p.id !== id);
  if (kept.length === workspace.projects.length) return false;
  writeWorkspace({ version: 1, projects: kept });
  return true;
}
