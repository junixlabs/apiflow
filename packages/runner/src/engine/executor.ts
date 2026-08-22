import type { ApiNode, FlowEdge, ExecutionResult, ExecutionCallbacks } from '../types';
import {
  coreRunSingleNode,
  coreRunFlow,
  coreInitSteppingMode,
  coreRunStepLevel,
} from '../core/executor';
import { sendRequestViaProxy } from '../core/httpClient';
import { useExecutionStore } from '../store/executionStore';
import { useAssertionStore } from '../store/assertionStore';

function getCallbacks(): ExecutionCallbacks {
  const execStore = useExecutionStore.getState();
  const assertStore = useAssertionStore.getState();
  return {
    onNodeStatusChange: execStore.setNodeStatus,
    onNodeResult: (nodeId: string, result: ExecutionResult) => {
      execStore.setNodeResult(nodeId, result);
    },
    getAssertions: assertStore.getAssertions,
    onAssertionResults: assertStore.setAssertionResults,
  };
}

export async function runSingleNode(
  node: ApiNode,
  variables: Record<string, string>,
  signal?: AbortSignal,
  nodeResults?: Map<string, ExecutionResult>,
  allNodes?: ApiNode[]
): Promise<ExecutionResult> {
  return coreRunSingleNode(
    node,
    variables,
    sendRequestViaProxy,
    getCallbacks(),
    signal,
    nodeResults ?? useExecutionStore.getState().nodeResults,
    allNodes ?? []
  );
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

  await coreRunFlow(
    nodes,
    edges,
    variables,
    sendRequestViaProxy,
    getCallbacks(),
    abortController.signal
  );

  store.setFlowRunning(false);
  store.setAbortController(null);
}

// Module-level state for stepping mode
let steppingSkippedNodes = new Set<string>();
let steppingEdges: FlowEdge[] = [];

export async function initSteppingMode(
  nodes: ApiNode[],
  edges: FlowEdge[],
  variables: Record<string, string>
): Promise<void> {
  const store = useExecutionStore.getState();

  const { levels, hasCycle } = coreInitSteppingMode(nodes, edges);

  if (hasCycle || levels.length === 0) return;

  // Reset
  store.resetAll();
  steppingSkippedNodes = new Set<string>();
  steppingEdges = edges;

  for (const node of nodes) {
    store.setNodeStatus(node.id, 'idle');
  }

  store.startStepping(levels);

  // Run first level
  await coreRunStepLevel(
    nodes,
    edges,
    variables,
    levels[0],
    sendRequestViaProxy,
    getCallbacks(),
    store.nodeResults,
    steppingSkippedNodes
  );
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
  await coreRunStepLevel(
    nodes,
    steppingEdges,
    variables,
    steppingLevels[nextIndex],
    sendRequestViaProxy,
    getCallbacks(),
    execStore.nodeResults,
    steppingSkippedNodes
  );
}
