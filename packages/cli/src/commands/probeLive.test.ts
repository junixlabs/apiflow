import { describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createApiMap, endpointId, finalizeApiMap, serializeMap } from '@junixlabs/apiflow-map';
import { detectStack } from '@junixlabs/apiflow-scan';
import { liveTargets } from './probe';

const endpoints = [
  { method: 'GET', path: '/api/projects' },
  { method: 'GET', path: '/api/map/{param}/{param}' },
  { method: 'DELETE', path: '/api/projects/{param}' },
  { method: 'UNKNOWN', path: '/api/anything' },
];

describe('choosing what a live probe may send', () => {
  it('sends only the methods asked for, and never an UNKNOWN verb', () => {
    const { ready } = liveTargets(endpoints, { param: '1' }, new Set(['GET']));
    expect(ready.map((t) => `${t.method} ${t.url}`)).toEqual(['GET /api/projects', 'GET /api/map/1/1']);
  });

  // cm:why Positional: `{param}` carries no name in the map, so two placeholders take two fills.
  it('fills placeholders in order', () => {
    const { ready } = liveTargets(endpoints, { 0: 'webapp', 1: 'fe' }, new Set(['GET']));
    expect(ready.find((t) => t.path.includes('map'))?.url).toBe('/api/map/webapp/fe');
  });

  it('skips an endpoint whose placeholder has no value, and names it', () => {
    const { ready, unfilled } = liveTargets(endpoints, {}, new Set(['GET']));
    expect(ready.map((t) => t.url)).toEqual(['/api/projects']);
    expect(unfilled).toEqual(['GET /api/map/{param}/{param}']);
  });
});

// cm:why Presence, not truthiness: `probe` records "this manifest exists" as an empty string, and the
// falsy check sent every Node repo to `generic` — which is why the runnable harness was never emitted.
describe('detectStack reads presence', () => {
  it('calls a repo with a package.json node, even when the content was not read', () => {
    expect(detectStack({ 'package.json': '' })).toBe('node');
    expect(detectStack({ 'package.json': '{"dependencies":{"@strapi/strapi":"5"}}' })).toBe('strapi');
    expect(detectStack({})).toBe('generic');
  });
});

// cm:guard The probe walks every endpoint in the map, and that list contains DELETE. These two
// refusals are the difference between a diagnostic and a scripted walk over someone's write endpoints.
describe('the live probe refuses the dangerous shapes', () => {
  const map = () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiflow-probe-'));
    const m = createApiMap('demo', 'github.com/acme/api', 'apiflow scan-be/2');
    m.endpoints.push({ id: endpointId('DELETE', '/api/things/1'), method: 'DELETE', path: '/api/things/1' });
    const file = join(dir, 'be.apimap');
    writeFileSync(file, serializeMap(finalizeApiMap(m)));
    return file;
  };
  const run = (args: string[]): { code: number; err: string } => {
    try {
      execFileSync('node', [join(import.meta.dirname, '..', '..', 'bin', 'cli.js'), 'probe', ...args], {
        encoding: 'utf8', stdio: 'pipe',
      });
      return { code: 0, err: '' };
    } catch (e) {
      const err = e as { status?: number; stderr?: string };
      return { code: err.status ?? -1, err: err.stderr ?? '' };
    }
  };

  it('will not send a write method without --unsafe', () => {
    const out = run([map(), '--live=http://127.0.0.1:9', '--methods=DELETE']);
    expect(out.code).toBe(2);
    expect(out.err).toContain('--unsafe');
  });

  it('will not probe a host that is not localhost without --yes-remote', () => {
    const out = run([map(), '--live=https://api.example.com']);
    expect(out.code).toBe(2);
    expect(out.err).toContain('--yes-remote');
  });
}, 60_000);
