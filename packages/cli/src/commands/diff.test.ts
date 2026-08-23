import { describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile } from '@junixlabs/apiflow-map';
import { createApiMap, endpointId, fieldId, finalizeApiMap, serializeMap, sideOf } from '@junixlabs/apiflow-map';
import { diffAgainst, renderDiff, renderMapDiff } from './diff';

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'cli.js');

function handWritten(paths: string[], withField: boolean): ApiMapFile {
  const map = createApiMap('planner', 'github.com/acme/planner', 'hand-written/1');
  for (const path of paths) {
    const id = endpointId('GET', path);
    map.endpoints.push({ id, method: 'GET', path });
    if (withField) map.fields.push({ id: fieldId(id, 'id'), endpointId: id, path: 'id', kind: 'response' });
  }
  return finalizeApiMap(map);
}

function write(map: ApiMapFile, dir: string, name: string): string {
  const file = join(dir, name);
  writeFileSync(file, serializeMap(map));
  return file;
}

function run(args: string[]): { status: number; out: string } {
  try {
    return { status: 0, out: execFileSync(process.execPath, [CLI, 'diff', ...args], { encoding: 'utf8' }) };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { status: err.status ?? -1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

describe('apiflow diff', () => {
  // cm:why The case the command exists for. `check` refuses a hand-written generator outright, so a
  // contract map written before the source could not be compared to anything until now.
  it('compares maps whose generator check refuses', () => {
    const map = handWritten(['/tasks'], false);
    expect(sideOf(map)).toBeNull();
    const result = diffAgainst(map, handWritten(['/tasks'], false));
    expect(result.diverged).toBe(false);
    expect(result.identical).toBe(true);
  });

  it('names the endpoint the build added and the one it dropped', () => {
    const result = diffAgainst(handWritten(['/tasks'], false), handWritten(['/projects'], false));
    expect(result.diverged).toBe(true);
    const text = renderDiff(result, 'design.apimap', 'built.apimap');
    expect(text).toContain('In the after map, missing from the before map');
    expect(text).toContain('`GET /projects`');
    expect(text).toContain('In the before map, gone from the after map');
    expect(text).toContain('`GET /tasks`');
  });

  // cm:why A field vanishing while the endpoint list holds is the failure a contract gate is bought
  // for, and every counter MapDiff had before this change stays flat through it.
  it('diverges when a field disappears and no endpoint moved', () => {
    const result = diffAgainst(handWritten(['/tasks'], true), handWritten(['/tasks'], false));
    expect(result.diff.endpoints.added).toHaveLength(0);
    expect(result.diff.endpoints.removed).toHaveLength(0);
    expect(result.diff.fields).toEqual({ before: 1, after: 0 });
    expect(result.diverged).toBe(true);
  });

  // cm:why Found by this command on its own first transcript: a design map and a build that swapped
  // one route for another got the headline "No meaningful change." above a list of the two routes.
  it('does not call a swapped endpoint no meaningful change', () => {
    const result = diffAgainst(handWritten(['/tasks'], false), handWritten(['/projects'], false));
    expect(result.diff.headline).toBe('The same number of endpoints, but not the same endpoints.');
  });

  // cm:guard The swap headline is a fallback, never a preemption: the rule above it is the louder
  // fact, and a reader who loses "fewer of them have a declared shape" has lost the actionable half.
  it('keeps the shape headline when a swap happens alongside it', () => {
    const result = diffAgainst(handWritten(['/tasks'], true), handWritten(['/projects'], false));
    expect(result.diff.headline).toBe('Not the same endpoints, and fewer of them have a declared shape.');
  });

  it('reports the counted surface as matching when only the bytes moved', () => {
    const before = handWritten(['/tasks'], false);
    const after = createApiMap('planner', 'github.com/acme/planner', 'apiflow scan-be/4');
    after.endpoints.push({ id: endpointId('GET', '/tasks'), method: 'GET', path: '/tasks' });
    const result = diffAgainst(before, finalizeApiMap(after));
    expect(result.diverged).toBe(false);
    expect(result.identical).toBe(false);
    expect(renderDiff(result, 'a', 'b')).toContain('the counted surface matches');
  });

  it('names the sides its caller gave it', () => {
    const diff = diffAgainst(handWritten([], false), handWritten(['/tasks'], false)).diff;
    expect(renderMapDiff(diff, { before: 'the map', after: 'the code' }).join('\n')).toContain(
      'In the code, missing from the map',
    );
  });

  describe('as a CI gate', () => {
    it('exits 0 on a match and 1 on a divergence', () => {
      const dir = mkdtempSync(join(tmpdir(), 'apiflow-diff-'));
      try {
        const a = write(handWritten(['/tasks'], false), dir, 'a.apimap');
        const b = write(handWritten(['/tasks'], false), dir, 'b.apimap');
        const c = write(handWritten(['/tasks', '/projects'], false), dir, 'c.apimap');
        expect(run([a, b]).status).toBe(0);
        expect(run([a, c]).status).toBe(1);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    // cm:guard 2 is "no verdict", never "they differ": a CI step that treats any non-zero as drift
    // would report an unreadable path as a broken contract.
    it('exits 2 when it cannot answer, not 1', () => {
      const dir = mkdtempSync(join(tmpdir(), 'apiflow-diff-'));
      try {
        const a = write(handWritten(['/tasks'], false), dir, 'a.apimap');
        expect(run([a]).status).toBe(2);
        expect(run([a, join(dir, 'missing.apimap')]).status).toBe(2);
        writeFileSync(join(dir, 'junk.apimap'), 'not json');
        expect(run([a, join(dir, 'junk.apimap')]).status).toBe(2);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    // cm:why A hand-written map is the input this command was built for, and omitting an empty
    // array is the ordinary way to write one — it reached diffMaps and died on `.length`.
    // cm:guard That crash exited 1, the "diverged" code, so CI blamed the build for a bad contract.
    it('exits 2 on a map that omits an empty collection, naming the key', () => {
      const dir = mkdtempSync(join(tmpdir(), 'apiflow-diff-'));
      try {
        const a = write(handWritten(['/tasks'], false), dir, 'a.apimap');
        const partial = join(dir, 'partial.apimap');
        writeFileSync(
          partial,
          JSON.stringify({
            version: 1,
            metadata: { name: 'planner', root: 'github.com/acme/planner', generator: 'hand-written/1' },
            screens: [],
            endpoints: [{ id: 'ep_get-tasks', method: 'GET', path: '/tasks' }],
            fields: [],
            calls: [],
            unresolved: [],
          }),
        );
        const outcome = run([a, partial]);
        expect(outcome.status).toBe(2);
        expect(outcome.out).toContain('missing "reads"');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    // cm:guard Every command that reads a map path refuses through the one loader, and each names the
    // code that means "no verdict" in ITS protocol. Add a seventh without it and this test says so.
    // cm:guard `impact` must NOT be 2: 2 is its "nothing matched", an answer, so a map it could not
    // read landing there tells a hook branching on 0-vs-2 that no screens break.
    it('is the same refusal from every command that reads a map', () => {
      const dir = mkdtempSync(join(tmpdir(), 'apiflow-diff-'));
      try {
        const bad = join(dir, 'bad.apimap');
        writeFileSync(bad, '{"version":1,"metadata":{"name":"x","root":"y","generator":"hand-written/1"},"screens":[],"endpoints":[],"fields":[],"calls":[],"unresolved":[]}');
        const cases: Array<{ argv: string[]; code: number }> = [
          { argv: ['impact', bad, '--json'], code: 1 },
          { argv: ['view', bad], code: 2 },
          { argv: ['probe', bad, '--emit'], code: 2 },
          { argv: ['link', bad, bad], code: 2 },
          { argv: ['check', bad], code: 2 },
        ];
        for (const { argv, code } of cases) {
          let status = 0;
          let err = '';
          try {
            execFileSync(process.execPath, [CLI, ...argv], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
          } catch (e) {
            const thrown = e as { status?: number; stderr?: string };
            status = thrown.status ?? -1;
            err = thrown.stderr ?? '';
          }
          expect(status, `apiflow ${argv[0]}`).toBe(code);
          // cm:guard Asserts the LOADER's sentence, not just the parse message. An uncaught throw
          // prints the same message and exits 1, so impact's case would pass without the loader.
          expect(err, `apiflow ${argv[0]}`).toMatch(/^Cannot read /);
          expect(err, `apiflow ${argv[0]}`).toContain('missing "reads"');
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    // cm:guard The two states `impact` must keep apart. Same exit code for both and a hook reading
    // the documented 0-vs-2 protocol reports a file it could not open as "nothing breaks".
    it('keeps impact cannot-read distinct from impact nothing-matched', () => {
      const dir = mkdtempSync(join(tmpdir(), 'apiflow-diff-'));
      try {
        const good = write(handWritten(['/tasks'], false), dir, 'good.apimap');
        const bad = join(dir, 'bad.apimap');
        writeFileSync(bad, '{"version":1,"metadata":{"name":"x","root":"y","generator":"hand-written/1"},"screens":[],"endpoints":[],"fields":[],"calls":[],"unresolved":[]}');
        const impact = (map: string): { status: number; stdout: string } => {
          try {
            return { status: 0, stdout: execFileSync(process.execPath, [CLI, 'impact', map, '--field=nope', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
          } catch (e) {
            const thrown = e as { status?: number; stdout?: string };
            return { status: thrown.status ?? -1, stdout: thrown.stdout ?? '' };
          }
        };
        const missed = impact(good);
        expect(missed.status).toBe(2);
        expect(JSON.parse(missed.stdout)).toMatchObject({ found: false });
        const unreadable = impact(bad);
        expect(unreadable.status).toBe(1);
        expect(unreadable.stdout).toBe('');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('emits json carrying the verdict and the diff', () => {
      const dir = mkdtempSync(join(tmpdir(), 'apiflow-diff-'));
      try {
        const a = write(handWritten(['/tasks'], false), dir, 'a.apimap');
        const c = write(handWritten(['/tasks', '/projects'], false), dir, 'c.apimap');
        const parsed = JSON.parse(run([a, c, '--json']).out) as {
          diverged: boolean;
          identical: boolean;
          diff: { endpoints: { added: Array<{ path: string }> }; fields: { before: number } };
        };
        expect(parsed.diverged).toBe(true);
        expect(parsed.identical).toBe(false);
        expect(parsed.diff.endpoints.added.map((e) => e.path)).toEqual(['/projects']);
        expect(parsed.diff.fields.before).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
