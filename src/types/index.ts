import type { Node, Edge } from '@xyflow/react';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
}

export interface ApiNodeConfig {
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  params: KeyValuePair[];
  body: string;
}

export type NodeStatus = 'idle' | 'running' | 'success' | 'error';

export interface ApiNodeData {
  label: string;
  config: ApiNodeConfig;
  description?: string;
  [key: string]: unknown;
}

export interface AnnotationNodeData {
  label: string;
  fontSize?: number;
  color?: string;
  [key: string]: unknown;
}

export interface GroupNodeData {
  label: string;
  color?: string;
  width: number;
  height: number;
  [key: string]: unknown;
}

export type ApiNode = Node<ApiNodeData>;
export type FlowEdge = Edge;

export interface ExecutionResult {
  nodeId: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  duration_ms: number;
  size_bytes: number;
  error?: string;
  resolvedRequest: {
    method: HttpMethod;
    url: string;
    headers: Record<string, string>;
    body: string;
  };
}

export interface Environment {
  name: string;
  variables: KeyValuePair[];
}

export interface ApiViewFile {
  version: 1;
  metadata: {
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  nodes: ApiNode[];
  edges: FlowEdge[];
  environments: Environment[];
  activeEnvironmentName: string;
}

export interface ProxyRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface ProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  duration_ms: number;
  size_bytes: number;
}

export interface ProxyErrorResponse {
  error: string;
  message: string;
  duration_ms: number;
}
