import { describe, expect, it } from 'vitest';
import { isGeneratedSource } from './generated';

const authored = (lines: number, width = 60): string =>
  Array.from({ length: lines }, () => 'x'.repeat(width)).join('\n');

describe('isGeneratedSource', () => {
  it('keeps ordinary source however long the file is', () => {
    expect(isGeneratedSource('src/api.ts', authored(500))).toBe(false);
  });

  it('keeps a file whose widest AUTHORED line is an inline svg', () => {
    const svg = `${authored(200)}\n  const path = '${'M0 0 L1 1 '.repeat(340)}';\n${authored(200)}`;
    expect(svg.length).toBeGreaterThan(4096);
    expect(isGeneratedSource('src/panda.tsx', svg)).toBe(false);
  });

  it('drops a minified bundle', () => {
    const bundle = Array.from({ length: 60 }, () => 'a'.repeat(5000)).join('\n');
    expect(isGeneratedSource('backend/public/widget/chat.js', bundle)).toBe(true);
  });

  it('drops a bundle by name even when it is small', () => {
    expect(isGeneratedSource('public/vendor.min.js', 'a')).toBe(true);
  });

  // cm:why The byte floor is the only thing keeping a short one-liner out: its mean line length is
  // its whole length, so without the floor `export * from './x';` on one line reads as generated.
  it('keeps a short one-liner', () => {
    expect(isGeneratedSource('src/index.ts', `export * from './${'a'.repeat(600)}';`)).toBe(false);
  });
});
