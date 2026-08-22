import { readFileSync, mkdirSync, writeFileSync, statSync, existsSync, realpathSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile, FieldNode } from '@junixlabs/apiflow-map';
import { createApiMap, endpointId, fieldId, finalizeApiMap, normalizePath } from '@junixlabs/apiflow-map';
import { scanOrigin } from '../workspace/scanOrigin';
import type { ClassIndex, SchemaDef, Stack } from '@junixlabs/apiflow-scan';
import { detectStack, indexClasses, isBackendFile, laravelRouteFilePrefixes, resolveHandlerSchemas, scanBackendFile } from '@junixlabs/apiflow-scan';
import { enclosingSymbols, symbolAt } from '@junixlabs/apiflow-scan';
import { buildMountGraph, joinPrefix, prefixesFor } from '@junixlabs/apiflow-scan';
import { buildResolver, readEntries, skipReport } from './scanFe';
import { tolerateClosedPipe } from './stdio';
import { isNestedCheckout } from './scanScope';
import { isGeneratedSource } from '@junixlabs/apiflow-scan';

// cm:edge contract -> packages/cli/src/commands/check.ts#readerChanged — this string is the
// READER's version, and check reads it to tell "the code moved" apart from "the reader improved".
// cm:why Bump it in the same commit as any change to what the BE reader produces for unchanged
// input.
export const GENERATOR = 'apiflow scan-be/4';
const MANIFESTS = ['artisan', 'composer.json', 'package.json', 'go.mod', 'pyproject.toml', 'requirements.txt'];
const SKIP_DIRS = new Set([
  'node_modules', 'vendor', 'dist', 'build', 'coverage', '.git', '__pycache__', '.venv', 'venv',
  'storage', '.next', 'target', 'bin', 'obj',
]);

export const lastBeScanStats = {
  checkoutsSkipped: [] as string[],
  generatedSkipped: [] as string[],
  unreadableSkipped: [] as string[],
};

function walk(root: string, dir: string, acc: string[] = []): string[] {
  const entries = readEntries(dir, lastBeScanStats.unreadableSkipped, relative(root, dir).split('\\').join('/'));
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (isNestedCheckout(full)) {
        lastBeScanStats.checkoutsSkipped.push(relative(root, full).split('\\').join('/'));
        continue;
      }
      walk(root, full, acc);
      continue;
    }
    const rel = relative(root, join(dir, entry.name));
    if (isBackendFile(rel)) acc.push(rel);
  }
  return acc;
}

function readManifests(root: string, dir = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of MANIFESTS) {
    const p = join(root, dir, name);
    if (existsSync(p)) out[name] = readFileSync(p, 'utf8');
  }
  return out;
}

// cm:guard One stack per repo is wrong for a monorepo: pointing the scan at a root that holds a
// Strapi backend beside a Next app detects `generic` and silently reports a fraction of the routes.
function stacksByDirectory(root: string): Array<{ dir: string; stack: Stack }> {
  const found: Array<{ dir: string; stack: Stack }> = [];
  const visit = (dir: string, depth: number): void => {
    const stack = detectStack(readManifests(root, dir));
    if (stack !== 'generic') found.push({ dir, stack });
    if (depth === 0) return;
    for (const entry of readEntries(join(root, dir), lastBeScanStats.unreadableSkipped, dir || '.')) {
      if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) visit(join(dir, entry.name), depth - 1);
    }
  };
  visit('', 2);
  return found.sort((a, b) => b.dir.length - a.dir.length);
}

export interface BeScanResult {
  map: ApiMapFile;
  stack: Stack;
  stacks: Array<{ dir: string; stack: Stack }>;
  schemasFound: number;
  routesWithRequest: number;
  routesWithResponse: number;
}

// cm:guard Only the node stack mounts routers under a runtime prefix — Laravel and Strapi paths are
// already absolute, so running this over them would prepend a prefix that does not exist.
function mountPrefixes(
  root: string,
  stackAt: (file: string) => Stack,
  files: Array<{ file: string; content: string }>
): (hit: { source: { file: string; line: number }; path: string; receiver?: string }) => string[] {
  if (!files.some(({ file }) => stackAt(file) === 'node')) return (hit) => [hit.path];
  const resolve = buildResolver(root, new Set(files.map((f) => f.file)));
  const graph = buildMountGraph(files, resolve);
  const symbols = new Map(files.map((f) => [f.file, enclosingSymbols(f.content)]));

  return ({ source, path, receiver }) => {
    if (stackAt(source.file) !== 'node') return [path];
    const owner = symbolAt(symbols.get(source.file) ?? [], source.line, ' module');
    const found = receiver ? prefixesFor(graph, source.file, owner, receiver) : [];
    return found.length > 0 ? found.map((prefix) => normalizePath(joinPrefix(prefix, path))) : [path];
  };
}

export function scanBackend(root: string, name: string): BeScanResult {
  // cm:guard Reset BEFORE the stack probe, not after: that probe walks directories too, and
  // clearing the list below it threw away every skip it had just recorded.
  lastBeScanStats.checkoutsSkipped = [];
  lastBeScanStats.generatedSkipped = [];
  lastBeScanStats.unreadableSkipped = [];
  const stacks = stacksByDirectory(root);
  const stackAt = (file: string): Stack =>
    stacks.find(({ dir }) => dir === '' || file.startsWith(`${dir}/`))?.stack ?? 'generic';
  const stack = stacks[stacks.length - 1]?.stack ?? 'generic';
  const files = walk(root, root)
    .map((file) => ({ file, content: safeRead(join(root, file)) }))
    .filter(({ file, content }) => {
      if (!isGeneratedSource(file, content)) return true;
      lastBeScanStats.generatedSkipped.push(file);
      return false;
    });
  const classes: ClassIndex = indexClasses(files);

  const schemas = new Map<string, SchemaDef>();
  const handlers = new Map<string, { requestSchema?: string; responseSchema?: string }>();
  const aliases = new Map<string, string>();
  const map = createApiMap(name, scanOrigin(root), GENERATOR);
  const schemaGaps = new Set<string>();
  const routes = [];

  for (const { file, content } of files) {
    if (!content) continue;
    const scan = scanBackendFile(file, content, stackAt(file));
    for (const s of scan.schemas) if (!schemas.has(s.name)) schemas.set(s.name, s);
    for (const h of scan.handlers ?? []) if (!handlers.has(h.name)) handlers.set(h.name, h);
    for (const a of scan.aliases ?? []) if (!aliases.has(a.type)) aliases.set(a.type, a.schema);
    routes.push(...scan.routes);
    map.unresolved.push(...scan.unresolved);
  }

  let routesWithRequest = 0;
  let routesWithResponse = 0;
  const mounted = mountPrefixes(root, stackAt, files);
  const routeFilePrefixes = laravelRouteFilePrefixes(files);
  const filePrefix = (file: string): string => {
    for (const [suffix, prefix] of routeFilePrefixes) if (file.endsWith(suffix)) return prefix;
    return '';
  };

  // cm:why Resolves a NAME through the alias table before the schema table: a route names the TYPE
  // (`PolicyResponse`) while the fields live on the schema it was inferred from (`policyResponseSchema`).
  const lookup = (name: string | undefined): SchemaDef | undefined => {
    if (name === undefined) return undefined;
    return schemas.get(name) ?? schemas.get(aliases.get(name) ?? '');
  };

  for (const raw of routes) {
    const hit = resolveHandlerSchemas(raw, classes);
    // cm:edge lockstep -> packages/scan/src/beScanner.ts#handlerDefs — the mount records the
    // handler symbol and this is where that symbol is turned into the two schema names.
    // cm:why A mount that stops recording the symbol makes every node route schema-less again,
    // silently.
    const viaHandler = hit.handler === undefined ? undefined : handlers.get(hit.handler);
    const request = lookup(hit.requestSchema ?? viaHandler?.requestSchema);
    const response = lookup(hit.responseSchema ?? viaHandler?.responseSchema);
    if (request) routesWithRequest++;
    if (response) routesWithResponse++;

    // cm:guard One router mounted at two prefixes really does serve both — the fields must follow
    // every copy, or the second path lands in the map as a schema-less endpoint that never was.
    for (const path of mounted(hit).map((p) => normalizePath(`${filePrefix(hit.source.file)}${p}`))) {
      const eid = endpointId(hit.method, path);
      map.endpoints.push({
        id: eid,
        method: hit.method,
        path,
        source: hit.source,
        handler: hit.handler,
        auth: hit.auth,
      });

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
      // cm:guard One entry per ENDPOINT, not per route hit. The same route is legitimately seen twice:
      // a manifest entry plus its mount site, or a resource macro expanding into a scanned file.
      // cm:guard Without this, 106 endpoints reported 317 schema gaps — three times the real work.
      if (!request && !response && hit.method !== 'UNKNOWN') {
        const reason = `${hit.method} ${path} — no request or response schema found in code`;
        if (!schemaGaps.has(reason)) {
          schemaGaps.add(reason);
          map.unresolved.push({
            source: hit.source,
            reason,
            snippet: hit.handler ?? '(no named handler)',
          });
        }
      }
    }
  }

  return {
    map: finalizeApiMap(map),
    stack,
    stacks,
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

// cm:edge contract -> packages/cli/skills/be-map-extractor/skill.md — the skill reads these headings to decide
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
  lines.push(`**Stack**: ${result.stacks.map((s) => (s.dir ? `${s.stack} (${s.dir})` : s.stack)).join(' · ') || 'generic'}`);
  lines.push(`**Written**: ${outPath}`);
  lines.push(`**Endpoints**: ${map.endpoints.length} (${withAuth} behind auth)`);
  lines.push(`**Schemas**: ${result.schemasFound} — request on ${result.routesWithRequest}, response on ${result.routesWithResponse}`);
  lines.push(`**Fields**: ${declared} declared in code · ${observed} observed from a real response`);
  lines.push(...skipReport(lastBeScanStats));
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
  tolerateClosedPipe();
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
