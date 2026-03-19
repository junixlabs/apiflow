import type { ApiNode, ExecutionResult } from '../types';

const ENV_VARIABLE_REGEX = /\{\{(\w+)\}\}/g;
const NODE_VARIABLE_REGEX = /\{\{nodes\["([^"]+)"\]\.response\.(.+?)\}\}/g;

function getValueByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.').flatMap((part) => {
    const match = part.match(/^(.+?)\[(\d+)\]$/);
    if (match) return [match[1], Number(match[2])];
    return [part];
  });

  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[String(part)];
  }
  return current;
}

export function resolveNodeVariables(
  template: string,
  nodeResults: Map<string, ExecutionResult>,
  nodes: ApiNode[]
): string {
  return template.replace(NODE_VARIABLE_REGEX, (match, label: string, path: string) => {
    const node = nodes.find((n) => n.data.label === label);
    if (!node) return match;
    const result = nodeResults.get(node.id);
    if (!result) return match;
    const value = getValueByPath(result, path);
    if (value === undefined) return match;
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
}

export function resolveVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(ENV_VARIABLE_REGEX, (_, key: string) => {
    return variables[key] ?? `{{${key}}}`;
  });
}

export function resolveAll(
  template: string,
  variables: Record<string, string>,
  nodeResults: Map<string, ExecutionResult>,
  nodes: ApiNode[]
): string {
  const afterNodes = resolveNodeVariables(template, nodeResults, nodes);
  return resolveVariables(afterNodes, variables);
}

export function resolveHeaders(
  headers: { key: string; value: string; enabled: boolean }[],
  variables: Record<string, string>,
  nodeResults?: Map<string, ExecutionResult>,
  nodes?: ApiNode[]
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const h of headers) {
    if (h.enabled && h.key) {
      const key = nodeResults && nodes
        ? resolveAll(h.key, variables, nodeResults, nodes)
        : resolveVariables(h.key, variables);
      const value = nodeResults && nodes
        ? resolveAll(h.value, variables, nodeResults, nodes)
        : resolveVariables(h.value, variables);
      resolved[key] = value;
    }
  }
  return resolved;
}
