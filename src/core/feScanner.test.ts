import { describe, expect, it } from 'vitest';
import {
  blankComments,
  findCallSites,
  firstArgument,
  isScannableFile,
  resolveUrl,
  routeFromFilePath,
  scanFile,
  stripCallSegments,
  symbolAt,
  enclosingSymbols,
} from './feScanner';

describe('firstArgument', () => {
  const at = (src: string) => src.indexOf('(');

  it('stops at the top-level comma', () => {
    const src = "fetch('/api/users', { method: 'POST' })";
    expect(firstArgument(src, at(src))).toBe("'/api/users'");
  });

  it('ignores commas inside a template literal', () => {
    const src = 'fetch(`${a},${b}/x`)';
    expect(firstArgument(src, at(src))).toBe('`${a},${b}/x`');
  });

  it('ignores commas nested in objects and arrays', () => {
    const src = 'axios({ url: "/a", params: [1, 2] })';
    expect(firstArgument(src, at(src))).toBe('{ url: "/a", params: [1, 2] }');
  });
});

describe('resolveUrl', () => {
  it('reads a plain literal as exact', () => {
    expect(resolveUrl("'/api/users'")).toEqual({ path: '/api/users', baseUrlVar: undefined, confidence: 'exact', pathLike: true });
  });

  it('splits a leading base variable off a template', () => {
    const r = resolveUrl('`${API_BASE}/api/users`');
    expect(r).toMatchObject({ path: '/api/users', baseUrlVar: 'API_BASE', confidence: 'inferred' });
  });

  it('refuses a url with no literal path segment', () => {
    expect(resolveUrl('`${API_BASE}${path}`')).toHaveProperty('unresolved');
    expect(resolveUrl('url')).toHaveProperty('unresolved');
  });

  it('handles string concatenation', () => {
    expect(resolveUrl("BASE + '/api/users'")).toMatchObject({ path: '/api/users', baseUrlVar: 'BASE' });
  });

  it('marks a non-path literal as not path-like', () => {
    expect(resolveUrl("'idle'")).toMatchObject({ pathLike: false });
  });
});

describe('routeFromFilePath', () => {
  it('derives a route from file-based routing', () => {
    expect(routeFromFilePath('src/pages/users/index.tsx')).toBe('/users');
    expect(routeFromFilePath('app/dashboard/page.tsx')).toBe('/dashboard');
    expect(routeFromFilePath('src/routes/settings/+page.svelte')).toBe('/settings');
  });

  it('turns dynamic segments into a parameter', () => {
    expect(routeFromFilePath('src/pages/users/[id].tsx')).toBe('/users/{param}');
    expect(routeFromFilePath('app/blog/[...slug]/page.tsx')).toBe('/blog/{param}');
  });

  it('drops route groups', () => {
    expect(routeFromFilePath('app/(marketing)/pricing/page.tsx')).toBe('/pricing');
  });

  it('returns nothing outside a routing directory', () => {
    expect(routeFromFilePath('src/components/Table.tsx')).toBeUndefined();
  });
});

describe('blankComments', () => {
  it('blanks comments while preserving offsets and lines', () => {
    const src = "// fetch('/nope')\nconst a = 1; /* fetch('/nope') */\nfetch('/yes');";
    const out = blankComments(src);
    expect(out).toHaveLength(src.length);
    expect(out.split('\n')).toHaveLength(3);
    expect(out).not.toContain('/nope');
    expect(out).toContain("fetch('/yes')");
  });

  it('leaves comment markers inside strings alone', () => {
    const src = "const u = 'https://x.dev/a';";
    expect(blankComments(src)).toBe(src);
  });
});

describe('findCallSites', () => {
  it('infers GET for fetch and reads an explicit method', () => {
    const sites = findCallSites("fetch('/a');\nfetch('/b', { method: 'DELETE' });");
    expect(sites.map((s) => s.method)).toEqual(['GET', 'DELETE']);
    expect(sites[0].methodExplicit).toBe(false);
    expect(sites[1].methodExplicit).toBe(true);
  });

  it('finds the call past a generic type argument', () => {
    const sites = findCallSites("api.get<{ data: Item[]; meta: { total: number } }>('/agents');");
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ via: 'api', method: 'GET', definitelyHttp: true });
  });

  it('ignores a property access that is not a call', () => {
    expect(findCallSites('const g = obj.get;\nconst n = a < b && c > d;')).toHaveLength(0);
  });

  it('treats a client-shaped receiver as definitely http', () => {
    const sites = findCallSites("api.post('/a');\ncache.get(key);");
    const byVia = new Map(sites.map((s) => [s.via, s.definitelyHttp]));
    expect(byVia.get('api')).toBe(true);
    expect(byVia.get('cache')).toBe(false);
  });
});

describe('scanFile — typed client', () => {
  it('reads the url out of a generic-typed client call', () => {
    const src = "export const agentsApi = {\n  list: () => api.get<{ data: Agent[] }>('/agents'),\n};";
    const scan = scanFile('src/lib/api/agents.ts', src);
    expect(scan.endpoints).toEqual([expect.objectContaining({ method: 'GET', path: '/agents' })]);
  });
});

describe('stripCallSegments', () => {
  it('drops trailing method names', () => {
    expect(stripCallSegments('data.map')).toBe('data');
    expect(stripCallSegments('data.items.filter')).toBe('data.items');
  });

  it('keeps a real field chain', () => {
    expect(stripCallSegments('data.profile.displayName')).toBe('data.profile.displayName');
  });
});

describe('enclosingSymbols', () => {
  it('attributes a line to the symbol above it', () => {
    const src = 'export function A() {\n  const x = 1;\n}\nexport const B = () => {\n  const y = 2;\n};';
    const symbols = enclosingSymbols(src);
    expect(symbolAt(symbols, 2, 'file')).toBe('A');
    expect(symbolAt(symbols, 5, 'file')).toBe('B');
  });
});

describe('isScannableFile', () => {
  it('accepts source files and rejects builds and tests', () => {
    expect(isScannableFile('src/pages/a.tsx')).toBe(true);
    expect(isScannableFile('src/a.vue')).toBe(true);
    expect(isScannableFile('node_modules/x/index.js')).toBe(false);
    expect(isScannableFile('src/a.test.ts')).toBe(false);
    expect(isScannableFile('README.md')).toBe(false);
  });
});

describe('scanFile', () => {
  it('maps a route file onto endpoints, calls and fields', () => {
    const src = [
      'export default function UserDetail({ id }) {',
      '  const load = async () => {',
      '    const user = await axios.get(`/api/users/${id}`);',
      '    return user.data.profile.email;',
      '  };',
      '  return load;',
      '}',
    ].join('\n');
    const scan = scanFile('src/pages/users/[id].tsx', src);

    expect(scan.endpoints).toEqual([
      expect.objectContaining({ method: 'GET', path: '/api/users/{param}' }),
    ]);
    expect(scan.screens[0].route).toBe('/users/{param}');
    expect(scan.calls[0]).toMatchObject({ via: 'axios', confidence: 'inferred', source: { line: 3 } });
    expect(scan.fields.map((f) => f.path)).toContain('data.profile.email');
  });

  it('records a definitely-http call it cannot resolve, and stays silent otherwise', () => {
    const src = 'function C() {\n  fetch(someUrl);\n  cache.get(key);\n}';
    const scan = scanFile('src/C.tsx', src);
    expect(scan.unresolved).toHaveLength(1);
    expect(scan.unresolved[0].source.line).toBe(2);
    expect(scan.calls).toHaveLength(0);
  });

  it('lets a hint resolve a call the scanner cannot, without inventing an id', () => {
    const src = 'function C() {\n  fetch(someUrl);\n}';
    const hints = { resolve: [{ file: 'src/C.tsx', line: 2, url: '/api/invoices/9', method: 'DELETE' as const }] };
    const scan = scanFile('src/C.tsx', src, hints);
    expect(scan.unresolved).toHaveLength(0);
    expect(scan.endpoints[0]).toMatchObject({ method: 'DELETE', path: '/api/invoices/{param}' });
    expect(scan.calls[0].confidence).toBe('inferred');
  });

  it('drops a call an ignore hint marks as not http', () => {
    const src = 'function C() {\n  fetch(someUrl);\n}';
    const scan = scanFile('src/C.tsx', src, { ignore: [{ file: 'src/C.tsx', line: 2 }] });
    expect(scan.unresolved).toHaveLength(0);
    expect(scan.calls).toHaveLength(0);
  });

  it('does not read call sites out of comments', () => {
    const scan = scanFile('src/C.tsx', "function C() {\n  // fetch('/api/ghost');\n}");
    expect(scan.calls).toHaveLength(0);
    expect(scan.unresolved).toHaveLength(0);
  });
});
