import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { scanOrigin } from './scanOrigin';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ApiMapFile } from '@junixlabs/apiflow-map';
import { createApiMap, endpointId, finalizeApiMap, parseMap, screenId } from '@junixlabs/apiflow-map';
import { addProject, findProject, readWorkspace, removeProject, slug, updateProject, workspaceRoot } from './registry';
import { hubProjects } from './hubData';
import { contentHash, historyOf, mapPath, projectDir, readMap, statusOf, writeMap } from './store';
import { endpointReliability, endpointState, summarize } from '@junixlabs/apiflow-map';
import { diffMaps, headlineFor } from '@junixlabs/apiflow-map';
import { scanInBackground } from './runScan';
import type { ScanEvent } from './runScan';
import { alertCounts, alerts } from '@junixlabs/apiflow-map';

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
    expect(slug('Đơn hàng nội bộ')).toBe('don-hang-noi-bo');   // diacritics still fold
  });

  it('stores roots absolute and reads them back', () => {
    addProject({ name: 'Webapp', fe: repo });
    expect(findProject('webapp')?.fe).toBe(repo);
    expect(readWorkspace().projects).toHaveLength(1);
  });

  it('refuses a root that is not an existing directory', () => {
    expect(() => addProject({ name: 'ghost', fe: join(repo, 'nope') })).toThrow(/is not an existing directory/);
  });

  it('refuses a project with neither side', () => {
    expect(() => addProject({ name: 'empty' })).toThrow(/an FE or a BE directory/);
  });

  it('refuses a duplicate id', () => {
    addProject({ name: 'Webapp', fe: repo });
    expect(() => addProject({ name: 'Webapp', fe: repo })).toThrow(/already exists/);
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
    expect(() => projectDir('../../etc')).toThrow(/invalid id/);
    expect(projectDir('webapp').startsWith(home)).toBe(true);
  });

  it('round-trips a map and records it in history', () => {
    const written = writeMap('webapp', 'fe', mapWith());
    expect(written.file).toBe(mapPath('webapp', 'fe'));
    expect(readMap('webapp', 'fe')?.metadata.name).toBe('demo');
    expect(readMap('webapp', 'be')).toBeNull();
  });

  // cm:why An unchanged repo re-scans to a byte-identical map, so a second write must land on the
  // SAME history entry — otherwise the history says "changed" every time nothing changed.
  it('does not add a history entry for an identical re-scan', () => {
    const first = writeMap('webapp', 'fe', mapWith());
    const second = writeMap('webapp', 'fe', mapWith());
    expect(second.history).toBe(first.history);
    const changed = writeMap('webapp', 'fe', mapWith({ metadata: { name: 'other', root: '/x', generator: 'g' } }));
    expect(changed.history).not.toBe(first.history);
  });

  it('reports which maps exist', () => {
    writeMap('webapp', 'fe', mapWith());
    const status = statusOf('webapp');
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
  // "the FE calls it and the API does not declare it", turning a missing half of the scan into a finding about the API.
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

describe('alerts', () => {
  const linked = mapWith({
    endpoints: [
      { id: 'get', method: 'GET', path: '/api/users', source: { file: 'api.php', line: 1 }, auth: true },
      { id: 'post', method: 'POST', path: '/api/users', source: { file: 'api.php', line: 2 }, auth: true },
      { id: 'put', method: 'PUT', path: '/api/users' },
      { id: 'ghost', method: 'GET', path: '/api/nowhere' },
      { id: 'open', method: 'GET', path: '/api/logs', source: { file: 'api.php', line: 3 }, auth: false },
      { id: 'dead', method: 'DELETE', path: '/api/old', source: { file: 'api.php', line: 4 }, auth: true },
    ],
    screens: [{ id: 's1', label: '/u', route: '/user/:id', source: { file: 'p.tsx', line: 1 } }],
    calls: [
      { screenId: 's1', endpointId: 'put', via: 'axios', confidence: 'exact', source: { file: 'edit.ts', line: 7 } },
      { screenId: 's1', endpointId: 'ghost', via: 'axios', confidence: 'guess', source: { file: 'g.ts', line: 3 } },
      { screenId: 's1', endpointId: 'get', via: 'axios', confidence: 'exact', source: { file: 'l.ts', line: 1 } },
    ],
  });

  it('separates a method mismatch from a path that does not exist', () => {
    const list = alerts(linked);
    const mismatch = list.find((a) => a.kind === 'method-mismatch');
    expect(mismatch).toMatchObject({ method: 'PUT', path: '/api/users', severity: 'high' });
    expect(mismatch?.detail).toContain('GET, POST');
    expect(mismatch?.screens).toEqual(['/user/:id']);
    expect(list.find((a) => a.kind === 'fe-only-path')).toMatchObject({ path: '/api/nowhere' });
  });

  // cm:why A guess-confidence mismatch may be an artefact of this tool's own path inference, so it
  // must not be filed next to a finding backed by a literal string in the source.
  it('grades severity by how well the call is known', () => {
    expect(alerts(linked).find((a) => a.path === '/api/nowhere')?.severity).toBe('low');
  });

  it('reports an open gate and an uncalled endpoint', () => {
    const kinds = alerts(linked).map((a) => a.kind);
    expect(kinds).toContain('open-auth');
    expect(kinds).toContain('uncalled');
    expect(alertCounts(alerts(linked)).high).toBeGreaterThanOrEqual(2);
  });

  it('says nothing about a missing side it never scanned', () => {
    const feOnly = mapWith({
      endpoints: [{ id: 'x', method: 'GET', path: '/a' }],
      screens: [{ id: 's', label: '/s', route: '/s', source: { file: 'p.tsx', line: 1 } }],
      calls: [{ screenId: 's', endpointId: 'x', via: 'f', confidence: 'exact', source: { file: 'a.ts', line: 1 } }],
    });
    expect(alerts(feOnly)).toEqual([]);
  });
});

describe('endpointReliability', () => {
  it('splits calls per endpoint and keeps the count alongside', () => {
    const m = mapWith({
      endpoints: [{ id: 'e', method: 'GET', path: '/a' }],
      screens: [{ id: 's', label: 'x', source: { file: 'p.tsx', line: 1 } }],
      calls: [
        { screenId: 's', endpointId: 'e', via: 'f', confidence: 'exact', source: { file: 'a.ts', line: 1 } },
        { screenId: 's', endpointId: 'e', via: 'f', confidence: 'guess', source: { file: 'a.ts', line: 2 } },
        { screenId: 's', endpointId: 'e', via: 'f', confidence: 'guess', source: { file: 'a.ts', line: 3 } },
      ],
    });
    expect(endpointReliability(m).get('e')).toEqual({ exact: 1, inferred: 0, guess: 2, calls: 3 });
  });
});

const callsOf = (spec: Array<[string, ApiMapFile['calls'][number]['confidence']]>): ApiMapFile['calls'] =>
  spec.map(([endpointId, confidence], i) => ({
    screenId: 's', endpointId, via: 'f', confidence, source: { file: 'a.ts', line: i + 1 },
  }));

const screen = { id: 's', label: '/s', route: '/s', source: { file: 'p.tsx', line: 1 } };

describe('diff', () => {
  it('says coverage grew while certainty fell, not just that the number went up', () => {
    const before = mapWith({ calls: callsOf([['e', 'exact'], ['e', 'exact']]) });
    const after = mapWith({ calls: callsOf([['e', 'exact'], ['e', 'exact'], ['e', 'guess'], ['e', 'guess']]) });
    expect(headlineFor(before, after)).toBe('Wider coverage, weaker certainty.');
  });

  it('does not claim more certainty when only coverage moved', () => {
    const before = mapWith({ calls: callsOf([['e', 'exact'], ['e', 'guess']]) });
    const after = mapWith({ calls: callsOf([['e', 'exact'], ['e', 'guess'], ['e', 'exact'], ['e', 'guess']]) });
    expect(headlineFor(before, after)).toBe('Wider coverage, certainty about the same.');
  });

  it('calls a rescan that found the same thing twice unchanged', () => {
    const m = mapWith({ calls: callsOf([['e', 'exact'], ['e', 'guess']]) });
    expect(headlineFor(m, m)).toBe('No meaningful change.');
  });

  it('does not congratulate a scan that lost calls', () => {
    const before = mapWith({ calls: callsOf([['e', 'exact'], ['e', 'guess'], ['e', 'guess']]) });
    const after = mapWith({ calls: callsOf([['e', 'exact']]) });
    expect(headlineFor(before, after)).toBe('Narrower coverage, what is left is firmer.');
  });

  it('names the screens that lose an endpoint, so removal is actionable', () => {
    const before = mapWith({
      endpoints: [{ id: 'e', method: 'GET', path: '/a' }],
      screens: [screen],
      calls: callsOf([['e', 'exact']]),
    });
    const d = diffMaps(before, mapWith({ screens: [screen] }));
    expect(d.endpoints.removed).toEqual([{ method: 'GET', path: '/a', screens: ['/s'] }]);
    expect(d.endpoints.added).toEqual([]);
  });

  it('reports an auth gate that opened as a change, not as a new endpoint', () => {
    const before = mapWith({ endpoints: [{ id: 'e', method: 'GET', path: '/a', auth: true }] });
    const after = mapWith({ endpoints: [{ id: 'e', method: 'GET', path: '/a', auth: false }] });
    const d = diffMaps(before, after);
    expect(d.endpoints.added).toEqual([]);
    expect(d.endpoints.changed[0].detail).toBe('auth gate: auth → no auth');
  });
});

const collect = (id: string, kind: 'fe' | 'be'): Promise<ScanEvent[]> =>
  new Promise((resolve) => {
    const events: ScanEvent[] = [];
    scanInBackground(id, kind, (event) => {
      events.push(event);
      if (event.kind !== 'log') resolve(events);
    });
    // cm:guard Resolves on the guard branches too — they answer synchronously, before this promise
    // body finishes, so the callback above has already fired and nothing would ever settle it.
    if (events.some((e) => e.kind !== 'log')) resolve(events);
  });

describe('scanInBackground', () => {
  it('refuses an id that is not in the registry instead of scanning something else', async () => {
    expect(await collect('khong-co', 'fe')).toEqual([{ kind: 'error', text: 'no project named khong-co' }]);
  });

  it('says which side was never declared rather than reporting an empty map', async () => {
    addProject({ name: 'fe only', fe: repo });
    expect(await collect('fe-only', 'be')).toEqual([{ kind: 'error', text: 'fe-only has no BE directory' }]);
  });

  it('runs a real scan and leaves no staging file behind', async () => {
    mkdirSync(join(repo, 'src'), { recursive: true });
    writeFileSync(join(repo, 'src', 'api.ts'), "export const load = () => fetch('/api/v1/things');\n");
    addProject({ name: 'tiny', fe: repo });

    const events = await collect('tiny', 'fe');
    expect(events[events.length - 1].kind).toBe('done');
    expect(readMap('tiny', 'fe')?.endpoints.map((e) => e.path)).toEqual(['/api/v1/things']);
    expect(existsSync(join(projectDir('tiny'), '.fe.scanning.apimap'))).toBe(false);
  }, 60_000);
});

describe('history order', () => {
  const withCalls = (n: number) =>
    mapWith({ calls: callsOf(Array.from({ length: n }, () => ['e', 'exact'] as const)) });

  it('keeps the scan order even when the newer map hashes lower than the older one', () => {
    addProject({ name: 'ord', fe: repo });
    const names: string[] = [];
    // cm:guard These three counts hash out of alphabetical order on purpose — with counts that
    // happen to hash ascending, the assertion below passes against the old sorted implementation.
    for (const n of [1, 2, 7]) names.push(writeMap('ord', 'fe', withCalls(n)).history);
    const seen = historyOf('ord', 'fe');
    expect(seen).toEqual(names.map((h) => h.split('/').pop()));
    // cm:why Asserts the alphabetical order differs, otherwise the test passes on both the sorted
    // implementation and the ordered one and proves nothing.
    expect([...seen].sort()).not.toEqual(seen);
  });

  it('reads a revert as a change back, not as the change itself', () => {
    addProject({ name: 'rev', fe: repo });
    writeMap('rev', 'fe', withCalls(1));
    writeMap('rev', 'fe', withCalls(4));
    writeMap('rev', 'fe', withCalls(1));
    const entries = historyOf('rev', 'fe');
    expect(entries).toHaveLength(3);
    const read = (f: string) => parseMap(readFileSync(join(projectDir('rev'), 'history', f), 'utf8'));
    expect(diffMaps(read(entries[1]), read(entries[2])).headline).toBe('Narrower coverage.');
  });

  it('does not log a re-scan that found exactly the same map', () => {
    addProject({ name: 'same', fe: repo });
    writeMap('same', 'fe', withCalls(2));
    writeMap('same', 'fe', withCalls(2));
    expect(historyOf('same', 'fe')).toHaveLength(1);
  });

  it('adopts a history written before the order log existed', () => {
    addProject({ name: 'legacy', fe: repo });
    writeMap('legacy', 'fe', withCalls(1));
    writeMap('legacy', 'fe', withCalls(4));
    rmSync(join(projectDir('legacy'), 'history', 'order'));
    writeMap('legacy', 'fe', withCalls(9));
    expect(historyOf('legacy', 'fe')).toHaveLength(3);
  });
});

describe('updateProject', () => {
  let other: string;

  beforeEach(() => {
    other = mkdtempSync(join(tmpdir(), 'apiflow-other-'));
    addProject({ name: 'moved root', fe: repo, be: repo, id: 'doi-goc' });
  });

  afterEach(() => rmSync(other, { recursive: true, force: true }));

  it('moves a root and leaves the id alone, because the maps live under it', () => {
    const before = mapPath('doi-goc', 'fe');
    expect(updateProject('doi-goc', { fe: other }).fe).toBe(other);
    expect(findProject('doi-goc')?.id).toBe('doi-goc');
    expect(mapPath('doi-goc', 'fe')).toBe(before);
  });

  it('clears a side on null and leaves it alone on undefined', () => {
    expect(updateProject('doi-goc', { be: null }).be).toBeUndefined();
    expect(updateProject('doi-goc', { name: 'same again' }).fe).toBe(repo);
  });

  it('refuses to leave a project with neither side', () => {
    updateProject('doi-goc', { be: null });
    expect(() => updateProject('doi-goc', { fe: null })).toThrow(/an FE or a BE directory/);
  });

  it('refuses a root that is not a directory, and keeps the old one', () => {
    expect(() => updateProject('doi-goc', { fe: join(other, 'nope') })).toThrow(/is not an existing directory/);
    expect(findProject('doi-goc')?.fe).toBe(repo);
  });

  it('refuses an id that is not registered', () => {
    expect(() => updateProject('khong-co', { name: 'x' })).toThrow(/no project named/);
  });

  it('refuses a blank name', () => {
    expect(() => updateProject('doi-goc', { name: '   ' })).toThrow(/name must not be blank/);
  });
});

describe('hub staleness', () => {
  it('reports the root a map was scanned from once the project points elsewhere', () => {
    const moved = mkdtempSync(join(tmpdir(), 'apiflow-moved-'));
    addProject({ name: 'lech', fe: repo });
    writeMap('lech', 'fe', mapWith({ metadata: { name: 'lech', root: scanOrigin(repo), generator: 'apiflow test' } }));
    expect(hubProjects()[0].maps[0].scannedFrom).toBeUndefined();

    updateProject('lech', { fe: moved });
    // cm:why The map is NOT deleted when a root moves, so this flag is the only thing standing
    // between the reader and a card of numbers measured on a different repo.
    expect(hubProjects()[0].maps[0].scannedFrom).toBe(scanOrigin(repo));
    rmSync(moved, { recursive: true, force: true });
  });

  it('accepts a linked map whose root names both sides', () => {
    addProject({ name: 'ghep', fe: repo, be: repo });
    writeMap('ghep', 'linked', mapWith({
      metadata: { name: 'ghep', root: `${scanOrigin(repo)} + ${scanOrigin(repo)}`, generator: 'apiflow link/1' },
    }));
    expect(hubProjects()[0].maps[0].scannedFrom).toBeUndefined();
  });
});

describe('a BE half too thin to compare', () => {
  // cm:why This is the webapp case measured on 2026-08-20: 2 routes read out of 103, because the
  // mount sites carry no literal path.
  // cm:why Without the guard the map reports 86 endpoints the API "does not declare" — and an agent
  // handed that list goes and edits an API that was never wrong.
  function thinBe(): ApiMapFile {
    const map = createApiMap('thin', 'github.com/acme/app', 'apiflow link/1');
    const declared = endpointId('GET', '/api/media/{param}');
    map.endpoints.push({ id: declared, method: 'GET', path: '/api/media/{param}', source: { file: 'src/index.ts', line: 9 }, auth: true });
    for (let i = 0; i < 5; i++) {
      const id = endpointId('GET', `/projects/${i}`);
      map.endpoints.push({ id, method: 'GET', path: `/projects/${i}` });
      const sc = screenId(`/p/${i}`, `src/pages/p${i}.tsx`, 'P');
      map.screens.push({ id: sc, label: `/p/${i}`, route: `/p/${i}`, source: { file: `src/pages/p${i}.tsx`, line: 1 } });
      map.calls.push({ screenId: sc, endpointId: id, via: 'fetch', confidence: 'inferred', source: { file: 'src/api.ts', line: 3 } });
    }
    return finalizeApiMap(map);
  }

  it('blames the reader, not the API, and only once', () => {
    const list = alerts(thinBe());
    const counts = alertCounts(list);
    expect(counts.byKind['fe-only-path']).toBe(0);
    expect(counts.byKind['be-partial']).toBe(1);
    expect(list.find((a) => a.kind === 'be-partial')?.detail).toContain('the reader failing to read');
  });

  it('leaves the comparison alone once the BE side is the bigger half', () => {
    const map = thinBe();
    for (let i = 0; i < 20; i++) {
      const id = endpointId('GET', `/declared/${i}`);
      map.endpoints.push({ id, method: 'GET', path: `/declared/${i}`, source: { file: 'src/index.ts', line: 10 + i }, auth: true });
    }
    const counts = alertCounts(alerts(finalizeApiMap(map)));
    expect(counts.byKind['be-partial']).toBe(0);
    expect(counts.byKind['fe-only-path']).toBe(5);
  });
});
