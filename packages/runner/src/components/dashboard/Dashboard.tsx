import { useState, useEffect, useCallback } from 'react';
import { useLibraryStore } from '../../store/libraryStore';
import { useFlowStore } from '../../store/flowStore';
import { useEnvironmentStore } from '../../store/environmentStore';
import { useExecutionStore } from '../../store/executionStore';
import { useProjectStore } from '../../store/projectStore';
import { useAssertionStore } from '../../store/assertionStore';
import { useDashboardStore } from '../../store/dashboardStore';
import type { FlowRunResult, FlowRunNodeResult } from '../../store/dashboardStore';
import type { ApiViewFile, ApiViewFileAny, ApiViewFileV2, ExecutionResult, ExecutionCallbacks } from '../../core/types';
import * as apiClient from '../../utils/apiClient';
import { coreRunFlow } from '../../core/executor';
import { sendRequestViaProxy } from '../../core/httpClient';
import { FlowResultCard } from './FlowResultCard';
import { BatchRunProgress } from './BatchRunProgress';

type SortMode = 'name' | 'status' | 'date';

interface Props {
  onBack: () => void;
  onOpenFlow: () => void;
}

function getVariablesFromFlow(flow: ApiViewFile): Record<string, string> {
  const env = flow.environments.find((e) => e.name === flow.activeEnvironmentName) ?? flow.environments[0];
  if (!env) return {};
  const vars: Record<string, string> = {};
  for (const v of env.variables) {
    if (v.enabled && v.key) {
      vars[v.key] = v.value;
    }
  }
  return vars;
}

async function runFlowFromLibrary(
  flowId: string,
  flow: ApiViewFile,
  signal?: AbortSignal
): Promise<FlowRunResult> {
  const nodeResultsMap = new Map<string, ExecutionResult>();
  const callbacks: ExecutionCallbacks = {
    onNodeStatusChange: () => {},
    onNodeResult: (nodeId, result) => {
      nodeResultsMap.set(nodeId, result);
    },
    getAssertions: () => [],
    onAssertionResults: () => {},
  };

  const variables = getVariablesFromFlow(flow);
  const startTime = Date.now();

  await coreRunFlow(flow.nodes, flow.edges, variables, sendRequestViaProxy, callbacks, signal);

  const totalDuration = Date.now() - startTime;

  const nodeResults: FlowRunNodeResult[] = [];
  let passedCount = 0;
  let failedCount = 0;

  for (const node of flow.nodes) {
    if (node.type !== 'apiNode') continue;
    const result = nodeResultsMap.get(node.id);
    if (result) {
      const hasFailed = !!result.error || result.status === 0 || result.status >= 400;
      if (hasFailed) {
        failedCount++;
      } else {
        passedCount++;
      }
      nodeResults.push({
        nodeId: node.id,
        label: node.data.label,
        status: result.status,
        error: result.error,
        duration_ms: result.duration_ms,
      });
    }
  }

  return {
    flowId,
    flowName: flow.metadata.name,
    nodeCount: flow.nodes.filter((n) => n.type === 'apiNode').length,
    passedCount,
    failedCount,
    totalDuration,
    timestamp: new Date().toISOString(),
    nodeResults,
  };
}

async function runFlowFromProject(
  fileName: string,
  flowData: ApiViewFileV2,
  variables: Record<string, string>,
  signal?: AbortSignal
): Promise<FlowRunResult> {
  const nodeResultsMap = new Map<string, ExecutionResult>();
  const callbacks: ExecutionCallbacks = {
    onNodeStatusChange: () => {},
    onNodeResult: (nodeId, result) => {
      nodeResultsMap.set(nodeId, result);
    },
    getAssertions: () => [],
    onAssertionResults: () => {},
  };

  const startTime = Date.now();

  await coreRunFlow(flowData.nodes, flowData.edges, variables, sendRequestViaProxy, callbacks, signal);

  const totalDuration = Date.now() - startTime;

  const nodeResults: FlowRunNodeResult[] = [];
  let passedCount = 0;
  let failedCount = 0;

  for (const node of flowData.nodes) {
    if (node.type !== 'apiNode') continue;
    const result = nodeResultsMap.get(node.id);
    if (result) {
      const hasFailed = !!result.error || result.status === 0 || result.status >= 400;
      if (hasFailed) {
        failedCount++;
      } else {
        passedCount++;
      }
      nodeResults.push({
        nodeId: node.id,
        label: node.data.label,
        status: result.status,
        error: result.error,
        duration_ms: result.duration_ms,
      });
    }
  }

  return {
    flowId: fileName,
    flowName: flowData.metadata.name,
    nodeCount: flowData.nodes.filter((n) => n.type === 'apiNode').length,
    passedCount,
    failedCount,
    totalDuration,
    timestamp: new Date().toISOString(),
    nodeResults,
  };
}

export function Dashboard({ onBack, onOpenFlow }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>('name');

  const isProjectMode = useProjectStore((s) => s.isProjectMode);
  const projectFlowList = useProjectStore((s) => s.flowList);
  const loadFlowList = useProjectStore((s) => s.loadFlowList);
  const setActiveFlowName = useProjectStore((s) => s.setActiveFlowName);

  const libraryFlows = useLibraryStore((s) => s.flows);
  const loadIndex = useLibraryStore((s) => s.loadIndex);
  const getFlow = useLibraryStore((s) => s.getFlow);

  const flowResults = useDashboardStore((s) => s.flowResults);
  const isBatchRunning = useDashboardStore((s) => s.isBatchRunning);
  const batchProgress = useDashboardStore((s) => s.batchProgress);
  const batchCurrentFlowName = useDashboardStore((s) => s.batchCurrentFlowName);

  // Load cached results from project on mount
  useEffect(() => {
    if (isProjectMode) {
      loadFlowList();
      // Load cached results for each flow
      const loadCachedResults = async () => {
        const flows = useProjectStore.getState().flowList;
        for (const flow of flows) {
          try {
            const cached = await apiClient.getResults(flow.fileName);
            if (cached) {
              useDashboardStore.getState().setFlowResult(flow.fileName, cached as FlowRunResult);
            }
          } catch {
            // No cached results
          }
        }
      };
      loadCachedResults();
    } else {
      loadIndex();
    }
  }, [isProjectMode, loadIndex, loadFlowList]);

  // Unified flow list
  const flows = isProjectMode
    ? projectFlowList.map((f) => ({
        id: f.fileName,
        name: f.name,
        updatedAt: f.updatedAt || new Date().toISOString(),
        nodeCount: f.nodeCount,
      }))
    : libraryFlows;

  const handleRunAll = useCallback(async () => {
    const store = useDashboardStore.getState();
    if (store.isBatchRunning) return;

    const abortController = new AbortController();
    store.setBatchRunning(true);
    store.setBatchAbortController(abortController);
    store.clearResults();
    store.setBatchProgress(0, flows.length);

    if (isProjectMode) {
      const variables = useEnvironmentStore.getState().getActiveVariables();
      for (let i = 0; i < flows.length; i++) {
        if (abortController.signal.aborted) break;

        const meta = flows[i];
        useDashboardStore.getState().setBatchCurrentFlowName(meta.name);

        try {
          const flowData = await apiClient.getFlow(meta.id) as ApiViewFileV2;
          const result = await runFlowFromProject(meta.id, flowData, variables, abortController.signal);
          useDashboardStore.getState().setFlowResult(meta.id, result);
          // Save results to project
          try {
            await apiClient.saveResults(meta.id, result);
          } catch {
            // Non-critical: failed to cache results
          }
        } catch {
          // aborted or error
        }

        useDashboardStore.getState().setBatchProgress(i + 1, flows.length);
      }
    } else {
      for (let i = 0; i < flows.length; i++) {
        if (abortController.signal.aborted) break;

        const meta = flows[i];
        const flow = getFlow(meta.id);
        if (!flow) {
          useDashboardStore.getState().setBatchProgress(i + 1, flows.length);
          continue;
        }

        useDashboardStore.getState().setBatchCurrentFlowName(meta.name);

        try {
          const result = await runFlowFromLibrary(meta.id, flow, abortController.signal);
          useDashboardStore.getState().setFlowResult(meta.id, result);
        } catch {
          // aborted or error
        }

        useDashboardStore.getState().setBatchProgress(i + 1, flows.length);
      }
    }

    useDashboardStore.getState().setBatchRunning(false);
    useDashboardStore.getState().setBatchAbortController(null);
    useDashboardStore.getState().setBatchCurrentFlowName('');
  }, [flows, getFlow, isProjectMode]);

  const handleCancel = useCallback(() => {
    useDashboardStore.getState().abortBatch();
  }, []);

  const handleOpenFlow = useCallback(
    async (id: string) => {
      if (isProjectMode) {
        try {
          const flowData = await apiClient.getFlow(id) as ApiViewFileAny;
          useFlowStore.getState().loadFlow(flowData);
          if (flowData.version === 2 && (flowData as ApiViewFileV2).assertions) {
            useAssertionStore.getState().loadFromFlow((flowData as ApiViewFileV2).assertions!);
          } else {
            useAssertionStore.getState().loadFromFlow({});
          }
          setActiveFlowName(id);
          useExecutionStore.getState().resetAll();
          onOpenFlow();
        } catch {
          // Failed to open flow
        }
      } else {
        const flow = getFlow(id);
        if (!flow) return;
        useFlowStore.getState().loadFlow(flow);
        useEnvironmentStore.getState().loadEnvironments(flow.environments, flow.activeEnvironmentName);
        useExecutionStore.getState().resetAll();
        useLibraryStore.setState({ currentFlowId: id } as never);
        onOpenFlow();
      }
    },
    [getFlow, onOpenFlow, isProjectMode, setActiveFlowName]
  );

  // Summary stats
  const totalFlows = flows.length;
  let passedFlows = 0;
  let failedFlows = 0;
  let notRunFlows = 0;
  for (const meta of flows) {
    const r = flowResults.get(meta.id);
    if (!r) {
      notRunFlows++;
    } else if (r.failedCount > 0) {
      failedFlows++;
    } else {
      passedFlows++;
    }
  }

  // Sort flows
  const sortedFlows = [...flows].sort((a, b) => {
    if (sortMode === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortMode === 'status') {
      const rA = flowResults.get(a.id);
      const rB = flowResults.get(b.id);
      const statusOrder = (r: typeof rA) => {
        if (!r) return 2;
        if (r.failedCount > 0) return 0;
        return 1;
      };
      return statusOrder(rA) - statusOrder(rB);
    }
    // date
    const rA = flowResults.get(a.id);
    const rB = flowResults.get(b.id);
    const tA = rA ? new Date(rA.timestamp).getTime() : 0;
    const tB = rB ? new Date(rB.timestamp).getTime() : 0;
    return tB - tA;
  });

  return (
    <div className="flex-1 h-full overflow-auto bg-canvas-bg p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-canvas-text">Project Overview</h1>
            <button
              onClick={onBack}
              className="px-2.5 py-1 text-xs text-canvas-text/40 hover:text-canvas-text hover:bg-surface-hover rounded"
            >
              Back to Canvas
            </button>
          </div>
          <button
            onClick={handleRunAll}
            disabled={isBatchRunning || flows.length === 0}
            className="px-3 py-1.5 text-xs bg-method-get text-white font-medium hover:bg-method-get/80 disabled:opacity-40 rounded"
          >
            Run All Flows
          </button>
        </div>

        {/* Summary Stats */}
        <div className="flex items-center gap-4 mb-4 text-xs text-canvas-text/50">
          <span>{totalFlows} total</span>
          {passedFlows > 0 && <span className="text-method-get">{passedFlows} passed</span>}
          {failedFlows > 0 && <span className="text-method-delete">{failedFlows} failed</span>}
          {notRunFlows > 0 && <span>{notRunFlows} not run</span>}
        </div>

        {/* Batch Run Progress */}
        {isBatchRunning && (
          <BatchRunProgress
            current={batchProgress.current}
            total={batchProgress.total}
            currentFlowName={batchCurrentFlowName}
            onCancel={handleCancel}
          />
        )}

        {/* Sort Controls */}
        {flows.length > 0 && (
          <div className="flex items-center gap-2 mb-4 text-xs text-canvas-text/40">
            <span>Sort by:</span>
            {(['name', 'status', 'date'] as SortMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={`px-2 py-0.5 rounded ${
                  sortMode === mode
                    ? 'bg-primary/20 text-primary'
                    : 'hover:bg-surface-hover hover:text-canvas-text'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* Flow Grid */}
        {flows.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-canvas-text/40 text-sm">No saved flows yet</p>
            <p className="text-canvas-text/25 text-xs mt-1">
              Save flows from the canvas to see them here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedFlows.map((meta) => (
              <FlowResultCard
                key={meta.id}
                flowId={meta.id}
                flowName={meta.name}
                nodeCount={meta.nodeCount}
                result={flowResults.get(meta.id)}
                onOpen={handleOpenFlow}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
