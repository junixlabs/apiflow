import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  findText,
  impactEndpointText,
  impactFieldText,
  mapCheckText,
  mapHealthText,
  mapListText,
  resolveTarget,
  screenDepsText,
} from './mapTools';

// cm:edge contract -> src/mcp/server.ts — two separate servers on purpose: that one is the request
// RUNNER (flows, envs, execute) and pulls the run half of the repo in. This one only reads .apimap,
// so it stays on the map side of the boundary in .dependency-cruiser.cjs.
const server = new McpServer({ name: 'apiflow-map', version: '1.1.0' });

const text = (body: string) => ({ content: [{ type: 'text' as const, text: body }] });
// cm:guard Errors come back as tool text with isError, never thrown: a thrown error inside a tool
// handler takes the whole stdio server down, and the agent loses the session over a typo in a route.
const guard = (fn: () => string) => {
  try {
    return text(fn());
  } catch (err) {
    return { content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
  }
};

const WHERE = {
  project: z.string().optional().describe('id project trong workspace (apiflow project ls)'),
  map: z.string().optional().describe('path to a specific .apimap file, instead of a project'),
};

server.tool(
  'impact_endpoint',
  'Which screens break if this endpoint changes. Returns each screen with the file:line of the call.',
  {
    endpoint: z.string().describe('e.g. "PATCH /projects/:id/policy", or just part of the path'),
    verbose: z.boolean().optional().describe('include the client → hook → component → screen chain'),
    ...WHERE,
  },
  ({ endpoint, verbose, project, map }) => guard(() => impactEndpointText(resolveTarget(project, map), endpoint, verbose === true))
);

server.tool(
  'impact_field',
  'Which screens break if this response field changes.',
  { field: z.string().describe('field name, e.g. "email" or "data.items.status"'), ...WHERE },
  ({ field, project, map }) => guard(() => impactFieldText(resolveTarget(project, map), field))
);

server.tool(
  'screen_deps',
  'Which endpoints one screen depends on.',
  { route: z.string().describe('the screen route, e.g. "/users/:id"'), ...WHERE },
  ({ route, project, map }) => guard(() => screenDepsText(resolveTarget(project, map), route))
);

server.tool(
  'find',
  'Find an endpoint / screen / field by a fragment, to learn the exact name before asking for impact.',
  { q: z.string().describe('a path fragment, a route name or a field name'), ...WHERE },
  ({ q, project, map }) => guard(() => findText(resolveTarget(project, map), q))
);

server.tool(
  'map_health',
  'The project map: counts, both-sides reconciliation, alerts, and the latest scan.',
  { ...WHERE },
  ({ project, map }) => guard(() => mapHealthText(resolveTarget(project, map)))
);

server.tool(
  'map_check',
  'Is the map still true to the code: re-scan and compare. Slow (seconds to tens of seconds) — call it only when it matters whether the map is stale.',
  { side: z.enum(['fe', 'be']).optional().describe('default: the side inferred from the map itself'), ...WHERE },
  ({ side, project, map }) => guard(() => mapCheckText(resolveTarget(project, map), side))
);

server.tool('map_list', 'The projects in the workspace and the maps that exist.', {}, () => guard(mapListText));

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
