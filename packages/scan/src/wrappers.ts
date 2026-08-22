import { blankComments, definitionHeads, matchingClose } from './feScanner';

// cm:guard Never a bare `get`/`post`: `cache.get(id)` and `map.get(key)` would make every helper
// that touches a Map look like an http transport, and the wrapper set then swallows the app.
const PRIMITIVE = [
  'fetch',
  '\\$fetch',
  'ofetch',
  '(?:this|api|http|client|axios|instance|transport)\\s*\\.\\s*(?:get|post|put|patch|delete|request|send)',
];

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
  for (const head of definitionHeads(content)) {
    // cm:guard `constructor` is a definition but never a transport name: admitting it puts
    // `constructor` in the wrapper set, and every class in the codebase then has a call site.
    if (head.name === 'constructor') continue;
    // cm:guard An overload signature reaches here with openBrace -1: it forwards nothing, and
    // slicing a body from -1 would hand the fixpoint the tail of the file to walk instead.
    if (head.openBrace === -1) continue;
    const parameter = firstParameter(content.slice(head.openParen + 1, head.closeParen));
    if (!parameter) continue;
    out.push({
      name: head.name,
      parameter,
      body: content.slice(head.openBrace, head.closeBrace === -1 ? undefined : head.closeBrace),
      bodyStart: head.openBrace,
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
