import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ApiMapFile } from '../core/apimap';
import { addProject, findProject, readWorkspace, removeProject, slug, workspaceRoot } from './registry';
import { contentHash, mapPath, projectDir, readMap, statusOf, writeMap } from './store';
import { endpointState, summarize } from './summary';

let home: string;
let repo: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'apiflow-home-'));
  repo = mkdtempSync(join(tmpdir(), 'apiflow-repo-'));
  process.env.APIFLOW_HOME = home;
});

afterEach(() => {
  delete process.env.APIFLOW_HOME;
  rmSync(home, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

const mapWith = (over: Partial<ApiMapFile> = {}): ApiMapFile => ({
  version: 1,
  metadata: { name: 'demo', root: '/tmp/demo', generator: 'apiflow test' },
  screens: [],
  endpoints: [],
  fields: [],
  calls: [],
  reads: [],
  unresolved: [],
  ...over,
});

describe('registry', () => {
  it('honours APIFLOW_HOME so a test never touches the real workspace', () => {
    expect(workspaceRoot()).toBe(home);
  });

  it('slugs a Vietnamese name into a usable id', () => {
    expect(slug('Đơn hàng nội bộ')).toBe('don-hang-noi-bo');
  });

  it('stores roots absolute and reads them back', () => {
    addProject({ name: 'Adminhub', fe: repo });
    expect(findProject('adminhub')?.fe).toBe(repo);
    expect(readWorkspace().projects).toHaveLength(1);
  });

  it('refuses a root that is not an existing directory', () => {
    expect(() => addProject({ name: 'ghost', fe: join(repo, 'nope') })).toThrow(/không phải một thư mục/);
  });

  it('refuses a project with neither side', () => {
    expect(() => addProject({ name: 'empty' })).toThrow(/--fe hoặc --be/);
  });

  it('refuses a duplicate id', () => {
    addProject({ name: 'Adminhub', fe: repo });
    expect(() => addProject({ name: 'Adminhub', fe: repo })).toThrow(/đã tồn tại/);
  });

  it('removes only the named project', () => {
    addProject({ name: 'a', fe: repo });
    addProject({ name: 'b', fe: repo });
    expect(removeProject('a')).toBe(true);
    expect(removeProject('a')).toBe(false);
    expect(readWorkspace().projects.map((p) => p.id)).toEqual(['b']);
  });

  it('writes the registry sorted so the file does not churn', () => {
    addProject({ name: 'zebra', fe: repo });
    addProject({ name: 'alpha', fe: repo });
    const raw = readFileSync(join(home, 'workspace.json'), 'utf8');
    expect(raw.indexOf('"alpha"')).toBeLessThan(raw.indexOf('"zebra"'));
  });
});

describe('store', () => {
  it('keeps every id inside the workspace', () => {
    expect(() => projectDir('../../etc')).toThrow(/id không hợp lệ/);
    expect(projectDir('adminhub').startsWith(home)).toBe(true);
  });

  it('round-trips a map and records it in history', () => {
    const written = writeMap('adminhub', 'fe', mapWith());
    expect(written.file).toBe(mapPath('adminhub', 'fe'));
    expect(readMap('adminhub', 'fe')?.metadata.name).toBe('demo');
    expect(readMap('adminhub', 'be')).toBeNull();
  });

  // cm:why An unchanged repo re-scans to a byte-identical map, so a second write must land on the
  // SAME history entry — otherwise the history says "changed" every time nothing changed.
  it('does not add a history entry for an identical re-scan', () => {
    const first = writeMap('adminhub', 'fe', mapWith());
    const second = writeMap('adminhub', 'fe', mapWith());
    expect(second.history).toBe(first.history);
    const changed = writeMap('adminhub', 'fe', mapWith({ metadata: { name: 'other', root: '/x', generator: 'g' } }));
    expect(changed.history).not.toBe(first.history);
  });

  it('reports which maps exist', () => {
    writeMap('adminhub', 'fe', mapWith());
    const status = statusOf('adminhub');
    expect(status.find((s) => s.kind === 'fe')?.exists).toBe(true);
    expect(status.find((s) => s.kind === 'linked')?.exists).toBe(false);
  });

  it('hashes content, not identity', () => {
    expect(contentHash('abc')).toBe(contentHash('abc'));
    expect(contentHash('abc')).not.toBe(contentHash('abd'));
  });
});

describe('summary', () => {
  const map = mapWith({
    endpoints: [
      { id: 'e1', method: 'GET', path: '/a', source: { file: 'r.php', line: 1 }, auth: true },
      { id: 'e2', method: 'GET', path: '/b', source: { file: 'r.php', line: 2 }, auth: false },
      { id: 'e3', method: 'GET', path: '/c' },
    ],
    screens: [{ id: 's1', label: '/x', route: '/x', source: { file: 'x.tsx', line: 1 } }],
    calls: [
      { screenId: 's1', endpointId: 'e1', via: 'axios', confidence: 'exact', source: { file: 'x.tsx', line: 3 } },
      { screenId: 's1', endpointId: 'e3', via: 'axios', confidence: 'guess', source: { file: 'x.tsx', line: 4 } },
    ],
  });

  it('splits endpoints into the three states the UI colours', () => {
    expect(summarize(map)).toMatchObject({ both: 1, uncalled: 1, feOnly: 1, auth: 1, open: 1, murky: 1 });
    expect(endpointState(map, 'e1')).toBe('both');
    expect(endpointState(map, 'e2')).toBe('uncalled');
    expect(endpointState(map, 'e3')).toBe('feOnly');
  });

  it('counts confidence per call, not per endpoint', () => {
    expect(summarize(map).confidence).toEqual({ exact: 1, inferred: 0, guess: 1 });
  });
});

describe('one-sided scans', () => {
  const feOnlyMap = mapWith({
    endpoints: [
      { id: 'e1', method: 'GET', path: '/a' },
      { id: 'e2', method: 'GET', path: '/b' },
    ],
    screens: [{ id: 's1', label: '/x', route: '/x', source: { file: 'x.tsx', line: 1 } }],
    calls: [{ screenId: 's1', endpointId: 'e1', via: 'axios', confidence: 'exact', source: { file: 'x.tsx', line: 2 } }],
  });

  const beOnlyMap = mapWith({
    endpoints: [{ id: 'e1', method: 'GET', path: '/a', source: { file: 'api.php', line: 1 } }],
  });

  // cm:why This is the defect the hub shipped with: a FE-only scan called every endpoint
  // "FE gọi mà API không khai", turning a missing half of the scan into a finding about the API.
  it('never claims the API is missing an endpoint when the BE was never scanned', () => {
    const sum = summarize(feOnlyMap);
    expect(sum).toMatchObject({ feOnly: 0, unpaired: 2, hasBe: false, hasFe: true });
    expect(endpointState(feOnlyMap, 'e1')).toBe('unpaired');
    expect(endpointState(feOnlyMap, 'e2')).toBe('unpaired');
  });

  it('never claims an endpoint is uncalled when the FE was never scanned', () => {
    const sum = summarize(beOnlyMap);
    expect(sum).toMatchObject({ uncalled: 0, unpaired: 1, hasBe: true, hasFe: false });
    expect(endpointState(beOnlyMap, 'e1')).toBe('unpaired');
  });
});
