let counter = 0;

export function generateNodeId(): string {
  return `node_${Date.now()}_${++counter}`;
}

export function generateEdgeId(source: string, target: string): string {
  return `edge_${source}_${target}`;
}
