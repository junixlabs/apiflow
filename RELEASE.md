# API View v0.4.0 — Release Notes

**Release Date:** 2026-03-20

API View is a lightweight, local-first visual API flow testing tool for backend developers.

---

## What's New in v0.4.0

### Claude Code Integration (Phase 4)
- **MCP Server** — Connect Claude Code to API View via 12 MCP tools. Create flows, add nodes, run requests, inspect results — all from the CLI.
- **Laravel Analyzer Skill** — Auto-analyze Laravel codebase and generate .apiview flow files from routes, controllers, and validation rules.
- **Project Dashboard** — Overview of all saved flows with batch run, pass/fail status, and per-node result drill-down.

### Import & Export (Phase 3)
- **OpenAPI 3.x import** — Drop in a Swagger spec (JSON/YAML) and get all endpoints as nodes.
- **Postman collection import** — Import Postman v2.x collections with headers, body, and folder structure.
- **Export to Postman** — Convert any flow to a Postman collection JSON.
- **Export cURL** — Copy cURL for a single node or all nodes at once.

### Testing & Debugging (Phase 3)
- **Test Assertions** — Add assertions per node: status code, body contains, JSONPath match, header exists. Green/red badges show pass/fail on canvas.
- **Response Diff** — Compare two consecutive runs to see what changed.
- **Request History** — Browse last 10 runs per node with full response details.

### Theme & Navigation (Phase 3)
- **Dark/Light theme** — Toggle in toolbar, persists across sessions.
- **MiniMap** — Bird's eye view of large flows.
- **Environment quick-switch** — One-click dropdown to change active environment.

---

## Complete Feature List

### Canvas
- Infinite zoom/pan canvas with dot grid
- API nodes with method badge, URL, status indicator, description icon, assertion badge
- Annotation nodes (editable text)
- Group frame nodes (resizable with title)
- Drag-and-drop connections with status-colored edges
- MiniMap overview
- Export to PNG/SVG

### Inspector (5 tabs)
- **Config** — Label, description, method/URL, headers (bulk edit), params, body (JSON editor with validation/format/minify/expand), assertions
- **Request** — Resolved URL/headers/body after variable substitution
- **Response** — Status, timing, size, headers (collapsible), body (Tree/Raw/search/expand)
- **Diff** — Side-by-side comparison of consecutive runs
- **History** — Timeline of last 10 runs per node

### JSON Viewer (used everywhere)
- Tree / Raw toggle (default: Raw with line numbers)
- Search/filter with match highlighting
- Copy JSONPath on hover
- Expand/Collapse all
- Full-screen expand modal
- Copy to clipboard

### Execution
- Run All (parallel per topological level)
- Run Single Node
- Step-by-step mode (level by level)
- Stop/cancel at any time
- Dynamic variables: `{{nodes["Name"].response.body.path}}`
- Environment variables: `{{variable_name}}`
- Variable autocomplete on `{{`

### Flow Management
- Save/Load .apiview files
- Flow Library (localStorage) with search, duplicate, delete
- Auto-save draft every 30s with restore on reload
- Undo/Redo (50 history max)
- Import: cURL, OpenAPI 3.x, Postman v2.x
- Export: PNG, SVG, Postman collection, cURL commands

### Project Dashboard
- Overview of all saved flows
- Batch run all flows
- Pass/fail status per flow
- Expandable per-node results

### MCP Server (Claude Code)
- 12 tools: load_flow, save_flow, list_nodes, add_node, update_node, delete_node, connect_nodes, run_node, run_flow, set_environment, export_curl, import_collection
- 3 resources: flow state, execution results, environments
- stdio transport, run via `npm run dev:mcp`

### Other
- Dark/Light theme (persisted)
- Keyboard shortcuts (Ctrl+Z/Shift+Z/S/O/Enter/I, Escape)
- Resizable inspector panel (persisted)
- CORS proxy server
- Multiple environments with quick-switch

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19.2, @xyflow/react 12.8 |
| State | Zustand 5.0 (7 stores) |
| Build | Vite 8.0, TypeScript 5.9 |
| Styling | Tailwind CSS 4.1 |
| Canvas Export | html-to-image |
| OpenAPI | js-yaml |
| MCP | @modelcontextprotocol/sdk |
| Proxy | Express 5.1 |

## Stats

| Metric | Value |
|--------|-------|
| Source files | 71 |
| Core engine modules | 11 |
| React components | 30 |
| Zustand stores | 9 |
| MCP tools | 12 |
| MCP resources | 3 |
| JS bundle (gzipped) | ~157 KB |
| CSS bundle (gzipped) | ~9 KB |

---

## Getting Started

```bash
# Install
npm install

# Development (Web UI + proxy)
npm run dev

# MCP Server (for Claude Code)
npm run dev:mcp

# Build
npm run build
```

### Connect to Claude Code
```bash
claude mcp add api-view -- npx tsx /path/to/api-view/src/mcp/server.ts
```
