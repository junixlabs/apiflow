# API View — Release Roadmap

## Phase 1: MVP — Core Flow & Inspection — DONE

**Release:** v0.1.0

### Deliverables

| # | Feature | Status |
|---|---------|--------|
| 1 | Project setup (React + React Flow + Vite) | DONE |
| 2 | Canvas: zoom, pan, grid background | DONE |
| 3 | API Node: create, delete, move, display method/URL | DONE |
| 4 | Node Config Panel: method, URL, headers, body editor | DONE |
| 5 | Connection: drag-and-drop between nodes | DONE |
| 6 | Execution Engine: topological sort + sequential/parallel run | DONE |
| 7 | Response Inspector: JSON tree view + status + timing | DONE |
| 8 | Environment variables (key-value, multiple envs) | DONE |
| 9 | Save/Load flow (JSON file) | DONE |

---

## Phase 2: Developer Experience — DONE

**Release:** v0.2.0

### Deliverables

| # | Feature | Status |
|---|---------|--------|
| 1 | Dynamic variables (`{{nodes["X"].response.body.field}}`) | DONE |
| 2 | Autocomplete for variables | DONE |
| 3 | cURL import → create node (auto-format JSON body) | DONE |
| 4 | Step-by-step execution mode | DONE |
| 5 | Canvas annotations and group frame | DONE |
| 6 | Node description/notes | DONE |
| 7 | Export canvas → PNG/SVG | DONE |
| 8 | Flow Library (home screen) | DONE |
| 9 | Auto-save | DONE |
| 10 | Keyboard shortcuts | DONE |
| 11 | Undo/Redo | DONE |
| 12 | Resizable inspector panel (persisted) | DONE |
| 13 | JSON viewer: Tree/Raw, search, copy path, expand modal | DONE |
| 14 | Body JSON editor: validation, format/minify, expand modal | DONE |
| 15 | KeyValueEditor: ghost row, bulk edit mode | DONE |
| 16 | Response/Request: collapsible headers, non-JSON fallback | DONE |

---

## Phase 3: Integration & Advanced — NEXT

**Release:** v0.3.0
**Prerequisite:** Phase 2 complete
**Estimate:** ~35h

| # | Feature | Estimate |
|---|---------|----------|
| 1 | OpenAPI/Swagger import | 6h |
| 2 | Postman collection import | 4h |
| 3 | Export → Postman collection | 3h |
| 4 | Export → cURL commands list | 2h |
| 5 | Test assertions (status code, body contains, JSONPath) | 6h |
| 6 | Response diff (compare 2 runs) | 5h |
| 7 | Request history per node | 3h |
| 8 | Dark/Light theme toggle | 3h |
| 9 | Mini-map for large flows | 1h |
| 10 | Environment quick-switch widget | 2h |

### Definition of Done
- Import OpenAPI spec → nodes created correctly
- Import Postman collection → nodes + connections match
- Assertions: green/red badge per node based on rules
- Switch environment → all variables update

---

## Phase 4: Claude Code Integration — PLANNED

**Release:** v0.4.0
**Prerequisite:** Phase 3 complete
**Estimate:** ~13-15 days

| Sub-phase | Duration | Key Deliverable |
|-----------|----------|-----------------|
| 4a: MCP Server | ~5 days | Claude Code ↔ API View via 12 MCP tools |
| 4b: Laravel Skill | ~5-7 days | Auto-analyze codebase → generate .apiview flows |
| 4c: Overview | ~3 days | Dashboard, API coverage report, batch run |

See [roadmap-master.md](roadmap-master.md), [../architecture/mcp-architecture.md](../architecture/mcp-architecture.md), and [claude-code-integration.md](claude-code-integration.md) for details.

---

## Future Considerations (Backlog)

| Feature | Motivation |
|---------|------------|
| WebSocket/SSE support | Real-time API testing |
| GraphQL mode | GraphQL project support |
| Collaboration (share flow via URL) | Team review |
| CLI mode (run flow from terminal) | CI/CD integration |
| Plugin system | Custom node types |
| gRPC support | gRPC project support |
