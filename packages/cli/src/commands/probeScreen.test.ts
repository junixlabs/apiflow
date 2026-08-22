import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { createApiMap, finalizeApiMap, serializeMap } from '@junixlabs/apiflow-map';
import type { ApiMapFile } from '@junixlabs/apiflow-map';
import { endpointsForScreens } from './probe';

// cm:why A linked map built by hand: one screen at /account, two calls resolving to two BE
// endpoints, plus an endpoint no screen reads.
// cm:why endpointsForScreens must return the screen's two and never the orphan — the point of
// impact→probe is probing what a screen reads, not the API.
function linkedMap(): ApiMapFile {
  const m = createApiMap('t', 'r', 'apiflow test');
  m.screens.push({ id: 'sc', label: 'Account', route: '/account', symbol: 'Account', source: { file: 'account.tsx', line: 1 } } as never);
  m.endpoints.push(
    { id: 'e1', method: 'GET', path: '/api/user-info' } as never,
    { id: 'e2', method: 'GET', path: '/api/banks' } as never,
    { id: 'e3', method: 'GET', path: '/api/orphan' } as never,
  );
  m.calls.push(
    { id: 'c1', endpointId: 'e1', screenId: 'sc', confidence: 'inferred', source: { file: 'account.tsx', line: 3 } } as never,
    { id: 'c2', endpointId: 'e2', screenId: 'sc', confidence: 'inferred', source: { file: 'account.tsx', line: 4 } } as never,
  );
  return finalizeApiMap(m);
}

describe('endpointsForScreens', () => {
  it('returns exactly the endpoints the screen reads, never the orphan', () => {
    const { keys, unmatched } = endpointsForScreens(linkedMap(), ['/account']);
    expect([...keys].sort()).toEqual(['GET /api/banks', 'GET /api/user-info']);
    expect(unmatched).toEqual([]);
  });

  it('reports a route that names no screen', () => {
    const { keys, unmatched } = endpointsForScreens(linkedMap(), ['/nope']);
    expect(keys.size).toBe(0);
    expect(unmatched).toEqual(['/nope']);
  });
});

describe('probe --screen end to end (no server)', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'apiflow-screen-')); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));
  const CLI = join(import.meta.dirname, '..', '..', 'bin', 'cli.js');

  const run = (args: string[]): { code: number; err: string } => {
    try {
      execFileSync('node', [CLI, ...args], { encoding: 'utf8', timeout: 20_000, stdio: ['ignore', 'pipe', 'pipe'] });
      return { code: 0, err: '' };
    } catch (e) {
      const ex = e as { status?: number; stderr?: string };
      return { code: ex.status ?? -1, err: ex.stderr ?? '' };
    }
  };

  it('refuses --screen on a BE-only map with a pointer to the linked map', () => {
    const be = join(dir, 'be.apimap');
    const m = createApiMap('be', 'r', 'apiflow scan-be/4');
    m.endpoints.push({ id: 'e1', method: 'GET', path: '/api/x' } as never);
    writeFileSync(be, serializeMap(finalizeApiMap(m)));
    // cm:why localhost so the remote guard never fires first — the screen guard is what is under test.
    const { code, err } = run(['probe', be, '--live=http://127.0.0.1:9', '--screen=/account']);
    expect(code).toBe(2);
    expect(err).toContain('linked');
  });

  it('refuses an unknown screen', () => {
    const linked = join(dir, 'linked.apimap');
    writeFileSync(linked, serializeMap(linkedMap()));
    const { code, err } = run(['probe', linked, '--live=http://127.0.0.1:9', '--screen=/no-such']);
    expect(code).toBe(2);
    expect(err).toContain('No screen named /no-such');
  });
});
