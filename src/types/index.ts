import type { Node, Edge } from '@xyflow/react';
import type { ApiNodeData } from '../core/types';

// Re-export all core types
export type {
  HttpMethod,
  KeyValuePair,
  ApiNodeConfig,
  NodeStatus,
  ApiNodeData,
  CoreApiNode,
  CoreFlowEdge,
  ExecutionResult,
  Environment,
  ApiViewFile,
  ApiViewFileV2,
  ApiViewFileAny,
  ProjectConfig,
  ProxyRequest,
  ProxyResponse,
  ProxyErrorResponse,
  ExecutionCallbacks,
  AuthType,
  AuthConfig,
} from '../core/types';

// Also re-export assertion types
export type { AssertionType, Assertion, AssertionResult } from '../core/types';

// Flow logic types
export type { ConditionRule, ConditionNodeData, LoopNodeConfig, LoopNodeData, RetryConfig } from '../core/types';

// UI-specific types that wrap @xyflow/react
export type ApiNode = Node<ApiNodeData>;
export type FlowEdge = Edge;

// Keep AnnotationNodeData and GroupNodeData here (UI-only)
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
