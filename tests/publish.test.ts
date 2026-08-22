import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const cli = read('packages/cli/package.json');
const WORKSPACE_DEPS = Object.keys(cli.dependencies).filter((d) => d.startsWith('@junixlabs/'));

describe('one published artifact', () => {
  // cm:edge contract -> scripts/prepack-bundle.mjs — its BUNDLED list and this field are the same
  // fact written twice; npm reads only the field, so a drift ships a tarball that cannot install.
  it('bundles every workspace dependency', () => {
    expect(WORKSPACE_DEPS.length).toBeGreaterThan(0);
    for (const dep of WORKSPACE_DEPS) expect(cli.bundleDependencies).toContain(dep);
  });

  // cm:guard `private` is what makes "one published package" enforced instead of merely intended:
  // remove it from a workspace and `npm publish -w` starts working again with nobody noticing.
  it('keeps the bundled packages unpublishable on their own', () => {
    for (const dep of WORKSPACE_DEPS) {
      const dir = dep.replace('@junixlabs/apiflow-', '');
      expect(read(`packages/${dir}/package.json`).private).toBe(true);
    }
    expect(read('package.json').private).toBe(true);
    expect(cli.private).toBeUndefined();
  });

  // cm:edge lockstep -> RELEASE.md — "version numbers across the workspace packages move together" is
  // a ritual step, so it gets a gate: a partial bump fails here instead of at someone's `npm ci`.
  it('pins every workspace dependency to the version on disk', () => {
    for (const from of ['cli', 'map', 'scan']) {
      const deps = read(`packages/${from}/package.json`).dependencies ?? {};
      for (const [dep, pin] of Object.entries(deps)) {
        if (!dep.startsWith('@junixlabs/')) continue;
        const dir = dep.replace('@junixlabs/apiflow-', '');
        expect(pin, `packages/${from} pins ${dep}`).toBe(read(`packages/${dir}/package.json`).version);
      }
    }
  });

  // cm:guard A root publish packs 170 files including .forge/ and CLAUDE.md into a public tarball, and
  // `private: true` on the root is all that refuses it — so the step must name its working-directory.
  it('publishes from packages/cli, after verify:pack', () => {
    const wf = readFileSync(join(root, '.github/workflows/publish.yml'), 'utf8');
    expect(wf).toContain('npm run verify:pack');
    const publish = wf.slice(wf.indexOf('- run: npm publish'));
    expect(publish).toMatch(/^- run: npm publish[^\n]*\n\s*working-directory: packages\/cli$/m);
    expect(wf.indexOf('npm run verify:pack')).toBeLessThan(wf.indexOf('- run: npm publish'));
  });
});
