import { create } from 'zustand';

export interface FlowRunNodeResult {
  nodeId: string;
  label: string;
  status: number;
  error?: string;
  duration_ms: number;
}

export interface FlowRunResult {
  flowId: string;
  flowName: string;
  nodeCount: number;
  passedCount: number;
  failedCount: number;
  totalDuration: number;
  timestamp: string;
  nodeResults: FlowRunNodeResult[];
}

interface DashboardState {
  flowResults: Map<string, FlowRunResult>;
  isBatchRunning: boolean;
  batchProgress: { current: number; total: number };
  batchCurrentFlowName: string;
  batchAbortController: AbortController | null;

  setFlowResult: (flowId: string, result: FlowRunResult) => void;
  setBatchRunning: (running: boolean) => void;
  setBatchProgress: (current: number, total: number) => void;
  setBatchCurrentFlowName: (name: string) => void;
  setBatchAbortController: (controller: AbortController | null) => void;
  clearResults: () => void;
  abortBatch: () => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  flowResults: new Map(),
  isBatchRunning: false,
  batchProgress: { current: 0, total: 0 },
  batchCurrentFlowName: '',
  batchAbortController: null,

  setFlowResult: (flowId, result) =>
    set((state) => {
      const newResults = new Map(state.flowResults);
      newResults.set(flowId, result);
      return { flowResults: newResults };
    }),

  setBatchRunning: (running) => set({ isBatchRunning: running }),

  setBatchProgress: (current, total) =>
    set({ batchProgress: { current, total } }),

  setBatchCurrentFlowName: (name) => set({ batchCurrentFlowName: name }),

  setBatchAbortController: (controller) =>
    set({ batchAbortController: controller }),

  clearResults: () =>
    set({
      flowResults: new Map(),
      batchProgress: { current: 0, total: 0 },
      batchCurrentFlowName: '',
    }),

  abortBatch: () => {
    const controller = get().batchAbortController;
    if (controller) controller.abort();
    set({
      isBatchRunning: false,
      batchAbortController: null,
      batchCurrentFlowName: '',
    });
  },
}));
