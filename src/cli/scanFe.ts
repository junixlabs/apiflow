import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync, realpathSync } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile, Confidence, ScreenNode } from '../core/apimap';
import { createApiMap, finalizeApiMap, screenId } from '../core/apimap';
import type { ScanHints } from '../core/feScanner';
import { enclosingSymbols, isScannableFile, memberAt, objectMembers, routeFromFilePath, scanFile, symbolAt } from '../core/feScanner';
import type { ModuleNode, ResolveImport } from '../core/callerGraph';
import { attributeToScreens, buildCallerGraph, parseModule, stripJsonComments } from '../core/callerGraph';
import { findHttpWrappers } from '../core/wrappers';

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

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.astro'];

const CONFIG_NAMES = new Set(['tsconfig.json', 'jsconfig.json']);

function walkConfigs(root: string, dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walkConfigs(root, full, acc);
    } else if (CONFIG_NAMES.has(entry.name)) acc.push(normalizePosix(relative(root, full)));
  }
  return acc;
}

// cm:guard A monorepo root has no tsconfig — the aliases live in `frontend/tsconfig.json`, which is
// not a scannable source file, so it must be found on disk or `@/*` stays silently unresolvable.
function collectAliasConfigs(root: string): AliasConfig[] {
  const configs: AliasConfig[] = [];
  for (const rel of walkConfigs(root, root)) {
    const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
    let config: { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } };
    try {
      config = JSON.parse(stripJsonComments(readFileSync(join(root, rel), 'utf8')));
    } catch {
      continue;
    }
    const baseUrl = config.compilerOptions?.baseUrl ?? '.';
    const aliases: Array<[string, string[]]> = [];
    for (const [pattern, targets] of Object.entries(config.compilerOptions?.paths ?? {})) {
      aliases.push([pattern, targets.map((t) => normalizePosix(join(dir, baseUrl, t)))]);
    }
    if (aliases.length > 0) configs.push({ dir, aliases });
  }
  return configs.sort((a, b) => b.dir.length - a.dir.length);
}

interface AliasConfig {
  dir: string;
  aliases: Array<[string, string[]]>;
}

// cm:why Alias imports (`@/lib/api/agents`) are the norm in Next/Vite apps; without reading the
// tsconfig paths every consumer edge through an alias is invisible and the hop finds nothing.
export function buildResolver(root: string, files: Set<string>): ResolveImport {
  const configs = collectAliasConfigs(root);

  // cm:guard NodeNext ESM writes `./http/router.js` for a file that is `router.ts` on disk — without
  // this rewrite every import in an ESM TypeScript backend resolves to nothing.
  const candidate = (base: string): string | null => {
    if (files.has(base)) return base;
    const transpiled = base.replace(/\.(js|mjs|cjs|jsx)$/, '');
    if (transpiled !== base) {
      for (const ext of EXTENSIONS) if (files.has(`${transpiled}${ext}`)) return `${transpiled}${ext}`;
    }
    for (const ext of EXTENSIONS) if (files.has(`${base}${ext}`)) return `${base}${ext}`;
    for (const ext of EXTENSIONS) if (files.has(`${base}/index${ext}`)) return `${base}/index${ext}`;
    return null;
  };

  return (fromFile, specifier) => {
    if (specifier.startsWith('.')) {
      return candidate(normalizePosix(join(dirname(fromFile), specifier)));
    }
    // cm:why Nearest config wins: two packages may both map `@/*`, and resolving a frontend import
    // against the backend's alias would wire a screen to the wrong module entirely.
    for (const config of configs) {
      if (config.dir && !fromFile.startsWith(`${config.dir}/`)) continue;
      for (const [pattern, targets] of config.aliases) {
        const prefix = pattern.replace(/\*$/, '');
        if (!pattern.endsWith('*') || !specifier.startsWith(prefix)) continue;
        const rest = specifier.slice(prefix.length);
        for (const target of targets) {
          const hit = candidate(normalizePosix(target.replace(/\*$/, '') + rest));
          if (hit) return hit;
        }
      }
    }
    return null;
  };
}

function normalizePosix(p: string): string {
  return p.split('\\').join('/').replace(/^\.\//, '');
}

export const lastScanStats = { serverFilesSkipped: 0, wrappers: 0 };

export function scanDirectory(root: string, name: string, hints?: ScanHints): ApiMapFile {
  const map = createApiMap(name, root, GENERATOR);
  const sources = new Map<string, string>();
  lastScanStats.serverFilesSkipped = 0;
  for (const rel of walk(root, root)) {
    try {
      sources.set(rel, readFileSync(join(root, rel), 'utf8'));
    } catch {
      continue;
    }
  }

  // cm:why Wrappers are a whole-project fact — `fetchPage` is declared in the transport base class
  // and called from a different file, so no per-file scan can see that it is an http call at all.
  const wrappers = [...findHttpWrappers([...sources].map(([file, content]) => ({ file, content })))].sort();
  lastScanStats.wrappers = wrappers.length;
  const withWrappers: ScanHints = { ...hints, wrappers };

  for (const [rel, content] of sources) {
    const scan = scanFile(rel, content, withWrappers);
    if (scan.serverFile) lastScanStats.serverFilesSkipped++;
    map.screens.push(...scan.screens);
    map.endpoints.push(...scan.endpoints);
    map.fields.push(...scan.fields);
    map.calls.push(...scan.calls);
    map.reads.push(...scan.reads);
    map.unresolved.push(...scan.unresolved);
  }
  return finalizeApiMap(resolveCallerHops(map, sources, root));
}

export interface HopStats {
  reattributed: number;
  stillModuleLevel: number;
}

export let lastHopStats: HopStats = { reattributed: 0, stillModuleLevel: 0 };

// cm:edge protocol -> src/core/callerGraph.ts — runs AFTER every file is scanned, because a call in
// an api module can only be attributed once the whole import graph exists.
export function resolveCallerHops(map: ApiMapFile, sources: Map<string, string>, root: string): ApiMapFile {
  const files = new Set(sources.keys());
  const resolve = buildResolver(root, files);
  const symbolIndex = new Map<
    string,
    { symbols: Array<{ line: number; name: string }>; members: Array<{ line: number; name: string }>; lines: string[] }
  >();

  const modules: ModuleNode[] = [];
  for (const [file, content] of sources) {
    modules.push({ file, parsed: parseModule(content), route: routeFromFilePath(file) });
    symbolIndex.set(file, { symbols: enclosingSymbols(content), members: objectMembers(content), lines: content.split('\n') });
  }
  const graph = buildCallerGraph(modules, resolve);

  const enclosingAt = (file: string, line: number) => {
    const index = symbolIndex.get(file);
    if (!index) return { symbol: file };
    const symbol = symbolAt(index.symbols, line, file);
    return { symbol, member: memberAt(index.members, index.symbols, line, index.lines) };
  };

  const screens = new Map(map.screens.map((s) => [s.id, s]));
  const extraScreens: ScreenNode[] = [];
  const rewrite = new Map<string, Array<{ id: string; precise: boolean; hops: number }>>();
  let reattributed = 0;
  let stillModuleLevel = 0;

  for (const screen of map.screens) {
    if (screen.route || !screen.symbol) continue;
    const attributions = attributeToScreens(
      { file: screen.source.file, symbol: screen.symbol, member: screen.member },
      graph,
      enclosingAt
    );
    if (attributions.length === 0) {
      stillModuleLevel++;
      continue;
    }
    reattributed++;
    const targets = attributions.map((a) => {
      const id = screenId(a.route, a.file, a.symbol);
      if (!screens.has(id)) {
        const node: ScreenNode = {
          id,
          label: a.route,
          route: a.route,
          source: { file: a.file, line: a.line },
          viaHops: a.hops,
        };
        screens.set(id, node);
        extraScreens.push(node);
      }
      return { id, precise: a.precise, hops: a.hops };
    });
    rewrite.set(screen.id, targets);
  }

  lastHopStats = { reattributed, stillModuleLevel };
  if (rewrite.size === 0) return map;

  // cm:why Confidence only ever drops across a hop. An imprecise hop (member unknown on one side)
  // widens the blast radius, so the edge must stop claiming to be exact.
  const degrade = (c: Confidence, precise: boolean): Confidence =>
    precise ? (c === 'exact' ? 'inferred' : c) : 'guess';

  const keep = (id: string) => !rewrite.has(id);
  return {
    ...map,
    screens: [...map.screens.filter((s) => keep(s.id)), ...extraScreens],
    calls: map.calls.flatMap((c) => {
      const targets = rewrite.get(c.screenId);
      if (!targets) return [c];
      return targets.map((t) => ({ ...c, screenId: t.id, confidence: degrade(c.confidence, t.precise) }));
    }),
    reads: map.reads.flatMap((r) => {
      const targets = rewrite.get(r.screenId);
      if (!targets) return [r];
      return targets.map((t) => ({ ...r, screenId: t.id, confidence: degrade(r.confidence, t.precise) }));
    }),
  };
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
  lines.push(
    `**Attributed to a route**: ${lastHopStats.reattributed} call sites walked back to a screen · ` +
      `${lastHopStats.stillModuleLevel} stopped at module level`
  );
  if (lastScanStats.wrappers > 0) lines.push(`**Client wrappers followed**: ${lastScanStats.wrappers}`);
  if (lastScanStats.serverFilesSkipped > 0) {
    lines.push(`**Server files skipped**: ${lastScanStats.serverFilesSkipped} (route registrations, not calls)`);
  }
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
