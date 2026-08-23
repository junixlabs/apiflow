import { describe, expect, it } from 'vitest';
import type { UnresolvedCall } from './apimap';
import { unresolvedBacklog, unresolvedShape } from './backlog';

// cm:guard The five fixed strings below are copied from their producers, not invented — a case that
// drifts from the real reason string tests a shape the tool never emits.
const FIXED = [
  'reads as a route registration, not a call',
  'call has no arguments to read a url from',
  'url is entirely interpolated — no literal path segment',
  'content-type schema is not valid JSON',
  'route registered without a verb — handler branches on r.Method',
];

function entries(reasons: string[]): UnresolvedCall[] {
  return reasons.map((reason, i) => ({
    source: { file: `src/f${i}.ts`, line: i + 1 },
    reason,
    snippet: '',
  }));
}

describe('unresolvedShape', () => {
  it('drops the method and path a schema gap interpolates', () => {
    expect(unresolvedShape('GET /users — no request or response schema found in code')).toBe(
      'no request or response schema found in code'
    );
    expect(unresolvedShape('DELETE /users/{param} — no request or response schema found in code')).toBe(
      'no request or response schema found in code'
    );
  });

  it('drops the source expression a dynamic url interpolates', () => {
    expect(unresolvedShape('url is a variable or expression: id')).toBe('url is a variable or expression');
    expect(unresolvedShape('url is a variable or expression: `${BASE}/users/${id}`')).toBe(
      'url is a variable or expression'
    );
  });

  it('cuts at the first colon, so a sliced signature cannot leak through', () => {
    expect(unresolvedShape('url is a variable or expression: id: string')).toBe('url is a variable or expression');
  });

  it('collapses the fan-out count a saturated attribution interpolates', () => {
    expect(unresolvedShape('reachable from 7+ screens through re-exports — too wide to name a screen')).toBe(
      'reachable from N+ screens through re-exports — too wide to name a screen'
    );
    expect(unresolvedShape('reachable from 41+ screens through re-exports — too wide to name a screen')).toBe(
      'reachable from N+ screens through re-exports — too wide to name a screen'
    );
  });

  it('strips a path that contains a space, which one token cannot match', () => {
    expect(unresolvedShape('GET /user profile — no request or response schema found in code')).toBe(
      'no request or response schema found in code'
    );
    expect(unresolvedShape('POST /v1/reports 2024 — no request or response schema found in code')).toBe(
      'no request or response schema found in code'
    );
  });

  it('collapses digits only for the producer that interpolates a count', () => {
    expect(unresolvedShape('GET /v1/reports 2024 — no request or response schema found in code')).not.toContain('N');
    expect(unresolvedShape('url is a variable or expression: page2')).toBe('url is a variable or expression');
  });

  it('leaves every fixed reason byte-identical', () => {
    for (const reason of FIXED) expect(unresolvedShape(reason)).toBe(reason);
  });

  it('does not read a non-verb first word as a method prefix', () => {
    expect(unresolvedShape('route registered without a verb — handler branches on r.Method')).toBe(
      'route registered without a verb — handler branches on r.Method'
    );
  });
});

describe('unresolvedBacklog', () => {
  it('counts one cause spelled three ways as one shape', () => {
    const backlog = unresolvedBacklog(
      entries([
        'GET /users — no request or response schema found in code',
        'GET /users/{param} — no request or response schema found in code',
        'DELETE /users/{param} — no request or response schema found in code',
      ])
    );
    expect(backlog).toHaveLength(1);
    expect(backlog[0].count).toBe(3);
    expect(backlog[0].shape).toBe('no request or response schema found in code');
  });

  it('keeps a real second cause separate', () => {
    const backlog = unresolvedBacklog(
      entries([
        'GET /users — no request or response schema found in code',
        'GET /orders — no request or response schema found in code',
        'url is a variable or expression: id',
      ])
    );
    expect(backlog.map((b) => [b.shape, b.count])).toEqual([
      ['no request or response schema found in code', 2],
      ['url is a variable or expression', 1],
    ]);
  });

  it('names the first entry of a shape as its example', () => {
    const backlog = unresolvedBacklog(entries(['content-type schema is not valid JSON']));
    expect(backlog[0].example).toEqual({ file: 'src/f0.ts', line: 1 });
  });

  it('breaks a tie on shape, so the order cannot move between scans', () => {
    const forward = unresolvedBacklog(entries(FIXED));
    const reversed = unresolvedBacklog(entries([...FIXED].reverse()));
    expect(forward.map((b) => b.shape)).toEqual(reversed.map((b) => b.shape));
    expect(forward.map((b) => b.shape)).toEqual([...FIXED].sort((a, b) => a.localeCompare(b)));
  });

  it('is empty on a map with nothing unresolved', () => {
    expect(unresolvedBacklog(entries([]))).toEqual([]);
  });

  it('accounts for every entry, which is what the caveat line subtracts from', () => {
    const reasons = [...FIXED, ...FIXED, 'url is a variable or expression: id'];
    const backlog = unresolvedBacklog(entries(reasons));
    expect(backlog.reduce((n, b) => n + b.count, 0)).toBe(reasons.length);
    expect(backlog).toHaveLength(FIXED.length + 1);
  });
});
