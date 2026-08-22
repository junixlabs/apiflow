import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cliModules = join(root, 'packages/cli/node_modules/@junixlabs');

// cm:edge contract -> packages/cli/package.json — these names must equal its bundleDependencies, or
// the tarball ships dependencies that resolve to a 404. tests/publish.test.ts asserts they agree.
const BUNDLED = [
  ['@junixlabs/apiflow-map', 'packages/map'],
  ['@junixlabs/apiflow-scan', 'packages/scan'],
];

// cm:guard npm bundles from the packing package's OWN node_modules, and workspaces hoist the symlinks
// to the repo root instead — skip this copy and npm packs "bundled files: 0" without failing.
function materialize() {
  for (const [name, src] of BUNDLED) {
    const dest = join(cliModules, name.split('/')[1]);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(root, src), dest, {
      recursive: true,
      filter: (p) => !p.includes('node_modules') && !p.endsWith('.test.ts'),
    });
    const version = JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8')).version;
    console.log(`bundled ${name}@${version}`);
  }
}

function clean() {
  for (const [name] of BUNDLED) {
    rmSync(join(cliModules, name.split('/')[1]), { recursive: true, force: true });
  }
  if (existsSync(cliModules)) rmSync(cliModules, { recursive: true, force: true });
}

process.argv.includes('--clean') ? clean() : materialize();
