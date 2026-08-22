import { maskComments } from './mask';
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
  defaultExport?: string;
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
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const DECLARATION = /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
// cm:guard `const Account = lazy(() => import('modules/account-info'))` is how a React SPA mounts a
// screen. Reading only static imports leaves the route table and the caller graph blind to all of it.
const LAZY_IMPORT =
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:React\s*\.\s*)?lazy\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*import\s*\(\s*(['"])([^'"]+)\2/g;
const DYNAMIC_IMPORT = /(?<!\.)\bimport\s*\(\s*(['"])([^'"]+)\1/g;

// cm:guard Same in-place contract as maskComments: replaces each match with spaces of equal length
// and keeps every newline, so `lineOf` still resolves to the line the text was on.
function maskSpans(src: string, patterns: RegExp[]): string {
  const out = src.split('');
  for (const pattern of patterns) {
    for (const m of src.matchAll(pattern)) {
      for (let i = m.index; i < m.index + m[0].length; i++) if (out[i] !== '\n') out[i] = ' ';
    }
  }
  return out.join('');
}

export function parseModule(content: string): ParsedModule {
  const imports: ImportBinding[] = [];
  const exports = new Set<string>();
  const reexports: string[] = [];
  // cm:edge lockstep -> packages/scan/src/mask.ts#maskComments — every scan below reads `code`, never `content`: a commented-out
  // import used to create a real dependency edge, and prose naming a symbol used to create a usage.
  const code = maskComments(content);
  const lineOf = (idx: number) => code.slice(0, idx).split('\n').length;

  for (const m of code.matchAll(IMPORT)) {
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

  const lazyLocals = new Set<string>();
  for (const m of code.matchAll(LAZY_IMPORT)) {
    lazyLocals.add(m[1]);
    imports.push({ imported: 'default', local: m[1], from: m[3], line: lineOf(m.index) });
  }
  // cm:why A dynamic import with no name still couples the two files — recorded as `*` so a consumer
  // edge exists without claiming to know which symbol travelled across it.
  for (const m of code.matchAll(DYNAMIC_IMPORT)) {
    if (imports.some((i) => i.from === m[2])) continue;
    imports.push({ imported: '*', local: '*', from: m[2], line: lineOf(m.index) });
  }

  for (const m of code.matchAll(REEXPORT)) reexports.push(m[2]);
  for (const m of code.matchAll(EXPORT_NAMED)) exports.add(m[1]);
  for (const m of code.matchAll(EXPORT_LIST)) {
    for (const part of m[1].split(',')) {
      const spec = part.trim().replace(/^type\s+/, '');
      const alias = /\s+as\s+([A-Za-z_$][\w$]*)$/.exec(spec);
      if (alias) exports.add(alias[1]);
      else if (/^[A-Za-z_$][\w$]*$/.test(spec)) exports.add(spec);
    }
  }
  if (/export\s+default\b/.test(code)) exports.add('default');
  // cm:why `export default addUserBank` is the only export of most api modules; not recording the
  // NAME it exports forces every chain through that file to widen to ANY and lose its precision.
  const defaultExport = (/export\s+default\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/.exec(code)
    ?? /export\s+default\s+([A-Za-z_$][\w$]*)\s*;?[ \t]*(?:\/\/[^\n]*)?$/m.exec(code))?.[1];
  if (defaultExport !== undefined) exports.add(defaultExport);

  // cm:guard Masks the import/export CLAUSES in place — same length, newlines kept — for the same
  // reason maskComments does: every line below is an index into this string.
  // cm:why The clause names every symbol it binds, so a `\bname\b` scan finds the binding itself
  // and calls it a use.
  // cm:why A fixed-width lookbehind cannot see past a multi-line clause: `import {\n A,\n apiFetch,`
  // puts 26 characters between `import` and the name, and 24 was the window.
  // cm:why The usage landed on a line with no enclosing declaration, widening the chain to ANY and
  // sending POST /auth/refresh to 26 of 27 screens — one of which imports only a class.
  const body = maskSpans(code, [IMPORT, REEXPORT, EXPORT_LIST]);

  const usages: Usage[] = [];
  // cm:guard An anonymous `import('./x')` binds the local name `*`, which is not an identifier —
  // interpolating it builds the regex `\b*\b` and throws "Nothing to repeat" mid-scan.
  const locals = new Set(imports.map((i) => i.local).filter((l) => IDENTIFIER.test(l)));
  for (const local of locals) {
    const re = new RegExp(`\\b${local}\\b(?:\\s*\\.\\s*([A-Za-z_$][\\w$]*))?`, 'g');
    for (const m of body.matchAll(re)) {
      usages.push({ symbol: local, member: m[1], line: lineOf(m.index) });
    }
  }
  const declarations = new Set<string>();
  for (const m of code.matchAll(DECLARATION)) declarations.add(m[1]);

  const localUsages: Usage[] = [];
  for (const local of declarations) {
    const re = new RegExp(`\\b${local}\\b(?:\\s*\\.\\s*([A-Za-z_$][\\w$]*))?`, 'g');
    for (const m of body.matchAll(re)) {
      // cm:guard The declaration site is not a use of itself — without this every exported symbol
      // would carry a self-edge at its own `function x` line.
      if (/(?:const|let|var|function|class)\s+$/.test(body.slice(Math.max(0, m.index - 40), m.index))) continue;
      localUsages.push({ symbol: local, member: m[1], line: lineOf(m.index) });
    }
  }

  return { exports: [...exports], defaultExport, imports, usages, localUsages, declarations: [...declarations], reexports };
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
  line?: number;
}

// cm:why Roles come from the NAMING CONVENTION, not from analysis: `use*` is a hook by convention
// and Capitalised is a component by convention.
// cm:why Recorded as a hint for reading the chain, never as a fact about what the module is.
export type ChainRole = 'client' | 'hook' | 'component' | 'module' | 'screen';

export interface ChainStep {
  file: string;
  symbol: string;
  line: number;
  role: ChainRole;
  precise: boolean;
}

export interface Attribution {
  file: string;
  route: string;
  symbol: string;
  hops: number;
  precise: boolean;
  line: number;
  chain: ChainStep[];
}

export function roleOf(symbol: string, isOrigin: boolean, isScreen: boolean): ChainRole {
  if (isScreen) return 'screen';
  if (isOrigin) return 'client';
  if (/^use[A-Z]/.test(symbol)) return 'hook';
  if (/^[A-Z]/.test(symbol)) return 'component';
  return 'module';
}

export const MAX_FAN_OUT = 40;

// cm:why Stands for "whichever binding this module exposes" — the alternative is dropping the chain
// at every default export, which is most of a React codebase.
const ANY = '*';

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
  const originStep: ChainStep = {
    file: origin.file,
    symbol: origin.symbol,
    line: origin.line ?? 0,
    role: roleOf(origin.symbol, true, false),
    precise: true,
  };
  let frontier: Array<Origin & { hops: number; precise: boolean; chain: ChainStep[] }> =
    [{ ...origin, hops: 0, precise: true, chain: [originStep] }];

  // cm:guard Bound the walk by ROUNDS, not by frontier[0].hops — an intra-file edge deliberately
  // keeps hops the same, so reading depth off one entry would stop the walk early or never.
  let rounds = 0;
  while (frontier.length > 0 && rounds < maxDepth * 2 && found.length < MAX_FAN_OUT) {
    rounds++;
    const next: Array<Origin & { hops: number; precise: boolean; chain: ChainStep[] }> = [];
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
          chain: [...current.chain, {
            file: current.file, symbol: enclosing.symbol, line: usage.line,
            role: roleOf(enclosing.symbol, false, false), precise: current.precise,
          }],
        });
      }

      for (const consumer of graph.consumers.get(current.file) ?? []) {
        const module = graph.modules.get(consumer.file);
        if (!module) continue;
        const matchesSymbol =
          current.symbol === ANY ||
          consumer.imported === '*' ||
          consumer.imported === current.symbol ||
          consumer.local === current.symbol ||
          // cm:why An importer may rename a default (`import addBank from`), so the binding matches
          // by what the exporting file calls it, not by the name that happens to arrive.
          (consumer.imported === 'default' && here?.parsed.defaultExport === current.symbol);
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
              // cm:guard Names the module's default export, not `symbolAt`: line 113 of a screen is
              // JSX inside the return, so the nearest declaration above it is some inner handler.
              // cm:guard Truthful about the line, misleading about whose chain step this is.
              chain: [...current.chain, {
                file: consumer.file,
                symbol: module.parsed.defaultExport ?? enclosing.symbol,
                line: usage.line,
                role: 'screen',
                precise,
              }],
            });
          } else {
            // cm:guard The symbol INSIDE a file is not the name its consumers import — a default
            // export renames it. Widening to ANY keeps the chain alive; `precise` records the cost.
            const exported = module.parsed.exports.includes(enclosing.symbol);
            next.push({
              file: consumer.file,
              symbol: exported ? enclosing.symbol : ANY,
              member: usage.member === undefined ? current.member : enclosing.member,
              hops: current.hops + 1,
              precise: precise && exported,
              chain: [...current.chain, {
                file: consumer.file, symbol: enclosing.symbol, line: usage.line,
                role: roleOf(enclosing.symbol, false, false), precise: precise && exported,
              }],
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
