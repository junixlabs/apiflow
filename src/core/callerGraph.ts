export interface ImportBinding {
  local: string;
  imported: string;
  from: string;
  line: number;
}

export interface Usage {
  symbol: string;
  member?: string;
  line: number;
}

export interface ParsedModule {
  exports: string[];
  imports: ImportBinding[];
  usages: Usage[];
  // cm:why `useAgents()` and `agentsApi` live in the SAME file: the call site is inside agentsApi,
  // but consumers import the hook. Without an intra-file edge the chain breaks at hop zero.
  localUsages: Usage[];
  declarations: string[];
  reexports: string[];
}

const IMPORT = /import\s+(type\s+)?([\s\S]*?)\s+from\s+(['"])([^'"]+)\3/g;
const REEXPORT = /export\s+(?:\*|\{[^}]*\})\s*(?:as\s+\w+\s*)?from\s+(['"])([^'"]+)\1/g;
const EXPORT_NAMED = /export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
const EXPORT_LIST = /export\s*\{([^}]*)\}(?!\s*from)/g;
const DECLARATION = /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;

// cm:why Type-only imports are dropped here: a screen that imports only a type from an api module
// does not call it, and counting those turns every shared type into a fake dependency edge.
export function parseModule(content: string): ParsedModule {
  const imports: ImportBinding[] = [];
  const exports = new Set<string>();
  const reexports: string[] = [];
  const lineOf = (idx: number) => content.slice(0, idx).split('\n').length;

  for (const m of content.matchAll(IMPORT)) {
    if (m[1]) continue;
    const clause = m[2].trim();
    const from = m[4];
    const line = lineOf(m.index);
    const named = /\{([\s\S]*)\}/.exec(clause);
    if (named) {
      for (const part of named[1].split(',')) {
        const spec = part.trim().replace(/^type\s+/, '');
        if (!spec || part.trim().startsWith('type ')) continue;
        const alias = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(spec);
        if (alias) imports.push({ imported: alias[1], local: alias[2], from, line });
        else if (/^[A-Za-z_$][\w$]*$/.test(spec)) imports.push({ imported: spec, local: spec, from, line });
      }
    }
    // cm:guard Match `* as ns` on the whole clause BEFORE tokenizing — split on whitespace first and
    // the namespace form decays into two bogus default imports named `as` and `ns`.
    let bare = clause.replace(/\{[\s\S]*\}/, '');
    for (const nsMatch of bare.matchAll(/\*\s*as\s+([A-Za-z_$][\w$]*)/g)) {
      imports.push({ imported: '*', local: nsMatch[1], from, line });
    }
    bare = bare.replace(/\*\s*as\s+[A-Za-z_$][\w$]*/g, ' ').replace(/,/g, ' ').trim();
    for (const token of bare.split(/\s+/)) {
      if (/^[A-Za-z_$][\w$]*$/.test(token)) imports.push({ imported: 'default', local: token, from, line });
    }
  }

  for (const m of content.matchAll(REEXPORT)) reexports.push(m[2]);
  for (const m of content.matchAll(EXPORT_NAMED)) exports.add(m[1]);
  for (const m of content.matchAll(EXPORT_LIST)) {
    for (const part of m[1].split(',')) {
      const spec = part.trim().replace(/^type\s+/, '');
      const alias = /\s+as\s+([A-Za-z_$][\w$]*)$/.exec(spec);
      if (alias) exports.add(alias[1]);
      else if (/^[A-Za-z_$][\w$]*$/.test(spec)) exports.add(spec);
    }
  }
  if (/export\s+default\b/.test(content)) exports.add('default');

  const usages: Usage[] = [];
  const locals = new Set(imports.map((i) => i.local));
  for (const local of locals) {
    const re = new RegExp(`\\b${local}\\b(?:\\s*\\.\\s*([A-Za-z_$][\\w$]*))?`, 'g');
    for (const m of content.matchAll(re)) {
      const before = content.slice(Math.max(0, m.index - 24), m.index);
      if (/(import|from)\s*[{,\s]*$/.test(before)) continue;
      usages.push({ symbol: local, member: m[1], line: lineOf(m.index) });
    }
  }
  const declarations = new Set<string>();
  for (const m of content.matchAll(DECLARATION)) declarations.add(m[1]);

  const localUsages: Usage[] = [];
  for (const local of declarations) {
    const re = new RegExp(`\\b${local}\\b(?:\\s*\\.\\s*([A-Za-z_$][\\w$]*))?`, 'g');
    for (const m of content.matchAll(re)) {
      const before = content.slice(Math.max(0, m.index - 40), m.index);
      if (/(import|from|export)\s*[{,\s]*$/.test(before)) continue;
      if (/(?:const|let|var|function|class)\s+$/.test(before)) continue;
      localUsages.push({ symbol: local, member: m[1], line: lineOf(m.index) });
    }
  }

  return { exports: [...exports], imports, usages, localUsages, declarations: [...declarations], reexports };
}

export interface ModuleNode {
  file: string;
  parsed: ParsedModule;
  route?: string;
}

export interface CallerGraph {
  modules: Map<string, ModuleNode>;
  consumers: Map<string, Array<{ file: string; local: string; imported: string }>>;
}

export type ResolveImport = (fromFile: string, specifier: string) => string | null;

export function buildCallerGraph(modules: ModuleNode[], resolve: ResolveImport): CallerGraph {
  const byFile = new Map(modules.map((m) => [m.file, m]));
  const consumers = new Map<string, Array<{ file: string; local: string; imported: string }>>();

  for (const module of modules) {
    for (const binding of module.parsed.imports) {
      const target = resolve(module.file, binding.from);
      if (!target || !byFile.has(target)) continue;
      const list = consumers.get(target) ?? [];
      list.push({ file: module.file, local: binding.local, imported: binding.imported });
      consumers.set(target, list);
    }
  }
  return { modules: byFile, consumers };
}

export interface Origin {
  file: string;
  symbol: string;
  member?: string;
}

export interface Attribution {
  file: string;
  route: string;
  symbol: string;
  hops: number;
  precise: boolean;
  line: number;
}

const MAX_FAN_OUT = 40;

// cm:guard Over-approximating is safe here, under-approximating is not: a missed consumer means a
// screen breaks with no warning. Every widening below is deliberate, and marked imprecise instead.
export function attributeToScreens(
  origin: Origin,
  graph: CallerGraph,
  symbolAt: (file: string, line: number) => { symbol: string; member?: string },
  maxDepth = 4
): Attribution[] {
  const found: Attribution[] = [];
  const seen = new Set<string>();
  let frontier: Array<Origin & { hops: number; precise: boolean }> = [{ ...origin, hops: 0, precise: true }];

  // cm:guard Bound the walk by ROUNDS, not by frontier[0].hops — an intra-file edge deliberately
  // keeps hops the same, so reading depth off one entry would stop the walk early or never.
  let rounds = 0;
  while (frontier.length > 0 && rounds < maxDepth * 2 && found.length < MAX_FAN_OUT) {
    rounds++;
    const next: Array<Origin & { hops: number; precise: boolean }> = [];
    for (const current of frontier) {
      const key = `${current.file}|${current.symbol}|${current.member ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const here = graph.modules.get(current.file);
      for (const usage of here?.parsed.localUsages ?? []) {
        if (usage.symbol !== current.symbol) continue;
        if (current.member !== undefined && usage.member !== undefined && usage.member !== current.member) continue;
        const enclosing = symbolAt(current.file, usage.line);
        if (enclosing.symbol === current.symbol) continue;
        // cm:guard `export const apiClient = new ApiClient()` aliases the WHOLE object, so the
        // member must travel with it — dropping it here fans one method out to every consumer.
        next.push({
          file: current.file,
          symbol: enclosing.symbol,
          member: usage.member === undefined ? current.member : enclosing.member,
          hops: current.hops,
          precise: current.precise,
        });
      }

      for (const consumer of graph.consumers.get(current.file) ?? []) {
        const module = graph.modules.get(consumer.file);
        if (!module) continue;
        const matchesSymbol =
          consumer.imported === '*' || consumer.imported === current.symbol || consumer.local === current.symbol;
        if (!matchesSymbol) continue;

        for (const usage of module.parsed.usages) {
          if (usage.symbol !== consumer.local) continue;
          // cm:why A consumer touching `agentsApi.remove` does not break when `agentsApi.list`
          // changes. Matching the member is what keeps one module from fanning out to every screen.
          const memberMatch = current.member === undefined || usage.member === undefined || usage.member === current.member;
          if (!memberMatch) continue;
          // cm:why A component has no member — using it means using everything it calls, so that is
          // still precise. Reaching a route while a member is still unconsumed is what widens.
          const precise = current.precise && !(module.route !== undefined && current.member !== undefined && usage.member === undefined);
          const enclosing = symbolAt(consumer.file, usage.line);

          if (module.route) {
            found.push({
              file: consumer.file,
              route: module.route,
              symbol: enclosing.symbol,
              hops: current.hops + 1,
              precise,
              line: usage.line,
            });
          } else {
            next.push({
              file: consumer.file,
              symbol: enclosing.symbol,
              member: usage.member === undefined ? current.member : enclosing.member,
              hops: current.hops + 1,
              precise,
            });
          }
        }
      }
    }
    frontier = next;
  }

  const unique = new Map<string, Attribution>();
  for (const a of found) {
    const existing = unique.get(a.route);
    if (!existing || a.hops < existing.hops || (a.hops === existing.hops && a.precise && !existing.precise)) {
      unique.set(a.route, a);
    }
  }
  return [...unique.values()].sort((a, b) => a.route.localeCompare(b.route));
}

// cm:guard Strips JSONC comments WITHOUT a regex: a tsconfig path alias contains `/*` ("@/*") and
// an include glob contains `*/` ("**/*.ts"), so a naive block-comment regex eats the file whole.
export function stripJsonComments(input: string): string {
  const out = input.split('');
  let i = 0;
  let quote = false;
  while (i < input.length) {
    const ch = input[i];
    if (quote) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === '"') quote = false;
      i++;
      continue;
    }
    if (ch === '"') { quote = true; i++; continue; }
    if (ch === '/' && input[i + 1] === '/') {
      while (i < input.length && input[i] !== '\n') { out[i] = ' '; i++; }
      continue;
    }
    if (ch === '/' && input[i + 1] === '*') {
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) {
        if (input[i] !== '\n') out[i] = ' ';
        i++;
      }
      if (i < input.length) { out[i] = ' '; out[i + 1] = ' '; i += 2; }
      continue;
    }
    i++;
  }
  return out.join('');
}
