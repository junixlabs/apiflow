import { create } from 'zustand';
import type { ExecutionResult } from '../types';

interface HistoryResultState {
  nodeHistory: Map<string, ExecutionResult[]>;
  maxPerNode: number;

  pushResult: (nodeId: string, result: ExecutionResult) => void;
  clearHistory: (nodeId?: string) => void;
  getHistory: (nodeId: string) => ExecutionResult[];
}

export const useHistoryResultStore = create<HistoryResultState>((set, get) => ({
  nodeHistory: new Map(),
  maxPerNode: 10,

  pushResult: (nodeId, result) =>
    set((state) => {
      const newHistory = new Map(state.nodeHistory);
      const existing = newHistory.get(nodeId) ?? [];
      const updated = [result, ...existing].slice(0, state.maxPerNode);
      newHistory.set(nodeId, updated);
      return { nodeHistory: newHistory };
    }),

  clearHistory: (nodeId) =>
    set((state) => {
      if (nodeId) {
        const newHistory = new Map(state.nodeHistory);
        newHistory.delete(nodeId);
        return { nodeHistory: newHistory };
      }
      return { nodeHistory: new Map() };
    }),

  getHistory: (nodeId) => {
    return get().nodeHistory.get(nodeId) ?? [];
  },
}));
