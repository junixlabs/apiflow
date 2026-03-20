export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface KeyValuePair {
  key: string;
  value: string;
  enabled: boolean;
}

// Retry config
export interface RetryConfig {
  count: number;           // max retries (0 = no retry)
  backoffMs: number;       // delay between retries
  retryOn: number[];       // status codes to retry on (e.g. [429, 500, 502, 503])
}

export interface ApiNodeConfig {
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  params: KeyValuePair[];
  body: string;
  auth?: AuthConfig;
  retry?: RetryConfig;
}

export type NodeStatus = 'idle' | 'running' | 'success' | 'error';

export interface ApiNodeData {
  label: string;
  config: ApiNodeConfig;
  description?: string;
  [key: string]: unknown;
}

// Standalone node type (no @xyflow/react dependency)
export interface CoreApiNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: ApiNodeData;
  style?: Record<string, unknown> | object;
}

export interface CoreFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;    // 'true' | 'false' for condition branches
  [key: string]: unknown;
}

export interface ExecutionResult {
  nodeId: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  duration_ms: number;
  size_bytes: number;
  error?: string;
  retryCount?: number;
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
  nodes: CoreApiNode[];
  edges: CoreFlowEdge[];
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

// Assertion types
export type AssertionType = 'status_equals' | 'body_contains' | 'jsonpath_match' | 'header_exists';

export interface Assertion {
  id: string;
  type: AssertionType;
  target: string;
  expected: string;
  enabled: boolean;
}

export interface AssertionResult {
  assertionId: string;
  passed: boolean;
  actual: string;
  message: string;
}

// Execution callback interface (replaces Zustand stores)
export interface ExecutionCallbacks {
  onNodeStatusChange: (nodeId: string, status: NodeStatus) => void;
  onNodeResult: (nodeId: string, result: ExecutionResult) => void;
  getAssertions: (nodeId: string) => Assertion[];
  onAssertionResults: (nodeId: string, results: AssertionResult[]) => void;
}

// V2 format: assertions included, environments separate
export interface ApiViewFileV2 {
  version: 2;
  metadata: { name: string; createdAt: string; updatedAt: string };
  nodes: CoreApiNode[];
  edges: CoreFlowEdge[];
  assertions?: Record<string, Assertion[]>;
}

// Union for loading either version
export type ApiViewFileAny = ApiViewFile | ApiViewFileV2;

// Project config
export interface ProjectConfig {
  name: string;
  activeEnvironment: string;
  defaultTimeout: number;
}

// Auth types
export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey';

export interface AuthConfig {
  type: AuthType;
  token?: string;        // bearer
  username?: string;      // basic
  password?: string;      // basic
  headerName?: string;    // apikey (default: X-API-Key)
  apiKey?: string;        // apikey
}

// Condition node
export interface ConditionRule {
  fieldPath: string;      // e.g. "status" or "body.data.active"
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'exists' | 'not_exists';
  expected: string;
}

export interface ConditionNodeData {
  label: string;
  sourceNodeLabel: string;  // which node's response to evaluate
  condition: ConditionRule;
  [key: string]: unknown;
}

// Loop node
export interface LoopNodeConfig {
  mode: 'pagination';
  pageParam: string;       // e.g. "page"
  startPage: number;
  maxIterations: number;   // safety limit
}

export interface LoopNodeData {
  label: string;
  loopConfig: LoopNodeConfig;
  [key: string]: unknown;
}
