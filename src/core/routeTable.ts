import { parseModule } from './callerGraph';
import type { ResolveImport } from './callerGraph';

export interface RouteTable {
  routes: Map<string, string[]>;
  unresolved: Array<{ file: string; line: number; expression: string }>;
}

const PATH_ATTR = /\bpath\s*=\s*(?:(['"])([^'"]*)\1|\{([^}]*?)\})/;
const TAG = /<\s*([A-Za-z_$][\w$.]*)/g;

// cm:guard Not framework wrappers: `element={<Suspense><Purchase/></Suspense>}` names Suspense first,
// and taking that hangs every route on the routing file instead of the screen it renders.
const WRAPPER = new Set([
  'Suspense', 'Fragment', 'Outlet', 'Navigate', 'ErrorBoundary', 'Route', 'Routes', 'PageDataProvider',
  'AuthInit', 'PrivateRoute', 'ProtectedRoute', 'RequireAuth', 'Layout', 'MasterLayout',
]);

// cm:guard Brace-aware, not `[^>]*`: the `element={<X/>}` attribute contains its own `>`, so a regex
// that stops at the first one truncates the attribute list and loses the component entirely.
function routeTags(content: string, start: number): { attrs: string; end: number } {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < content.length; i++) {
    const ch = content[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return { attrs: content.slice(start, i), end: i };
  }
  return { attrs: content.slice(start), end: content.length };
}
const STRING_CONST = /(?:^|\n)\s*export\s+const\s+([A-Z][\w$]*)\s*(?::\s*[^=]+)?=\s*([^;\n]+)/g;
const ROUTER_ROOT = /<(?:BrowserRouter|HashRouter|MemoryRouter)\b|createBrowserRouter\s*\(/;

// cm:why A Vite/CRA app declares its routes in code, so `routeFromFilePath` finds nothing and every
// call site stops at module level — the map ends up with 500 endpoints and not one screen.
export function stringConstants(files: Array<{ file: string; content: string }>): Map<string, string> {
  const raw = new Map<string, string>();
  for (const { content } of files) {
    for (const m of content.matchAll(STRING_CONST)) if (!raw.has(m[1])) raw.set(m[1], m[2].trim());
  }

  const resolved = new Map<string, string>();
  // cm:guard Runs to a fixpoint: `PURCHASE_LIST = PURCHASE + '/' + PURCHASE_LIST_PATH` needs the two
  // names it concatenates to be known first, and source order guarantees nothing about that.
  for (let round = 0; round < 6; round++) {
    let progressed = false;
    for (const [name, expression] of raw) {
      if (resolved.has(name)) continue;
      const value = evaluateConcat(expression, resolved);
      if (value !== null) {
        resolved.set(name, value);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return resolved;
}

function evaluateConcat(expression: string, known: Map<string, string>): string | null {
  const parts = expression.split('+').map((p) => p.trim());
  const out: string[] = [];
  for (const part of parts) {
    const literal = /^(['"])([^'"]*)\1$/.exec(part);
    if (literal) {
      out.push(literal[2]);
      continue;
    }
    if (/^[A-Za-z_$][\w$]*$/.test(part) && known.has(part)) {
      out.push(known.get(part) as string);
      continue;
    }
    return null;
  }
  return out.join('');
}

interface RouteEntry {
  path: string | null;
  expression: string;
  components: string[];
  line: number;
}

export function routeEntries(content: string, constants: Map<string, string>): RouteEntry[] {
  const out: RouteEntry[] = [];
  for (const m of content.matchAll(/<\s*Route\b/g)) {
    const { attrs } = routeTags(content, m.index + m[0].length);
    const element = /\belement\s*=\s*\{/.exec(attrs);
    if (!element) continue;
    const body = attrs.slice(element.index).replace(/\b(?:fallback|errorElement)\s*=\s*\{[^{}]*\}/g, '');
    // cm:guard Innermost wins, and `fallback={<Loading/>}` is dropped first: the screen sits at the
    // BOTTOM of `<Suspense><Permission><Screen/></Permission></Suspense>`, never at the top.
    const candidates = [...body.matchAll(TAG)]
      .map((t) => t[1].split('.').pop() as string)
      .filter((name) => /^[A-Z]/.test(name) && !WRAPPER.has(name))
      .reverse();
    if (candidates.length === 0) continue;
    const pathMatch = PATH_ATTR.exec(attrs.slice(0, element.index));
    const expression = pathMatch ? (pathMatch[2] ?? pathMatch[3]).trim() : '';
    const path = pathMatch === null ? '' : pathMatch[2] !== undefined ? pathMatch[2] : evaluateConcat(pathMatch[3], constants);
    out.push({ path, expression, components: candidates, line: content.slice(0, m.index).split('\n').length });
  }
  return out;
}

function joinRoute(prefix: string, path: string): string {
  // cm:guard Collapse the duplicate slashes BEFORE trimming the tail — a child `path="/"` makes
  // `/account//`, and trimming first leaves the trailing slash that splits one screen into two.
  const merged = `${prefix}/${path}`.replace(/\/{2,}/g, '/').replace(/\/\*?$/, '');
  return merged.length > 0 ? merged : '/';
}

// cm:guard Keyed by the component's DECLARING file, not by the file the route sits in: the route
// table lives in `routing/`, while the screen that breaks is the module the element points at.
export function buildRouteTable(
  files: Array<{ file: string; content: string }>,
  resolve: ResolveImport
): RouteTable {
  const constants = stringConstants(files);
  const byFile = new Map(files.map((f) => [f.file, f.content]));
  const declaredIn = new Map<string, string>();
  const importsOf = new Map<string, Map<string, string>>();
  const entries = new Map<string, RouteEntry[]>();
  const roots: string[] = [];

  for (const { file, content } of files) {
    const parsed = parseModule(content);
    importsOf.set(file, new Map(parsed.imports.map((i) => [i.local, i.from])));
    for (const declaration of parsed.declarations) if (!declaredIn.has(declaration)) declaredIn.set(declaration, file);
    entries.set(file, routeEntries(content, constants));
    if (ROUTER_ROOT.test(content)) roots.push(file);
  }

  const fileOf = (from: string, component: string): string | null => {
    const specifier = importsOf.get(from)?.get(component);
    const imported = specifier ? resolve(from, specifier) : null;
    if (imported && byFile.has(imported)) return imported;
    return declaredIn.get(component) ?? null;
  };

  const routes = new Map<string, string[]>();
  const unresolved: RouteTable['unresolved'] = [];
  const add = (file: string, route: string): boolean => {
    const existing = routes.get(file) ?? [];
    if (existing.includes(route)) return false;
    routes.set(file, [...existing, route].sort());
    return true;
  };

  let frontier = roots.map((file) => ({ file, prefix: '' }));
  const seen = new Set<string>();

  // cm:guard Bounded by rounds and by a seen (file, prefix) pair — a module that renders a router
  // which mounts the module again is a normal shape in nested layouts, and it must terminate.
  for (let round = 0; round < 8 && frontier.length > 0; round++) {
    const next: Array<{ file: string; prefix: string }> = [];
    for (const { file, prefix } of frontier) {
      if (seen.has(file)) continue;
      seen.add(file);

      for (const entry of entries.get(file) ?? []) {
        if (entry.path === null) {
          unresolved.push({ file, line: entry.line, expression: entry.expression });
          continue;
        }
        // cm:why The element may nest several components — the screen is the first one that is a
        // real module in this repo, so provider wrappers in between are stepped over, not guessed at.
        const target = entry.components.map((c) => fileOf(file, c)).find((f) => f !== null && f !== file);
        const route = joinRoute(prefix, entry.path);
        if (!target) {
          if (entry.path !== '') add(file, route);
          continue;
        }
        add(target, route);
        if (!seen.has(target)) next.push({ file: target, prefix: route });
      }
    }
    frontier = next;
  }

  return { routes, unresolved };
}
