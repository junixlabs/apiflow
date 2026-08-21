# API View — MCP Architecture

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code CLI                          │
│  ┌──────────────────┐                                           │
│  │ Laravel Analyzer  │ (Skill — reads codebase, writes .apiview)│
│  │ Skill             │                                          │
│  └────────┬─────────┘                                           │
│           │ .apiview files                                      │
│  ┌────────▼─────────┐     stdio (JSON-RPC 2.0)                 │
│  │ MCP Client        │◄──────────────────────┐                  │
│  └──────────────────┘                        │                  │
└──────────────────────────────────────────────┼──────────────────┘
                                               │
┌──────────────────────────────────────────────┼──────────────────┐
│              API View MCP Server             │                  │
│  ┌──────────────────┐  ┌─────────────────┐   │                  │
│  │ Tool Handlers     │  │ Resource Handlers│  │                  │
│  │ (12 tools)        │  │ (flow://)        │◄─┘                  │
│  └────────┬─────────┘  └────────┬────────┘                      │
│           │                     │                                │
│  ┌────────▼─────────────────────▼────────┐                      │
│  │            Core Engine                 │                      │
│  │  ┌──────────┐ ┌──────────┐ ┌────────┐ │                      │
│  │  │ Execution│ │ Flow CRUD│ │ File   │ │                      │
│  │  │ Engine   │ │ Manager  │ │ I/O    │ │                      │
│  │  └──────────┘ └──────────┘ └────────┘ │                      │
│  │  ┌──────────┐ ┌──────────┐            │                      │
│  │  │ Variable │ │ HTTP     │            │                      │
│  │  │ Resolver │ │ Client   │            │                      │
│  │  └──────────┘ └──────────┘            │                      │
│  └───────────────────────────────────────┘                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │ shared Core Engine
┌──────────────────────▼──────────────────────────────────────────┐
│              API View Web UI                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌───────────────┐  │
│  │ Canvas   │ │ Inspector│ │ Environment  │ │ Project       │  │
│  │ (React   │ │ Panel    │ │ Manager      │ │ Overview      │  │
│  │  Flow)   │ │          │ │              │ │ Dashboard     │  │
│  └──────────┘ └──────────┘ └──────────────┘ └───────────────┘  │
│                         ▲                                       │
│                    HTTP │ (localhost)                            │
│                  ┌──────┴──────┐                                │
│                  │ CORS Proxy  │                                │
│                  └─────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Engine Separation

The core engine is pure TypeScript with **no React dependency**. Both the MCP server and the web UI import from `src/core/`.

### Why split the core engine out?
- The MCP server runs in Node.js — no DOM, no need for React
- The web UI runs in the browser — it needs React, but the execution logic is the same
- Split out → the core engine can be tested on its own, with no browser

### Core Engine Modules

| Module | Responsibility |
|--------|---------------|
| `ExecutionEngine` | Topological sort, sequential/parallel run, error handling |
| `FlowManager` | CRUD operations on a flow: create, read, update, delete |
| `VariableResolver` | Resolves `{{variable}}` in the URL, headers and body |
| `HttpClient` | Execute HTTP requests, capture timing + response |
| `FileIO` | Read/write `.apiview` files, environment files |

---

## MCP Server Implementation

### Transport: stdio
- Claude Code native support — `claude mcp add api-view -- node src/mcp/server.js`
- No HTTP server, no port management
- Protocol: JSON-RPC 2.0 over stdin/stdout

### SDK
- `@modelcontextprotocol/sdk` — official MCP SDK
- `server.setRequestHandler()` for tools + resources

### Tool Registration Pattern
```typescript
// One handler function per tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "create_flow": return handleCreateFlow(request.params.arguments);
    case "run_flow":    return handleRunFlow(request.params.arguments);
    case "run_node":    return handleRunNode(request.params.arguments);
    // ...
  }
});
```

### Resource Registration
```typescript
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  if (uri === "flow://current") return getCurrentFlow();
  if (uri === "flow://results") return getLastResults();
  // flow://{name} → load saved flow
});
```

---

## Skill Implementation

### Format
A Claude Code skill is a markdown file with instructions plus tool-usage patterns.

### Codebase Analysis Approach

```
1. Read routes/api.php
   → Parse: Route::get('/api/users', [UserController::class, 'index'])
   → Extract: method=GET, url=/api/users, controller=UserController, action=index

2. Read UserController.php
   → Find: public function index(Request $request)
   → Detect: $this->userService->getAll()
   → Detect: return response()->json($users)

3. Read UserService.php
   → Find: public function getAll()
   → Detect: User::query()->with('roles')->paginate()
   → Detect: Http::get('https://external-api.com/verify')

4. Read UserRequest.php (if exists)
   → Extract validation rules → generate example body
   → e.g., 'email' => 'required|email' → {"email": "user@example.com"}

5. Group + Generate
   → Related endpoints → 1 workflow → 1 .apiview file
```

---

## Data Flow

```
[Laravel Codebase]
       │
       │ Skill reads source files
       ▼
[Laravel Analyzer Skill]
       │
       │ Writes .apiview JSON files
       ▼
[flows/*.apiview]
       │
       ├──→ [MCP Server] ──→ load, execute, return results to Claude
       │
       └──→ [Web UI] ──→ render canvas, show results in browser
```

---

## Folder Structure

```
api-view/
├── src/
│   ├── core/                    ← Pure TypeScript (shared)
│   │   ├── ExecutionEngine.ts
│   │   ├── FlowManager.ts
│   │   ├── VariableResolver.ts
│   │   ├── HttpClient.ts
│   │   ├── FileIO.ts
│   │   └── types.ts
│   │
│   ├── ui/                      ← React (Web UI)
│   │   ├── components/
│   │   ├── store/
│   │   └── App.tsx
│   │
│   ├── mcp/                     ← MCP Server (Node.js)
│   │   ├── server.ts            ← Entry point, stdio transport
│   │   ├── tools/               ← Tool handlers
│   │   │   ├── createFlow.ts
│   │   │   ├── runFlow.ts
│   │   │   ├── runNode.ts
│   │   │   ├── inspectNode.ts
│   │   │   ├── addNode.ts
│   │   │   ├── configureNode.ts
│   │   │   ├── connectNodes.ts
│   │   │   ├── listFlows.ts
│   │   │   ├── openFlow.ts
│   │   │   ├── deleteFlow.ts
│   │   │   ├── exportFlow.ts
│   │   │   └── openUi.ts
│   │   └── resources/           ← Resource handlers
│   │       ├── currentFlow.ts
│   │       ├── flowResults.ts
│   │       └── savedFlow.ts
│   │
│   └── proxy/                   ← CORS proxy (existing)
│
├── skills/
│   └── api-flow-analyzer/       ← Claude Code Skill
│       ├── skill.md             ← Skill definition
│       └── templates/           ← .apiview templates
│           └── laravel.json
│
├── flows/                       ← Generated .apiview files (per-project)
└── docs/                        ← All project documentation
```

---

## .apiview File Format (Reference)

The JSON format the web UI already uses, for example:
```json
{
  "name": "user-registration",
  "description": "User registration workflow",
  "nodes": [
    {
      "id": "node-1",
      "type": "api",
      "position": { "x": 100, "y": 100 },
      "data": {
        "method": "POST",
        "url": "{{base_url}}/api/register",
        "headers": { "Content-Type": "application/json" },
        "body": "{\"name\": \"John\", \"email\": \"john@example.com\", \"password\": \"secret123\"}"
      }
    }
  ],
  "edges": [
    { "source": "node-1", "target": "node-2" }
  ],
  "environment": {
    "base_url": "http://localhost:8000"
  }
}
```

The MCP server and the web UI both read and write this format → a single source of truth.

---

## Current State (as of Phase 2 completion)

The web UI already has all of:
- A canvas with API nodes, annotations and group frames
- Execution engine (normal + step-by-step)
- Variable resolution (env vars + node response chaining)
- Inspector panel (resizable, JSON viewer with Tree/Raw/Search/Expand)
- Flow Library (localStorage, CRUD)
- Import cURL, Export PNG/SVG
- Undo/Redo, Keyboard shortcuts, Auto-save

The core engine modules currently live in `src/engine/` and `src/store/`:
- `src/engine/executor.ts` — execution logic
- `src/engine/variableResolver.ts` — variable resolution
- `src/engine/httpClient.ts` — HTTP proxy client
- `src/engine/topologicalSort.ts` — graph sorting
- `src/utils/fileIO.ts` — file save/load

The Phase 4a refactor moves these modules to `src/core/` so the MCP server can share them.
