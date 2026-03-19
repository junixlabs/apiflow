import type { FlowEdge } from '../types';

export interface TopologicalResult {
  levels: string[][];
  hasCycle: boolean;
}

/**
 * Kahn's algorithm for topological sort.
 * Returns levels where each level contains nodes that can run in parallel.
 */
export function topologicalSort(
  nodeIds: string[],
  edges: FlowEdge[]
): TopologicalResult {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    const current = inDegree.get(edge.target) ?? 0;
    inDegree.set(edge.target, current + 1);
    adjacency.get(edge.source)?.push(edge.target);
  }

  const levels: string[][] = [];
  let queue = nodeIds.filter((id) => inDegree.get(id) === 0);
  let processed = 0;

  while (queue.length > 0) {
    levels.push([...queue]);
    processed += queue.length;
    const nextQueue: string[] = [];

    for (const nodeId of queue) {
      for (const neighbor of adjacency.get(nodeId) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          nextQueue.push(neighbor);
        }
      }
    }

    queue = nextQueue;
  }

  return {
    levels,
    hasCycle: processed !== nodeIds.length,
  };
}
