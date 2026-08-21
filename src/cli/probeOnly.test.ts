import { describe, expect, it } from 'vitest';
import { matchesOnly, passesScope, liveTargets } from './probe';

const ENDPOINTS = [
  { method: 'GET', path: '/api/v1/color-statuses' },
  { method: 'GET', path: '/api/v1/color-statuses/{param}' },
  { method: 'GET', path: '/storage/logs/{param}' },
  { method: 'GET', path: '/api/v1/orders/{param}/lines/{param}' },
  { method: 'DELETE', path: '/api/v1/orders/{param}' },
];

describe('matchesOnly', () => {
  it('matches everything when no pattern is given', () => {
    expect(ENDPOINTS.every((e) => matchesOnly(e.method, e.path, []))).toBe(true);
  });

  it('takes a substring, which is what a human types', () => {
    const hit = ENDPOINTS.filter((e) => matchesOnly(e.method, e.path, ['color-statuses']));
    expect(hit.map((e) => e.path)).toEqual(['/api/v1/color-statuses', '/api/v1/color-statuses/{param}']);
  });

  it('globs on *', () => {
    const hit = ENDPOINTS.filter((e) => matchesOnly(e.method, e.path, ['/storage/logs/*']));
    expect(hit.map((e) => e.path)).toEqual(['/storage/logs/{param}']);
  });

  it('can scope by method as well, because the subject is "METHOD PATH"', () => {
    const hit = ENDPOINTS.filter((e) => matchesOnly(e.method, e.path, ['delete ']));
    expect(hit.map((e) => e.method)).toEqual(['DELETE']);
  });

  it('accepts several patterns', () => {
    const hit = ENDPOINTS.filter((e) => matchesOnly(e.method, e.path, ['/storage/', 'orders']));
    expect(hit).toHaveLength(3);
  });

  // cm:why An --only that matches nothing must not read as a clean run over zero endpoints; the CLI
  // exits 2 on this, and the count is what it exits on.
  it('reports no match rather than matching by accident', () => {
    expect(ENDPOINTS.filter((e) => matchesOnly(e.method, e.path, ['/nope'])).length).toBe(0);
  });
});

describe('liveTargets records the url it actually sends', () => {
  it('keeps the template as path and the filled url beside it', () => {
    const { ready } = liveTargets(
      [{ method: 'GET', path: '/api/v1/orders/{param}/lines/{param}' }],
      { '0': '7', '1': '3' },
      new Set(['GET'])
    );
    expect(ready).toEqual([
      { method: 'GET', path: '/api/v1/orders/{param}/lines/{param}', url: '/api/v1/orders/7/lines/3' },
    ]);
  });
});

describe('passesScope — --skip is the exclusion --only cannot express', () => {
  const danger = ['/restart-queue', '/supervisor', '/call-artisan'];
  const all = [
    ...ENDPOINTS,
    ...danger.map((path) => ({ method: 'GET', path })),
  ];

  it('with no filter, everything passes', () => {
    expect(all.every((e) => passesScope(e.method, e.path, [], []))).toBe(true);
  });

  // cm:why The exact case that bit: an --only covering the API surface still cannot leave the three
  // side-effect GET routes out, because they are not under /api/. --skip does.
  it('skip removes the side-effect routes an /api/ include would still miss', () => {
    const sent = all.filter((e) => passesScope(e.method, e.path, ['/api/'], []));
    expect(sent.some((e) => danger.includes(e.path))).toBe(false);
  });

  it('skip wins when only and skip disagree — the safe default is do-not-send', () => {
    expect(passesScope('GET', '/api/v1/orders', ['/api/'], ['orders'])).toBe(false);
  });

  it('skip alone excludes just its matches', () => {
    const sent = all.filter((e) => passesScope(e.method, e.path, [], ['/supervisor', '/restart-queue', '/call-artisan']));
    expect(sent.some((e) => danger.includes(e.path))).toBe(false);
    expect(sent).toContainEqual({ method: 'GET', path: '/api/v1/color-statuses' });
  });

  it('skip globs, like only', () => {
    const sent = all.filter((e) => passesScope(e.method, e.path, [], ['get /storage/*']));
    expect(sent.some((e) => e.path.startsWith('/storage/'))).toBe(false);
  });
});
