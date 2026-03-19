import { create } from 'zustand';
import type { ApiViewFile } from '../types';

export interface FlowMeta {
  id: string;
  name: string;
  updatedAt: string;
  nodeCount: number;
}

const INDEX_KEY = 'apiview_library_index';
const FLOW_PREFIX = 'apiview_flow_';

interface LibraryState {
  flows: FlowMeta[];

  loadIndex: () => void;
  saveToLibrary: (flow: ApiViewFile, id?: string) => string;
  deleteFromLibrary: (id: string) => void;
  duplicateFlow: (id: string) => string | null;
  getFlow: (id: string) => ApiViewFile | null;
}

function saveIndex(flows: FlowMeta[]) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(flows));
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  flows: [],

  loadIndex: () => {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      if (raw) {
        set({ flows: JSON.parse(raw) });
      }
    } catch {
      set({ flows: [] });
    }
  },

  saveToLibrary: (flow, existingId) => {
    const id = existingId ?? `flow_${Date.now()}`;
    localStorage.setItem(FLOW_PREFIX + id, JSON.stringify(flow));

    const meta: FlowMeta = {
      id,
      name: flow.metadata.name,
      updatedAt: new Date().toISOString(),
      nodeCount: flow.nodes.filter((n) => n.type === 'apiNode').length,
    };

    const state = get();
    const existing = state.flows.findIndex((f) => f.id === id);
    let updated: FlowMeta[];
    if (existing >= 0) {
      updated = state.flows.map((f, i) => (i === existing ? meta : f));
    } else {
      updated = [...state.flows, meta];
    }

    saveIndex(updated);
    set({ flows: updated });
    return id;
  },

  deleteFromLibrary: (id) => {
    localStorage.removeItem(FLOW_PREFIX + id);
    const updated = get().flows.filter((f) => f.id !== id);
    saveIndex(updated);
    set({ flows: updated });
  },

  duplicateFlow: (id) => {
    const flow = get().getFlow(id);
    if (!flow) return null;
    // Deep clone to avoid shared references
    const cloned: ApiViewFile = JSON.parse(JSON.stringify(flow));
    cloned.metadata.name = flow.metadata.name + ' (copy)';
    cloned.metadata.createdAt = new Date().toISOString();
    cloned.metadata.updatedAt = new Date().toISOString();
    return get().saveToLibrary(cloned);
  },

  getFlow: (id) => {
    try {
      const raw = localStorage.getItem(FLOW_PREFIX + id);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
  },
}));
