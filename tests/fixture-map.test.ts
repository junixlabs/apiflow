import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GATE = join(REPO, 'scripts', 'fixture-map.mjs');
const MAPS = join(REPO, 'fixtures', 'demo-app', 'maps');
const GOLDENS = ['web.apimap', 'api.apimap', 'linked.apimap'];

// cm:guard A replay spawns the real CLI three times, twice more inside the gate — seconds, not
// milliseconds. Same reason tests/guide.test.ts carries its own timeout.
const GATE_TIMEOUT = 120_000;

function runGate(mapsDir?: string): { code: number; out: string } {
  const args = [GATE, ...(mapsDir === undefined ? [] : [`--dir=${relative(REPO, mapsDir)}`])];
  const run = spawnSync(process.execPath, args, {
    cwd: REPO,
    env: { ...process.env, NO_COLOR: '1' },
    encoding: 'utf8',
  });
  return { code: run.status ?? -1, out: `${run.stdout ?? ''}${run.stderr ?? ''}` };
}

// cm:why Copies the goldens somewhere writable so a tamper test never touches a tracked file: one
// that corrupts what it checks leaves the repo dirty, and the next run gates the corruption.
function tamperedCopy(edit: (name: string, text: string) => string): string {
  const dir = mkdtempSync(join(tmpdir(), 'apiflow-tamper-'));
  mkdirSync(dir, { recursive: true });
  for (const name of GOLDENS) {
    const text = readFileSync(join(MAPS, name), 'utf8');
    const next = edit(name, text);
    if (next === text) copyFileSync(join(MAPS, name), join(dir, name));
    else writeFileSync(join(dir, name), next);
  }
  return dir;
}

// cm:why The gate this suite guards is the repo's only assertion that one source produces one set of
// bytes — the premise under sharing a map with no server and under reviewing one in a PR.
// cm:guard So it is not enough that the gate passes today: it must be shown to FAIL on a wrong map,
// or it can stop gating without anything noticing, which is the failure this suite exists to close.
describe('the fixture maps are gated, not just committed', () => {
  it(
    'passes on the committed maps',
    () => {
      const { code, out } = runGate();
      expect(out).toContain('still matches the code');
      expect(out).toContain('reproduced it byte for byte');
      expect(code, out).toBe(0);
    },
    GATE_TIMEOUT,
  );

  // cm:why An endpoint the committed map does not have is the worst case, not the loudest: read as an
  // answer, that map says "no screen calls this".
  it(
    'fails and names the endpoint when a half no longer describes the fixture',
    () => {
      const dir = tamperedCopy((name, text) =>
        name === 'web.apimap' ? text.replaceAll('/api/users', '/api/people') : text,
      );
      try {
        const { code, out } = runGate(dir);
        expect(code, out).toBe(1);
        expect(out).toContain('the map has drifted from the code');
        expect(out).toContain('/api/users');
        expect(out).toContain('npm run map:refresh');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    GATE_TIMEOUT,
  );

  // cm:why A golden that is not JSON at all exits 1 the same way drift does, because `check` throws
  // and node reports 1 for an uncaught error — so the gate has to survive reading it.
  // cm:guard Without this it crashed on the read and its own "refresh and commit" line never printed:
  // CI was red for the right reason and said nothing a reader could act on.
  it(
    'still reports, rather than crashing, when a golden is not a map at all',
    () => {
      const dir = tamperedCopy((name, text) => (name === 'web.apimap' ? 'not a map' : text));
      try {
        const { code, out } = runGate(dir);
        expect(code, out).toBe(1);
        expect(out).toContain('no longer match what the pipeline produces');
        expect(out).toContain('npm run map:refresh');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    GATE_TIMEOUT,
  );

  // cm:why The linked map is the one `apiflow check` refuses — `sideOf()` is null for `apiflow
  // link/1` — so its comparator is written here and needs its own proof that it can say no.
  it(
    'fails and points at the line when the linked map is not what linking produces',
    () => {
      const dir = tamperedCopy((name, text) =>
        name === 'linked.apimap' ? text.replace('"name": "web+api"', '"name": "web+apo"') : text,
      );
      try {
        const { code, out } = runGate(dir);
        expect(code, out).toBe(1);
        expect(out).toContain('no longer reproduces this map');
        expect(out).toMatch(/First difference at line \d+/);
        expect(out).toContain('web+apo');
        expect(out).toContain('npm run map:refresh');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    GATE_TIMEOUT,
  );
});
