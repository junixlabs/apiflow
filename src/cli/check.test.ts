import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createApiMap } from '../core/apimap';
import { checkAgainst, renderCheck, rescan } from './check';
import { sideOf } from '../core/apimap';

function repo(): string {
  const root = mkdtempSync(join(tmpdir(), 'apiflow-check-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  writeFileSync(join(root, '.git', 'config'), '[remote "origin"]\n\turl = git@github.com:acme/app.git\n');
  mkdirSync(join(root, 'src', 'pages'), { recursive: true });
  writeFileSync(
    join(root, 'src', 'pages', 'users.tsx'),
    "export function Users() {\n  fetch('/api/users');\n  return null;\n}\n"
  );
  return root;
}

describe('apiflow check', () => {
  it('passes when the map still describes the code', () => {
    const root = repo();
    try {
      const stored = rescan('fe', root, 'app');
      const result = checkAgainst(stored, rescan('fe', root, 'app'));
      expect(result.drifted).toBe(false);
      expect(renderCheck(result, 'm.apimap')).toContain('still matches the code');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  // cm:why This is the whole point of the command: an endpoint that appeared in code while the
  // committed map still says it does not exist is exactly the state that makes the map worse than
  // nothing — read as an answer, it says "no screen calls this".
  it('fails and names the endpoint that appeared in code', () => {
    const root = repo();
    try {
      const stored = rescan('fe', root, 'app');
      writeFileSync(
        join(root, 'src', 'pages', 'orders.tsx'),
        "export function Orders() {\n  fetch('/api/orders');\n  return null;\n}\n"
      );
      const result = checkAgainst(stored, rescan('fe', root, 'app'));
      expect(result.drifted).toBe(true);
      expect(result.structural).toBe(true);
      expect(result.diff.endpoints.added.map((e) => `${e.method} ${e.path}`)).toContain('GET /api/orders');
      const text = renderCheck(result, 'm.apimap');
      expect(text).toContain('/api/orders');
      expect(text).toContain('--write');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('separates a byte change with no structural change from real drift', () => {
    const root = repo();
    try {
      const fresh = rescan('fe', root, 'app');
      const stored = { ...fresh, metadata: { ...fresh.metadata, generator: 'apiflow scan-fe/0' } };
      const result = checkAgainst(stored, fresh);
      expect(result.drifted).toBe(true);
      expect(result.structural).toBe(false);
      expect(renderCheck(result, 'm.apimap')).toContain('code that moved');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('knows which side a map came from, and refuses a linked one', () => {
    expect(sideOf(createApiMap('a', 'r', 'apiflow scan-fe/1'))).toBe('fe');
    expect(sideOf(createApiMap('a', 'r', 'apiflow scan-be/1'))).toBe('be');
    expect(sideOf(createApiMap('a', 'r', 'apiflow link/1'))).toBeNull();
  });
});
