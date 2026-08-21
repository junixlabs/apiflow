import { describe, expect, it } from 'vitest';
import type { ApiMapFile } from './apimap';
import { createApiMap, endpointId, endpointsForScreen, fieldId, finalizeApiMap, normalizePath, parseMap, screenId, screensAffectedByEndpoint, screensAffectedByField, serializeMap, unreadResponseFields } from './apimap';

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

describe('unreadResponseFields kinship', () => {
  const map = createApiMap('t', '/tmp', 'test');
  const endpoint = { id: endpointId('GET', '/keys'), method: 'GET' as const, path: '/keys', source: { file: 'r.ts', line: 1 } };
  map.endpoints.push(endpoint);
  const field = (path: string) => ({
    id: fieldId(endpoint.id, path),
    endpointId: endpoint.id,
    path,
    kind: 'response' as const,
    observed: true as const,
  });
  map.fields.push(field('keys'), field('keys.id'), field('keys.createdAt'), field('meta'));
  map.reads.push({
    screenId: 'sc_x',
    fieldId: fieldId(endpoint.id, 'keys'),
    confidence: 'inferred',
    source: { file: 'page.tsx', line: 2 },
  });

  const unread = unreadResponseFields(finalizeApiMap(map)).map((a) => a.field.path);

  it('does not claim a child of a subtree the screen took whole', () => {
    expect(unread).not.toContain('keys.createdAt');
    expect(unread).not.toContain('keys.id');
  });

  it('still claims a sibling nobody touched', () => {
    expect(unread).toEqual(['meta']);
  });
});

describe('normalizePath root', () => {
  it('never returns an empty path', () => {
    expect(normalizePath('//')).toBe('/');
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
  });
});

describe('optional route params', () => {
  it('keeps an optional Laravel param instead of losing its closing brace', () => {
    expect(normalizePath('/v1/paygates/currencies/{country_code?}')).toBe('/v1/paygates/currencies/{param}');
  });

  it('still strips a real query string', () => {
    expect(normalizePath('/v1/companies?page=2')).toBe('/v1/companies');
  });
});

describe('chain interning', () => {
  const withChain = (): ApiMapFile => ({
    version: 1,
    metadata: { name: 'x', root: '/r', generator: 'g' },
    screens: [{ id: 's1', label: '/u', route: '/u', source: { file: 'p.tsx', line: 1 } }],
    endpoints: [{ id: 'e1', method: 'PUT', path: '/api/users' }],
    fields: [],
    calls: [
      {
        screenId: 's1', endpointId: 'e1', via: 'axios', confidence: 'inferred',
        source: { file: 'api/edit.ts', line: 7 },
        chain: [
          { file: 'api/edit.ts', symbol: 'editUser', line: 7, role: 'client', precise: true },
          { file: 'hooks/useEdit.ts', symbol: 'useEditUser', line: 12, role: 'hook', precise: true },
          { file: 'p.tsx', symbol: 'UserPage', line: 53, role: 'screen', precise: false },
        ],
      },
      {
        screenId: 's1', endpointId: 'e1', via: 'axios', confidence: 'exact',
        source: { file: 'api/edit.ts', line: 7 },
        chain: [{ file: 'api/edit.ts', symbol: 'editUser', line: 7, role: 'client', precise: true }],
      },
    ],
    reads: [],
    unresolved: [],
  });

  it('round-trips a chain through serialize and parse', () => {
    const back = parseMap(serializeMap(withChain()));
    expect(back.calls[0].chain).toEqual(withChain().calls[0].chain);
    expect(back.calls[1].chain).toEqual(withChain().calls[1].chain);
  });

  it('writes a repeated node once', () => {
    const text = serializeMap(withChain());
    expect(text.split('"api/edit.ts"').length - 1).toBe(3);
    expect(JSON.parse(text).chainNodes).toHaveLength(3);
  });

  // cm:why Without this, every stored map without chains would look changed the first time it is
  // rewritten — and the byte-identical invariant is how apiflow proves a re-scan found nothing new.
  it('emits no chainNodes key at all when nothing has a chain', () => {
    const bare = { ...withChain(), calls: withChain().calls.map(({ chain: _chain, ...c }) => c) };
    const text = serializeMap(bare);
    expect(text).not.toContain('chainNodes');
    expect(text).toBe(`${JSON.stringify(bare, null, 2)}\n`);
  });
});

// cm:why Two call sites in one screen used to be two rows, so the headline "N screen(s) break"
// counted the same screen twice — on a real app 10 reported screens were 3 distinct ones.
describe('a screen that calls an endpoint twice is one screen', () => {
  const build = () => {
    const map = createApiMap('dup', 'github.com/acme/app', 'test/1');
    map.endpoints.push({ id: 'ep_policy', method: 'PATCH', path: '/policy' });
    map.screens.push({ id: 'sc_pipeline', label: 'Pipeline', route: '/setup/pipeline', source: { file: 'a.tsx', line: 1 } });
    map.screens.push({ id: 'sc_other', label: 'Other', route: '/other', source: { file: 'b.tsx', line: 1 } });
    map.calls.push({ endpointId: 'ep_policy', screenId: 'sc_pipeline', confidence: 'guess', via: 'direct', source: { file: 'a.tsx', line: 10 } });
    map.calls.push({ endpointId: 'ep_policy', screenId: 'sc_pipeline', confidence: 'inferred', via: 'direct', source: { file: 'a.tsx', line: 40 } });
    map.calls.push({ endpointId: 'ep_policy', screenId: 'sc_other', confidence: 'guess', via: 'direct', source: { file: 'b.tsx', line: 7 } });
    return finalizeApiMap(map);
  };

  it('collapses to one entry per screen and counts the call sites', () => {
    const answer = screensAffectedByEndpoint(build(), 'ep_policy');
    expect(answer.screens).toHaveLength(2);
    const pipeline = answer.screens.find((s) => s.screen.route === '/setup/pipeline');
    expect(pipeline?.callSites).toBe(2);
    expect(answer.screens.find((s) => s.screen.route === '/other')?.callSites).toBe(1);
  });

  it('keeps the strongest confidence and its evidence', () => {
    const pipeline = screensAffectedByEndpoint(build(), 'ep_policy').screens
      .find((s) => s.screen.route === '/setup/pipeline');
    expect(pipeline?.confidence).toBe('inferred');
    expect(pipeline?.source.line).toBe(40);
  });
});

// cm:why A layout's call belongs to every screen rendered inside it: GET /auth/me runs in the
// beforeLoad of /_authenticated and gates 24 screens, and the answer used to name one.
describe('a layout route hands its calls down to its children', () => {
  const build = () => {
    const map = createApiMap('layout', 'github.com/acme/app', 'test/1');
    map.endpoints.push({ id: 'ep_me', method: 'GET', path: '/auth/me' });
    map.endpoints.push({ id: 'ep_own', method: 'GET', path: '/queue' });
    map.screens.push({ id: 'sc_shell', label: '/app', route: '/app', source: { file: 'src/routes/app/route.tsx', line: 3 } });
    map.screens.push({ id: 'sc_kid', label: '/app/queue', route: '/app/queue', source: { file: 'src/routes/app/queue.tsx', line: 5 } });
    map.screens.push({ id: 'sc_index', label: '/orders', route: '/orders', source: { file: 'src/routes/orders/index.tsx', line: 4 } });
    map.screens.push({ id: 'sc_detail', label: '/orders/{param}', route: '/orders/{param}', source: { file: 'src/routes/orders/[id].tsx', line: 4 } });
    map.calls.push({ endpointId: 'ep_me', screenId: 'sc_shell', confidence: 'inferred', via: 'direct', source: { file: 'src/lib/auth.ts', line: 9 } });
    map.calls.push({ endpointId: 'ep_own', screenId: 'sc_index', confidence: 'exact', via: 'direct', source: { file: 'src/lib/orders.ts', line: 2 } });
    return finalizeApiMap(map);
  };

  it('names the child and says which layout the call came from', () => {
    const answer = screensAffectedByEndpoint(build(), 'ep_me');
    expect(answer.screens.map((s) => s.screen.route).sort()).toEqual(['/app', '/app/queue']);
    expect(answer.screens.find((s) => s.screen.route === '/app/queue')?.inheritedFrom).toBe('/app');
    expect(answer.screens.find((s) => s.screen.route === '/app')?.inheritedFrom).toBeUndefined();
  });

  // cm:guard An index route shares its directory's route string with the layout but wraps nothing —
  // treating it as a parent would make /orders the ancestor of its own sibling /orders/{param}.
  it('does not treat an index route as the parent of its siblings', () => {
    const answer = screensAffectedByEndpoint(build(), 'ep_own');
    expect(answer.screens.map((s) => s.screen.route)).toEqual(['/orders']);
  });

  it('lets the child list the inherited endpoint in its own dependencies', () => {
    const deps = endpointsForScreen(build(), 'sc_kid');
    expect(deps.map((d) => `${d.endpoint.method} ${d.endpoint.path}`)).toEqual(['GET /auth/me']);
    expect(deps[0].inheritedFrom).toBe('/app');
  });
});
