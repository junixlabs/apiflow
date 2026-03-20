import type {
  CoreApiNode,
  CoreFlowEdge,
  ExecutionResult,
  ExecutionCallbacks,
  AuthConfig,
  ConditionRule,
  ConditionNodeData,
} from './types';
import type { SendRequestFn } from './httpClient';
import { isProxyError } from './httpClient';
import { resolveAll, resolveHeaders, getValueByPath } from './variableResolver';
import { topologicalSort } from './topologicalSort';
import { runAssertions } from './assertionRunner';

function applyAuth(
  headers: Record<string, string>,
  auth: AuthConfig,
  variables: Record<string, string>,
  nodeResults: Map<string, ExecutionResult>,
  nodes: CoreApiNode[]
): void {
  switch (auth.type) {
    case 'bearer': {
      const token = resolveAll(auth.token || '', variables, nodeResults, nodes);
      if (token) headers['Authorization'] = `Bearer ${token}`;
      break;
    }
    case 'basic': {
      const user = resolveAll(auth.username || '', variables, nodeResults, nodes);
      const pass = resolveAll(auth.password || '', variables, nodeResults, nodes);
      const encoded = btoa(`${user}:${pass}`);
      headers['Authorization'] = `Basic ${encoded}`;
      break;
    }
    case 'apikey': {
      const headerName = resolveAll(auth.headerName || 'X-API-Key', variables, nodeResults, nodes);
      const key = resolveAll(auth.apiKey || '', variables, nodeResults, nodes);
      if (key) headers[headerName] = key;
      break;
    }
  }
}

function evaluateCondition(
  rule: ConditionRule,
  result: ExecutionResult
): boolean {
  let actual: unknown;

  if (rule.fieldPath === 'status') {
    actual = result.status;
  } else if (rule.fieldPath.startsWith('body.')) {
    actual = getValueByPath(result.body, rule.fieldPath.slice(5));
  } else if (rule.fieldPath.startsWith('headers.')) {
    actual = result.headers[rule.fieldPath.slice(8)];
  } else {
    actual = getValueByPath(result, rule.fieldPath);
  }

  const actualStr = actual != null ? String(actual) : '';

  switch (rule.operator) {
    case 'equals': return actualStr === rule.expected;
    case 'not_equals': return actualStr !== rule.expected;
    case 'contains': return actualStr.includes(rule.expected);
    case 'gt': return Number(actual) > Number(rule.expected);
    case 'lt': return Number(actual) < Number(rule.expected);
    case 'exists': return actual !== undefined && actual !== null;
    case 'not_exists': return actual === undefined || actual === null;
    default: return false;
  }
}

function buildExecutionResult(
  nodeId: string,
  node: CoreApiNode,
  variables: Record<string, string>,
  nodeResults: Map<string, ExecutionResult>,
  allNodes: CoreApiNode[],
  response: Awaited<ReturnType<SendRequestFn>>
): ExecutionResult {
  const config = node.data.config;
  const resolvedUrl = resolveAll(config.url, variables, nodeResults, allNodes);
  const resolvedHeaders = resolveHeaders(config.headers, variables, nodeResults, allNodes);
  const resolvedBody = config.body ? resolveAll(config.body, variables, nodeResults, allNodes) : '';

  if (isProxyError(response)) {
    return {
      nodeId,
      status: 0,
      statusText: 'Proxy Error',
      headers: {},
      body: { error: response.error, message: response.message },
      duration_ms: response.duration_ms,
      size_bytes: 0,
      error: response.message,
      resolvedRequest: {
        method: config.method,
        url: resolvedUrl,
        headers: resolvedHeaders,
        body: resolvedBody,
      },
    };
  }

  return {
    nodeId,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    body: response.body,
    duration_ms: response.duration_ms,
    size_bytes: response.size_bytes,
    resolvedRequest: {
      method: config.method,
      url: resolvedUrl,
      headers: resolvedHeaders,
      body: resolvedBody,
    },
  };
}

export async function coreRunSingleNode(
  node: CoreApiNode,
  variables: Record<string, string>,
  sendRequest: SendRequestFn,
  callbacks: ExecutionCallbacks,
  signal?: AbortSignal,
  nodeResults?: Map<string, ExecutionResult>,
  allNodes?: CoreApiNode[]
): Promise<ExecutionResult> {
  const config = node.data.config;
  const results = nodeResults ?? new Map<string, ExecutionResult>();
  const nodes = allNodes ?? [];

  callbacks.onNodeStatusChange(node.id, 'running');

  const resolvedUrl = resolveAll(config.url, variables, results, nodes);
  const resolvedHeaders = resolveHeaders(config.headers, variables, results, nodes);
  const resolvedBody = config.body ? resolveAll(config.body, variables, results, nodes) : undefined;

  // Apply auth config
  if (config.auth && config.auth.type !== 'none') {
    applyAuth(resolvedHeaders, config.auth, variables, results, nodes);
  }

  try {
    const retryConfig = config.retry;
    const maxAttempts = (retryConfig?.count ?? 0) + 1;
    let lastResponse: Awaited<ReturnType<SendRequestFn>> | null = null;

    let actualRetries = 0;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        actualRetries++;
        await new Promise(r => setTimeout(r, (retryConfig!.backoffMs || 1000)));
        callbacks.onNodeStatusChange(node.id, 'running');
      }

      lastResponse = await sendRequest(
        {
          method: config.method,
          url: resolvedUrl,
          headers: resolvedHeaders,
          body: resolvedBody,
        },
        signal
      );

      const status = isProxyError(lastResponse) ? 0 : lastResponse.status;
      if (!retryConfig?.retryOn?.includes(status)) break;
    }

    const result = buildExecutionResult(node.id, node, variables, results, nodes, lastResponse!);
    if (actualRetries > 0) result.retryCount = actualRetries;
    callbacks.onNodeResult(node.id, result);
    callbacks.onNodeStatusChange(node.id, result.error ? 'error' : 'success');

    const assertions = callbacks.getAssertions(node.id);
    if (assertions.length > 0) {
      const assertionResults = runAssertions(assertions, result);
      callbacks.onAssertionResults(node.id, assertionResults);
    }

    return result;
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const isTimeout = isAbort && !signal?.aborted;
    const errorMessage = isTimeout
      ? 'Request timeout — the server did not respond in time'
      : isAbort
        ? 'Request was cancelled'
        : err instanceof Error ? err.message : 'Unknown error';
    const errorResult: ExecutionResult = {
      nodeId: node.id,
      status: 0,
      statusText: isTimeout ? 'Timeout' : isAbort ? 'Cancelled' : 'Network Error',
      headers: {},
      body: null,
      duration_ms: 0,
      size_bytes: 0,
      error: errorMessage,
      resolvedRequest: {
        method: config.method,
        url: resolvedUrl,
        headers: resolvedHeaders,
        body: resolvedBody ?? '',
      },
    };
    callbacks.onNodeResult(node.id, errorResult);
    callbacks.onNodeStatusChange(node.id, 'error');
    return errorResult;
  }
}

export async function coreRunFlow(
  nodes: CoreApiNode[],
  edges: CoreFlowEdge[],
  variables: Record<string, string>,
  sendRequest: SendRequestFn,
  callbacks: ExecutionCallbacks,
  signal?: AbortSignal
): Promise<void> {
  // Reset all statuses
  for (const node of nodes) {
    callbacks.onNodeStatusChange(node.id, 'idle');
  }

  // Include both API nodes and condition nodes for execution
  const executableTypes = new Set(['apiNode', 'conditionNode', 'loopNode']);
  const execNodes = nodes.filter((n) => executableTypes.has(n.type ?? ''));
  const execNodeIds = new Set(execNodes.map((n) => n.id));
  const execEdges = edges.filter((e) => execNodeIds.has(e.source) && execNodeIds.has(e.target));

  const nodeIds = execNodes.map((n) => n.id);
  const { levels, hasCycle } = topologicalSort(nodeIds, execEdges);

  if (hasCycle) {
    return;
  }

  const nodeMap = new Map(execNodes.map((n) => [n.id, n]));
  const nodeResults = new Map<string, ExecutionResult>();
  const skippedNodes = new Set<string>();

  // Helper: recursively mark downstream of a skipped node as also skipped
  function markDownstreamSkipped(nodeId: string) {
    const outEdges = execEdges.filter(e => e.source === nodeId);
    for (const edge of outEdges) {
      if (!skippedNodes.has(edge.target)) {
        // Only skip if ALL incoming edges lead from skipped nodes
        const inEdges = execEdges.filter(e => e.target === edge.target);
        const allSourcesSkipped = inEdges.every(e => skippedNodes.has(e.source));
        if (allSourcesSkipped) {
          skippedNodes.add(edge.target);
          markDownstreamSkipped(edge.target);
        }
      }
    }
  }

  for (const level of levels) {
    if (signal?.aborted) break;

    const promises = level.map(async (nodeId) => {
      if (skippedNodes.has(nodeId)) {
        callbacks.onNodeStatusChange(nodeId, 'idle');
        return null;
      }

      const node = nodeMap.get(nodeId)!;

      // Condition node: evaluate, don't call API
      if (node.type === 'conditionNode') {
        const condData = node.data as unknown as ConditionNodeData;
        const sourceNode = execNodes.find(n => n.data.label === condData.sourceNodeLabel);
        const sourceResult = sourceNode ? nodeResults.get(sourceNode.id) : undefined;
        const passed = sourceResult ? evaluateCondition(condData.condition, sourceResult) : false;

        callbacks.onNodeStatusChange(nodeId, 'success');

        // Find edges from this condition node and skip the inactive branch
        const condEdges = edges.filter(e => e.source === nodeId);
        for (const edge of condEdges) {
          if (edge.sourceHandle === 'true' && !passed) {
            skippedNodes.add(edge.target);
            markDownstreamSkipped(edge.target);
          } else if (edge.sourceHandle === 'false' && passed) {
            skippedNodes.add(edge.target);
            markDownstreamSkipped(edge.target);
          }
        }

        return null;
      }

      // Loop node: pass through (full loop execution is future feature)
      if (node.type === 'loopNode') {
        callbacks.onNodeStatusChange(nodeId, 'success');
        return null;
      }

      // API node: run normally
      return coreRunSingleNode(node, variables, sendRequest, callbacks, signal, nodeResults, execNodes);
    });

    const results = await Promise.allSettled(promises);

    // Collect results into nodeResults map
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        nodeResults.set(r.value.nodeId, r.value);
      }
    }

    const hasError = results.some(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.error)
    );

    if (hasError) {
      // Mark remaining nodes as idle
      for (const remainingLevel of levels.slice(levels.indexOf(level) + 1)) {
        for (const nodeId of remainingLevel) {
          callbacks.onNodeStatusChange(nodeId, 'idle');
        }
      }
      break;
    }
  }
}

export function coreInitSteppingMode(
  nodes: CoreApiNode[],
  edges: CoreFlowEdge[]
): { levels: string[][]; hasCycle: boolean } {
  const executableTypes = new Set(['apiNode', 'conditionNode', 'loopNode']);
  const execNodes = nodes.filter((n) => executableTypes.has(n.type ?? ''));
  const execNodeIds = new Set(execNodes.map((n) => n.id));
  const execEdges = edges.filter((e) => execNodeIds.has(e.source) && execNodeIds.has(e.target));

  const nodeIds = execNodes.map((n) => n.id);
  return topologicalSort(nodeIds, execEdges);
}

export async function coreRunStepLevel(
  nodes: CoreApiNode[],
  edges: CoreFlowEdge[],
  variables: Record<string, string>,
  level: string[],
  sendRequest: SendRequestFn,
  callbacks: ExecutionCallbacks,
  nodeResults: Map<string, ExecutionResult>,
  skippedNodes: Set<string>
): Promise<void> {
  const executableTypes = new Set(['apiNode', 'conditionNode', 'loopNode']);
  const execNodes = nodes.filter((n) => executableTypes.has(n.type ?? ''));
  const nodeMap = new Map(execNodes.map((n) => [n.id, n]));

  for (const nodeId of level) {
    if (skippedNodes.has(nodeId)) {
      callbacks.onNodeStatusChange(nodeId, 'idle');
      continue;
    }
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    if (node.type === 'conditionNode') {
      // Evaluate condition without API call
      const condData = node.data as unknown as import('./types').ConditionNodeData;
      const sourceNode = execNodes.find(n => n.data.label === condData.sourceNodeLabel);
      const sourceResult = sourceNode ? nodeResults.get(sourceNode.id) : undefined;
      const passed = sourceResult ? evaluateCondition(condData.condition, sourceResult) : false;

      callbacks.onNodeStatusChange(node.id, 'success');

      // Mark inactive branches as skipped
      const condEdges = edges.filter(e => e.source === node.id);
      for (const edge of condEdges) {
        if ((edge.sourceHandle === 'true' && !passed) || (edge.sourceHandle === 'false' && passed)) {
          markDownstreamSkipped(edge.target, edges, skippedNodes);
        }
      }
    } else {
      await coreRunSingleNode(node, variables, sendRequest, callbacks, undefined, nodeResults, execNodes);
    }
  }
}

function markDownstreamSkipped(nodeId: string, edges: CoreFlowEdge[], skipped: Set<string>): void {
  if (skipped.has(nodeId)) return;
  skipped.add(nodeId);
  for (const edge of edges) {
    if (edge.source === nodeId) {
      markDownstreamSkipped(edge.target, edges, skipped);
    }
  }
}
