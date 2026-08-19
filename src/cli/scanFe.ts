import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync, realpathSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile, Confidence } from '../core/apimap';
import { createApiMap, finalizeApiMap } from '../core/apimap';
import type { ScanHints } from '../core/feScanner';
import { isScannableFile, scanFile } from '../core/feScanner';

const GENERATOR = 'apiflow scan-fe/1';

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', 'coverage', '.next', '.nuxt', '.git', '.svelte-kit',
  'vendor', '__snapshots__', '.turbo', 'out',
]);

function walk(root: string, dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(root, join(dir, entry.name), acc);
      continue;
    }
    const rel = relative(root, join(dir, entry.name));
    if (isScannableFile(rel)) acc.push(rel);
  }
  return acc;
}

export function scanDirectory(root: string, name: string, hints?: ScanHints): ApiMapFile {
  const map = createApiMap(name, root, GENERATOR);
  for (const rel of walk(root, root)) {
    let content: string;
    try {
      content = readFileSync(join(root, rel), 'utf8');
    } catch {
      continue;
    }
    const scan = scanFile(rel, content, hints);
    map.screens.push(...scan.screens);
    map.endpoints.push(...scan.endpoints);
    map.fields.push(...scan.fields);
    map.calls.push(...scan.calls);
    map.reads.push(...scan.reads);
    map.unresolved.push(...scan.unresolved);
  }
  return finalizeApiMap(map);
}

function countBy(items: Array<{ confidence: Confidence }>): Record<Confidence, number> {
  const out: Record<Confidence, number> = { exact: 0, inferred: 0, guess: 0 };
  for (const i of items) out[i.confidence]++;
  return out;
}

// cm:edge contract -> skills/fe-map-extractor/skill.md — the skill parses this report shape and
// resolves what landed in Unresolved; changing the headings breaks its step 3.
export function renderReport(map: ApiMapFile, outPath: string): string {
  const c = countBy(map.calls);
  const lines: string[] = [];
  lines.push('## FE Map Scan Results');
  lines.push('');
  lines.push(`**Root**: ${map.metadata.root}`);
  lines.push(`**Written**: ${outPath}`);
  lines.push(`**Screens**: ${map.screens.length}`);
  lines.push(`**Endpoints**: ${map.endpoints.length}`);
  lines.push(`**Calls**: ${map.calls.length} (exact ${c.exact} · inferred ${c.inferred} · guess ${c.guess})`);
  lines.push(`**Fields traced**: ${map.fields.length}`);
  lines.push('');
  lines.push(`### Unresolved — ${map.unresolved.length === 0 ? 'none' : map.unresolved.length}`);
  for (const u of map.unresolved.slice(0, 50)) {
    lines.push(`- ${u.source.file}:${u.source.line} — ${u.reason}`);
    lines.push(`  \`${u.snippet}\``);
  }
  if (map.unresolved.length > 50) lines.push(`- ... ${map.unresolved.length - 50} more (see the .apimap file)`);
  return lines.join('\n');
}

function main(): void {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const flag = (n: string): string | undefined => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

  const root = resolve(positional[0] ?? process.cwd());
  if (!statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`Not a directory: ${root}`);
    process.exit(1);
  }
  const name = flag('name') ?? (root.split('/').pop() || 'frontend');
  const hintsPath = flag('hints');
  const hints = hintsPath ? (JSON.parse(readFileSync(resolve(hintsPath), 'utf8')) as ScanHints) : undefined;
  const map = scanDirectory(root, name, hints);

  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(map, null, 2));
    return;
  }

  const outPath = resolve(flag('out') ?? join(root, '.apiview', 'map', `${name}.apimap`));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(map, null, 2)}\n`);
  console.log(renderReport(map, outPath));
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
