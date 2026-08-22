import { create } from 'zustand';
import type { Assertion, AssertionResult } from '../types';

interface AssertionState {
  nodeAssertions: Map<string, Assertion[]>;
  nodeAssertionResults: Map<string, AssertionResult[]>;
  setAssertions: (nodeId: string, assertions: Assertion[]) => void;
  setAssertionResults: (nodeId: string, results: AssertionResult[]) => void;
  getAssertions: (nodeId: string) => Assertion[];
  clearResults: () => void;
  loadFromFlow: (assertions: Record<string, Assertion[]>) => void;
  toRecord: () => Record<string, Assertion[]>;
}

export const useAssertionStore = create<AssertionState>((set, get) => ({
  nodeAssertions: new Map(),
  nodeAssertionResults: new Map(),

  setAssertions: (nodeId, assertions) =>
    set((state) => {
      const newMap = new Map(state.nodeAssertions);
      newMap.set(nodeId, assertions);
      return { nodeAssertions: newMap };
    }),

  setAssertionResults: (nodeId, results) =>
    set((state) => {
      const newMap = new Map(state.nodeAssertionResults);
      newMap.set(nodeId, results);
      return { nodeAssertionResults: newMap };
    }),

  getAssertions: (nodeId) => {
    return get().nodeAssertions.get(nodeId) ?? [];
  },

  clearResults: () =>
    set({ nodeAssertionResults: new Map() }),

  loadFromFlow: (assertions: Record<string, Assertion[]>) => {
    const newMap = new Map<string, Assertion[]>();
    for (const [nodeId, list] of Object.entries(assertions)) {
      newMap.set(nodeId, list);
    }
    set({ nodeAssertions: newMap, nodeAssertionResults: new Map() });
  },

  toRecord: () => {
    const record: Record<string, Assertion[]> = {};
    const map = get().nodeAssertions;
    map.forEach((assertions, nodeId) => {
      if (assertions.length > 0) {
        record[nodeId] = assertions;
      }
    });
    return record;
  },
}));
