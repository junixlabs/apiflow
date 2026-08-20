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
  map: z.string().optional().describe('đường dẫn tới một file .apimap cụ thể, thay cho project'),
};

server.tool(
  'impact_endpoint',
  'Đổi một endpoint thì màn hình nào vỡ. Trả về từng màn kèm file:line của lời gọi.',
  {
    endpoint: z.string().describe('ví dụ "PATCH /projects/:id/policy" hoặc chỉ một phần đường dẫn'),
    verbose: z.boolean().optional().describe('kèm chuỗi client → hook → component → màn'),
    ...WHERE,
  },
  ({ endpoint, verbose, project, map }) => guard(() => impactEndpointText(resolveTarget(project, map), endpoint, verbose === true))
);

server.tool(
  'impact_field',
  'Đổi một field trong response thì màn hình nào vỡ.',
  { field: z.string().describe('tên field, ví dụ "email" hoặc "data.items.status"'), ...WHERE },
  ({ field, project, map }) => guard(() => impactFieldText(resolveTarget(project, map), field))
);

server.tool(
  'screen_deps',
  'Một màn hình phụ thuộc những endpoint nào.',
  { route: z.string().describe('route của màn, ví dụ "/users/:id"'), ...WHERE },
  ({ route, project, map }) => guard(() => screenDepsText(resolveTarget(project, map), route))
);

server.tool(
  'find',
  'Tìm endpoint / màn hình / field theo một mẩu chuỗi, để biết tên chính xác trước khi hỏi impact.',
  { q: z.string().describe('một mẩu đường dẫn, tên route hoặc tên field'), ...WHERE },
  ({ q, project, map }) => guard(() => findText(resolveTarget(project, map), q))
);

server.tool(
  'map_health',
  'Bản đồ của project: số liệu, đối chiếu hai phía, alert, và lần scan gần nhất.',
  { ...WHERE },
  ({ project, map }) => guard(() => mapHealthText(resolveTarget(project, map)))
);

server.tool(
  'map_check',
  'Bản đồ còn đúng với code không: scan lại rồi so. Chậm (giây tới chục giây) — chỉ gọi khi cần biết map có mốc.',
  { side: z.enum(['fe', 'be']).optional().describe('mặc định: phía suy từ chính bản đồ'), ...WHERE },
  ({ side, project, map }) => guard(() => mapCheckText(resolveTarget(project, map), side))
);

server.tool('map_list', 'Các project trong workspace và bản đồ đã có.', {}, () => guard(mapListText));

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
