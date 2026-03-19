# API View — Master Roadmap (Updated 2026-03-19)

## Status Overview

| Phase | Status | Key Deliverables |
|-------|--------|-----------------|
| Phase 1: MVP | DONE | Canvas, nodes, connections, inspector, proxy, execution engine, env variables, save/load |
| Phase 2: DX | DONE | Dynamic vars, autocomplete, cURL import, step execution, undo/redo, annotations, export, auto-save, library, shortcuts, JSON UX overhaul |
| Phase 3: Integration | NEXT | OpenAPI/Postman import/export, assertions, response diff, request history, theme, minimap |
| Phase 4: Claude Code | PLANNED | MCP server, Laravel analyzer skill, project overview dashboard |

---

## Phase 1: MVP — DONE

v0.1.0 — Core Flow & Inspection

- Project setup (React 19 + ReactFlow 12 + Vite 8 + Zustand 5 + Tailwind 4)
- Canvas: zoom, pan, grid background, custom node/edge types
- API Node: create, delete, move, display method/URL
- Node Config Panel: method, URL, headers, params, body editor
- Connections: drag-and-drop between nodes
- Execution Engine: topological sort, sequential/parallel run per level
- Response Inspector: JSON tree view, status badges, timing
- Environment variables (key-value, multiple environments, switch)
- Save/Load flow (.apiview JSON files)
- CORS Proxy server (Express on port 3001)

---

## Phase 2: Developer Experience — DONE

v0.2.0 — Daily workflow polish

### Planned Features (all delivered)
1. Dynamic variables `{{nodes["X"].response.body.field}}` — chain responses between nodes
2. Variable autocomplete — dropdown suggestions for env vars + node response paths
3. cURL import — paste from DevTools, auto-format JSON body
4. Step-by-step execution — run flow level by level with inspect between steps
5. Canvas annotations — editable text nodes, no handles
6. Canvas group frames — resizable dashed rectangles with title
7. Node description/notes — optional notes field, icon on canvas
8. Export canvas PNG/SVG — via html-to-image
9. Flow Library — localStorage grid view with search, open, duplicate, delete
10. Auto-save — 30s interval draft to localStorage, restore banner on reload
11. Undo/Redo — history stack (50 max), structural operations tracked
12. Keyboard shortcuts — Ctrl+Z/Y, Ctrl+S, Ctrl+O, Ctrl+Enter, Ctrl+I, Escape

### Additional UX Improvements (beyond original plan)
13. **Resizable inspector panel** — drag handle, 320-800px, width persisted to localStorage
14. **JSON Tree Viewer overhaul** — Tree/Raw toggle, copy, search/filter, expand/collapse all, copy JSONPath on hover, collapsed preview (key names), line numbers in raw view, full-screen expand modal
15. **Body JSON editor** — real-time validation, Format/Minify (variable-aware), Tab inserts spaces, full-screen modal with line numbers, expand button
16. **KeyValueEditor improvements** — ghost row auto-add, bulk edit mode (paste Key: Value lines), 35/65 key/value column ratio
17. **Response/Request tabs** — collapsible headers, non-JSON body fallback (text/null), body type labels, copy body button, full-screen expand on any JSON viewer
18. **Default Raw JSON view** — all JsonTreeView instances default to Raw mode

### Files Created (14 new)
```
src/hooks/useVariableAutocomplete.ts
src/hooks/useKeyboardShortcuts.ts
src/components/canvas/AnnotationNode.tsx
src/components/canvas/GroupNode.tsx
src/components/toolbar/ImportCurlModal.tsx
src/components/library/FlowLibrary.tsx
src/components/library/FlowCard.tsx
src/components/shared/VariableAutocomplete.tsx
src/components/shared/ShortcutHint.tsx
src/store/historyStore.ts
src/store/libraryStore.ts
src/utils/curlParser.ts
src/utils/canvasExport.ts
src/utils/autoSave.ts
```

### Dependencies Added (1)
- `html-to-image` — canvas export

---

## Phase 3: Integration & Advanced — NEXT

v0.3.0 — Tool ecosystem integration

**Prerequisite:** Phase 2 complete (DONE)
**Estimate:** ~35h (5-6 days)

### Notes on Already-Done Items
- **Multiple environments** — Already exists in Phase 1 (add/delete/switch). Phase 3 scope: improve UX with quick switch toolbar widget, env indicator per node, env-specific variable highlighting.
- **Mini-map** — ReactFlow has built-in `<MiniMap>` component, just needs wiring.

### Deliverables

| # | Feature | Est. | Details |
|---|---------|------|---------|
| 1 | OpenAPI/Swagger import | 6h | Parse OpenAPI 3.0 spec → create nodes per endpoint, group by tag |
| 2 | Postman collection import | 4h | Parse Postman v2.1 JSON → nodes + folders → connections |
| 3 | Export → Postman collection | 3h | Convert flow to Postman-compatible JSON with environments |
| 4 | Export → cURL commands | 2h | Generate resolved cURL for each node (with current env vars) |
| 5 | Test assertions | 6h | Per-node assertions: status code equals, body contains, JSONPath match, header exists. Green/red badge on node |
| 6 | Response diff | 5h | Compare 2 run results for same node: highlight changed fields, added/removed keys |
| 7 | Request history per node | 3h | Store last N results per node, timeline view in inspector, compare any 2 |
| 8 | Dark/Light theme | 3h | CSS variables toggle, persist preference, auto-detect system preference |
| 9 | Mini-map | 1h | ReactFlow `<MiniMap>` component, toggle visibility |
| 10 | Environment quick switch | 2h | Toolbar dropdown shows env name prominently, switch without opening panel |

### Dependency Graph
```
Independent (can parallel):
  - OpenAPI import (#1)
  - Postman import (#2)
  - Dark/Light theme (#8)
  - Mini-map (#9)
  - Env quick switch (#10)

Sequential:
  #1 (OpenAPI) + #2 (Postman) → #3 (Export Postman) → #4 (Export cURL)
  #5 (Assertions) → #6 (Response diff) → #7 (Request history)
```

### Suggested Chunks

| Chunk | Features | Est. |
|-------|----------|------|
| A | OpenAPI import + Postman import | 10h |
| B | Export Postman + Export cURL | 5h |
| C | Test assertions + Response diff | 11h |
| D | Request history + Theme + Minimap + Env switch | 9h |

**Critical path:** A → B (exports need imports working first)
**Parallel:** C and D can run alongside A/B

### Definition of Done
- Import OpenAPI spec → nodes created with correct method/URL/headers
- Import Postman collection → nodes + connections match original
- Assertions: set status=200 assertion → run → green/red badge shows
- Switch Dark/Light theme → all UI elements update correctly

---

## Phase 4: Claude Code Integration — PLANNED

v0.4.0 — AI-powered workflow automation

**Prerequisite:** Phase 3 complete
**Estimate:** ~13-15 days

### Phase 4a: MCP Server (~5 days)
- Separate Core Engine from UI (`src/core/` — pure TypeScript)
- MCP Server with stdio transport (`@modelcontextprotocol/sdk`)
- 12 MCP tools: create_flow, add_node, configure_node, connect_nodes, run_flow, run_node, inspect_node, list_flows, open_flow, delete_flow, export_flow, open_ui
- 3 MCP resources: flow://current, flow://results, flow://{name}

### Phase 4b: Laravel Analyzer Skill (~5-7 days)
- Claude Code skill that reads Laravel codebase
- Parse routes → controllers → services → models → requests
- Generate .apiview flow files per workflow
- Test on real Laravel projects

### Phase 4c: Project Overview Dashboard (~3 days)
- Dashboard page with all flows, status badges, last run time
- API coverage report (routes in codebase vs flows)
- Batch run + summary
- Flow dependency view

See [../architecture/mcp-architecture.md](../architecture/mcp-architecture.md) and [claude-code-integration.md](claude-code-integration.md) for full details.

---

## Future Backlog

| Feature | Motivation | When |
|---------|------------|------|
| WebSocket/SSE support | Real-time API testing | After Phase 4, if needed |
| GraphQL mode | GraphQL project support | After Phase 4, if needed |
| Collaboration (share flow via URL) | Team review | After Phase 4, if team needs |
| CLI mode (run flow from terminal) | CI/CD integration | After Phase 4a (reuses Core Engine) |
| Plugin system | Custom node types | After Phase 4, if extensibility needed |
| gRPC support | gRPC project support | After Phase 4, if needed |
