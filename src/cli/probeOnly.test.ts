import { describe, expect, it } from 'vitest';
import { matchesOnly, liveTargets } from './probe';

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
