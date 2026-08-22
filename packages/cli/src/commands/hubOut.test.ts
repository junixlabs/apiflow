import { describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createApiMap, endpointId, finalizeApiMap, serializeMap } from '@junixlabs/apiflow-map';

// cm:why Runs the real CLI from a repo-shaped cwd: `hub` read the directory only as a positional, so
// the documented `--out=<dir>` fell through to ./apiflow-maps inside whatever repo was cwd.
describe('apiflow hub --out', () => {
  it('writes where --out says, and nothing into the working directory', () => {
    const home = mkdtempSync(join(tmpdir(), 'apiflow-hub-home-'));
    const cwd = mkdtempSync(join(tmpdir(), 'apiflow-hub-cwd-'));
    const out = join(mkdtempSync(join(tmpdir(), 'apiflow-hub-out-')), 'pages');

    const map = createApiMap('demo', 'github.com/acme/app', 'apiflow scan-fe/1');
    map.endpoints.push({ id: endpointId('GET', '/users'), method: 'GET', path: '/users' });
    mkdirSync(join(home, 'projects', 'demo'), { recursive: true });
    writeFileSync(join(home, 'projects', 'demo', 'fe.apimap'), serializeMap(finalizeApiMap(map)));
    writeFileSync(join(home, 'workspace.json'), JSON.stringify({
      version: 1, projects: [{ id: 'demo', name: 'Demo', fe: cwd }],
    }));

    execFileSync('node', [join(import.meta.dirname, '..', '..', 'bin', 'cli.js'), 'hub', `--out=${out}`], {
      cwd, encoding: 'utf8', env: { ...process.env, APIFLOW_HOME: home },
    });

    expect(existsSync(join(out, 'index.html'))).toBe(true);
    expect(existsSync(join(out, 'demo.html'))).toBe(true);
    expect(existsSync(join(cwd, 'apiflow-maps'))).toBe(false);
  }, 60_000);
});
