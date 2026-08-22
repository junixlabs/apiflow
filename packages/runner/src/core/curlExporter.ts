import type { CoreApiNode, ExecutionResult } from './types';
import { resolveAll, resolveHeaders } from './variableResolver';

function escapeShellSingleQuote(value: string): string {
  return value.replace(/'/g, "'\\''");
}

export function generateCurl(
  node: CoreApiNode,
  variables: Record<string, string>,
  nodeResults: Map<string, ExecutionResult>,
  allNodes: CoreApiNode[]
): string {
  const { method, url, headers, body } = node.data.config;

  const resolvedUrl = resolveAll(url, variables, nodeResults, allNodes);
  const resolvedHeaders = resolveHeaders(headers, variables, nodeResults, allNodes);
  const resolvedBody = body ? resolveAll(body, variables, nodeResults, allNodes) : '';

  const parts: string[] = [`curl -X ${method} '${escapeShellSingleQuote(resolvedUrl)}'`];

  for (const [key, value] of Object.entries(resolvedHeaders)) {
    parts.push(`-H '${escapeShellSingleQuote(key)}: ${escapeShellSingleQuote(value)}'`);
  }

  if (resolvedBody && method !== 'GET') {
    parts.push(`-d '${escapeShellSingleQuote(resolvedBody)}'`);
  }

  return parts.join(' ');
}

export function generateAllCurls(
  nodes: CoreApiNode[],
  variables: Record<string, string>,
  nodeResults: Map<string, ExecutionResult>,
  allNodes: CoreApiNode[]
): string {
  return nodes
    .filter((n) => n.type === 'apiNode')
    .map((n) => generateCurl(n, variables, nodeResults, allNodes))
    .join('\n\n');
}
