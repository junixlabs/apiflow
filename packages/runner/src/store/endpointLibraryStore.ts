import { create } from 'zustand';
import type { EndpointLibraryEntry } from '../types/library';
import type { ApiNodeConfig } from '../types';
import * as apiClient from '../utils/apiClient';

interface EndpointLibraryState {
  entries: EndpointLibraryEntry[];
  isLoaded: boolean;

  loadLibrary: () => Promise<void>;
  addEntry: (label: string, config: ApiNodeConfig, tags?: string[]) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  updateEntry: (id: string, patch: Partial<EndpointLibraryEntry>) => Promise<void>;
}

function genId() {
  return `ep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useEndpointLibraryStore = create<EndpointLibraryState>((set, get) => ({
  entries: [],
  isLoaded: false,

  loadLibrary: async () => {
    try {
      const entries = await apiClient.getEndpointLibrary();
      set({ entries, isLoaded: true });
    } catch {
      set({ entries: [], isLoaded: true });
    }
  },

  addEntry: async (label, config, tags = []) => {
    const now = new Date().toISOString();
    const entry: EndpointLibraryEntry = {
      id: genId(),
      label,
      config: JSON.parse(JSON.stringify(config)),
      tags,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...get().entries, entry];
    await apiClient.saveEndpointLibrary(updated);
    set({ entries: updated });
  },

  removeEntry: async (id) => {
    const updated = get().entries.filter((e) => e.id !== id);
    await apiClient.saveEndpointLibrary(updated);
    set({ entries: updated });
  },

  updateEntry: async (id, patch) => {
    const updated = get().entries.map((e) =>
      e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e
    );
    await apiClient.saveEndpointLibrary(updated);
    set({ entries: updated });
  },
}));
