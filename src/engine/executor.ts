import type { ApiNode, FlowEdge, ExecutionResult } from '../types';
import { sendRequest, isProxyError } from './httpClient';
import { resolveAll, resolveHeaders } from './variableResolver';
import { topologicalSort } from './topologicalSort';
import { useExecutionStore } from '../store/executionStore';

function buildExecutionResult(
  nodeId: string,
  node: ApiNode,
  variables: Record<string, string>,
  nodeResults: Map<string, ExecutionResult>,
  allNodes: ApiNode[],
  response: Awaited<ReturnType<typeof sendRequest>>
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

export async function runSingleNode(
  node: ApiNode,
  variables: Record<string, string>,
  signal?: AbortSignal,
  nodeResults?: Map<string, ExecutionResult>,
  allNodes?: ApiNode[]
): Promise<ExecutionResult> {
  const store = useExecutionStore.getState();
  const config = node.data.config;
  const results = nodeResults ?? store.nodeResults;
  const nodes = allNodes ?? [];

  store.setNodeStatus(node.id, 'running');

  const resolvedUrl = resolveAll(config.url, variables, results, nodes);
  const resolvedHeaders = resolveHeaders(config.headers, variables, results, nodes);
  const resolvedBody = config.body ? resolveAll(config.body, variables, results, nodes) : undefined;

  try {
    const response = await sendRequest(
      {
        method: config.method,
        url: resolvedUrl,
        headers: resolvedHeaders,
        body: resolvedBody,
      },
      signal
    );

    const result = buildExecutionResult(node.id, node, variables, results, nodes, response);
    store.setNodeResult(node.id, result);
    store.setNodeStatus(node.id, result.error ? 'error' : 'success');
    return result;
  } catch (err) {
    const errorResult: ExecutionResult = {
      nodeId: node.id,
      status: 0,
      statusText: 'Network Error',
      headers: {},
      body: null,
      duration_ms: 0,
      size_bytes: 0,
      error: err instanceof Error ? err.message : 'Unknown error',
      resolvedRequest: {
        method: config.method,
        url: resolvedUrl,
        headers: resolvedHeaders,
        body: resolvedBody ?? '',
      },
    };
    store.setNodeResult(node.id, errorResult);
    store.setNodeStatus(node.id, 'error');
    return errorResult;
  }
}

export async function runFlow(
  nodes: ApiNode[],
  edges: FlowEdge[],
  variables: Record<string, string>
): Promise<void> {
  const store = useExecutionStore.getState();
  const abortController = new AbortController();
  store.setAbortController(abortController);
  store.setFlowRunning(true);

  // Reset all statuses
  for (const node of nodes) {
    store.setNodeStatus(node.id, 'idle');
  }

  // Filter to only API nodes for execution
  const apiNodes = nodes.filter((n) => n.type === 'apiNode');
  const apiNodeIds = new Set(apiNodes.map((n) => n.id));
  const apiEdges = edges.filter((e) => apiNodeIds.has(e.source) && apiNodeIds.has(e.target));

  const nodeIds = apiNodes.map((n) => n.id);
  const { levels, hasCycle } = topologicalSort(nodeIds, apiEdges);

  if (hasCycle) {
    store.setFlowRunning(false);
    return;
  }

  const nodeMap = new Map(apiNodes.map((n) => [n.id, n]));

  for (const level of levels) {
    if (abortController.signal.aborted) break;

    const promises = level.map((nodeId) => {
      const node = nodeMap.get(nodeId)!;
      return runSingleNode(node, variables, abortController.signal, store.nodeResults, nodes);
    });

    const results = await Promise.allSettled(promises);

    const hasError = results.some(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error)
    );

    if (hasError) {
      // Mark remaining nodes as idle
      for (const remainingLevel of levels.slice(levels.indexOf(level) + 1)) {
        for (const nodeId of remainingLevel) {
          store.setNodeStatus(nodeId, 'idle');
        }
      }
      break;
    }
  }

  store.setFlowRunning(false);
  store.setAbortController(null);
}

export async function initSteppingMode(
  nodes: ApiNode[],
  edges: FlowEdge[],
  variables: Record<string, string>
): Promise<void> {
  const store = useExecutionStore.getState();

  const apiNodes = nodes.filter((n) => n.type === 'apiNode');
  const apiNodeIds = new Set(apiNodes.map((n) => n.id));
  const apiEdges = edges.filter((e) => apiNodeIds.has(e.source) && apiNodeIds.has(e.target));

  const nodeIds = apiNodes.map((n) => n.id);
  const { levels, hasCycle } = topologicalSort(nodeIds, apiEdges);

  if (hasCycle || levels.length === 0) return;

  // Reset previous results before stepping
  store.resetAll();

  // Reset statuses after resetAll (which also resets them)
  for (const node of apiNodes) {
    store.setNodeStatus(node.id, 'idle');
  }

  store.startStepping(levels);

  // Run first level
  await runStepLevel(nodes, variables, 0, levels);
}

export async function runNextStep(
  nodes: ApiNode[],
  variables: Record<string, string>
): Promise<void> {
  const execStore = useExecutionStore.getState();
  const { steppingLevels, currentStepIndex } = execStore;
  if (!steppingLevels) return;

  const nextIndex = currentStepIndex + 1;
  if (nextIndex >= steppingLevels.length) {
    execStore.stopStepping();
    return;
  }

  execStore.setCurrentStepIndex(nextIndex);
  await runStepLevel(nodes, variables, nextIndex, steppingLevels);
}

async function runStepLevel(
  nodes: ApiNode[],
  variables: Record<string, string>,
  levelIndex: number,
  levels: string[][]
): Promise<void> {
  const store = useExecutionStore.getState();
  const level = levels[levelIndex];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const promises = level.map((nodeId) => {
    const node = nodeMap.get(nodeId);
    if (!node) return Promise.resolve();
    return runSingleNode(node, variables, undefined, store.nodeResults, nodes);
  });

  await Promise.allSettled(promises);
}
