import { describe, expect, it } from 'vitest';
import { buildRouteTable, routeEntries, stringConstants } from './routeTable';

const resolve = (_from: string, specifier: string): string | null => {
  const cleaned = specifier.replace(/^\.\//, '');
  return `src/${cleaned}.tsx`;
};

describe('stringConstants', () => {
  it('resolves a constant built from other constants', () => {
    const files = [
      { file: 'src/paths.ts', content: "export const PURCHASE = '/purchase';\nexport const PURCHASE_LIST = PURCHASE + '/' + 'list';\n" },
    ];
    expect(stringConstants(files).get('PURCHASE_LIST')).toBe('/purchase/list');
  });
});

describe('routeEntries', () => {
  it('takes the innermost component, not the wrapper', () => {
    const content = '<Route path="/orders" element={<Suspense fallback={<Loading/>}><OrderList/></Suspense>} />';
    expect(routeEntries(content, new Map())[0]).toMatchObject({ path: '/orders', components: ['OrderList'] });
  });
});

describe('buildRouteTable', () => {
  it('does not leave a trailing slash when a child route is "/"', () => {
    const files = [
      {
        file: 'src/routing/index.tsx',
        content:
          '<BrowserRouter>\n' +
          '<Route path="/account" element={<AccountShell/>} />\n' +
          '</BrowserRouter>\n' +
          "import AccountShell from './AccountShell';\n",
      },
      {
        file: 'src/AccountShell.tsx',
        content: '<Route path="/" element={<AccountHome/>} />\n' + "import AccountHome from './AccountHome';\n",
      },
      { file: 'src/AccountHome.tsx', content: 'export default function AccountHome() { return null; }\n' },
    ];
    const table = buildRouteTable(files, resolve);
    expect(table.routes.get('src/AccountHome.tsx')).toEqual(['/account']);
  });
});
