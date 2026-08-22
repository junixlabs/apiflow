import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { serializeMap } from '@junixlabs/apiflow-map';
import { scanDirectory } from './scanFe';

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'apiflow-portable-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  writeFileSync(join(root, '.git', 'config'), '[remote "origin"]\n\turl = git@github.com:acme/app.git\n');
  mkdirSync(join(root, 'src', 'pages'), { recursive: true });
  writeFileSync(
    join(root, 'src', 'pages', 'users.tsx'),
    "export function Users() {\n  fetch('/api/users').then((r) => r.json());\n  return null;\n}\n"
  );
  return root;
}

// cm:guard The test that keeps the map shareable. One absolute path and the file stops being
// reviewable in a PR and stops being the same bytes on two machines, which is the whole point.
describe('a scanned map carries no machine path', () => {
  it('records the repo it came from, not where the repo sits', () => {
    const root = fixture();
    try {
      const map = scanDirectory(root, 'fx');
      expect(map.metadata.root).toBe('github.com/acme/app');
      const body = serializeMap(map);
      expect(body).not.toContain(root);
      expect(body).not.toContain(tmpdir());
      expect(body).toContain('src/pages/users.tsx');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('scans the same tree twice into the same bytes', () => {
    const root = fixture();
    try {
      expect(serializeMap(scanDirectory(root, 'fx'))).toBe(serializeMap(scanDirectory(root, 'fx')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
