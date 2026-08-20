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
