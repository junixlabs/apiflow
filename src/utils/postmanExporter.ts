import type { ApiNode, FlowEdge, Environment } from '../types';

export function exportToPostmanCollection(
  nodes: ApiNode[],
  _edges: FlowEdge[],
  name: string,
  environments: Environment[]
): object {
  const apiNodes = nodes.filter((n) => n.type === 'apiNode');

  const items = apiNodes.map((node) => {
    const { method, url, headers, body } = node.data.config;

    const headerList = headers
      .filter((h) => h.enabled && h.key)
      .map((h) => ({ key: h.key, value: h.value, type: 'text' }));

    const item: Record<string, unknown> = {
      name: node.data.label,
      request: {
        method,
        url: { raw: url },
        header: headerList,
        ...(body
          ? {
              body: {
                mode: 'raw',
                raw: body,
                options: { raw: { language: 'json' } },
              },
            }
          : {}),
      },
    };

    return item;
  });

  const collectionVariables: { key: string; value: string; type: string }[] = [];
  for (const env of environments) {
    for (const v of env.variables) {
      if (v.enabled && v.key) {
        collectionVariables.push({ key: v.key, value: v.value, type: 'default' });
      }
    }
  }

  const collection = {
    info: {
      name,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: items,
    variable: collectionVariables,
  };

  // Download as JSON file
  const json = JSON.stringify(collection, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.postman_collection.json`;
  a.click();
  URL.revokeObjectURL(url);

  return collection;
}
