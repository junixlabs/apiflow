import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'packages/cli');

// cm:guard Every entry is something a tarball must NOT carry: this repo is public, holds internal
// Forge material, and `files` is an allowlist that a new top-level directory silently escapes.
const FORBIDDEN = [/(^|\/)\.forge\//, /(^|\/)\.claude\//, /(^|\/)CLAUDE\.md$/, /\.test\.ts$/];

const REQUIRED = [
  'package/node_modules/@junixlabs/apiflow-map/src/index.ts',
  'package/node_modules/@junixlabs/apiflow-scan/src/index.ts',
  'package/bin/cli.js',
];

const out = process.argv[2] ?? mkdtempSync(join(tmpdir(), 'apiflow-pack-'));
execFileSync('npm', ['pack', '--pack-destination', out], { cwd: cli, stdio: 'inherit' });
const tarball = join(out, readdirSync(out).find((f) => f.endsWith('.tgz')));

const entries = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

const failures = [
  ...REQUIRED.filter((r) => !entries.includes(r)).map((r) => `missing: ${r}`),
  ...entries.filter((e) => FORBIDDEN.some((p) => p.test(e))).map((e) => `must not ship: ${e}`),
];

const declared = JSON.parse(
  execFileSync('node', ['-p', 'JSON.stringify(require("./package.json"))'], {
    cwd: cli,
    encoding: 'utf8',
  }),
);
for (const dep of Object.keys(declared.dependencies)) {
  if (dep.startsWith('@junixlabs/') && !declared.bundleDependencies?.includes(dep)) {
    failures.push(`workspace dep not bundled, so it resolves to a 404 on install: ${dep}`);
  }
}

console.log(`\n${tarball}\n${entries.length} entries`);
if (failures.length) {
  console.error(`\n${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('ok — one self-contained tarball, no internal material');
