import { describe, expect, it } from 'vitest';
import { blankComments, enclosingSymbols, findCallSites, firstArgument, isScannableFile, isServerFile, memberAt, objectMembers, resolveUrl, routeFromFilePath, scanFile, stripCallSegments, symbolAt } from './feScanner';

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
    expect(routeFromFilePath('packages/runner/src/components/Table.tsx')).toBeUndefined();
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

describe('server code is not a screen', () => {
  const SERVER = `import express from 'express';
const app = express();
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.post('/api/auth/login', async (req, res) => res.json({}));`;

  it('scans nothing out of a file that builds a server', () => {
    const scan = scanFile('server/index.ts', SERVER);
    expect(scan.serverFile).toBe(true);
    expect(scan.endpoints).toEqual([]);
    expect(scan.calls).toEqual([]);
  });

  it('skips a registration in a file that only receives the router', () => {
    const registrar = `export function registerRoutes(router: Router) {
  router.get('/import-template', requirePermission('read'), asyncHandler(async (req, res) => send(res)));
}`;
    expect(isServerFile(registrar)).toBe(false);
    expect(scanFile('routes.ts', registrar).endpoints).toEqual([]);
  });

  it('keeps a client call whose options object carries a callback', () => {
    const client = `export const upload = (file: File) =>
  api.post('/files', file, { onUploadProgress: (e) => report(e) });`;
    expect(scanFile('lib/api.ts', client).endpoints.map((e) => `${e.method} ${e.path}`)).toEqual(['POST /files']);
  });

  it('keeps a wrapper call whose last argument reads the response', () => {
    const client = `export function listProducts(query: string) {
  return send<ProductList>(\`/products\${query}\`, {}, async (response) => parse(response));
}`;
    const scan = scanFile('lib/api.ts', client, { wrappers: ['send'] });
    expect(scan.endpoints.map((e) => e.path)).toContain('/products');
  });

  it('keeps a fetcher passed to useSWR', () => {
    const swr = `export const useUsers = () => useSWR('/api/users', (url) => fetch(url).then((r) => r.json()));`;
    expect(scanFile('hooks/users.ts', swr).endpoints.some((e) => e.path === '/api/users')).toBe(true);
  });
});

describe('typed api client classes', () => {
  const CLIENT = `export class ApiClient {
  async listCompanies(filters: Filters): Promise<CompanyList> {
    return this.get('/companies');
  }
  private async removeCompany(id: string): Promise<void> {
    return this.delete(\`/companies/\${id}\`);
  }
}`;

  it('attributes a call to the method that makes it, not to the class', () => {
    const members = objectMembers(CLIENT);
    const symbols = enclosingSymbols(CLIENT);
    const lines = CLIENT.split('\n');
    expect(memberAt(members, symbols, 3, lines)).toBe('listCompanies');
    expect(memberAt(members, symbols, 6, lines)).toBe('removeCompany');
  });

  it('never reports a control-flow keyword as a member', () => {
    const src = `export const api = {
  list: async () => {
    if (ready) {
      return http.get('/x');
    }
  },
};`;
    const lines = src.split('\n');
    expect(memberAt(objectMembers(src), enclosingSymbols(src), 4, lines)).toBe('list');
  });
});

describe('reads through a project wrapper', () => {
  const SYNC = `export async function connect() {
  const res = await authFetch('/api/state');
  const root: Root = await res.json();
  applyServerRoot(root.projects);
  count(root.orgs.length);
}`;

  it('sees past a type annotation on the parse hop', () => {
    const scan = scanFile('packages/runner/src/store/sync.ts', SYNC, { wrappers: ['authFetch'] });
    expect(scan.fields.map((f) => f.path).sort()).toEqual(['orgs', 'projects']);
  });

  it('still traces reads when the callee is a plain fetch', () => {
    const plain = `export async function load() {
  const res = await fetch('/api/state');
  const body = await res.json();
  return body.items;
}`;
    expect(scanFile('load.ts', plain).fields.map((f) => f.path)).toContain('items');
  });
});

describe('url built by concatenation', () => {
  it('turns a literal prefix plus an expression into a path param', () => {
    expect(resolveUrl("'api/v1/carriers/' + id")).toEqual({
      path: '/api/v1/carriers/{param}',
      confidence: 'inferred',
      pathLike: true,
    });
  });

  it('keeps the segment that follows the expression', () => {
    const r = resolveUrl("'api/v1/orders/' + orderId + '/items'");
    expect(r).toHaveProperty('path', '/api/v1/orders/{param}/items');
  });

  it('refuses a concatenation with no path in it', () => {
    expect(resolveUrl("'?page=' + page")).toHaveProperty('unresolved');
    expect(resolveUrl('total + 1')).toHaveProperty('unresolved');
  });

  it('does not mistake an arrow-function argument for a path', () => {
    expect(resolveUrl('items.map((i) => i.id)')).toHaveProperty('unresolved');
  });
});

describe('enclosingSymbols on typed arrow functions', () => {
  it('names an async arrow with a return type', () => {
    const src = 'const addUserBank = async (params: AddUserBank): Promise<FetcherResponse<any>> => {\n  return post();\n};\n';
    expect(enclosingSymbols(src).map((s) => s.name)).toContain('addUserBank');
  });

  it('still ignores a call that merely takes an arrow', () => {
    expect(enclosingSymbols('const ids = items.map((i) => i.id);\n').map((s) => s.name)).not.toContain('ids');
  });
});
