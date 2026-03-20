import yaml from 'js-yaml';
import type { CoreApiNode, CoreFlowEdge, KeyValuePair, HttpMethod } from './types';
import { generateNodeId, generateEdgeId } from './idGenerator';

interface OpenApiParameter {
  name: string;
  in: string;
  schema?: OpenApiSchema;
  example?: unknown;
}

interface OpenApiSchema {
  type?: string;
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  example?: unknown;
  default?: unknown;
  enum?: unknown[];
}

interface OpenApiRequestBody {
  content?: Record<string, { schema?: OpenApiSchema }>;
}

interface OpenApiOperation {
  operationId?: string;
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
}

interface OpenApiServer {
  url: string;
}

interface OpenApiPathItem {
  parameters?: OpenApiParameter[];
  [method: string]: OpenApiOperation | OpenApiParameter[] | undefined;
}

interface OpenApiSpec {
  openapi: string;
  servers?: OpenApiServer[];
  paths?: Record<string, OpenApiPathItem>;
}

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch'] as const;

function generateExampleFromSchema(schema: OpenApiSchema | undefined): unknown {
  if (!schema) return '';

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];

  switch (schema.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      return [generateExampleFromSchema(schema.items)];
    case 'object': {
      if (!schema.properties) return {};
      const obj: Record<string, unknown> = {};
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        obj[key] = generateExampleFromSchema(propSchema);
      }
      return obj;
    }
    default:
      return '';
  }
}

function parseContent(content: string): OpenApiSpec {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = yaml.load(content);
  }
  return parsed as OpenApiSpec;
}

export function parseOpenApiSpec(content: string): { nodes: CoreApiNode[]; edges: CoreFlowEdge[] } {
  const spec = parseContent(content);

  if (!spec.openapi || !spec.openapi.startsWith('3.')) {
    throw new Error('Only OpenAPI 3.x specifications are supported');
  }

  const baseUrl = spec.servers?.[0]?.url ?? '';
  const nodes: CoreApiNode[] = [];
  const edges: CoreFlowEdge[] = [];

  if (!spec.paths) {
    return { nodes, edges };
  }

  let index = 0;
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const httpMethod of HTTP_METHODS) {
      const operation = pathItem[httpMethod] as OpenApiOperation | undefined;
      if (!operation) continue;

      const method = httpMethod.toUpperCase() as HttpMethod;
      const label = operation.operationId ?? `${method} ${path}`;

      const headers: KeyValuePair[] = [];
      const params: KeyValuePair[] = [];

      const allParameters = [
        ...(pathItem.parameters ?? []),
        ...(operation.parameters ?? []),
      ] as OpenApiParameter[];

      for (const param of allParameters) {
        const pair: KeyValuePair = {
          key: param.name,
          value: param.example != null ? String(param.example) : '',
          enabled: true,
        };
        if (param.in === 'header') {
          headers.push(pair);
        } else if (param.in === 'query') {
          params.push(pair);
        }
      }

      let body = '';
      if (operation.requestBody?.content) {
        const jsonContent = operation.requestBody.content['application/json'];
        if (jsonContent?.schema) {
          const example = generateExampleFromSchema(jsonContent.schema);
          body = JSON.stringify(example, null, 2);
        }
      }

      const id = generateNodeId();
      nodes.push({
        id,
        type: 'apiNode',
        position: { x: 200, y: index * 200 },
        data: {
          label,
          config: {
            method,
            url: `${baseUrl}${path}`,
            headers: headers.length > 0 ? headers : [{ key: '', value: '', enabled: true }],
            params,
            body,
          },
        },
      });

      index++;
    }
  }

  // Create sequential edges
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: generateEdgeId(nodes[i].id, nodes[i + 1].id),
      source: nodes[i].id,
      target: nodes[i + 1].id,
    });
  }

  return { nodes, edges };
}
