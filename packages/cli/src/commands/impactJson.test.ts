import { describe, expect, it } from 'vitest';
import { createApiMap, endpointId, fieldId, finalizeApiMap, screenId, screensAffectedByEndpoint, screensAffectedByField } from '@junixlabs/apiflow-map';
import type { ApiMapFile } from '@junixlabs/apiflow-map';
import { impactJson, mapJson, otherMethodsOn, resolveEndpointQuery, screenDepsJson } from './impact';

function demo(): ApiMapFile {
  const map = createApiMap('demo', 'github.com/acme/app', 'test');
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

describe('impact --json', () => {
  it('answers with the screens and the file:line that proves each one', () => {
    const map = demo();
    const out = impactJson(map, 'endpoint', 'GET /users/:id', [screensAffectedByEndpoint(map, resolveEndpointQuery(map, 'GET /users/:id')[0])]);
    expect(out.found).toBe(true);
    const screens = (out.matches[0] as { screens: Array<{ route: string; at: string; confidence: string }> }).screens;
    expect(screens).toHaveLength(1);
    expect(screens[0].route).toBe('/users/:id');
    expect(screens[0].at).toBe('src/api/users.ts:12');
    expect(screens[0].confidence).toBe('inferred');
  });

  // cm:guard An answer without the unresolved count reads as "nothing calls this". The map only ever
  // knows what it could parse, and this number is the whole difference between the two claims.
  it('carries the unresolved count even when it found nothing', () => {
    const map = demo();
    const out = impactJson(map, 'endpoint', 'GET /nope', []);
    expect(out.found).toBe(false);
    expect(out.matches).toEqual([]);
    expect(out.map.unresolved).toBe(1);
  });

  it('never leaks a machine path into the payload', () => {
    const out = mapJson(demo());
    expect(out.map.root).toBe('github.com/acme/app');
    expect(JSON.stringify(out)).not.toContain('/home/');
  });

  it('lists what one screen depends on', () => {
    const out = screenDepsJson(demo(), '/users/:id');
    expect(out.found).toBe(true);
    expect(out.matches).toEqual([
      { method: 'GET', path: '/users/{param}', confidence: 'inferred', at: 'src/api/users.ts:12', hops: 2 },
    ]);
  });

  it('reports a field as breaking the screens that read it', () => {
    const map = demo();
    const out = impactJson(map, 'field', 'email', [screensAffectedByField(map, fieldId(endpointId('GET', '/users/{param}'), 'email'))]);
    const screens = (out.matches[0] as { screens: Array<{ route: string; confidence: string }> }).screens;
    expect(screens[0].route).toBe('/users/:id');
    expect(screens[0].confidence).toBe('exact');
  });

  it('says found=false for a screen route the map does not have', () => {
    expect(screenDepsJson(demo(), '/nope').found).toBe(false);
  });
});

describe('resolving what the user typed', () => {
  it('keeps the verb when it widens the path search', () => {
    const map = demo();
    map.endpoints.push({ id: endpointId('DELETE', '/users/{param}'), method: 'DELETE', path: '/users/{param}' });
    // cm:why The bug this locks: asking for a verb the map does not have on that path used to return
    // the OTHER verbs' endpoints, and the answer read as if the verb asked for broke those screens.
    expect(resolveEndpointQuery(map, 'POST /users/:id')).toEqual([]);
    expect(resolveEndpointQuery(map, 'DELETE /users/:id')).toEqual([endpointId('DELETE', '/users/{param}')]);
    expect(resolveEndpointQuery(map, 'GET /users')).toEqual([endpointId('GET', '/users/{param}')]);
  });

  it('still matches on the path alone when no verb was given', () => {
    expect(resolveEndpointQuery(demo(), '/users')).toEqual([endpointId('GET', '/users/{param}')]);
  });

  it('can say which verbs the path does have', () => {
    expect(otherMethodsOn(demo(), 'POST /users/:id')).toEqual(['GET /users/{param}']);
    expect(otherMethodsOn(demo(), 'POST /nope')).toEqual([]);
  });
});
