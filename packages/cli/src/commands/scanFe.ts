import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync, realpathSync } from 'fs';
import type { Dirent } from 'fs';
import { join, relative, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile, Confidence, ScreenNode, UnresolvedCall } from '@junixlabs/apiflow-map';
import { createApiMap, finalizeApiMap, screenId, serializeMap, unresolvedBacklog } from '@junixlabs/apiflow-map';
import { scanOrigin } from '../workspace/scanOrigin';
import type { ScanHints } from '@junixlabs/apiflow-scan';
import { enclosingSymbols, isScannableFile, memberAt, objectMembers, routeFromFilePath, scanFile, symbolAt } from '@junixlabs/apiflow-scan';
import type { ModuleNode, ResolveImport } from '@junixlabs/apiflow-scan';
import { MAX_FAN_OUT, attributeToScreens, buildCallerGraph, parseModule, stripJsonComments } from '@junixlabs/apiflow-scan';
import type { ChainStep } from '@junixlabs/apiflow-scan';
import { findHttpWrappers } from '@junixlabs/apiflow-scan';
import { buildRouteTable } from '@junixlabs/apiflow-scan';
import { tolerateClosedPipe } from './stdio';
import { isNestedCheckout } from './scanScope';
import { isGeneratedSource } from '@junixlabs/apiflow-scan';

// cm:edge contract -> packages/cli/src/commands/check.ts#readerChanged — the READER's version, bumped in the same
// commit as any change to what the FE reader produces for unchanged input.
export const GENERATOR = 'apiflow scan-fe/4';

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', 'coverage', '.next', '.nuxt', '.git', '.svelte-kit',
  'vendor', '__snapshots__', '.turbo', 'out',
]);

function walk(root: string, dir: string, acc: string[] = []): string[] {
  // cm:why A directory the process cannot read used to end the scan with a raw EACCES stack — one
  // root-owned cache anywhere under the root and the command produced no map at all.
  const entries = readEntries(dir, lastScanStats.unreadableSkipped, normalizePosix(relative(root, dir)));
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (isNestedCheckout(full)) {
        lastScanStats.checkoutsSkipped.push(normalizePosix(relative(root, full)));
        continue;
      }
      walk(root, full, acc);
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
  for (const entry of readEntries(dir, lastScanStats.unreadableSkipped, normalizePosix(relative(root, dir)))) {
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
    const baseUrl = config.compilerOptions?.baseUrl;
    const aliases: Array<[string, string[]]> = [];
    for (const [pattern, targets] of Object.entries(config.compilerOptions?.paths ?? {})) {
      aliases.push([pattern, targets.map((t) => normalizePosix(join(dir, baseUrl ?? '.', t)))]);
    }
    // cm:guard `baseUrl` with no `paths` is the CRA/Vite default, and it makes EVERY bare import
    // resolvable: without this fallback `from 'modules/auth/login'` resolves to nothing at all.
    if (baseUrl !== undefined) aliases.push(['*', [normalizePosix(join(dir, baseUrl, '*'))]]);
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

// cm:why A skip has to be printed. Silently dropping fifteen worktrees reads exactly like a scan
// that found nothing there, and the reader would go looking for a bug in the walk instead.
export function skipReport(stats: {
  checkoutsSkipped: string[];
  generatedSkipped: string[];
  unreadableSkipped?: string[];
}): string[] {
  const out: string[] = [];
  const show = (list: string[]): string =>
    list.slice(0, 3).join(', ') + (list.length > 3 ? `, +${list.length - 3} more` : '');
  if (stats.unreadableSkipped?.length) {
    out.push(`**Unreadable directories skipped**: ${stats.unreadableSkipped.length} — ${show(stats.unreadableSkipped)}`);
  }
  if (stats.checkoutsSkipped.length > 0) {
    out.push(`**Nested checkouts skipped**: ${stats.checkoutsSkipped.length} — ${show(stats.checkoutsSkipped)}`);
  }
  if (stats.generatedSkipped.length > 0) {
    out.push(`**Generated files skipped**: ${stats.generatedSkipped.length} — ${show(stats.generatedSkipped)}`);
  }
  return out;
}

const BACKLOG_SHAPES = 5;

// cm:why Top FIVE, and the cap states what it hid. A ranking that quietly showed only its head would
// read as the whole backlog — the failure the flat 50-line list above it already has.
// cm:edge contract -> packages/cli/src/commands/scanBe.ts — the BE report renders this same block, so
// one shape ranking cannot be described two ways in the two halves.
export function backlogReport(unresolved: readonly UnresolvedCall[]): string[] {
  const shapes = unresolvedBacklog(unresolved);
  if (shapes.length === 0) return [];
  const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
  const out = [
    '',
    `**Ranked by shape** — ${plural(shapes.length, 'shape', 'shapes')} behind ` +
      `${plural(unresolved.length, 'entry', 'entries')}:`,
  ];
  for (const s of shapes.slice(0, BACKLOG_SHAPES)) {
    out.push(`- ${s.count}× ${s.shape} (e.g. ${s.example.file}:${s.example.line})`);
  }
  const hiddenShapes = shapes.length - BACKLOG_SHAPES;
  if (hiddenShapes > 0) {
    const hiddenEntries = shapes.slice(BACKLOG_SHAPES).reduce((n, s) => n + s.count, 0);
    out.push(
      `- ... ${plural(hiddenShapes, 'more shape', 'more shapes')} not shown, ` +
        `covering ${plural(hiddenEntries, 'entry', 'entries')}`
    );
  }
  return out;
}

// cm:edge contract -> packages/cli/src/commands/scanBe.ts — both walks report an unreadable
// directory the same way, so the two commands cannot disagree about what a skipped tree looks like.
export function readEntries(dir: string, skipped: string[], label: string): Dirent[] {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    // cm:guard Deduped on the way in: the config walk and the source walk both cross the same
    // directory, and one unreadable tree reported twice reads as two.
    const name = label || '.';
    if (!skipped.includes(name)) skipped.push(name);
    return [];
  }
}

function normalizePosix(p: string): string {
  return p.split('\\').join('/').replace(/^\.\//, '');
}

export const lastScanStats = {
  serverFilesSkipped: 0,
  wrappers: 0,
  declaredRoutes: 0,
  checkoutsSkipped: [] as string[],
  generatedSkipped: [] as string[],
  unreadableSkipped: [] as string[],
};

export function scanDirectory(root: string, name: string, hints?: ScanHints): ApiMapFile {
  const map = createApiMap(name, scanOrigin(root), GENERATOR);
  const sources = new Map<string, string>();
  lastScanStats.serverFilesSkipped = 0;
  lastScanStats.checkoutsSkipped = [];
  lastScanStats.generatedSkipped = [];
  lastScanStats.unreadableSkipped = [];
  for (const rel of walk(root, root)) {
    let content: string;
    try {
      content = readFileSync(join(root, rel), 'utf8');
    } catch {
      continue;
    }
    // cm:edge ordering -> packages/scan/src/generated.ts — dropped from `sources`, not inside scanFile(), so a
    // bundle never reaches the caller graph either. Both passes read this one map.
    if (isGeneratedSource(rel, content)) {
      lastScanStats.generatedSkipped.push(rel);
      continue;
    }
    sources.set(rel, content);
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
  saturated: number;
  reattributed: number;
  stillModuleLevel: number;
}

export let lastHopStats: HopStats = { reattributed: 0, stillModuleLevel: 0, saturated: 0 };

// cm:edge protocol -> packages/scan/src/callerGraph.ts — runs AFTER every file is scanned, because a call in
// an api module can only be attributed once the whole import graph exists.
export function resolveCallerHops(map: ApiMapFile, sources: Map<string, string>, root: string): ApiMapFile {
  const files = new Set(sources.keys());
  const resolve = buildResolver(root, files);
  const symbolIndex = new Map<
    string,
    { symbols: Array<{ line: number; name: string }>; members: Array<{ line: number; name: string }>; lines: string[] }
  >();

  // cm:why File-based routing covers Next/Nuxt/Remix and nothing else — a Vite SPA declares its
  // routes in JSX, so without the table every screen in the app is invisible to the hop.
  const table = buildRouteTable([...sources].map(([file, content]) => ({ file, content })), resolve);
  lastScanStats.declaredRoutes = table.routes.size;

  const modules: ModuleNode[] = [];
  for (const [file, content] of sources) {
    const declared = table.routes.get(file);
    modules.push({ file, parsed: parseModule(content), route: routeFromFilePath(file) ?? declared?.[0] });
    symbolIndex.set(file, { symbols: enclosingSymbols(content), members: objectMembers(content), lines: content.split('\n') });
  }
  const graph = buildCallerGraph(modules, resolve);

  // cm:why A module-level screen node carries `line: 1` on purpose — it stands for the whole module.
  // The chain needs a real line, so the origin step points at where the symbol is DECLARED.
  const declaredAt = (file: string, symbol: string): number =>
    symbolIndex.get(file)?.symbols.find((s) => s.name === symbol)?.line ?? 1;

  const enclosingAt = (file: string, line: number) => {
    const index = symbolIndex.get(file);
    if (!index) return { symbol: file };
    const symbol = symbolAt(index.symbols, line, file);
    return { symbol, member: memberAt(index.members, index.symbols, line, index.lines) };
  };

  const screens = new Map(map.screens.map((s) => [s.id, s]));
  const extraScreens: ScreenNode[] = [];
  const rewrite = new Map<string, Array<{ id: string; precise: boolean; hops: number; chain: ChainStep[] }>>();
  let reattributed = 0;
  let stillModuleLevel = 0;
  const saturated: UnresolvedCall[] = [];

  for (const screen of map.screens) {
    if (screen.route || !screen.symbol) continue;
    const attributions = attributeToScreens(
      { file: screen.source.file, symbol: screen.symbol, member: screen.member, line: declaredAt(screen.source.file, screen.symbol) },
      graph,
      enclosingAt
    );
    if (attributions.length === 0) {
      stillModuleLevel++;
      continue;
    }
    // cm:guard Saturation is reported, never truncated: through re-export barrels one call reaches
    // hundreds of screens, and naming 40 arbitrary ones answers the question wrongly, not partially.
    if (attributions.length >= MAX_FAN_OUT) {
      stillModuleLevel++;
      saturated.push({
        source: screen.source,
        reason: `reachable from ${attributions.length}+ screens through re-exports — too wide to name a screen`,
        snippet: screen.symbol,
      });
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
      return { id, precise: a.precise, hops: a.hops, chain: a.chain };
    });
    rewrite.set(screen.id, targets);
  }

  lastHopStats = { reattributed, stillModuleLevel, saturated: saturated.length };
  if (rewrite.size === 0) return { ...map, unresolved: [...map.unresolved, ...saturated] };

  // cm:why Confidence only ever drops across a hop. An imprecise hop (member unknown on one side)
  // widens the blast radius, so the edge must stop claiming to be exact.
  const degrade = (c: Confidence, precise: boolean): Confidence =>
    precise ? (c === 'exact' ? 'inferred' : c) : 'guess';

  const keep = (id: string) => !rewrite.has(id);
  return {
    ...map,
    unresolved: [...map.unresolved, ...saturated],
    screens: [...map.screens.filter((s) => keep(s.id)), ...extraScreens],
    calls: map.calls.flatMap((c) => {
      const targets = rewrite.get(c.screenId);
      if (!targets) return [c];
      return targets.map((t) => ({ ...c, screenId: t.id, confidence: degrade(c.confidence, t.precise), chain: t.chain }));
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

// cm:edge contract -> packages/cli/skills/fe-map-extractor/skill.md — the skill parses this report shape and
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
      `${lastHopStats.stillModuleLevel} stopped at module level` +
      (lastHopStats.saturated > 0
        ? ` (${lastHopStats.saturated} dropped for too wide a fan-out — see Unresolved)`
        : '')
  );
  if (lastScanStats.declaredRoutes > 0) {
    lines.push(`**Routes declared in code**: ${lastScanStats.declaredRoutes} file(s) tied to a route`);
  }
  if (lastScanStats.wrappers > 0) lines.push(`**Client wrappers followed**: ${lastScanStats.wrappers}`);
  if (lastScanStats.serverFilesSkipped > 0) {
    lines.push(`**Server files skipped**: ${lastScanStats.serverFilesSkipped} (route registrations, not calls)`);
  }
  lines.push(...skipReport(lastScanStats));
  lines.push('');
  lines.push(`### Unresolved — ${map.unresolved.length === 0 ? 'none' : map.unresolved.length}`);
  for (const u of map.unresolved.slice(0, 50)) {
    lines.push(`- ${u.source.file}:${u.source.line} — ${u.reason}`);
    lines.push(`  \`${u.snippet}\``);
  }
  if (map.unresolved.length > 50) lines.push(`- ... ${map.unresolved.length - 50} more (see the .apimap file)`);
  lines.push(...backlogReport(map.unresolved));
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
  const name = flag('name') ?? (root.split('/').pop() || 'frontend');
  const hintsPath = flag('hints');
  const hints = hintsPath ? (JSON.parse(readFileSync(resolve(hintsPath), 'utf8')) as ScanHints) : undefined;
  const map = scanDirectory(root, name, hints);

  if (args.includes('--json')) {
    process.stdout.write(serializeMap(map));
    return;
  }

  const outPath = resolve(flag('out') ?? join(root, '.apiview', 'map', `${name}.apimap`));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, serializeMap(map));
  console.log(renderReport(map, outPath));
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
