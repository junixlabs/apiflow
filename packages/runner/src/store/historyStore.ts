import { create } from 'zustand';
import type { ApiNode, FlowEdge } from '../types';

export interface Snapshot {
  nodes: ApiNode[];
  edges: FlowEdge[];
}

interface HistoryState {
  past: Snapshot[];
  future: Snapshot[];

  pushState: (snapshot: Snapshot) => void;
  undo: (currentState: Snapshot) => Snapshot | null;
  redo: (currentState: Snapshot) => Snapshot | null;
  clear: () => void;
}

const MAX_HISTORY = 50;

function cloneSnapshot(s: Snapshot): Snapshot {
  return JSON.parse(JSON.stringify(s));
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],

  pushState: (snapshot) => {
    set((state) => ({
      past: [...state.past.slice(-(MAX_HISTORY - 1)), cloneSnapshot(snapshot)],
      future: [],
    }));
  },

  undo: (currentState) => {
    const { past } = get();
    if (past.length === 0) return null;
    const previous = past[past.length - 1];
    set((state) => ({
      past: state.past.slice(0, -1),
      future: [cloneSnapshot(currentState), ...state.future],
    }));
    return previous;
  },

  redo: (currentState) => {
    const { future } = get();
    if (future.length === 0) return null;
    const next = future[0];
    set((state) => ({
      past: [...state.past, cloneSnapshot(currentState)],
      future: state.future.slice(1),
    }));
    return next;
  },

  clear: () => set({ past: [], future: [] }),
}));
