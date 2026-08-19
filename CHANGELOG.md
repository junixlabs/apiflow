# Changelog

All notable changes to API View are documented here.

---

## [Unreleased]

### Added — dependency map (the read half)

- `.apimap` format (`src/core/apimap.ts`): screens, endpoints, fields and the edges between them.
  Ids derive from content and no timestamp is written, so re-scanning an unchanged repo produces a
  byte-identical file. Positions are **not** stored — a generated map is laid out at render time.
- `apiflow scan-fe <dir>` — deterministic, framework-agnostic scanner. Finds HTTP call sites,
  normalizes urls onto endpoints, attributes them to a screen (file-based route, else the enclosing
  component) and traces which response fields are read. Every edge carries `exact`/`inferred`/`guess`
  and a `file:line`; what it cannot resolve goes to an Unresolved list rather than being dropped.
- `apiflow impact <map.apimap> --endpoint=… | --field=…` — answers "which screens break if this
  changes", which is the question the whole product exists for.
- `--hints=<file>` — the agent-resolvable half. `skills/fe-map-extractor/` reads the Unresolved list,
  works out what a variable url really is, and feeds it back as hints; ids stay derived by code.

### Added — provider half, and the join

- `apiflow scan-be <dir>` — deterministic backend scanner. Routes, request payloads and response
  shapes from **code**, per stack: Laravel (`Route::verb`, `Route::resource` expanded to 5, group
  prefixes, FormRequest `rules()`, API Resource `toArray()`), NestJS/Express (`@Controller`+`@Get`,
  Zod, class-validator DTO), Go (gin/chi/echo/fiber/`HandleFunc`+`.Methods()`, struct `json:` tags),
  Python (FastAPI/Flask, Pydantic, `response_model=`). A generic pass runs on every file too, so a
  sidecar in another language is not lost. Cross-file: a route naming `UserController@store` is
  followed into the controller, then into its FormRequest and Resource.
- `apiflow probe <map> --emit` / `--ingest=` — **response shapes confirmed against reality**.
  Emits a test in the project's *own* runner (PHPUnit+`RefreshDatabase`, vitest+supertest, Go
  `httptest`, pytest+`TestClient`) so the probe runs on the test database and never touches real
  rows. Ingest merges observed shapes, marks each field `declared` / `observed`, and reports
  **fields declared in code that the running API never sent**. Only 2xx bodies are learned from —
  an error envelope is not a contract.
- `apiflow link <fe.apimap> <be.apimap>` — joins the two halves on `METHOD + normalized path`, with
  suffix matching for a gateway prefix only the frontend sees. Unlocks three questions neither half
  could answer alone: fields the API sends that no screen reads, fields declared but never sent, and
  endpoints no screen calls.
- `skills/be-map-extractor/` — the judgement layer: wire the probe harness into the project's own
  fixtures/auth, and classify each declared-but-never-sent field as bug, conditional, or scanner miss.

### Added — caller hop (screen attribution)

- `src/core/callerGraph.ts` — import graph over the frontend: named/default/namespace imports (type
  imports excluded), local declarations, and intra-file uses. `scan-fe` now walks a call site in an
  api module back through hooks and components to the file-based route that renders it, and records
  the hop count on the screen.
  Without it the answer to "which screen breaks" was the name of an api module. On a real Next.js
  app: **13/203 → 254/321 call sites attributed to a real route**.
  Members are tracked, so `agentsApi.remove` and `agentsApi.list` do not fan out to each other's
  screens. Confidence only ever drops across a hop, and never claims exact.
- Import specifiers resolve through `tsconfig`/`jsconfig` path aliases (`@/*`), relative paths,
  extension guessing and `index.*`.

### Changed

- `.apimap` fields now carry `kind` (`request`/`response`), `type`, and independent `declared` /
  `observed` flags, plus `declaredAs` when a wrapper (`{data: …}`) renames the observed path.
- FE scanner follows callback parameters: `rows.data.map(u => u.email)` now traces `data.email`.
  Without it every list screen traced nothing and the link audit called live fields dead.

### Added — tests

- vitest, and 90 tests over `src/core/` (apimap, feScanner, executor, assertionRunner,
  variableResolver, topologicalSort, all three parsers, curl exporter, beScanner, shape, probe harness, link).

### Removed

- Loop node. The executor treated it as a pass-through while shipping a full config UI; a headline
  feature that does not run is worse than an absent one. Gone from executor, canvas, inspector,
  toolbar, store and types.

### Fixed

- `apiflow` (serve mode) builds `dist/` on demand instead of exiting — a git clone had no way to run
  the documented first command.
- `proxy/` and `src/mcp/` are now type-checked (`tsconfig.node.json`), which surfaced and fixed an
  unchecked `res.json()` cast in `httpClient` and dead code in the proxy.

### Internal

- E2E pipeline dispatch smoke test marker (ISS-5).

---

## [0.4.0] - 2026-03-20

### Phase 4: Claude Code Integration

**Core Engine Separation:**
- Extracted pure TypeScript engine into `src/core/` (11 modules) — no React, Zustand, or DOM dependencies
- Core modules: executor, variableResolver, topologicalSort, assertionRunner, httpClient, curlParser, curlExporter, openApiParser, postmanParser, idGenerator, types
- Existing `src/engine/` and `src/utils/` now re-export from core — zero breaking changes for UI code
- Added `sendRequestDirect()` in httpClient for Node.js environments (bypasses CORS proxy)
- Executor refactored to callback-based pattern (`ExecutionCallbacks` interface)

**MCP Server:**
- MCP server at `src/mcp/` using `@modelcontextprotocol/sdk` with stdio transport
- 12 tools: `load_flow`, `save_flow`, `list_nodes`, `add_node`, `update_node`, `delete_node`, `connect_nodes`, `run_node`, `run_flow`, `set_environment`, `export_curl`, `import_collection`
- 3 resources: `apiview://flow/state`, `apiview://flow/results`, `apiview://flow/environments`
- In-memory state manager (`McpState`) replaces Zustand for MCP context
- Run with: `npm run dev:mcp` or `claude mcp add apiflow -- npx tsx src/mcp/server.ts`

**Laravel Analyzer Skill:**
- Claude Code skill at `skills/api-flow-analyzer/skill.md`
- Analyzes Laravel routes, controllers, services, FormRequest validation rules
- Generates `.apiview` flow files grouped by controller/resource
- Includes CRUD template at `skills/api-flow-analyzer/templates/laravel-crud.json`

**Project Overview Dashboard:**
- Dashboard view accessible from toolbar
- Flow result cards with pass/fail status, node count, duration
- Batch run: execute all saved flows with progress tracking
- Summary stats: total, passed, failed, not run
- Sort by name, status, or date

---

## [0.3.0] - 2026-03-20

### Phase 3: Integration & Advanced

**Import/Export:**
- OpenAPI 3.x import (JSON/YAML) — auto-detect format, extract endpoints with headers/params/body examples
- Postman collection v2.x import — recursive folder traversal, URL resolution, header/body mapping
- Export to Postman collection v2.1 JSON with environment variables
- Export cURL commands: per-node (copy button in inspector) + all nodes (toolbar menu)

**Test Assertions:**
- 4 assertion types: status_equals, body_contains, jsonpath_match, header_exists
- Per-node assertion editor in Config tab with type dropdown, target/expected inputs
- Green/red badge on canvas nodes showing assertion pass/fail
- Assertions run automatically after each node execution

**Response Diff:**
- Diff tab in inspector comparing previous vs current run
- Color-coded: green (added), red (removed), yellow (changed)
- Compares status, headers, and body

**Request History:**
- History tab in inspector showing last 10 runs per node
- Each entry: timestamp, status badge, duration, size
- Expandable with full response body (JsonTreeView)
- Clear history per node

**Theme:**
- Dark/Light theme toggle in toolbar
- CSS variable-based theming with `[data-theme]` attribute
- Persisted to localStorage, flash-free on reload (inline script)

**MiniMap:**
- ReactFlow MiniMap in bottom-right of canvas
- Node coloring by type (API=blue, annotation=gray, group=dark)

**Environment Quick-Switch:**
- Dropdown in toolbar showing all environments
- Active environment with green indicator
- One-click switch

---

## [0.2.0] - 2026-03-19

### Phase 2: Developer Experience

**Dynamic Variables:**
- `{{nodes["Node Name"].response.body.path}}` syntax to chain responses between nodes
- `getValueByPath` helper supports dot-path navigation with array indexing `[0]`
- Resolution order: node variables first, environment variables second

**Variable Autocomplete:**
- Dropdown on typing `{{` in URL and body fields
- Suggestions from environment variables and node response paths (depth 3)
- Keyboard navigation: arrows, Enter to select, Escape to close

**cURL Import:**
- Paste cURL from browser DevTools
- Parses -X, -H, -d/--data-raw, -u (Basic auth), multi-line continuations
- Auto-formats JSON body on import
- Handles unknown flags gracefully

**Step-by-Step Execution:**
- Run flow level by level with "Step Through" mode
- "Next Step" button shows progress (current/total)
- Stop stepping at any point

**Canvas Enhancements:**
- Annotation nodes: double-click to edit text, Ctrl+Enter to save
- Group frame nodes: resizable dashed rectangle with title
- Node description/notes field with icon indicator on canvas

**Export:**
- Canvas export to PNG and SVG via html-to-image
- Controls excluded from export

**Flow Library:**
- Grid view of saved flows in localStorage
- Search by name, sort by date
- Actions: open, duplicate, delete

**Auto-save:**
- Draft saved to localStorage every 30 seconds
- Restore banner on reload if unsaved draft found

**Undo/Redo:**
- History stack (50 max) for structural operations
- Tracked: add/delete node, connect, edge delete, node drag
- Toolbar buttons + Ctrl+Z / Ctrl+Shift+Z

**Keyboard Shortcuts:**
- Ctrl+Z Undo, Ctrl+Shift+Z Redo, Ctrl+S Save, Ctrl+O Open
- Ctrl+Enter Run All, Ctrl+I Import cURL, Escape deselect/close
- Platform-aware hints (Cmd on macOS)

**Inspector Panel:**
- Resizable 320-800px with drag handle
- Width persisted to localStorage

**JSON Viewer:**
- Tree/Raw toggle (default Raw)
- Search/filter with match highlighting
- Copy JSONPath on hover ($ button per row)
- Expand/Collapse all
- Collapsed preview (first 3 keys for objects)
- Full-screen expand modal with line numbers
- Copy to clipboard

**Body JSON Editor:**
- Real-time validation (valid/invalid/has-vars)
- Format (pretty-print) and Minify buttons — variable-aware
- Tab key inserts 2 spaces
- Full-screen expand modal with line numbers and synced scroll

**KeyValueEditor:**
- Ghost row auto-adds when typing in last row
- Bulk edit mode: paste Key: Value per line
- 35/65 key/value column ratio

---

## [0.1.0] - 2026-03-19

### Phase 1: MVP

- React 19 + @xyflow/react 12 + Zustand 5 + Vite 8 + Tailwind 4 + TypeScript 5.9
- Infinite canvas with zoom, pan, dot grid background
- API nodes: create (5 HTTP methods), delete, drag, method badge, URL display
- Connections: drag between node ports, bezier curves, status-colored (idle/running/success/error)
- Execution engine: Kahn's topological sort, parallel per level, stop on error
- Run All flow + Run single node
- Inspector panel: Config (method/URL/headers/params/body), Request (resolved), Response (status/headers/body/timing)
- Environment variables: multiple environments, add/delete/switch, key-value with enable/disable
- Save/Load .apiview files (File System Access API with fallback)
- CORS proxy server (Express on port 3001)
- JSON tree viewer with collapse/expand
