import type { CallEdge, Confidence, FieldNode, MapMethod, ReadEdge, ScreenNode, UnresolvedCall } from './apimap';
import { endpointId, fieldId, normalizePath, screenId } from './apimap';
import type { EndpointNode } from './apimap';

// cm:edge contract -> skills/fe-map-extractor/skill.md — the skill writes this shape as hints.json
// and never edits the .apimap directly, so every id stays derived by code and the scan deterministic.
export interface ScanHints {
  resolve?: Array<{ file: string; line: number; url: string; method?: MapMethod; note?: string }>;
  ignore?: Array<{ file: string; line: number }>;
}

export interface FileScan {
  screens: ScreenNode[];
  endpoints: EndpointNode[];
  fields: FieldNode[];
  calls: CallEdge[];
  reads: ReadEdge[];
  unresolved: UnresolvedCall[];
}

const VERBS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

const SYMBOL_PATTERNS: RegExp[] = [
  /^\s*export\s+default\s+function\s+([A-Za-z_$][\w$]*)/,
  /^\s*export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/,
  /^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[:=]/,
  /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/,
  /^\s*export\s+default\s+class\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/,
];

export function enclosingSymbols(content: string): Array<{ line: number; name: string }> {
  const out: Array<{ line: number; name: string }> = [];
  content.split('\n').forEach((text, i) => {
    for (const re of SYMBOL_PATTERNS) {
      const m = re.exec(text);
      if (m) {
        out.push({ line: i + 1, name: m[1] });
        return;
      }
    }
  });
  return out;
}

export function symbolAt(symbols: Array<{ line: number; name: string }>, line: number, fallback: string): string {
  let best = fallback;
  for (const s of symbols) {
    if (s.line <= line) best = s.name;
    else break;
  }
  return best;
}

const ROUTE_DIRS = ['pages', 'routes', 'app', 'views', 'screens'];

// cm:why File-based routing is the one screen signal a generic scanner can read without knowing the
// framework — every convention (Next, Nuxt, SvelteKit, Remix) encodes the route in the path.
export function routeFromFilePath(file: string): string | undefined {
  const parts = file.split('/').filter(Boolean);
  const anchor = parts.findIndex((p) => ROUTE_DIRS.includes(p));
  if (anchor === -1) return undefined;
  const rest = parts.slice(anchor + 1);
  if (rest.length === 0) return undefined;
  const last = rest[rest.length - 1];
  const base = last.replace(/\.(tsx?|jsx?|vue|svelte|astro)$/, '');
  const segs = rest.slice(0, -1);
  if (!/^(page|index|route|\+page)$/.test(base)) segs.push(base);
  const route = segs
    .filter((s) => !/^\(.*\)$/.test(s))
    .map((s) => s.replace(/^\[\.{3}(.+)\]$/, '{param}').replace(/^\[(.+)\]$/, '{param}'))
    .join('/');
  return `/${route}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
}

// cm:guard Quote- and depth-aware, not a regex: `fetch(\`${a},${b}\`)` and `axios(url, { a: [1,2] })`
// both contain commas that must not terminate the first argument.
export function firstArgument(text: string, openParenIdx: number): string | null {
  let depth = 0;
  let quote: string | null = null;
  let out = '';
  for (let i = openParenIdx; i < text.length; i++) {
    const ch = text[i];
    const prev = text[i - 1];
    if (quote) {
      out += ch;
      if (ch === quote && prev !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      if (depth === 1 && ch === '(') continue;
      out += ch;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) return out.trim();
      out += ch;
      continue;
    }
    if (ch === ',' && depth === 1) return out.trim();
    out += ch;
  }
  return out.trim() ? out.trim() : null;
}

export interface ResolvedUrl {
  path: string;
  baseUrlVar?: string;
  confidence: Confidence;
  pathLike: boolean;
}

const LITERAL = /^(['"`])([\s\S]*)\1$/;

export function resolveUrl(expr: string): ResolvedUrl | { unresolved: string } {
  const raw = expr.trim();
  const lit = LITERAL.exec(raw);
  if (lit) {
    const inner = lit[2];
    const leading = /^\$\{([^}]+)\}/.exec(inner);
    const baseUrlVar = leading ? leading[1].trim() : undefined;
    const body = leading ? inner.slice(leading[0].length) : inner;
    if (!body.replace(/\$\{[^}]*\}/g, '').replace(/[/{}]/g, '').trim()) {
      return { unresolved: 'url is entirely interpolated — no literal path segment' };
    }
    return {
      path: normalizePath(body),
      baseUrlVar,
      confidence: lit[1] === '`' || baseUrlVar ? 'inferred' : 'exact',
      pathLike: body.includes('/'),
    };
  }
  const concat = /^([A-Za-z_$][\w$.]*)\s*\+\s*(['"`])([\s\S]*?)\2/.exec(raw);
  if (concat) {
    return { path: normalizePath(concat[3]), baseUrlVar: concat[1], confidence: 'inferred', pathLike: concat[3].includes('/') };
  }
  const embedded = /(['"`])(\/[A-Za-z0-9_\-./{}$:]*)\1/.exec(raw);
  if (embedded) return { path: normalizePath(embedded[2]), confidence: 'guess', pathLike: true };
  return { unresolved: `url is a variable or expression: ${raw.slice(0, 60)}` };
}

// cm:guard Blanks comment bodies in place, preserving every offset and newline — findCallSites
// reports byte offsets and line numbers that must still point at the original source.
export function blankComments(content: string): string {
  const out = content.split('');
  let i = 0;
  let quote: string | null = null;
  while (i < content.length) {
    const ch = content[i];
    const next = content[i + 1];
    if (quote) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; i++; continue; }
    if (ch === '/' && next === '/') {
      while (i < content.length && content[i] !== '\n') { out[i] = ' '; i++; }
      continue;
    }
    if (ch === '/' && next === '*') {
      while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) {
        if (content[i] !== '\n') out[i] = ' ';
        i++;
      }
      if (i < content.length) { out[i] = ' '; out[i + 1] = ' '; i += 2; }
      continue;
    }
    i++;
  }
  return out.join('');
}

interface CallSite {
  line: number;
  via: string;
  method: MapMethod;
  argIdx: number;
  methodExplicit: boolean;
  definitelyHttp: boolean;
}

// cm:guard `<ident>.get(...)` is Map.get far more often than it is an HTTP GET. A member call only
// counts as HTTP when the receiver reads like a client OR the argument resolves to a real path.
const HTTP_RECEIVER = /^(\$?(api|http|client|axios|request|req|fetcher|instance|service|agent|rest|sdk|gql|backend|server))/i;

const MEMBER_CALL = new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s*\\.\\s*(${VERBS.join('|')})\\b`, 'g');
const PLAIN_CALL = /\b(fetch|\$fetch|ofetch|useFetch|useSWR|request|axios)\b/g;

// cm:guard `api.get<{ data: T[] }>('/x')` is the dominant shape in a typed client — the generic
// sits between the verb and the paren, so the open paren must be found, never assumed adjacent.
export function openParenAfter(content: string, from: number): number | null {
  let i = from;
  while (i < content.length && /\s/.test(content[i])) i++;
  if (content[i] === '<') {
    let depth = 0;
    while (i < content.length) {
      const ch = content[i];
      if (ch === '<') depth++;
      else if (ch === '>') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      } else if (ch === '(' || ch === ')' || ch === '\n') return null;
      i++;
    }
    while (i < content.length && /\s/.test(content[i])) i++;
  }
  return content[i] === '(' ? i : null;
}
const XHR_OPEN = /\.\s*open\s*\(\s*(['"`])(GET|POST|PUT|PATCH|DELETE|HEAD)\1\s*,/gi;

// cm:guard Bounded by the call's own parentheses, not a fixed character window — a lookahead that
// runs past the closing paren reads the NEXT call's `method:` and mislabels this one.
export function callExpression(text: string, openParenIdx: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openParenIdx; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return text.slice(openParenIdx, i + 1);
    }
  }
  return text.slice(openParenIdx);
}

function methodFromContext(window: string): MapMethod | null {
  const m = /\bmethod\s*:\s*(['"`])(GET|POST|PUT|PATCH|DELETE|HEAD)\1/i.exec(window);
  return m ? (m[2].toUpperCase() as MapMethod) : null;
}

export function findCallSites(content: string): CallSite[] {
  const sites: CallSite[] = [];
  const lineOf = (idx: number) => content.slice(0, idx).split('\n').length;
  const push = (s: CallSite) => {
    if (!sites.some((x) => x.argIdx === s.argIdx)) sites.push(s);
  };

  for (const m of content.matchAll(MEMBER_CALL)) {
    const idx = openParenAfter(content, m.index + m[0].length);
    if (idx === null) continue;
    push({
      line: lineOf(idx),
      via: m[1],
      method: m[2].toUpperCase() as MapMethod,
      argIdx: idx,
      methodExplicit: true,
      definitelyHttp: HTTP_RECEIVER.test(m[1]),
    });
  }
  for (const m of content.matchAll(PLAIN_CALL)) {
    const idx = openParenAfter(content, m.index + m[0].length);
    if (idx === null) continue;
    const window = callExpression(content, idx);
    const explicit = methodFromContext(window);
    push({
      line: lineOf(idx),
      via: m[1],
      method: explicit ?? 'GET',
      argIdx: idx,
      methodExplicit: explicit !== null,
      definitelyHttp: true,
    });
  }
  for (const m of content.matchAll(XHR_OPEN)) {
    const idx = m.index + m[0].length - 1;
    push({
      line: lineOf(idx),
      via: 'xhr',
      method: m[2].toUpperCase() as MapMethod,
      argIdx: idx,
      methodExplicit: true,
      definitelyHttp: true,
    });
  }
  return sites.sort((a, b) => a.argIdx - b.argIdx);
}

// cm:why `rows.data.map(u => u.email)` is how a list screen reads its fields — without following
// the callback parameter the whole collection case traces nothing, and every field of every list
const LAMBDA = /^\s*\(\s*(?:\(\s*(\w+)[^)]*\)|(\w+))\s*=>/;

export function lambdaReads(content: string, afterChain: number, basePath: string): string[] {
  const lambda = LAMBDA.exec(content.slice(afterChain, afterChain + 80));
  const param = lambda?.[1] ?? lambda?.[2];
  if (!param) return [];
  const body = content.slice(afterChain, afterChain + 600);
  const chains = new RegExp(`\\b${param}\\s*((?:\\.\\s*[A-Za-z_$][\\w$]*)+)`, 'g');
  const out = new Set<string>();
  for (const m of body.matchAll(chains)) {
    const leaf = stripCallSegments(m[1].replace(/\s+/g, '').replace(/^\./, ''));
    if (leaf) out.add(basePath ? `${basePath}.${leaf}` : leaf);
  }
  return [...out];
}

const RESPONSE_MEMBERS = /^(then|catch|finally|json|text|ok|status|statusText|headers|blob|arrayBuffer)$/;

// cm:why `body.data.map(...)` reads the field `data`, not a field called `map` — without this the
// map fills with array and promise method names and the field half becomes unusable.
const CALL_SEGMENTS = new Set([
  'map', 'filter', 'forEach', 'reduce', 'find', 'findIndex', 'some', 'every', 'includes',
  'slice', 'splice', 'sort', 'join', 'push', 'pop', 'concat', 'flat', 'flatMap', 'at',
  'then', 'catch', 'finally', 'toString', 'valueOf', 'length', 'trim', 'split', 'replace',
]);

export function stripCallSegments(chain: string): string {
  const segs = chain.split('.');
  while (segs.length > 0 && CALL_SEGMENTS.has(segs[segs.length - 1])) segs.pop();
  return segs.join('.');
}

const RESULT_BINDING = /(?:const|let|var)\s+(?:\{([^}]*)\}|([A-Za-z_$][\w$]*))\s*=\s*(?:await\s+)?$/;

function tracedReads(content: string, site: CallSite): Array<{ path: string; line: number; confidence: Confidence }> {
  const lineStart = content.lastIndexOf('\n', site.argIdx) + 1;
  const head = content.slice(lineStart, site.argIdx);
  const bind = RESULT_BINDING.exec(head.replace(/\b(fetch|\$fetch|ofetch|useFetch|useSWR|request|axios)\b[\s\S]*$/, ''));
  const out: Array<{ path: string; line: number; confidence: Confidence }> = [];
  const lineOf = (idx: number) => content.slice(0, idx).split('\n').length;

  if (bind?.[1]) {
    for (const name of bind[1].split(',')) {
      const clean = name.split(':')[0].trim();
      if (clean && /^[A-Za-z_$][\w$]*$/.test(clean)) out.push({ path: clean, line: site.line, confidence: 'inferred' });
    }
  }
  const root = bind?.[2];
  if (root) {
    const window = content.slice(site.argIdx, site.argIdx + 2000);
    // cm:why `const r = await fetch(...)` then `const b = await r.json()` is the dominant shape —
    // stopping at `r` traces nothing, so follow exactly one parse hop before reading the chain.
    const hop = new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(?:await\\s+)?${root}\\s*\\.\\s*(?:json|text)\\s*\\(`).exec(window);
    const roots = hop ? [root, hop[1]] : [root];
    const chain = new RegExp(`\\b(?:${roots.join('|')})\\s*((?:\\.\\s*[A-Za-z_$][\\w$]*)+)`, 'g');
    for (const m of window.matchAll(chain)) {
      const raw = m[1].replace(/\s+/g, '').replace(/^\./, '');
      const path = stripCallSegments(raw);
      if (path && !RESPONSE_MEMBERS.test(path)) {
        out.push({ path, line: lineOf(site.argIdx + m.index), confidence: 'guess' });
      }
      for (const nested of lambdaReads(window, m.index + m[0].length, path)) {
        out.push({ path: nested, line: lineOf(site.argIdx + m.index), confidence: 'guess' });
      }
    }
  }
  return out;
}

const SKIP_PATH = /(^|\/)(node_modules|dist|build|coverage|\.next|\.nuxt|\.git|vendor|__snapshots__)(\/|$)/;

export function isScannableFile(file: string): boolean {
  if (SKIP_PATH.test(file)) return false;
  if (/\.(test|spec)\.[jt]sx?$/.test(file)) return false;
  return /\.(tsx?|jsx?|vue|svelte|astro|mjs|cjs)$/.test(file);
}

function hintKey(file: string, line: number): string {
  return `${file}:${line}`;
}

export function indexHints(hints: ScanHints | undefined): {
  resolve: Map<string, { url: string; method?: MapMethod; note?: string }>;
  ignore: Set<string>;
} {
  const resolve = new Map<string, { url: string; method?: MapMethod; note?: string }>();
  for (const r of hints?.resolve ?? []) resolve.set(hintKey(r.file, r.line), r);
  return { resolve, ignore: new Set((hints?.ignore ?? []).map((i) => hintKey(i.file, i.line))) };
}

export function scanFile(file: string, rawContent: string, hints?: ScanHints): FileScan {
  const out: FileScan = { screens: [], endpoints: [], fields: [], calls: [], reads: [], unresolved: [] };
  const content = blankComments(rawContent);
  const sites = findCallSites(content);
  if (sites.length === 0) return out;

  const symbols = enclosingSymbols(content);
  const route = routeFromFilePath(file);
  const fallbackSymbol = (file.split('/').pop() ?? file).replace(/\.[^.]+$/, '');
  const lines = rawContent.split('\n');
  const index = indexHints(hints);

  for (const site of sites) {
    const arg = firstArgument(content, site.argIdx);
    const snippet = (lines[site.line - 1] ?? '').trim().slice(0, 160);
    const source = { file, line: site.line };

    if (index.ignore.has(hintKey(file, site.line))) continue;
    const hint = index.resolve.get(hintKey(file, site.line));

    if (!arg && !hint) {
      if (site.definitelyHttp) out.unresolved.push({ source, reason: 'call has no arguments to read a url from', snippet });
      continue;
    }
    const resolved = hint
      ? { path: normalizePath(hint.url), confidence: 'inferred' as Confidence, pathLike: true }
      : resolveUrl(arg as string);
    if ('unresolved' in resolved) {
      if (site.definitelyHttp) out.unresolved.push({ source, reason: resolved.unresolved, snippet });
      continue;
    }
    if (!site.definitelyHttp && !resolved.pathLike) continue;
    const method = hint?.method ?? site.method;

    const symbol = symbolAt(symbols, site.line, fallbackSymbol);
    const sid = screenId(route, file, symbol);
    const eid = endpointId(method, resolved.path);

    out.screens.push({ id: sid, label: route ?? symbol, route, source: { file, line: 1 } });
    out.endpoints.push({
      id: eid,
      method,
      path: resolved.path,
      baseUrlVar: 'baseUrlVar' in resolved ? resolved.baseUrlVar : undefined,
    });

    // cm:why The edge is only as good as its weakest half — a certain url reached through a guessed
    // verb is still a guess, so the two confidences collapse to the lower one here.
    const confidence: Confidence = hint
      ? 'inferred'
      : resolved.confidence === 'guess' || !site.methodExplicit
        ? resolved.confidence === 'exact' && !site.methodExplicit
          ? 'inferred'
          : 'guess'
        : resolved.confidence;

    out.calls.push({ screenId: sid, endpointId: eid, via: site.via, confidence, source });

    for (const read of tracedReads(content, site)) {
      const fid = fieldId(eid, read.path);
      out.fields.push({ id: fid, endpointId: eid, path: read.path, kind: 'response' });
      out.reads.push({
        screenId: sid,
        fieldId: fid,
        confidence: read.confidence,
        source: { file, line: read.line },
      });
    }
  }
  return out;
}
