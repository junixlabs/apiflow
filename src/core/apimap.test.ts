import { describe, expect, it } from 'vitest';
import {
  createApiMap,
  endpointId,
  fieldId,
  finalizeApiMap,
  normalizePath,
  screenId,
  screensAffectedByEndpoint,
  screensAffectedByField,
} from './apimap';
import type { ApiMapFile } from './apimap';

describe('normalizePath', () => {
  it('strips origin, query and hash', () => {
    expect(normalizePath('https://api.example.com/v1/users?page=2#top')).toBe('/v1/users');
  });

  it('collapses concrete ids so one endpoint stays one node', () => {
    expect(normalizePath('/api/users/42')).toBe('/api/users/{param}');
    expect(normalizePath('/api/users/3f8b1c2d-1111-2222-3333-444455556666')).toBe('/api/users/{param}');
  });

  it('treats every parameter syntax as the same segment', () => {
    expect(normalizePath('/api/users/${id}/posts')).toBe('/api/users/{param}/posts');
    expect(normalizePath('/api/users/:id/posts')).toBe('/api/users/{param}/posts');
    expect(normalizePath('/api/users/{id}/posts')).toBe('/api/users/{param}/posts');
  });

  it('adds a leading slash and drops a trailing one', () => {
    expect(normalizePath('api/users/')).toBe('/api/users');
    expect(normalizePath('/')).toBe('/');
  });
});

describe('id derivation', () => {
  it('is stable across calls', () => {
    expect(endpointId('GET', '/api/users')).toBe(endpointId('GET', '/api/users'));
    expect(screenId('/users', 'a.tsx', 'X')).toBe(screenId('/users', 'b.tsx', 'Y'));
  });

  it('separates method and path', () => {
    expect(endpointId('GET', '/api/users')).not.toBe(endpointId('POST', '/api/users'));
    expect(fieldId('ep_a', 'data.id')).not.toBe(fieldId('ep_b', 'data.id'));
  });

  it('falls back to file and symbol when there is no route', () => {
    expect(screenId(undefined, 'src/x.tsx', 'Panel')).toBe(screenId(undefined, 'src/x.tsx', 'Panel'));
    expect(screenId(undefined, 'src/x.tsx', 'Panel')).not.toBe(screenId(undefined, 'src/x.tsx', 'Other'));
  });
});

describe('finalizeApiMap', () => {
  const build = (order: 'forward' | 'reverse'): ApiMapFile => {
    const map = createApiMap('demo', '/root', 'test');
    const screens = [
      { id: 'sc_b', label: 'B', source: { file: 'b.tsx', line: 1 } },
      { id: 'sc_a', label: 'A', source: { file: 'a.tsx', line: 1 } },
    ];
    map.screens.push(...(order === 'forward' ? screens : [...screens].reverse()));
    map.screens.push(screens[0]);
    map.calls.push(
      { screenId: 'sc_b', endpointId: 'ep_1', via: 'fetch', confidence: 'exact', source: { file: 'b.tsx', line: 9 } },
      { screenId: 'sc_a', endpointId: 'ep_1', via: 'fetch', confidence: 'exact', source: { file: 'a.tsx', line: 3 } },
      { screenId: 'sc_a', endpointId: 'ep_1', via: 'fetch', confidence: 'exact', source: { file: 'a.tsx', line: 3 } }
    );
    return finalizeApiMap(map);
  };

  it('produces byte-identical output regardless of walk order', () => {
    expect(JSON.stringify(build('forward'))).toBe(JSON.stringify(build('reverse')));
  });

  it('drops duplicates', () => {
    const map = build('forward');
    expect(map.screens).toHaveLength(2);
    expect(map.calls).toHaveLength(2);
  });
});

describe('impact queries', () => {
  const map = finalizeApiMap({
    ...createApiMap('demo', '/root', 'test'),
    screens: [
      { id: 'sc_list', label: '/users', route: '/users', source: { file: 'list.tsx', line: 1 } },
      { id: 'sc_detail', label: '/users/{param}', route: '/users/{param}', source: { file: 'detail.tsx', line: 1 } },
    ],
    endpoints: [{ id: 'ep_users', method: 'GET', path: '/api/users' }],
    fields: [{ id: 'fl_email', endpointId: 'ep_users', path: 'data.email', kind: 'response' as const }],
    calls: [
      { screenId: 'sc_list', endpointId: 'ep_users', via: 'fetch', confidence: 'exact', source: { file: 'list.tsx', line: 5 } },
      { screenId: 'sc_detail', endpointId: 'ep_users', via: 'axios', confidence: 'inferred', source: { file: 'detail.tsx', line: 7 } },
    ],
    reads: [
      { screenId: 'sc_list', fieldId: 'fl_email', confidence: 'inferred', source: { file: 'list.tsx', line: 6 } },
    ],
    unresolved: [],
  });

  it('answers which screens call an endpoint', () => {
    const answer = screensAffectedByEndpoint(map, 'ep_users');
    expect(answer.endpoint?.path).toBe('/api/users');
    expect(answer.screens.map((s) => s.screen.route).sort()).toEqual(['/users', '/users/{param}']);
  });

  it('returns nothing for an endpoint no screen calls', () => {
    expect(screensAffectedByEndpoint(map, 'ep_missing').screens).toHaveLength(0);
  });

  it('includes callers with no traced read, downgraded to guess', () => {
    const answer = screensAffectedByField(map, 'fl_email');
    const byId = new Map(answer.screens.map((s) => [s.screen.id, s.confidence]));
    expect(byId.get('sc_list')).toBe('inferred');
    expect(byId.get('sc_detail')).toBe('guess');
  });
});

describe('normalizePath with template literals', () => {
  it('collapses a nested interpolation to one param', () => {
    expect(normalizePath('/reports/${fmt({ id: row.id })}/rows')).toBe('/reports/{param}/rows');
  });

  it('collapses two interpolations separately', () => {
    expect(normalizePath('/a/${x}/b/${y}')).toBe('/a/{param}/b/{param}');
  });

  it('leaves a plain path untouched', () => {
    expect(normalizePath('/agents/list')).toBe('/agents/list');
  });
});
