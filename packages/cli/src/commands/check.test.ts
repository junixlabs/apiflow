import { describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createApiMap, endpointId, fieldId, finalizeApiMap } from '@junixlabs/apiflow-map';
import { checkAgainst, readerChanged, renderCheck, rescan } from './check';
import { sideOf } from '@junixlabs/apiflow-map';
import { GENERATOR as BE_GENERATOR } from './scanBe';
import { headlineFor } from '@junixlabs/apiflow-map';

function repo(): string {
  const root = mkdtempSync(join(tmpdir(), 'apiflow-check-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  writeFileSync(join(root, '.git', 'config'), '[remote "origin"]\n\turl = git@github.com:acme/app.git\n');
  mkdirSync(join(root, 'src', 'pages'), { recursive: true });
  writeFileSync(
    join(root, 'src', 'pages', 'users.tsx'),
    "export function Users() {\n  fetch('/api/users');\n  return null;\n}\n"
  );
  return root;
}

describe('apiflow check', () => {
  // cm:guard Exit 1 means "the map drifted". A malformed map reported as 1 makes CI blame the code
  // for a broken file, which is what a raw stack trace out of parseMap used to do.
  it('exits 2, not 1, on a map it cannot read', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiflow-check-bad-'));
    try {
      const bad = join(dir, 'bad.apimap');
      writeFileSync(bad, '{"version":1,"metadata":{"name":"x","root":"y","generator":"apiflow scan-be/4"},"screens":[],"endpoints":[],"fields":[],"calls":[],"unresolved":[]}');
      const cli = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'cli.js');
      let status = 0;
      let out = '';
      try {
        execFileSync(process.execPath, [cli, 'check', bad], { encoding: 'utf8' });
      } catch (e) {
        const err = e as { status?: number; stdout?: string; stderr?: string };
        status = err.status ?? -1;
        out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
      }
      expect(status).toBe(2);
      expect(out).toContain('missing "reads"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes when the map still describes the code', () => {
    const root = repo();
    try {
      const stored = rescan('fe', root, 'app');
      const result = checkAgainst(stored, rescan('fe', root, 'app'));
      expect(result.drifted).toBe(false);
      expect(renderCheck(result, 'm.apimap')).toContain('still matches the code');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // cm:why The whole point of the command: an endpoint in the code that the committed map says does
  // not exist makes the map worse than nothing — read as an answer it says "no screen calls this".
  it('fails and names the endpoint that appeared in code', () => {
    const root = repo();
    try {
      const stored = rescan('fe', root, 'app');
      writeFileSync(
        join(root, 'src', 'pages', 'orders.tsx'),
        "export function Orders() {\n  fetch('/api/orders');\n  return null;\n}\n"
      );
      const result = checkAgainst(stored, rescan('fe', root, 'app'));
      expect(result.drifted).toBe(true);
      expect(result.structural).toBe(true);
      expect(result.diff.endpoints.added.map((e) => `${e.method} ${e.path}`)).toContain('GET /api/orders');
      const text = renderCheck(result, 'm.apimap');
      expect(text).toContain('/api/orders');
      expect(text).toContain('--write');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('separates a byte change with no structural change from real drift', () => {
    const root = repo();
    try {
      const fresh = rescan('fe', root, 'app');
      const stored = { ...fresh, metadata: { ...fresh.metadata, generator: 'apiflow scan-fe/0' } };
      const result = checkAgainst(stored, fresh);
      expect(result.drifted).toBe(true);
      expect(result.structural).toBe(false);
      expect(renderCheck(result, 'm.apimap')).toContain('code that moved');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('knows which side a map came from, and refuses a linked one', () => {
    expect(sideOf(createApiMap('a', 'r', 'apiflow scan-fe/1'))).toBe('fe');
    expect(sideOf(createApiMap('a', 'r', 'apiflow scan-be/1'))).toBe('be');
    expect(sideOf(createApiMap('a', 'r', 'apiflow link/1'))).toBeNull();
  });
});

// cm:why A reader upgrade and a code change look identical in a diff and mean opposite things. Saying
// which one it is is the difference between a gate people trust and a gate people mute.
describe('a map written by an older reader says so', () => {
  it('names the version pair when the generator moved, and nothing when it did not', () => {
    const old = createApiMap('a', 'github.com/acme/api', 'apiflow scan-be/1');
    expect(readerChanged(old, 'be')).toMatch(/scan-be\/1 → apiflow scan-be\/\d+/);
    const current = createApiMap('a', 'github.com/acme/api', BE_GENERATOR);
    expect(readerChanged(current, 'be')).toBeNull();
  });
});

// cm:why A BE map has no calls, so the call-based headline said "No meaningful change" on every one of
// them — printed directly under "the map has drifted from the code".
describe('the headline for a map with no calls', () => {
  const beMap = (endpoints: number, shaped: number) => {
    const map = createApiMap('be', 'github.com/acme/api', BE_GENERATOR);
    for (let i = 0; i < endpoints; i++) {
      const id = endpointId('GET', `/x${i}`);
      map.endpoints.push({ id, method: 'GET', path: `/x${i}` });
      if (i < shaped) {
        map.fields.push({ id: fieldId(id, 'a', 'response'), endpointId: id, path: 'a', kind: 'response', declared: true });
      }
    }
    return finalizeApiMap(map);
  };

  it('reads coverage off the endpoints and certainty off the declared shapes', () => {
    expect(headlineFor(beMap(2, 0), beMap(4, 0))).toBe('More endpoints read.');
    expect(headlineFor(beMap(4, 0), beMap(4, 3))).toBe('Same endpoints, more of them have a declared shape.');
    expect(headlineFor(beMap(4, 3), beMap(4, 0))).toBe('Same endpoints, fewer of them have a declared shape.');
    expect(headlineFor(beMap(4, 0), beMap(2, 0))).toBe('Fewer endpoints read.');
  });
});
