import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { McpState } from './state.ts';
import { coreRunSingleNode, coreRunFlow } from '../core/executor.ts';
import { sendRequestDirect } from '../core/httpClient.ts';
import { generateCurl, generateAllCurls } from '../core/curlExporter.ts';
import { parseCurl } from '../core/curlParser.ts';
import { parseOpenApiSpec } from '../core/openApiParser.ts';
import { parsePostmanCollection } from '../core/postmanParser.ts';
import type { HttpMethod, KeyValuePair, ExecutionResult } from '../core/types.ts';

const server = new McpServer({
  name: 'api-view',
  version: '0.4.0',
});

const state = new McpState();

// --- Tools ---

// Tool 0: open_project
server.tool(
  'open_project',
  'Open a project directory for API View',
  { dir: z.string().describe('Path to the project directory') },
  async ({ dir }) => {
    try {
      state.openProjectDir(dir);
      const flows = state.listProjectFlows();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              dir,
              projectName: state.projectConfig?.name ?? dir,
              flowCount: flows.length,
              flows: flows.map((f) => f.name),
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ],
      };
    }
  }
);

// Tool 1: load_flow
server.tool(
  'load_flow',
  'Load a .apiview flow file. If a project is open, filePath is the flow file name within .apiview/flows/; otherwise it is an absolute path.',
  { filePath: z.string() },
  async ({ filePath }) => {
    try {
      state.loadFromFile(filePath);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              name: state.metadata.name,
              nodeCount: state.nodes.filter((n) => n.type === 'apiNode').length,
              edgeCount: state.edges.length,
              projectMode: !!state.projectDir,
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ],
      };
    }
  }
);

// Tool 2: save_flow
server.tool(
  'save_flow',
  'Save the current flow state. If a project is open, filePath is the flow file name within .apiview/flows/; otherwise it is an absolute path.',
  { filePath: z.string() },
  async ({ filePath }) => {
    try {
      state.saveToFile(filePath);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ success: true, filePath, projectMode: !!state.projectDir }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ],
      };
    }
  }
);

// Tool 3: list_nodes
server.tool('list_nodes', 'List all API nodes in the current flow', {}, async () => {
  const apiNodes = state.nodes
    .filter((n) => n.type === 'apiNode')
    .map((n) => ({
      id: n.id,
      label: n.data.label,
      method: n.data.config.method,
      url: n.data.config.url,
    }));
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(apiNodes) }],
  };
});

// Tool 4: add_node
server.tool(
  'add_node',
  'Add a new API request node to the flow',
  {
    method: z.string(),
    url: z.string(),
    label: z.string().optional(),
    headers: z
      .array(z.object({ key: z.string(), value: z.string() }))
      .optional(),
    body: z.string().optional(),
  },
  async ({ method, url, label, headers, body }) => {
    const kvHeaders: KeyValuePair[] = headers
      ? headers.map((h) => ({ key: h.key, value: h.value, enabled: true }))
      : [{ key: '', value: '', enabled: true }];

    const node = state.addNode(
      {
        method: method.toUpperCase() as HttpMethod,
        url,
        headers: kvHeaders,
        params: [],
        body: body ?? '',
      },
      label
    );

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ nodeId: node.id, label: node.data.label }),
        },
      ],
    };
  }
);

// Tool 5: update_node
server.tool(
  'update_node',
  'Update an existing API request node',
  {
    nodeId: z.string(),
    method: z.string().optional(),
    url: z.string().optional(),
    label: z.string().optional(),
    headers: z
      .array(z.object({ key: z.string(), value: z.string() }))
      .optional(),
    body: z.string().optional(),
  },
  async ({ nodeId, method, url, label, headers, body }) => {
    try {
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);

      const configPatch: Record<string, unknown> = {};
      if (method !== undefined)
        configPatch.method = method.toUpperCase() as HttpMethod;
      if (url !== undefined) configPatch.url = url;
      if (headers !== undefined)
        configPatch.headers = headers.map((h) => ({
          key: h.key,
          value: h.value,
          enabled: true,
        }));
      if (body !== undefined) configPatch.body = body;

      state.updateNode(nodeId, {
        ...(label !== undefined ? { label } : {}),
        ...(Object.keys(configPatch).length > 0
          ? { config: { ...node.data.config, ...configPatch } }
          : {}),
      });

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify({ success: true }) },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ],
      };
    }
  }
);

// Tool 6: delete_node
server.tool(
  'delete_node',
  'Delete an API request node from the flow',
  { nodeId: z.string() },
  async ({ nodeId }) => {
    try {
      state.deleteNode(nodeId);
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify({ success: true }) },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ],
      };
    }
  }
);

// Tool 7: connect_nodes
server.tool(
  'connect_nodes',
  'Connect two nodes with a directed edge (source runs before target)',
  { sourceNodeId: z.string(), targetNodeId: z.string() },
  async ({ sourceNodeId, targetNodeId }) => {
    try {
      const edge = state.connectNodes(sourceNodeId, targetNodeId);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ edgeId: edge.id }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ],
      };
    }
  }
);

// Tool 8: run_node
server.tool(
  'run_node',
  'Execute a single API request node and return the result',
  { nodeId: z.string() },
  async ({ nodeId }) => {
    try {
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node) throw new Error(`Node not found: ${nodeId}`);

      const variables = state.getActiveVariables();
      const result = await coreRunSingleNode(
        node,
        variables,
        sendRequestDirect,
        state.getCallbacks(),
        undefined,
        state.nodeResults,
        state.nodes
      );

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ],
      };
    }
  }
);

// Tool 9: run_flow
server.tool(
  'run_flow',
  'Execute all nodes in the flow in topological order',
  {},
  async () => {
    try {
      state.resetResults();
      const variables = state.getActiveVariables();

      await coreRunFlow(
        state.nodes,
        state.edges,
        variables,
        sendRequestDirect,
        state.getCallbacks()
      );

      const summary: Record<string, { status: number; statusText: string; duration_ms: number; error?: string }> = {};
      state.nodeResults.forEach((result: ExecutionResult, nodeId: string) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        const label = node?.data.label ?? nodeId;
        summary[label] = {
          status: result.status,
          statusText: result.statusText,
          duration_ms: result.duration_ms,
          ...(result.error ? { error: result.error } : {}),
        };
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(summary) }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ],
      };
    }
  }
);

// Tool 10: set_environment
server.tool(
  'set_environment',
  'Set environment variables for request resolution',
  {
    variables: z.array(z.object({ key: z.string(), value: z.string() })),
    environmentName: z.string().optional(),
  },
  async ({ variables, environmentName }) => {
    const envName = environmentName ?? state.activeEnvironmentName;
    const kvVars: KeyValuePair[] = variables.map((v) => ({
      key: v.key,
      value: v.value,
      enabled: true,
    }));

    const existing = state.environments.find((e) => e.name === envName);
    if (existing) {
      existing.variables = kvVars;
    } else {
      state.environments.push({ name: envName, variables: kvVars });
    }
    state.activeEnvironmentName = envName;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            environmentName: envName,
            variableCount: kvVars.filter((v) => v.key).length,
          }),
        },
      ],
    };
  }
);

// Tool 11: export_curl
server.tool(
  'export_curl',
  'Export node(s) as curl command(s)',
  { nodeId: z.string().optional() },
  async ({ nodeId }) => {
    try {
      const variables = state.getActiveVariables();
      let curlOutput: string;

      if (nodeId) {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node) throw new Error(`Node not found: ${nodeId}`);
        curlOutput = generateCurl(
          node,
          variables,
          state.nodeResults,
          state.nodes
        );
      } else {
        curlOutput = generateAllCurls(
          state.nodes,
          variables,
          state.nodeResults,
          state.nodes
        );
      }

      return {
        content: [{ type: 'text' as const, text: curlOutput }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ],
      };
    }
  }
);

// Tool 12: import_collection
server.tool(
  'import_collection',
  'Import API definitions from OpenAPI spec, Postman collection, or curl command',
  {
    source: z.enum(['openapi', 'postman', 'curl']),
    content: z.string(),
  },
  async ({ source, content }) => {
    try {
      if (source === 'curl') {
        const config = parseCurl(content);
        const node = state.addNode(config);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                nodesAdded: 1,
                nodes: [{ id: node.id, label: node.data.label }],
              }),
            },
          ],
        };
      }

      let parsed: { nodes: import('../core/types.ts').CoreApiNode[]; edges: import('../core/types.ts').CoreFlowEdge[] };
      if (source === 'openapi') {
        parsed = parseOpenApiSpec(content);
      } else {
        parsed = parsePostmanCollection(content);
      }

      state.nodes.push(...parsed.nodes);
      state.edges.push(...parsed.edges);
      state.metadata.updatedAt = new Date().toISOString();

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              nodesAdded: parsed.nodes.filter((n) => n.type === 'apiNode')
                .length,
              edgesAdded: parsed.edges.length,
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        ],
      };
    }
  }
);

// --- Resources ---

server.resource('flow-state', 'apiview://flow/state', async (uri) => {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({
          nodes: state.nodes
            .filter((n) => n.type === 'apiNode')
            .map((n) => ({
              id: n.id,
              label: n.data.label,
              method: n.data.config.method,
              url: n.data.config.url,
            })),
          edges: state.edges,
          metadata: state.metadata,
        }),
      },
    ],
  };
});

server.resource(
  'execution-results',
  'apiview://flow/results',
  async (uri) => {
    const results: Record<string, ExecutionResult> = {};
    state.nodeResults.forEach((v, k) => {
      results[k] = v;
    });
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(results),
        },
      ],
    };
  }
);

server.resource(
  'environments',
  'apiview://flow/environments',
  async (uri) => {
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({
            environments: state.environments,
            activeEnvironmentName: state.activeEnvironmentName,
          }),
        },
      ],
    };
  }
);

// --- Start server ---
const transport = new StdioServerTransport();
await server.connect(transport);
