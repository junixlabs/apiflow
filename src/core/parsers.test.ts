import { describe, expect, it } from 'vitest';
import { parseCurl } from './curlParser';
import { parseOpenApiSpec } from './openApiParser';
import { parsePostmanCollection } from './postmanParser';
import { generateCurl } from './curlExporter';
import type { CoreApiNode } from './types';

describe('parseCurl', () => {
  it('reads method, url, headers and body', () => {
    const config = parseCurl(
      `curl -X POST 'https://api.dev/users' -H 'Content-Type: application/json' -H 'Authorization: Bearer t' -d '{"name":"a"}'`
    );
    expect(config.method).toBe('POST');
    expect(config.url).toBe('https://api.dev/users');
    expect(config.headers.map((h) => h.key)).toEqual(['Content-Type', 'Authorization']);
    expect(config.body).toBe('{"name":"a"}');
  });

  it('defaults to GET and survives line continuations', () => {
    const config = parseCurl("curl 'https://api.dev/users' \\\n  -H 'Accept: application/json'");
    expect(config.method).toBe('GET');
    expect(config.url).toBe('https://api.dev/users');
    expect(config.headers).toHaveLength(1);
  });

  it('infers POST from a body without an explicit -X', () => {
    expect(parseCurl(`curl 'https://api.dev/u' -d '{"a":1}'`).method).toBe('POST');
  });
});

describe('parseOpenApiSpec', () => {
  const spec = JSON.stringify({
    openapi: '3.0.0',
    servers: [{ url: 'https://api.dev' }],
    paths: {
      '/users': {
        get: { operationId: 'listUsers' },
        post: { operationId: 'createUser' },
      },
      '/users/{id}': {
        get: { operationId: 'getUser', parameters: [{ name: 'id', in: 'path', example: 7 }] },
      },
    },
  });

  it('turns every operation into a node', () => {
    const { nodes } = parseOpenApiSpec(spec);
    expect(nodes.map((n) => n.data.label).sort()).toEqual(['createUser', 'getUser', 'listUsers']);
    expect(nodes.map((n) => n.data.config.method).sort()).toEqual(['GET', 'GET', 'POST']);
  });

  it('prefixes the server url', () => {
    const { nodes } = parseOpenApiSpec(spec);
    expect(nodes.every((n) => n.data.config.url.startsWith('https://api.dev'))).toBe(true);
  });

  it('rejects anything that is not OpenAPI 3.x', () => {
    expect(() => parseOpenApiSpec(JSON.stringify({ swagger: '2.0', paths: {} }))).toThrow(/3\.x/);
  });
});

describe('parsePostmanCollection', () => {
  const collection = JSON.stringify({
    info: { name: 'c', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: [
      {
        name: 'folder',
        item: [
          {
            name: 'List',
            request: {
              method: 'GET',
              url: { raw: 'https://api.dev/users' },
              header: [{ key: 'Accept', value: 'application/json' }],
            },
          },
        ],
      },
      {
        name: 'Create',
        request: {
          method: 'POST',
          url: { raw: 'https://api.dev/users' },
          header: [],
          body: { mode: 'raw', raw: '{"a":1}' },
        },
      },
    ],
  });

  it('flattens nested folders into nodes', () => {
    const { nodes } = parsePostmanCollection(collection);
    expect(nodes.map((n) => n.data.label)).toEqual(['List', 'Create']);
    expect(JSON.parse(nodes[1].data.config.body)).toEqual({ a: 1 });
  });

  it('rejects a file that is not a collection', () => {
    expect(() => parsePostmanCollection('{}')).toThrow(/Invalid Postman collection/);
  });
});

describe('generateCurl', () => {
  const node: CoreApiNode = {
    id: 'n1',
    type: 'apiNode',
    position: { x: 0, y: 0 },
    data: {
      label: 'Create',
      config: {
        method: 'POST',
        url: '{{base}}/users',
        headers: [{ key: 'Authorization', value: 'Bearer {{token}}', enabled: true }],
        params: [],
        body: '{"name":"a"}',
      },
    },
  };

  it('resolves variables into the emitted command', () => {
    const out = generateCurl(node, { base: 'https://api.dev', token: 'abc' }, new Map(), [node]);
    expect(out).toContain("-X POST");
    expect(out).toContain('https://api.dev/users');
    expect(out).toContain('Bearer abc');
  });

  it('round-trips back through parseCurl', () => {
    const out = generateCurl(node, { base: 'https://api.dev', token: 'abc' }, new Map(), [node]);
    const parsed = parseCurl(out);
    expect(parsed.method).toBe('POST');
    expect(parsed.url).toBe('https://api.dev/users');
    expect(parsed.body).toBe('{"name":"a"}');
  });

  it('escapes single quotes so the shell command stays valid', () => {
    const risky: CoreApiNode = {
      ...node,
      data: { ...node.data, config: { ...node.data.config, body: `{"name":"O'Brien"}` } },
    };
    const out = generateCurl(risky, { base: 'https://api.dev', token: 'abc' }, new Map(), [risky]);
    expect(out).toContain(`O'\\''Brien`);
  });
});
