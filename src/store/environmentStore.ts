import { create } from 'zustand';
import type { Environment, KeyValuePair } from '../types';

interface EnvironmentState {
  environments: Environment[];
  activeEnvironmentName: string;

  getActiveVariables: () => Record<string, string>;
  setActiveEnvironment: (name: string) => void;
  addEnvironment: (name: string) => void;
  deleteEnvironment: (name: string) => void;
  updateVariables: (envName: string, variables: KeyValuePair[]) => void;
  loadEnvironments: (environments: Environment[], activeName: string) => void;
}

export const useEnvironmentStore = create<EnvironmentState>((set, get) => ({
  environments: [{ name: 'Default', variables: [{ key: '', value: '', enabled: true }] }],
  activeEnvironmentName: 'Default',

  getActiveVariables: () => {
    const state = get();
    const activeEnv = state.environments.find(
      (e) => e.name === state.activeEnvironmentName
    );
    if (!activeEnv) return {};
    const vars: Record<string, string> = {};
    for (const v of activeEnv.variables) {
      if (v.enabled && v.key) {
        vars[v.key] = v.value;
      }
    }
    return vars;
  },

  setActiveEnvironment: (name) => set({ activeEnvironmentName: name }),

  addEnvironment: (name) =>
    set((state) => ({
      environments: [
        ...state.environments,
        { name, variables: [{ key: '', value: '', enabled: true }] },
      ],
      activeEnvironmentName: name,
    })),

  deleteEnvironment: (name) =>
    set((state) => {
      const filtered = state.environments.filter((e) => e.name !== name);
      return {
        environments: filtered.length > 0 ? filtered : [{ name: 'Default', variables: [{ key: '', value: '', enabled: true }] }],
        activeEnvironmentName: filtered.length > 0 ? filtered[0].name : 'Default',
      };
    }),

  updateVariables: (envName, variables) =>
    set((state) => ({
      environments: state.environments.map((e) =>
        e.name === envName ? { ...e, variables } : e
      ),
    })),

  loadEnvironments: (environments, activeName) =>
    set({ environments, activeEnvironmentName: activeName }),
}));
