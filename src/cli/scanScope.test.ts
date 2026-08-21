import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isNestedCheckout } from './scanScope';
import { scanDirectory, lastScanStats } from './scanFe';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'apiflow-scope-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const write = (rel: string, body: string): void => {
  const full = join(root, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, body);
};

describe('isNestedCheckout', () => {
  it('recognises a worktree, whose .git is a FILE not a directory', () => {
    write('.claude/worktrees/iss-1/.git', 'gitdir: /elsewhere/.git/worktrees/iss-1\n');
    expect(isNestedCheckout(join(root, '.claude/worktrees/iss-1'))).toBe(true);
  });

  it('recognises a nested clone, whose .git is a directory', () => {
    mkdirSync(join(root, 'sub/.git'), { recursive: true });
    expect(isNestedCheckout(join(root, 'sub'))).toBe(true);
  });

  it('leaves an ordinary directory alone', () => {
    write('src/api.ts', 'export const x = 1;\n');
    expect(isNestedCheckout(join(root, 'src'))).toBe(false);
  });
});

describe('scanDirectory skips copies of itself', () => {
  const call = "export const load = () => fetch('/api/orders');\n";

  it('counts a call once, not once per worktree', () => {
    write('src/api.ts', call);
    write('.claude/worktrees/iss-1/.git', 'gitdir: /elsewhere\n');
    write('.claude/worktrees/iss-1/src/api.ts', call);
    write('.claude/worktrees/iss-2/.git', 'gitdir: /elsewhere\n');
    write('.claude/worktrees/iss-2/src/api.ts', call);

    const map = scanDirectory(root, 'copies');
    expect(map.calls).toHaveLength(1);
    expect(lastScanStats.checkoutsSkipped).toHaveLength(2);
  });

  // cm:why Counterfactual for the skip: without it the SAME call arrives three times, which is the
  // shape of the real defect — one screen reported sixteen times on a repo with fifteen worktrees.
  it('would have counted it three times without the .git marker', () => {
    write('src/api.ts', call);
    write('.claude/worktrees/iss-1/src/api.ts', call);
    write('.claude/worktrees/iss-2/src/api.ts', call);

    expect(scanDirectory(root, 'copies').calls).toHaveLength(3);
  });

  it('reads no endpoint out of a committed bundle', () => {
    write('public/widget/chat.js', `${'var a=1;'.repeat(700)}fetch("/api/ghost");\n`);
    write('src/api.ts', call);

    const map = scanDirectory(root, 'bundle');
    expect(map.endpoints.map((e) => e.path)).toEqual(['/api/orders']);
    expect(lastScanStats.generatedSkipped).toEqual(['public/widget/chat.js']);
  });
});
