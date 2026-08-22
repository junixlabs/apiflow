import type { Environment } from '../core/types';
import type { EndpointLibraryEntry } from '../types/library';

const API_BASE = 'http://localhost:3001/api';

// Types
export interface RecentProject {
  dir: string;
  name: string;
  lastOpened: string;
}

export interface ProjectConfig {
  name: string;
  activeEnvironment: string;
  defaultTimeout: number;
}

export interface FlowMeta {
  name: string;
  fileName: string;
  folder?: string;
  updatedAt: string | null;
  nodeCount: number;
}

// Helper
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// Project
export async function getProjects(): Promise<RecentProject[]> {
  return request<RecentProject[]>('/projects');
}

export async function openProject(dir: string): Promise<{ dir: string; config: ProjectConfig }> {
  return request<{ dir: string; config: ProjectConfig }>('/project/open', {
    method: 'POST',
    body: JSON.stringify({ dir }),
  });
}

export async function getActiveProject(): Promise<{ dir: string; config: ProjectConfig } | null> {
  return request<{ dir: string; config: ProjectConfig } | null>('/project/active');
}

// Flows
export async function listFlows(): Promise<FlowMeta[]> {
  return request<FlowMeta[]>('/flows');
}

export async function getFlow(name: string): Promise<unknown> {
  return request<unknown>(`/flow/${encodeURIComponent(name)}`);
}

export async function saveFlow(name: string, data: unknown): Promise<void> {
  await request<unknown>(`/flow/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteFlow(name: string): Promise<void> {
  await request<unknown>(`/flow/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

// Environments
export async function listEnvironments(): Promise<Environment[]> {
  return request<Environment[]>('/environments');
}

export async function saveEnvironment(name: string, env: Environment): Promise<void> {
  await request<unknown>(`/environment/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify(env),
  });
}

export async function deleteEnvironment(name: string): Promise<void> {
  await request<unknown>(`/environment/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

// Results
export async function getResults(name: string): Promise<unknown | null> {
  return request<unknown | null>(`/results/${encodeURIComponent(name)}`);
}

export async function saveResults(name: string, data: unknown): Promise<void> {
  await request<unknown>(`/results/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// Config
export async function getConfig(): Promise<ProjectConfig> {
  return request<ProjectConfig>('/config');
}

export async function saveConfig(config: ProjectConfig): Promise<void> {
  await request<unknown>('/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

// Endpoint Library
export async function getEndpointLibrary(): Promise<EndpointLibraryEntry[]> {
  return request<EndpointLibraryEntry[]>('/library/endpoints');
}

export async function saveEndpointLibrary(entries: EndpointLibraryEntry[]): Promise<void> {
  await request<unknown>('/library/endpoints', {
    method: 'PUT',
    body: JSON.stringify(entries),
  });
}

// Flow folders
export async function listFlowFolders(): Promise<string[]> {
  return request<string[]>('/flow-folders');
}

export async function createFlowFolder(folderPath: string): Promise<void> {
  await request<unknown>('/flow-folder', {
    method: 'POST',
    body: JSON.stringify({ path: folderPath }),
  });
}
