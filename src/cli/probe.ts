import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile } from '../core/apimap';
import { finalizeApiMap, parseMap, undeliveredFields } from '../core/apimap';
import type { Stack } from '../core/beScanner';
import { detectStack } from '../core/beScanner';
import type { ProbeSample } from '../core/probeHarness';
import { buildHarness, ingestSamples } from '../core/probeHarness';
import { localRootFor } from '../workspace/registry';
import { tolerateClosedPipe } from './stdio';

const RESULT_FILE = 'apiflow-probe.json';
const MANIFESTS = ['artisan', 'composer.json', 'package.json', 'go.mod', 'pyproject.toml', 'requirements.txt'];

function loadMap(path: string): ApiMapFile {
  const map = parseMap(readFileSync(path, 'utf8'));
  if (map.version !== 1) throw new Error(`unsupported .apimap version: ${String(map.version)}`);
  return map;
}

function stackOf(root: string, override?: string): Stack {
  if (override) return override as Stack;
  const manifests: Record<string, string> = {};
  for (const name of MANIFESTS) if (existsSync(join(root, name))) manifests[name] = '';
  return detectStack(manifests);
}

function main(): void {
  tolerateClosedPipe();
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const flag = (n: string): string | undefined => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

  if (positional.length === 0) {
    console.error('Usage: apiflow probe <file.apimap> --emit[=<dir>] | --ingest=<results.json>');
    process.exit(1);
  }
  const mapPath = resolve(positional[0]);
  const map = loadMap(mapPath);
  const ingestPath = flag('ingest');

  if (ingestPath) {
    const samples = JSON.parse(readFileSync(resolve(ingestPath), 'utf8')) as ProbeSample[];
    const { map: next, applied, skipped } = ingestSamples(map, samples);

    const observed = next.fields.filter((f) => f.observed).length;
    const finalized = finalizeApiMap(next);
    const lying = undeliveredFields(finalized);
    writeFileSync(mapPath, `${JSON.stringify(finalized, null, 2)}\n`);
    console.log('## Probe ingest');
    console.log('');
    console.log(`**Samples**: ${samples.length} · applied ${samples.length - skipped.length} · skipped ${skipped.length}`);
    console.log(`**Fields now observed**: ${observed} (${applied} field observations merged)`);
    console.log(`**Probed endpoints**: ${next.endpoints.filter((e) => e.probed).length}/${next.endpoints.length}`);
    console.log('');
    console.log(`### Declared in code but never sent — ${lying.length === 0 ? 'none' : lying.length}`);
    for (const a of lying.slice(0, 30)) {
      console.log(`- ${a.endpoint.method} ${a.endpoint.path} → \`${a.field.path}\` — ${a.field.source?.file ?? '?'}:${a.field.source?.line ?? '?'}`);
    }
    if (skipped.length > 0) {
      console.log('');
      console.log(`### Skipped samples — ${skipped.length}`);
      for (const s of skipped.slice(0, 20)) {
        const why = s.status < 200 || s.status >= 300 ? `status ${s.status} is not a success` : s.body == null ? 'empty body' : 'endpoint not in the map';
        console.log(`- ${s.method} ${s.path} — ${why}`);
      }
    }
    return;
  }

  const root = flag('root') ?? localRootFor(map.metadata.root);
  if (root === undefined) {
    console.error(`No idea where ${map.metadata.root} lives on this machine.`);
    console.error('The map records the repo, not a machine path — pass --root=<dir>,');
    console.error('or register the project: apiflow project add <name> --be=<dir>');
    process.exit(1);
  }
  const emitDir = resolve(flag('emit') ?? root);
  const stack = stackOf(emitDir, flag('stack'));
  const harness = buildHarness(stack, map.endpoints, RESULT_FILE);
  const target = join(emitDir, harness.filename);
  mkdirSync(dirname(target), { recursive: true });

  if (existsSync(target) && !args.includes('--force')) {
    console.error(`Refusing to overwrite ${target} — pass --force if that is what you want.`);
    process.exit(1);
  }
  writeFileSync(target, harness.content);

  console.log('## Probe harness emitted');
  console.log('');
  console.log(`**Stack**: ${stack}`);
  console.log(`**File**: ${target}`);
  console.log(`**Endpoints covered**: ${map.endpoints.filter((e) => e.method !== 'UNKNOWN').length}`);
  console.log('');
  console.log('Next:');
  console.log(`1. Fill every \`/* apiflow:fill */\` marker — app instance, auth, and seeded fixture ids.`);
  console.log(`2. Run it: \`${harness.runWith}\``);
  console.log(`3. Feed the result back: \`apiflow probe ${mapPath} --ingest=${join(emitDir, RESULT_FILE)}\``);
  console.log('');
  console.log('It runs inside the project test runner, so it hits the test database, not a real one.');
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
