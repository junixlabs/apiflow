import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { request } from 'http';
import { serve } from './index';
import { findProject } from '../workspace/registry';
import { mapPath, writeMap } from '../workspace/store';
import type { ApiMapFile } from '../core/apimap';

const mapWith = (): ApiMapFile => ({
  version: 1,
  metadata: { name: 'demo', root: '/tmp/demo', generator: 'apiflow test' },
  screens: [], endpoints: [], fields: [], calls: [], reads: [], unresolved: [],
});

let home: string;
let repo: string;
let stop: () => void;
let base: string;

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), 'apiflow-home-'));
  repo = mkdtempSync(join(tmpdir(), 'apiflow-repo-'));
  process.env.APIFLOW_HOME = home;
  const running = await serve({ port: 0, host: '127.0.0.1' });
  stop = running.close;
  base = `http://127.0.0.1:${running.port}`;
});

afterEach(() => {
  stop();
  delete process.env.APIFLOW_HOME;
  rmSync(home, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

// cm:why Uses node:http rather than fetch for these: `Host` is a forbidden header name, so fetch
// drops it silently and the request arrives at the loopback host — the assertion then passes against
// a server with no guard at all. A browser drops it too, which is what makes the Host check useful.
const rawPost = (path: string, headers: Record<string, string>): Promise<number> =>
  new Promise((done, fail) => {
    const url = new URL(base + path);
    const req = request(
      { host: '127.0.0.1', port: url.port, path: url.pathname, method: 'POST', headers },
      (res) => {
        res.resume();
        res.once('end', () => done(res.statusCode ?? 0));
      }
    );
    req.once('error', fail);
    req.end('{}');
  });

interface Answer {
  status: number;
  error?: string;
  message?: string;
  project?: { id: string; fe?: string; be?: string };
  removed?: string;
  mapsKept?: string | null;
}

const post = async (path: string, body: unknown, headers: Record<string, string> = {}): Promise<Answer> => {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, ...((await res.json()) as Omit<Answer, 'status'>) };
};

describe('POST /api/projects', () => {
  it('registers a project and stores the root absolute', async () => {
    const res = await post('/api/projects', { name: 'Hoá đơn nội bộ', fe: repo });
    expect(res.status).toBe(201);
    expect(res.project?.id).toBe('hoa-don-noi-bo');
    expect(findProject('hoa-don-noi-bo')?.fe).toBe(repo);
  });

  it('refuses a root that is not a directory, and names the field', async () => {
    const res = await post('/api/projects', { name: 'ghost', fe: join(repo, 'nope') });
    expect(res.status).toBe(400);
    // cm:why Asserts the message reads as prose: the same text is shown in the browser form, where
    // an error naming the CLI flag `--fe` points at a field that does not exist on screen.
    expect(res.message).toContain('FE directory');
    expect(res.message).not.toContain('--fe');
  });

  it('refuses a name it cannot turn into an id, and says which field to fill', async () => {
    const res = await post('/api/projects', { name: '日本語', fe: repo });
    expect(res.status).toBe(400);
    expect(res.message).toContain('fill the id field');
  });

  it('refuses a project with neither side', async () => {
    const res = await post('/api/projects', { name: 'empty' });
    expect(res.status).toBe(400);
    expect(res.error).toBe('NO_ROOT');
  });
});

// cm:why These four cases are the whole reason a write route may accept a filesystem path at all.
// Any page in the browser can reach 127.0.0.1; without them it could register the user's home
// directory as a project and have it scanned.
describe('write guard', () => {
  it('rejects a Host that is not loopback, which is what DNS rebinding produces', async () => {
    expect(await rawPost('/api/projects', { host: 'evil.example', 'content-type': 'application/json' })).toBe(403);
    expect(findProject('x')).toBeUndefined();
  });

  it('rejects a cross-site Origin', async () => {
    const res = await post('/api/projects', { name: 'x', fe: repo }, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
    expect(res.error).toBe('BAD_ORIGIN');
  });

  it('rejects a request the browser labelled cross-site', async () => {
    const res = await post('/api/projects', { name: 'x', fe: repo }, { 'sec-fetch-site': 'cross-site' });
    expect(res.status).toBe(403);
    expect(res.error).toBe('CROSS_SITE');
  });

  it('lets the page apiflow itself served through', async () => {
    const res = await post('/api/projects', { name: 'ok', fe: repo },
      { origin: base, 'sec-fetch-site': 'same-origin' });
    expect(res.status).toBe(201);
  });

  it('guards the scan route the same way', async () => {
    expect(await rawPost('/api/projects/whatever/scan', { host: 'evil.example' })).toBe(403);
  });
});

describe('PATCH /api/projects/:id', () => {
  const patch = async (id: string, body: unknown, headers: Record<string, string> = {}): Promise<Answer> => {
    const res = await fetch(`${base}/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return { status: res.status, ...((await res.json()) as Omit<Answer, 'status'>) };
  };

  let other: string;
  beforeEach(async () => {
    other = mkdtempSync(join(tmpdir(), 'apiflow-other-'));
    await post('/api/projects', { name: 'doi goc', fe: repo, be: repo });
  });
  afterEach(() => rmSync(other, { recursive: true, force: true }));

  it('moves one root without touching the other', async () => {
    const res = await patch('doi-goc', { fe: other });
    expect(res.status).toBe(200);
    expect(res.project?.fe).toBe(other);
    expect(res.project?.be).toBe(repo);
  });

  // cm:why This is the case the field-vs-absent split exists for: a form posts every input it has, so
  // if an empty string did not mean "clear", editing the FE path could never remove a BE path — and
  // if an absent key did not mean "leave alone", the project view's form would wipe the hints file.
  it('treats an empty field as clear and an absent field as unchanged', async () => {
    expect((await patch('doi-goc', { be: '' })).project?.be).toBeUndefined();
    expect((await patch('doi-goc', { name: 'new name' })).project?.fe).toBe(repo);
  });

  it('refuses to clear the last remaining side', async () => {
    await patch('doi-goc', { be: '' });
    const res = await patch('doi-goc', { fe: '' });
    expect(res.status).toBe(400);
    expect(findProject('doi-goc')?.fe).toBe(repo);
  });

  it('refuses a blank name instead of silently keeping the old one', async () => {
    const res = await patch('doi-goc', { name: '  ' });
    expect(res.status).toBe(400);
    expect(res.error).toBe('NO_NAME');
    expect(findProject('doi-goc')?.name).toBe('doi goc');
  });

  it('answers 404 for an id that was never registered', async () => {
    expect((await patch('khong-co', { name: 'x' })).status).toBe(404);
  });

  it('is fenced like every other write route', async () => {
    expect((await patch('doi-goc', { fe: other }, { origin: 'https://evil.example' })).status).toBe(403);
    expect(findProject('doi-goc')?.fe).toBe(repo);
  });
});

describe('DELETE /api/projects/:id', () => {
  const del = async (id: string, headers: Record<string, string> = {}): Promise<Answer> => {
    const res = await fetch(`${base}/api/projects/${id}`, { method: 'DELETE', headers });
    return { status: res.status, ...((await res.json()) as Omit<Answer, 'status'>) };
  };

  it('removes the workspace entry and keeps the scanned maps', async () => {
    await post('/api/projects', { name: 'bo di', fe: repo });
    writeMap('bo-di', 'fe', mapWith());
    const res = await del('bo-di');
    expect(res.status).toBe(200);
    expect(findProject('bo-di')).toBeUndefined();
    // cm:guard The map file must still be there: the confirm text in the browser promises exactly
    // this, and a delete that quietly took the maps too would make that text a lie.
    expect(existsSync(mapPath('bo-di', 'fe'))).toBe(true);
  });

  it('names no map directory for a project removed before its first scan', async () => {
    await post('/api/projects', { name: 'chua scan', fe: repo });
    expect((await del('chua-scan')).mapsKept).toBeNull();
  });

  it('answers 404 for an id that was never registered', async () => {
    expect((await del('khong-co')).status).toBe(404);
  });

  it('is fenced like every other write route', async () => {
    await post('/api/projects', { name: 'giu lai', fe: repo });
    expect((await del('giu-lai', { origin: 'https://evil.example' })).status).toBe(403);
    expect(findProject('giu-lai')).toBeDefined();
  });
});

describe('read routes', () => {
  it('names the kinds it accepts instead of guessing', async () => {
    const res = await fetch(`${base}/api/map/anything/sideways`);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { message: string }).message).toContain('fe, be, linked');
  });

  it('answers 404 for a project that is not registered', async () => {
    expect((await fetch(`${base}/p/khong-co`)).status).toBe(404);
  });
});
