import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildResolver } from './scanFe';

const root = mkdtempSync(join(tmpdir(), 'apiflow-resolver-'));

const write = (rel: string, content: string) => {
  mkdirSync(join(root, rel, '..'), { recursive: true });
  writeFileSync(join(root, rel), content);
};

write('frontend/tsconfig.json', '{ "compilerOptions": { "paths": { "@/*": ["./*"] } }, "include": ["**/*.ts"] }');
write('backend/tsconfig.json', '{ "compilerOptions": { "baseUrl": "src", "paths": { "@/*": ["./*"] } } }');
write('frontend/lib/api.ts', '');
write('backend/src/lib/api.ts', '');

const files = new Set(['frontend/lib/api.ts', 'backend/src/lib/api.ts', 'frontend/app/page.tsx']);
const resolve = buildResolver(root, files);

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('buildResolver in a monorepo', () => {
  it('reads an alias from a tsconfig the root does not have', () => {
    expect(resolve('frontend/app/page.tsx', '@/lib/api')).toBe('frontend/lib/api.ts');
  });

  it('resolves the same alias to the package that owns the importer', () => {
    expect(resolve('backend/src/app.ts', '@/lib/api')).toBe('backend/src/lib/api.ts');
  });

  it('still resolves a relative import', () => {
    expect(resolve('frontend/app/page.tsx', '../lib/api')).toBe('frontend/lib/api.ts');
  });

  it('returns null for a package it cannot see', () => {
    expect(resolve('frontend/app/page.tsx', 'react')).toBeNull();
  });
});
