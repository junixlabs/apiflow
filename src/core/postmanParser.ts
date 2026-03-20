import type { CoreApiNode, CoreFlowEdge, KeyValuePair, HttpMethod } from './types';
import { generateNodeId, generateEdgeId } from './idGenerator';

interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
}

interface PostmanUrl {
  raw?: string;
  host?: string[];
  path?: string[];
  protocol?: string;
}

interface PostmanBody {
  mode?: string;
  raw?: string;
}

interface PostmanRequest {
  method?: string;
  header?: PostmanHeader[];
  url?: PostmanUrl | string;
  body?: PostmanBody;
}

interface PostmanItem {
  name?: string;
  request?: PostmanRequest;
  item?: PostmanItem[];
}

interface PostmanCollection {
  info?: { name?: string; schema?: string };
  item?: PostmanItem[];
}

const VALID_METHODS: Set<string> = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']);

function resolveUrl(url: PostmanUrl | string | undefined): string {
  if (!url) return '';
  if (typeof url === 'string') return url;
  if (url.raw) return url.raw;
  const host = url.host?.join('.') ?? '';
  const path = url.path?.join('/') ?? '';
  const protocol = url.protocol ?? 'https';
  return host ? `${protocol}://${host}/${path}` : `/${path}`;
}

function formatBody(raw: string | undefined): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

function flattenItems(
  items: PostmanItem[],
  nodes: CoreApiNode[],
  edges: CoreFlowEdge[],
  yOffset: { value: number },
): void {
  const levelNodeIds: string[] = [];

  for (const item of items) {
    if (item.request) {
      const req = item.request;
      const rawMethod = (req.method ?? 'GET').toUpperCase();
      const method: HttpMethod = VALID_METHODS.has(rawMethod)
        ? (rawMethod as HttpMethod)
        : 'GET';

      const url = resolveUrl(req.url);

      const headers: KeyValuePair[] = (req.header ?? []).map((h) => ({
        key: h.key,
        value: h.value,
        enabled: !h.disabled,
      }));

      const body = formatBody(req.body?.raw);

      const id = generateNodeId();
      nodes.push({
        id,
        type: 'apiNode',
        position: { x: 200, y: yOffset.value },
        data: {
          label: item.name ?? `${method} ${url}`,
          config: {
            method,
            url,
            headers: headers.length > 0 ? headers : [{ key: '', value: '', enabled: true }],
            params: [],
            body,
          },
        },
      });

      levelNodeIds.push(id);
      yOffset.value += 200;
    }

    if (item.item) {
      flattenItems(item.item, nodes, edges, yOffset);
    }
  }

  // Create sequential edges between items at this level
  for (let i = 0; i < levelNodeIds.length - 1; i++) {
    edges.push({
      id: generateEdgeId(levelNodeIds[i], levelNodeIds[i + 1]),
      source: levelNodeIds[i],
      target: levelNodeIds[i + 1],
    });
  }
}

export function parsePostmanCollection(content: string): { nodes: CoreApiNode[]; edges: CoreFlowEdge[] } {
  const collection: PostmanCollection = JSON.parse(content);

  if (!collection.info || !collection.item) {
    throw new Error('Invalid Postman collection: missing "info" or "item" fields');
  }

  const nodes: CoreApiNode[] = [];
  const edges: CoreFlowEdge[] = [];
  const yOffset = { value: 0 };

  flattenItems(collection.item, nodes, edges, yOffset);

  return { nodes, edges };
}
