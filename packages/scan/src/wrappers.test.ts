import { describe, expect, it } from 'vitest';
import { findHttpWrappers } from './wrappers';

const TRANSPORT = `export class ApiTransport {
  protected async send<T>(
    path: string,
    options: RequestOptions,
    read: (response: Response) => Promise<T> = parseResponse,
  ): Promise<T> {
    const url = \`\${this.baseUrl}\${path}\`;
    const response = await fetch(url, { ...options });
    return read(response);
  }

  protected fetchPage<T>(path: string): Promise<PagedResult<T>> {
    return this.send<PagedResult<T>>(path, {}, async (response) => parseEnvelope<T[]>(response));
  }
}`;

const CLIENT = `export class ApiClient extends ApiTransport {
  listCompanies(filters: Filters) {
    return this.fetchPage<Company>(\`/companies\${queryString(filters)}\`);
  }
  updateCompany(id: string, input: Input) {
    return this.send<Company>(\`/companies/\${id}\`, { method: "PUT", body: input });
  }
}`;

const files = [
  { file: 'lib/api/transport.ts', content: TRANSPORT },
  { file: 'lib/api/client.ts', content: CLIENT },
];

describe('findHttpWrappers', () => {
  const wrappers = findHttpWrappers(files);

  it('follows the chain past a multi-line signature with a default parameter', () => {
    expect(wrappers.has('send')).toBe(true);
  });

  it('reaches the name the call sites actually use, through nested generics', () => {
    expect(wrappers.has('fetchPage')).toBe(true);
  });

  it('leaves a method that builds its own path out of the set', () => {
    expect(wrappers.has('listCompanies')).toBe(false);
    expect(wrappers.has('updateCompany')).toBe(false);
  });

  it('does not mistake a Map read for an http call', () => {
    const cache = `export function lookup(key: string) {
  return this.entries.get(key);
}`;
    expect(findHttpWrappers([{ file: 'cache.ts', content: cache }]).has('lookup')).toBe(false);
  });

  it('ignores a wrapper name that only appears in a comment', () => {
    const commented = `export function helper(path: string) {
  // return fetch(path);
  return path;
}`;
    expect(findHttpWrappers([{ file: 'x.ts', content: commented }]).has('helper')).toBe(false);
  });
});
