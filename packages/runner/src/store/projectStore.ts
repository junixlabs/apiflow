import { create } from 'zustand';
import type { ProjectConfig } from '../types';
import * as apiClient from '../utils/apiClient';
import type { RecentProject, FlowMeta } from '../utils/apiClient';
import { useFlowStore } from './flowStore';
import { useAssertionStore } from './assertionStore';
import { useEnvironmentStore } from './environmentStore';

interface ProjectState {
  projectDir: string | null;
  projectConfig: ProjectConfig | null;
  flowList: FlowMeta[];
  flowFolders: string[];
  activeFlowName: string | null;
  isProjectMode: boolean;
  recentProjects: RecentProject[];
  isLoading: boolean;

  // Actions
  openProject: (dir: string) => Promise<void>;
  closeProject: () => void;
  loadFlowList: () => Promise<void>;
  loadRecentProjects: () => Promise<void>;
  setActiveFlowName: (name: string | null) => void;

  // Flow operations (delegates to apiClient)
  saveCurrentFlow: () => Promise<void>;
  deleteFlow: (name: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectDir: null,
  projectConfig: null,
  flowList: [],
  flowFolders: [],
  activeFlowName: null,
  isProjectMode: false,
  recentProjects: [],
  isLoading: false,

  openProject: async (dir: string) => {
    set({ isLoading: true });
    try {
      const result = await apiClient.openProject(dir);
      set({
        projectDir: result.dir,
        projectConfig: result.config,
        isProjectMode: true,
      });
      await get().loadFlowList();
      await useEnvironmentStore.getState().loadFromProject();
    } finally {
      set({ isLoading: false });
    }
  },

  closeProject: () => {
    set({
      projectDir: null,
      projectConfig: null,
      flowList: [],
      flowFolders: [],
      activeFlowName: null,
      isProjectMode: false,
    });
  },

  loadFlowList: async () => {
    const flows = await apiClient.listFlows();
    // Extract unique folders from flow list
    const folders = Array.from(
      new Set(flows.map((f) => f.folder).filter((f): f is string => !!f))
    ).sort();
    set({ flowList: flows, flowFolders: folders });
  },

  loadRecentProjects: async () => {
    const projects = await apiClient.getProjects();
    set({ recentProjects: projects });
  },

  setActiveFlowName: (name: string | null) => {
    set({ activeFlowName: name });
    // Persist so reload can restore
    if (name) {
      try { localStorage.setItem('apiview_active_flow', name); } catch { /* ignore */ }
    } else {
      try { localStorage.removeItem('apiview_active_flow'); } catch { /* ignore */ }
    }
  },

  saveCurrentFlow: async () => {
    const { activeFlowName } = get();
    if (!activeFlowName) return;

    const assertions = useAssertionStore.getState().toRecord();
    const flowData = useFlowStore.getState().exportFlowV2(assertions);

    await apiClient.saveFlow(activeFlowName, flowData);
    useFlowStore.getState().setClean();
    await get().loadFlowList();
  },

  deleteFlow: async (name: string) => {
    await apiClient.deleteFlow(name);
    const { activeFlowName } = get();
    if (activeFlowName === name) {
      set({ activeFlowName: null });
    }
    await get().loadFlowList();
  },
}));
