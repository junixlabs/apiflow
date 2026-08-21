import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createApiMap, endpointId, fieldId, finalizeApiMap, screenId } from '../core/apimap';
import type { ApiMapFile } from '../core/apimap';
import { addProject, workspaceRoot } from '../workspace/registry';
import { writeMap } from '../workspace/store';
import {
  findText,
  impactEndpointText,
  impactFieldText,
  mapCheckText,
  mapHealthText,
  mapListText,
  resolveTarget,
  screenDepsText,
} from './mapTools';

let home: string;
let repo: string;

function feRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'apiflow-mcp-repo-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  writeFileSync(join(root, '.git', 'config'), '[remote "origin"]\n\turl = git@github.com:acme/app.git\n');
  mkdirSync(join(root, 'src', 'pages'), { recursive: true });
  writeFileSync(join(root, 'src', 'pages', 'users.tsx'), "export function Users() {\n  fetch('/api/users');\n  return null;\n}\n");
  return root;
}

function demo(): ApiMapFile {
  const map = createApiMap('demo', 'github.com/acme/app', 'apiflow scan-fe/1');
  const ep = endpointId('GET', '/users/{param}');
  const sc = screenId('/users/:id', 'src/pages/user.tsx', 'UserPage');
  const fid = fieldId(ep, 'email');
  map.endpoints.push({ id: ep, method: 'GET', path: '/users/{param}' });
  map.screens.push({ id: sc, label: '/users/:id', route: '/users/:id', source: { file: 'src/pages/user.tsx', line: 1 }, viaHops: 2 });
  map.fields.push({ id: fid, endpointId: ep, path: 'email', kind: 'response' });
  map.calls.push({ screenId: sc, endpointId: ep, via: 'fetch', confidence: 'inferred', source: { file: 'src/api/users.ts', line: 12 } });
  map.reads.push({ screenId: sc, fieldId: fid, confidence: 'exact', source: { file: 'src/pages/user.tsx', line: 30 } });
  map.unresolved.push({ source: { file: 'src/api/client.ts', line: 4 }, reason: 'url is a variable', snippet: 'fetch(url)' });
  return finalizeApiMap(map);
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'apiflow-mcp-home-'));
  process.env.APIFLOW_HOME = home;
  delete process.env.APIFLOW_PROJECT;
  repo = feRepo();
  addProject({ name: 'demo', fe: repo, id: 'demo' });
  writeMap('demo', 'fe', demo());
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
  delete process.env.APIFLOW_HOME;
});

describe('the map MCP tools', () => {
  it('resolves the only project in the workspace without being told', () => {
    expect(workspaceRoot()).toBe(home);
    expect(resolveTarget().label).toBe('demo/fe');
  });

  it('names the projects it knows when the workspace has more than one', () => {
    addProject({ name: 'other', fe: repo, id: 'other' });
    expect(() => resolveTarget()).toThrow(/demo · other/);
  });

  it('answers the impact question with the file:line that proves it', () => {
    const out = impactEndpointText(resolveTarget(), 'GET /users/:id');
    expect(out).toContain('1 screen(s) break if this changes');
    expect(out).toContain('/users/:id [inferred] src/api/users.ts:12');
  });

  // cm:guard Every answer carries the unresolved count. An agent that reads "0 screens" without it will
  // report "nothing calls this endpoint" as a measured fact.
  it('carries the unresolved count in every answer, including the misses', () => {
    const target = resolveTarget();
    for (const out of [
      impactEndpointText(target, 'GET /users/:id'),
      impactEndpointText(target, 'GET /khong-co'),
      impactFieldText(target, 'email'),
      screenDepsText(target, '/users/:id'),
      findText(target, 'users'),
    ]) {
      expect(out).toContain('1 calls whose path could not be resolved');
      expect(out).toContain('github.com/acme/app');
    }
  });

  it('walks the chain only when asked', () => {
    const target = resolveTarget();
    expect(impactEndpointText(target, 'GET /users/:id', false)).not.toContain('client ');
    expect(impactFieldText(target, 'email')).toContain('/users/:id');
  });

  it('lists endpoints, screens and fields for a fuzzy query', () => {
    const out = findText(resolveTarget(), 'user');
    expect(out).toContain('GET /users/{param}');
    expect(out).toContain('/users/:id');
  });

  it('says what a screen depends on', () => {
    expect(screenDepsText(resolveTarget(), '/users/:id')).toContain('GET /users/{param} [inferred]');
  });

  it('suggests real routes when the screen is not in the map', () => {
    expect(screenDepsText(resolveTarget(), '/nope')).toContain('/users/:id');
  });

  it('reports health with the confidence split and the unresolved count', () => {
    const out = mapHealthText(resolveTarget());
    expect(out).toContain('endpoints 1 · screens 1 · calls 1 · fields 1');
    expect(out).toContain('inferred 1');
    expect(out).toContain('unresolved 1');
    expect(out).toContain('fe: scan');
  });

  it('checks the stored map against a fresh scan of the real directory', () => {
    writeMap('demo', 'fe', finalizeApiMap(createApiMap('demo', 'github.com/acme/app', 'apiflow scan-fe/1')));
    const out = mapCheckText(resolveTarget());
    expect(out).toContain('has drifted from the code');
    expect(out).toContain('+ GET /api/users');
  });

  it('lists the workspace', () => {
    expect(mapListText()).toContain('demo — demo · fe');
  });
});
