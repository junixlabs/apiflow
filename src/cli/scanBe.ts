import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync, existsSync, realpathSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile, FieldNode } from '../core/apimap';
import { createApiMap, endpointId, fieldId, finalizeApiMap } from '../core/apimap';
import type { ClassIndex, SchemaDef, Stack } from '../core/beScanner';
import { detectStack, indexClasses, isBackendFile, resolveHandlerSchemas, scanBackendFile } from '../core/beScanner';

const GENERATOR = 'apiflow scan-be/1';
const MANIFESTS = ['artisan', 'composer.json', 'package.json', 'go.mod', 'pyproject.toml', 'requirements.txt'];
const SKIP_DIRS = new Set([
  'node_modules', 'vendor', 'dist', 'build', 'coverage', '.git', '__pycache__', '.venv', 'venv',
  'storage', '.next', 'target', 'bin', 'obj',
]);

function walk(root: string, dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(root, join(dir, entry.name), acc);
      continue;
    }
    const rel = relative(root, join(dir, entry.name));
    if (isBackendFile(rel)) acc.push(rel);
  }
  return acc;
}

function readManifests(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of MANIFESTS) {
    const p = join(root, name);
    if (existsSync(p)) out[name] = readFileSync(p, 'utf8');
  }
  return out;
}

export interface BeScanResult {
  map: ApiMapFile;
  stack: Stack;
  schemasFound: number;
  routesWithRequest: number;
  routesWithResponse: number;
}

export function scanBackend(root: string, name: string): BeScanResult {
  const stack = detectStack(readManifests(root));
  const files = walk(root, root).map((file) => ({ file, content: safeRead(join(root, file)) }));
  const classes: ClassIndex = indexClasses(files);

  const schemas = new Map<string, SchemaDef>();
  const map = createApiMap(name, root, GENERATOR);
  const routes = [];

  for (const { file, content } of files) {
    if (!content) continue;
    const scan = scanBackendFile(file, content, stack);
    for (const s of scan.schemas) if (!schemas.has(s.name)) schemas.set(s.name, s);
    routes.push(...scan.routes);
    map.unresolved.push(...scan.unresolved);
  }

  let routesWithRequest = 0;
  let routesWithResponse = 0;

  for (const raw of routes) {
    const hit = resolveHandlerSchemas(raw, classes);
    const eid = endpointId(hit.method, hit.path);
    map.endpoints.push({
      id: eid,
      method: hit.method,
      path: hit.path,
      source: hit.source,
      handler: hit.handler,
      auth: hit.auth,
    });

    const request = hit.requestSchema ? schemas.get(hit.requestSchema) : undefined;
    const response = hit.responseSchema ? schemas.get(hit.responseSchema) : undefined;
    if (request) routesWithRequest++;
    if (response) routesWithResponse++;

    for (const [schema, kind] of [[request, 'request'], [response, 'response']] as const) {
      if (!schema) continue;
      for (const field of schema.fields) {
        map.fields.push({
          id: fieldId(eid, field.path, kind),
          endpointId: eid,
          path: field.path,
          kind,
          type: field.type,
          optional: field.optional,
          declared: true,
          source: schema.source,
        } satisfies FieldNode);
      }
    }

    // cm:why An endpoint whose two shapes are unknown is exactly what the probe stage exists to
    // fill — recording it here is what makes the probe list finite instead of "every route".
    if (!request && !response && hit.method !== 'UNKNOWN') {
      map.unresolved.push({
        source: hit.source,
        reason: `${hit.method} ${hit.path} — no request or response schema found in code`,
        snippet: hit.handler ?? '(no named handler)',
      });
    }
  }

  return {
    map: finalizeApiMap(map),
    stack,
    schemasFound: schemas.size,
    routesWithRequest,
    routesWithResponse,
  };
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

// cm:edge contract -> skills/be-map-extractor/skill.md — the skill reads these headings to decide
// which endpoints still need a probe run; renaming them breaks its step 4.
export function renderBeReport(result: BeScanResult, outPath: string): string {
  const { map } = result;
  const withAuth = map.endpoints.filter((e) => e.auth).length;
  const declared = map.fields.filter((f) => f.declared).length;
  const observed = map.fields.filter((f) => f.observed).length;
  const lines: string[] = [];
  lines.push('## BE Map Scan Results');
  lines.push('');
  lines.push(`**Root**: ${map.metadata.root}`);
  lines.push(`**Stack**: ${result.stack}`);
  lines.push(`**Written**: ${outPath}`);
  lines.push(`**Endpoints**: ${map.endpoints.length} (${withAuth} behind auth)`);
  lines.push(`**Schemas**: ${result.schemasFound} — request on ${result.routesWithRequest}, response on ${result.routesWithResponse}`);
  lines.push(`**Fields**: ${declared} declared in code · ${observed} observed from a real response`);
  lines.push('');
  lines.push(`### Shapes still unknown — ${map.unresolved.length === 0 ? 'none' : map.unresolved.length}`);
  for (const u of map.unresolved.slice(0, 50)) {
    lines.push(`- ${u.source.file}:${u.source.line} — ${u.reason}`);
  }
  if (map.unresolved.length > 50) lines.push(`- ... ${map.unresolved.length - 50} more (see the .apimap file)`);
  lines.push('');
  lines.push(
    observed === 0
      ? '**Response shapes are code-declared only — not confirmed against a running API.** Run `apiflow probe` next.'
      : `**${observed} field(s) confirmed against a real response.**`
  );
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
  const name = flag('name') ?? (root.split('/').pop() || 'backend');
  const result = scanBackend(root, name);

  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(result.map, null, 2));
    return;
  }
  const outPath = resolve(flag('out') ?? join(root, '.apiview', 'map', `${name}.apimap`));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(result.map, null, 2)}\n`);
  console.log(renderBeReport(result, outPath));
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
