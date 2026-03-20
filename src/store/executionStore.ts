import { create } from 'zustand';
import type { ExecutionResult, NodeStatus } from '../types';
import { useHistoryResultStore } from './historyResultStore';

interface ExecutionState {
  nodeResults: Map<string, ExecutionResult>;
  nodeStatuses: Map<string, NodeStatus>;
  isFlowRunning: boolean;
  abortController: AbortController | null;
  lastRunTime: string | null;

  // Stepping mode
  executionMode: 'normal' | 'stepping';
  steppingLevels: string[][] | null;
  currentStepIndex: number;

  setNodeResult: (nodeId: string, result: ExecutionResult) => void;
  setNodeStatus: (nodeId: string, status: NodeStatus) => void;
  setFlowRunning: (running: boolean) => void;
  setAbortController: (controller: AbortController | null) => void;
  resetAll: () => void;
  abort: () => void;

  startStepping: (levels: string[][]) => void;
  stopStepping: () => void;
  setCurrentStepIndex: (index: number) => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  nodeResults: new Map(),
  nodeStatuses: new Map(),
  isFlowRunning: false,
  abortController: null,
  lastRunTime: null,

  executionMode: 'normal',
  steppingLevels: null,
  currentStepIndex: 0,

  setNodeResult: (nodeId, result) => {
    set((state) => {
      const newResults = new Map(state.nodeResults);
      newResults.set(nodeId, result);
      return { nodeResults: newResults };
    });
    useHistoryResultStore.getState().pushResult(nodeId, result);
  },

  setNodeStatus: (nodeId, status) =>
    set((state) => {
      const newStatuses = new Map(state.nodeStatuses);
      newStatuses.set(nodeId, status);
      return { nodeStatuses: newStatuses };
    }),

  setFlowRunning: (running) =>
    set({
      isFlowRunning: running,
      lastRunTime: running ? null : new Date().toISOString(),
    }),

  setAbortController: (controller) => set({ abortController: controller }),

  resetAll: () =>
    set({
      nodeResults: new Map(),
      nodeStatuses: new Map(),
      isFlowRunning: false,
      abortController: null,
      executionMode: 'normal',
      steppingLevels: null,
      currentStepIndex: 0,
    }),

  abort: () => {
    const controller = get().abortController;
    if (controller) controller.abort();
    set({
      isFlowRunning: false,
      abortController: null,
      executionMode: 'normal',
      steppingLevels: null,
      currentStepIndex: 0,
    });
  },

  startStepping: (levels) =>
    set({
      executionMode: 'stepping',
      steppingLevels: levels,
      currentStepIndex: 0,
    }),

  stopStepping: () =>
    set({
      executionMode: 'normal',
      steppingLevels: null,
      currentStepIndex: 0,
    }),

  setCurrentStepIndex: (index) => set({ currentStepIndex: index }),
}));
