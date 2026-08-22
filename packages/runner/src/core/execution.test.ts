import { describe, expect, it, vi } from 'vitest';
import { topologicalSort } from './topologicalSort';
import { getValueByPath, resolveAll, resolveNodeVariables, resolveVariables } from './variableResolver';
import { runAssertions } from './assertionRunner';
import { coreRunFlow, coreRunSingleNode } from './executor';
import type { Assertion, CoreApiNode, CoreFlowEdge, ExecutionCallbacks, ExecutionResult, ProxyRequest } from './types';

function node(id: string, label: string, url: string, type = 'apiNode'): CoreApiNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label, config: { method: 'GET', url, headers: [], params: [], body: '' } },
  };
}

function edge(source: string, target: string, sourceHandle?: string): CoreFlowEdge {
  return { id: `${source}-${target}`, source, target, sourceHandle };
}

function callbacks(): ExecutionCallbacks & { statuses: Array<[string, string]>; results: ExecutionResult[] } {
  const statuses: Array<[string, string]> = [];
  const results: ExecutionResult[] = [];
  return {
    statuses,
    results,
    onNodeStatusChange: (id, status) => statuses.push([id, status]),
    onNodeResult: (_, result) => results.push(result),
    getAssertions: () => [],
    onAssertionResults: () => undefined,
  };
}

const ok = (body: unknown, status = 200) =>
  vi.fn(async (_request: ProxyRequest, _signal?: AbortSignal) => ({
    status,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body,
    duration_ms: 1,
    size_bytes: 2,
  }));

describe('topologicalSort', () => {
  it('groups independent nodes into one level', () => {
    const { levels, hasCycle } = topologicalSort(['a', 'b', 'c'], [edge('a', 'c'), edge('b', 'c')]);
    expect(hasCycle).toBe(false);
    expect(levels).toEqual([['a', 'b'], ['c']]);
  });

  it('reports a cycle instead of looping forever', () => {
    const { hasCycle } = topologicalSort(['a', 'b'], [edge('a', 'b'), edge('b', 'a')]);
    expect(hasCycle).toBe(true);
  });
});

describe('variableResolver', () => {
  it('reads a dotted path with array indexes', () => {
    expect(getValueByPath({ a: { b: [{ c: 7 }] } }, 'a.b[0].c')).toBe(7);
    expect(getValueByPath({ a: 1 }, 'a.missing.deep')).toBeUndefined();
  });

  it('substitutes environment variables and leaves unknown ones intact', () => {
    expect(resolveVariables('{{base}}/x/{{gone}}', { base: 'http://h' })).toBe('http://h/x/{{gone}}');
  });

  it('chains a value out of another node response', () => {
    const nodes = [node('n1', 'Get User', '/u')];
    const results = new Map<string, ExecutionResult>([
      ['n1', { nodeId: 'n1', status: 200, statusText: 'OK', headers: {}, body: { id: 42 }, duration_ms: 1, size_bytes: 1, resolvedRequest: { method: 'GET', url: '/u', headers: {}, body: '' } }],
    ]);
    expect(resolveNodeVariables('/x/{{nodes["Get User"].response.body.id}}', results, nodes)).toBe('/x/42');
  });

  it('leaves the template alone when the referenced node has no result', () => {
    const template = '/x/{{nodes["Missing"].response.body.id}}';
    expect(resolveAll(template, {}, new Map(), [])).toBe(template);
  });
});

describe('runAssertions', () => {
  const result: ExecutionResult = {
    nodeId: 'n1',
    status: 201,
    statusText: 'Created',
    headers: { 'x-req-id': 'abc' },
    body: { data: { email: 'a@b.co' } },
    duration_ms: 1,
    size_bytes: 1,
    resolvedRequest: { method: 'GET', url: '/u', headers: {}, body: '' },
  };
  const assertion = (over: Partial<Assertion>): Assertion =>
    ({ id: 'a', type: 'status_equals', target: '', expected: '201', enabled: true, ...over });

  it('covers all four assertion types', () => {
    const results = runAssertions(
      [
        assertion({ id: 'status' }),
        assertion({ id: 'body', type: 'body_contains', expected: 'a@b.co' }),
        assertion({ id: 'json', type: 'jsonpath_match', target: 'data.email', expected: 'a@b.co' }),
        assertion({ id: 'header', type: 'header_exists', target: 'x-req-id', expected: '' }),
      ],
      result
    );
    expect(results.map((r) => [r.assertionId, r.passed])).toEqual([
      ['status', true],
      ['body', true],
      ['json', true],
      ['header', true],
    ]);
  });

  it('fails on a mismatch and skips disabled assertions', () => {
    const results = runAssertions(
      [assertion({ id: 'bad', expected: '200' }), assertion({ id: 'off', enabled: false })],
      result
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ assertionId: 'bad', passed: false });
  });
});

describe('coreRunSingleNode', () => {
  it('resolves variables into the request it sends', async () => {
    const send = ok({ id: 1 });
    const cb = callbacks();
    const result = await coreRunSingleNode(node('n1', 'A', '{{base}}/users'), { base: 'http://h' }, send, cb);
    expect(send.mock.calls[0][0]).toMatchObject({ url: 'http://h/users' });
    expect(result.status).toBe(200);
    expect(cb.statuses).toEqual([['n1', 'running'], ['n1', 'success']]);
  });
});

describe('coreRunFlow', () => {
  it('runs levels in dependency order', async () => {
    const send = ok({ id: 1 });
    const cb = callbacks();
    await coreRunFlow([node('a', 'A', '/a'), node('b', 'B', '/b')], [edge('a', 'b')], {}, send, cb);
    expect(send.mock.calls.map((c) => c[0].url)).toEqual(['/a', '/b']);
  });

  it('does nothing when the graph has a cycle', async () => {
    const send = ok({});
    await coreRunFlow([node('a', 'A', '/a'), node('b', 'B', '/b')], [edge('a', 'b'), edge('b', 'a')], {}, send, callbacks());
    expect(send).not.toHaveBeenCalled();
  });

  it('prunes the branch a condition node did not take', async () => {
    const send = ok({ active: false });
    const cb = callbacks();
    const condition: CoreApiNode = {
      id: 'c',
      type: 'conditionNode',
      position: { x: 0, y: 0 },
      data: {
        label: 'Check',
        sourceNodeLabel: 'A',
        condition: { fieldPath: 'body.active', operator: 'equals', expected: 'true' },
      } as unknown as CoreApiNode['data'],
    };
    await coreRunFlow(
      [node('a', 'A', '/a'), condition, node('t', 'T', '/true'), node('f', 'F', '/false')],
      [edge('a', 'c'), edge('c', 't', 'true'), edge('c', 'f', 'false')],
      {},
      send,
      cb
    );
    const urls = send.mock.calls.map((c) => c[0].url);
    expect(urls).toContain('/false');
    expect(urls).not.toContain('/true');
  });
});
