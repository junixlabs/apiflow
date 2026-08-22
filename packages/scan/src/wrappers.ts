import { blankComments } from './feScanner';

// cm:guard Never a bare `get`/`post`: `cache.get(id)` and `map.get(key)` would make every helper
// that touches a Map look like an http transport, and the wrapper set then swallows the app.
const PRIMITIVE = [
  'fetch',
  '\\$fetch',
  'ofetch',
  '(?:this|api|http|client|axios|instance|transport)\\s*\\.\\s*(?:get|post|put|patch|delete|request|send)',
];

// cm:guard Paren-balanced, not `\([^)]*\)`: a default parameter like
// `read: (r: Response) => T = parse` closes early and the whole method stops being seen.
const METHOD_HEAD =
  /(?:^|[\s;}])(?:export\s+)?(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:async\s+)?(?:function\s+)?([A-Za-z_$][\w$]*)\s*(?:<[^>(){}]*>)?\s*\(/g;

const RESERVED = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'do', 'with', 'constructor']);

function matchingClose(content: string, open: number, openChar: string, closeChar: string): number {
  let depth = 0;
  for (let i = open; i < content.length; i++) {
    if (content[i] === openChar) depth++;
    else if (content[i] === closeChar && --depth === 0) return i;
  }
  return -1;
}

function firstParameter(params: string): string | null {
  const name = /^([A-Za-z_$][\w$]*)/.exec(params.split(',')[0].trim());
  return name ? name[1] : null;
}

function firstArgument(content: string, openParen: number): string {
  const close = matchingClose(content, openParen, '(', ')');
  const inner = content.slice(openParen + 1, close === -1 ? undefined : close);
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    if ('([{'.includes(inner[i])) depth++;
    else if (')]}'.includes(inner[i])) depth--;
    else if (inner[i] === ',' && depth === 0) return inner.slice(0, i);
  }
  return inner;
}

interface Definition {
  name: string;
  parameter: string;
  body: string;
  bodyStart: number;
  source: string;
}

function definitionsIn(content: string): Definition[] {
  const out: Definition[] = [];
  for (const m of content.matchAll(METHOD_HEAD)) {
    if (RESERVED.has(m[1])) continue;
    const openParen = m.index + m[0].length - 1;
    const closeParen = matchingClose(content, openParen, '(', ')');
    if (closeParen === -1) continue;
    const after = /^\s*(?::\s*[^{;=]+)?\{/.exec(content.slice(closeParen + 1, closeParen + 400));
    if (!after) continue;
    const openBrace = closeParen + after[0].length;
    const closeBrace = matchingClose(content, openBrace, '{', '}');
    const parameter = firstParameter(content.slice(openParen + 1, closeParen));
    if (!parameter) continue;
    out.push({
      name: m[1],
      parameter,
      body: content.slice(openBrace, closeBrace === -1 ? undefined : closeBrace),
      bodyStart: openBrace,
      source: content,
    });
  }
  return out;
}

// cm:why A typed client hides its verbs — `listCompanies` → `this.fetchPage` → `this.send` → `fetch`
// — so every path above the last recognisable hop goes missing unless the chain is walked by name.
export function findHttpWrappers(files: Array<{ file: string; content: string }>): Set<string> {
  const definitions = files.flatMap(({ content }) => definitionsIn(blankComments(content)));
  const wrappers = new Set<string>();

  // cm:guard The url must be PASSED, not born here: `updateCompany(id)` calls
  // ``request(`/companies/${id}`)``, and a literal path in the argument marks a real call site.
  const forwards = (definition: Definition, callees: readonly string[]): boolean => {
    const mentionsParameter = new RegExp(`\\b${definition.parameter}\\b`);
    for (const callee of callees) {
      const re = new RegExp(`${callee}\\s*(?:<[^()]*>)?\\s*\\(`, 'g');
      for (const call of definition.body.matchAll(re)) {
        const openParen = definition.bodyStart + call.index + call[0].length - 1;
        const argument = firstArgument(definition.source, openParen).trim();
        if (/^['"`]\s*\//.test(argument)) continue;
        if (mentionsParameter.test(argument)) return true;
        const local = /^[A-Za-z_$][\w$]*$/.test(argument)
          ? new RegExp(`\\b(?:const|let|var)\\s+${argument}\\s*=([^;]*)`).exec(definition.body)
          : null;
        if (local && mentionsParameter.test(local[1])) return true;
      }
    }
    return false;
  };

  // cm:guard Runs to a fixpoint, not one pass: the chain is discovered from the bottom up, so a
  // single sweep finds `send` but leaves `fetchPage` — the very name the call sites actually use.
  for (let round = 0; round < 6; round++) {
    const before = wrappers.size;
    for (const definition of definitions) {
      if (wrappers.has(definition.name)) continue;
      const known = [...wrappers].map((w) => `\\b${w}`);
      if (forwards(definition, [...PRIMITIVE, ...known])) wrappers.add(definition.name);
    }
    if (wrappers.size === before) break;
  }
  return wrappers;
}
