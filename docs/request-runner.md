# Request runner — the other half

The visual flow runner: build a graph of requests, chain data between them, assert on responses.
It works, and it is **deliberately second in line** behind the dependency map — see
[`NORTH-STAR.md`](../NORTH-STAR.md) §3 for why. Nothing here imports the map half, and the
`npm run boundary` gate keeps it that way.

```bash
npx @junixlabs/apiflow                          # canvas + proxy
npx @junixlabs/apiflow --project=/path/to/repo   # flows stored in <repo>/.apiview/
npm run dev                                     # from a clone, with hot reload
node bin/cli.js mcp run                         # 13 MCP tools for an agent
```

## What it does

| | |
|---|---|
| **Visual canvas** | drag-and-drop API nodes on an infinite canvas |
| **Response chaining** | `{{nodes["Get User"].response.body.id}}` passes data between requests |
| **Assertions** | four kinds — `status_equals`, `body_contains`, `jsonpath_match`, `header_exists` — with pass/fail badges on the node |
| **Conditional branching** | if/else nodes route on status or body content, so upsert patterns (GET → PUT else POST) are one flow |
| **Retry with backoff** | per node, with the status codes that should be retried |
| **Per-node auth** | Bearer, Basic or API key, different per node in the same flow |
| **Environments** | Local / Staging / Production base URLs and credentials, switched in one click |
| **Endpoint library** | configure an endpoint once, drag it into any flow |
| **Step-by-step run** | run level by level and inspect between steps |
| **Response diff** | compare consecutive runs of a node |
| **History** | the last 10 runs per node, with full responses |
| **Dashboard** | batch-run every saved flow, pass/fail at a glance |
| **Import** | cURL (paste from DevTools) · OpenAPI 3.x (JSON/YAML) · Postman collections |
| **Export** | PNG / SVG of the canvas · Postman collection · cURL per node or for the whole flow |
| **Theme** | dark / light, persisted |

Flows are JSON in `.apiview/` next to your code — commit them, review them in pull requests. See
[`formats.md`](formats.md).

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+S` | Save |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo |
| `Ctrl+O` | Open / Library |
| `Ctrl+Enter` | Run all |
| `Ctrl+I` | Import cURL |
| `Escape` | Deselect / close |
| `Delete` | Delete selected node |

## MCP tools (`mcp run`)

`open_project` · `load_flow` · `save_flow` · `list_nodes` · `add_node` · `update_node` ·
`delete_node` · `connect_nodes` · `run_node` · `run_flow` · `set_environment` · `export_curl` ·
`import_collection`

This is a different server from `mcp map`, on purpose: that one only reads `.apimap` and stays
headless, this one executes requests.

## Stack

| Layer | Technology |
|---|---|
| UI | React 19, @xyflow/react 12 |
| State | Zustand 5 |
| Styling | Tailwind CSS 4 |
| Build | Vite 8, TypeScript 5.9 |
| Proxy | Express 5 |
| MCP | @modelcontextprotocol/sdk |
