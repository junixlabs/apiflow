import { describe, expect, it } from 'vitest';
import { attributeToScreens, buildCallerGraph, parseModule, stripJsonComments } from './callerGraph';
import type { ModuleNode, ResolveImport } from './callerGraph';
import { enclosingSymbols, memberAt, objectMembers, symbolAt } from './feScanner';

const API = `import { api } from './client';

export const agentsApi = {
  list: () => api.get<{ data: Agent[] }>('/agents'),
  remove: (id: string) => api.delete(\`/agents/\${id}\`),
};

export function useAgents() {
  return useQuery({ queryFn: () => agentsApi.list() });
}

export function useRemoveAgent() {
  return useMutation({ mutationFn: agentsApi.remove });
}`;

const PANEL = `import { useAgents } from '@/lib/api/agents';

export function AgentsPanel() {
  const { data } = useAgents();
  return data;
}`;

const TRASH = `import { useRemoveAgent } from '@/lib/api/agents';

export function TrashButton() {
  const remove = useRemoveAgent();
  return remove;
}`;

const PAGE = `import { AgentsPanel } from '@/features/agents/panel';

export default function Page() {
  return <AgentsPanel />;
}`;

const TRASH_PAGE = `import { TrashButton } from '@/features/agents/trash';

export default function Page() {
  return <TrashButton />;
}`;

const FILES: Record<string, string> = {
  'src/lib/api/agents.ts': API,
  'src/features/agents/panel.tsx': PANEL,
  'src/features/agents/trash.tsx': TRASH,
  'src/app/agents/page.tsx': PAGE,
  'src/app/trash/page.tsx': TRASH_PAGE,
};

const resolve: ResolveImport = (_from, spec) => {
  const map: Record<string, string> = {
    '@/lib/api/agents': 'src/lib/api/agents.ts',
    '@/features/agents/panel': 'src/features/agents/panel.tsx',
    '@/features/agents/trash': 'src/features/agents/trash.tsx',
    './client': 'src/lib/api/client.ts',
  };
  return map[spec] ?? null;
};

const modules: ModuleNode[] = Object.entries(FILES).map(([file, content]) => ({
  file,
  parsed: parseModule(content),
  route: file.startsWith('src/app/') ? `/${file.split('/')[2]}` : undefined,
}));

const graph = buildCallerGraph(modules, resolve);

const enclosingAt = (file: string, line: number) => {
  const content = FILES[file] ?? '';
  const symbols = enclosingSymbols(content);
  return { symbol: symbolAt(symbols, line, file), member: memberAt(objectMembers(content), symbols, line, content.split('\n')) };
};

describe('parseModule', () => {
  it('reads named, default and namespace imports', () => {
    const parsed = parseModule("import React from 'react';\nimport { a, b as c } from './x';\nimport * as ns from './y';");
    expect([...parsed.imports].sort((x, y) => x.local.localeCompare(y.local))).toEqual([
      { imported: 'a', local: 'a', from: './x', line: 2 },
      { imported: 'b', local: 'c', from: './x', line: 2 },
      { imported: '*', local: 'ns', from: './y', line: 3 },
      { imported: 'default', local: 'React', from: 'react', line: 1 },
    ]);
  });

  it('drops type-only imports', () => {
    expect(parseModule("import type { User } from './types';").imports).toHaveLength(0);
  });

  it('records local declarations and their uses', () => {
    const parsed = parseModule(API);
    expect(parsed.declarations).toContain('agentsApi');
    expect(parsed.declarations).toContain('useAgents');
    const listUse = parsed.localUsages.find((u) => u.symbol === 'agentsApi' && u.member === 'list');
    expect(listUse?.line).toBe(9);
  });
});

describe('attributeToScreens', () => {
  it('walks api member -> hook -> component -> route', () => {
    const found = attributeToScreens(
      { file: 'src/lib/api/agents.ts', symbol: 'agentsApi', member: 'list' },
      graph,
      enclosingAt
    );
    expect(found.map((f) => f.route)).toEqual(['/agents']);
    expect(found[0].file).toBe('src/app/agents/page.tsx');
  });

  it('keeps two members of one client apart', () => {
    const remove = attributeToScreens(
      { file: 'src/lib/api/agents.ts', symbol: 'agentsApi', member: 'remove' },
      graph,
      enclosingAt
    );
    expect(remove.map((f) => f.route)).toEqual(['/trash']);
  });

  it('returns nothing when no consumer reaches a route', () => {
    const orphan = attributeToScreens({ file: 'src/lib/api/client.ts', symbol: 'api' }, graph, enclosingAt);
    expect(orphan).toEqual([]);
  });

  it('terminates on an import cycle', () => {
    const cyclic = buildCallerGraph(
      [
        { file: 'a.ts', parsed: parseModule("import { b } from './b';\nexport const a = () => b();") },
        { file: 'b.ts', parsed: parseModule("import { a } from './a';\nexport const b = () => a();") },
      ],
      (_from, spec) => (spec === './b' ? 'b.ts' : spec === './a' ? 'a.ts' : null)
    );
    expect(attributeToScreens({ file: 'a.ts', symbol: 'a' }, cyclic, () => ({ symbol: 'x' }))).toEqual([]);
  });
});

describe('stripJsonComments', () => {
  it('leaves a path alias and an include glob intact', () => {
    const tsconfig = '{ "paths": { "@/*": ["./src/*"] }, "include": ["**/*.ts"] }';
    expect(JSON.parse(stripJsonComments(tsconfig))).toEqual({
      paths: { '@/*': ['./src/*'] },
      include: ['**/*.ts'],
    });
  });

  it('removes real comments and preserves line count', () => {
    const src = '{\n  // note\n  "a": 1, /* block */\n  "b": "// not a comment"\n}';
    const out = stripJsonComments(src);
    expect(out.split('\n')).toHaveLength(5);
    expect(JSON.parse(out)).toEqual({ a: 1, b: '// not a comment' });
  });
});

describe('instance aliases', () => {
  const CLIENT = `export class ApiClient {
  async listCompanies() { return http.get('/companies'); }
  async removeCompany(id) { return http.delete('/companies/' + id); }
}

export const apiClient = new ApiClient();`;

  const LIST = `import { apiClient } from '@/lib/client';
export function useCompanies() { return apiClient.listCompanies(); }`;

  const REMOVE = `import { apiClient } from '@/lib/client';
export function useRemoveCompany() { return apiClient.removeCompany('1'); }`;

  const LIST_PAGE = `import { useCompanies } from '@/hooks/list';
export default function Page() { return useCompanies(); }`;

  const REMOVE_PAGE = `import { useRemoveCompany } from '@/hooks/remove';
export default function Page() { return useRemoveCompany(); }`;

  const files: Record<string, string> = {
    'src/lib/client.ts': CLIENT,
    'src/hooks/list.ts': LIST,
    'src/hooks/remove.ts': REMOVE,
    'src/app/companies/page.tsx': LIST_PAGE,
    'src/app/trash/page.tsx': REMOVE_PAGE,
  };
  const resolveAlias: ResolveImport = (_from, spec) =>
    ({ '@/lib/client': 'src/lib/client.ts', '@/hooks/list': 'src/hooks/list.ts', '@/hooks/remove': 'src/hooks/remove.ts' })[spec] ?? null;

  const clientGraph = buildCallerGraph(
    Object.entries(files).map(([file, content]) => ({
      file,
      parsed: parseModule(content),
      route: file.startsWith('src/app/') ? `/${file.split('/')[2]}` : undefined,
    })),
    resolveAlias
  );

  const at = (file: string, line: number) => {
    const content = files[file] ?? '';
    const symbols = enclosingSymbols(content);
    return {
      symbol: symbolAt(symbols, line, file),
      member: memberAt(objectMembers(content), symbols, line, content.split('\n')),
    };
  };

  it('carries the method across `new ApiClient()` instead of fanning out', () => {
    const list = attributeToScreens({ file: 'src/lib/client.ts', symbol: 'ApiClient', member: 'listCompanies' }, clientGraph, at);
    expect(list.map((a) => a.route)).toEqual(['/companies']);
  });

  it('keeps the second method on its own screen', () => {
    const remove = attributeToScreens({ file: 'src/lib/client.ts', symbol: 'ApiClient', member: 'removeCompany' }, clientGraph, at);
    expect(remove.map((a) => a.route)).toEqual(['/trash']);
  });
});

describe('anonymous dynamic import', () => {
  it('does not turn the `*` binding into a regex', () => {
    const parsed = parseModule("if (flag) import('./late-feature');\nconst x = 1;\n");
    expect(parsed.imports.some((i) => i.local === '*')).toBe(true);
    expect(parsed.usages.every((u) => u.symbol !== '*')).toBe(true);
  });

  it('records the name a default export carries', () => {
    const parsed = parseModule('const addUserBank = async (p: P): Promise<R> => {};\nexport default addUserBank;\n');
    expect(parsed.defaultExport).toBe('addUserBank');
    expect(parsed.exports).toContain('addUserBank');
  });
});

// cm:why The shape is copied from a real app: a barrel whose own comment NAMES the components it
// adapts, and an api module whose comment on one export mentions another.
// cm:why Both were producing usages at the comment's line, and the widening that followed sent one
// call to every route in the barrel.
describe('a comment that names a symbol is not a usage', () => {
  const BARREL = `import { BrandVoice } from './brand-voice';
import { PipelineTab } from './pipeline-tab';

// cm:why thin adapters — BrandVoice/PipelineTab keep taking a plain projectId prop
export function SetupBrandVoice() {
  return <BrandVoice projectId={id} />;
}

export function SetupPipeline() {
  return <PipelineTab projectId={id} />;
}`;

  it('reads the JSX line and not the comment line', () => {
    const usages = parseModule(BARREL).usages.filter((u) => u.symbol === 'BrandVoice');
    expect(usages.map((u) => u.line)).toEqual([6]);
  });

  it('does not invent a local usage from prose about another export', () => {
    const parsed = parseModule(`export async function login() {}

// cm:why Same bypass as login: a wrong password answers 401
export async function changePassword() {}`);
    expect(parsed.localUsages.filter((u) => u.symbol === 'login')).toEqual([]);
  });

  it('keeps a url that contains // and the code after a masked comment', () => {
    const parsed = parseModule(`import { get } from './c';
const base = 'https://api.example.com'; // the base
export const load = () => get(base);`);
    expect(parsed.usages.filter((u) => u.symbol === 'get').map((u) => u.line)).toEqual([3]);
  });

  it('attributes a barrel export only to the route that imports it', () => {
    const files: Record<string, string> = {
      'src/lib/data.ts': `import { api } from './client';
export function useBrandProfile() { return api.get('/brand-profile'); }`,
      'src/features/brand-voice.tsx': `import { useBrandProfile } from '@/lib/data';
export function BrandVoice() { return useBrandProfile(); }`,
      'src/features/pipeline-tab.tsx': 'export function PipelineTab() { return null; }',
      'src/features/sections.tsx': BARREL,
      'src/app/brand-voice/page.tsx': `import { SetupBrandVoice } from '@/features/sections';
export default function Page() { return <SetupBrandVoice />; }`,
      'src/app/pipeline/page.tsx': `import { SetupPipeline } from '@/features/sections';
export default function Page() { return <SetupPipeline />; }`,
    };
    const resolveBarrel: ResolveImport = (_from, spec) => ({
      '@/lib/data': 'src/lib/data.ts',
      '@/features/sections': 'src/features/sections.tsx',
      './brand-voice': 'src/features/brand-voice.tsx',
      './pipeline-tab': 'src/features/pipeline-tab.tsx',
    }[spec] ?? null);
    const nodes: ModuleNode[] = Object.entries(files).map(([file, content]) => ({
      file,
      parsed: parseModule(content),
      route: file.startsWith('src/app/') ? `/${file.split('/')[2]}` : undefined,
    }));
    const at = (file: string, line: number) => {
      const content = files[file] ?? '';
      const symbols = enclosingSymbols(content);
      return { symbol: symbolAt(symbols, line, file), member: memberAt(objectMembers(content), symbols, line, content.split('\n')) };
    };
    const routes = attributeToScreens(
      { file: 'src/features/brand-voice.tsx', symbol: 'BrandVoice' },
      buildCallerGraph(nodes, resolveBarrel),
      at
    ).map((a) => a.route);
    expect(routes).toEqual(['/brand-voice']);
  });
});

// cm:why The clause binds the name, it does not use it. A 24-character lookbehind could not see past
// a multi-line `import {`, so the binding counted as a use and widened the chain to ANY.
describe('an import clause is not a usage', () => {
  it('ignores a name bound inside a multi-line import clause', () => {
    const parsed = parseModule([
      "import {",
      "  NetworkError,",
      "  apiFetch,",
      "  toApiError,",
      "} from './api-fetch'",
      "",
      "export function login() { return fetch('/auth/login') }",
      "",
      "export function me() { return apiFetch('/auth/me') }",
    ].join('\n'));
    expect(parsed.imports.map((i) => i.imported).sort()).toEqual(['NetworkError', 'apiFetch', 'toApiError']);
    expect(parsed.usages.filter((u) => u.symbol === 'apiFetch').map((u) => u.line)).toEqual([9]);
  });

  it('ignores a name listed in an export clause', () => {
    const parsed = parseModule([
      "import { helper } from './helper'",
      "function wrap() { return helper() }",
      "export { wrap, helper }",
    ].join('\n'));
    expect(parsed.usages.filter((u) => u.symbol === 'helper').map((u) => u.line)).toEqual([2]);
  });

  it('ignores a re-export clause naming a symbol it does not call', () => {
    const parsed = parseModule([
      "import { apiFetch } from './api-fetch'",
      "export { apiFetch } from './api-fetch'",
      "export function me() { return apiFetch('/auth/me') }",
    ].join('\n'));
    expect(parsed.usages.filter((u) => u.symbol === 'apiFetch').map((u) => u.line)).toEqual([3]);
  });
});
