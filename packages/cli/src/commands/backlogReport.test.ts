import { describe, expect, it } from 'vitest';
import type { UnresolvedCall } from '@junixlabs/apiflow-map';
import { backlogReport } from './scanFe';

function entries(reasons: string[]): UnresolvedCall[] {
  return reasons.map((reason, i) => ({
    source: { file: `src/f${i}.ts`, line: i + 1 },
    reason,
    snippet: '',
  }));
}

function repeat(reason: string, n: number): string[] {
  return Array.from({ length: n }, () => reason);
}

describe('backlogReport', () => {
  it('says nothing when there is no backlog', () => {
    expect(backlogReport([])).toEqual([]);
  });

  it('reports the fixture BE gap as one shape behind three entries', () => {
    expect(
      backlogReport(
        entries([
          'GET /users — no request or response schema found in code',
          'GET /users/{param} — no request or response schema found in code',
          'DELETE /users/{param} — no request or response schema found in code',
        ])
      )
    ).toEqual([
      '',
      '**Ranked by shape** — 1 shape behind 3 entries:',
      '- 3× no request or response schema found in code (e.g. src/f0.ts:1)',
    ]);
  });

  it('ranks the costlier shape first', () => {
    const lines = backlogReport(
      entries([
        'url is a variable or expression: id',
        'GET /users — no request or response schema found in code',
        'GET /orders — no request or response schema found in code',
      ])
    );
    expect(lines[1]).toBe('**Ranked by shape** — 2 shapes behind 3 entries:');
    expect(lines[2]).toContain('2× no request or response schema found in code');
    expect(lines[3]).toContain('1× url is a variable or expression');
  });

  it('caps at five shapes and states what it hid', () => {
    const lines = backlogReport(
      entries([
        ...repeat('content-type schema is not valid JSON', 6),
        ...repeat('reads as a route registration, not a call', 5),
        ...repeat('call has no arguments to read a url from', 4),
        ...repeat('url is entirely interpolated — no literal path segment', 3),
        ...repeat('url is a variable or expression: id', 2),
        ...repeat('route registered without a verb — handler branches on r.Method', 7),
      ])
    );
    expect(lines[1]).toBe('**Ranked by shape** — 6 shapes behind 27 entries:');
    expect(lines.filter((l) => /^- \d+×/.test(l))).toHaveLength(5);
    expect(lines.at(-1)).toBe('- ... 1 more shape not shown, covering 2 entries');
  });

  it('counts hidden entries, not hidden shapes', () => {
    const lines = backlogReport(
      entries([
        ...repeat('a: x', 10),
        ...repeat('b: x', 9),
        ...repeat('c: x', 8),
        ...repeat('d: x', 7),
        ...repeat('e: x', 6),
        ...repeat('f: x', 5),
        ...repeat('g: x', 4),
      ])
    );
    expect(lines.at(-1)).toBe('- ... 2 more shapes not shown, covering 9 entries');
  });

  it('speaks of one entry in the singular', () => {
    expect(backlogReport(entries(['content-type schema is not valid JSON']))[1]).toBe(
      '**Ranked by shape** — 1 shape behind 1 entry:'
    );
  });
});
