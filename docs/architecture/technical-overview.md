# API View — Technical Architecture

## Tech Stack (Actual)

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| UI Framework | React | 19.2 | |
| Canvas | @xyflow/react | 12.8 | Node-based canvas, MIT license |
| State Management | Zustand | 5.0 | Lightweight, no boilerplate |
| Build Tool | Vite | 8.0 | Fast dev server, HMR |
| Styling | Tailwind CSS | 4.1 | Utility-first |
| Language | TypeScript | 5.9 | Strict mode |
| HTTP Proxy | Express | 5.1 | CORS proxy on port 3001 |
| Canvas Export | html-to-image | latest | PNG/SVG export |

Note: Monaco Editor was considered but not used — plain textarea with custom JSON validation/formatting provides sufficient UX at much smaller bundle size.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    React App                         │
│                                                     │
│  ┌─────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Flow Canvas  │  │ Inspector│  │ Environment   │  │
│  │ (@xyflow)    │  │ Panel    │  │ Manager       │  │
│  │ + Annotation │  │ (resize) │  │               │  │
│  │ + GroupNode  │  │          │  │               │  │
│  └──────┬──────┘  └────┬─────┘  └───────┬───────┘  │
│         │              │                │           │
│  ┌──────┴──────────────┴────────────────┴───────┐  │
│  │          Zustand Stores                       │  │
│  │  flowStore    — nodes, edges, metadata        │  │
│  │  executionStore — results, statuses, stepping │  │
│  │  environmentStore — envs, active env          │  │
│  │  historyStore — undo/redo stacks              │  │
│  │  libraryStore — flow library (localStorage)   │  │
│  └──────────────────┬───────────────────────────┘  │
│                     │                               │
│  ┌──────────────────┴───────────────────────────┐  │
│  │           Engine Layer                        │  │
│  │  executor.ts      — run flow / step / single  │  │
│  │  variableResolver — env vars + node vars      │  │
│  │  topologicalSort  — Kahn's algorithm          │  │
│  │  httpClient.ts    — proxy fetch               │  │
│  └──────────────────┬───────────────────────────┘  │
│                     │                               │
│  ┌──────────────────┴───────────────────────────┐  │
│  │           Utilities                           │  │
│  │  fileIO.ts     — save/load .apiview files     │  │
│  │  autoSave.ts   — localStorage draft           │  │
│  │  curlParser.ts — cURL import                  │  │
│  │  canvasExport  — PNG/SVG via html-to-image    │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │           Proxy Server (Express, port 3001)   │  │
│  │  - Bypass CORS for browser requests           │  │
│  │  - Forward to actual API, return response     │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Source Structure

```
src/
├── App.tsx                          # Root: view switch, shortcuts, auto-save
├── main.tsx                         # React entry
├── types/index.ts                   # All TypeScript interfaces
│
├── engine/
│   ├── executor.ts                  # runFlow, runSingleNode, stepping mode
│   ├── variableResolver.ts          # {{env}} + {{nodes["X"].response...}}
│   ├── httpClient.ts                # Proxy fetch to localhost:3001
│   └── topologicalSort.ts           # Kahn's algorithm, level grouping
│
├── store/
│   ├── flowStore.ts                 # Nodes, edges, CRUD, undo/redo
│   ├── executionStore.ts            # Results, statuses, stepping state
│   ├── environmentStore.ts          # Environments, variables
│   ├── historyStore.ts              # Undo/redo snapshot stacks
│   └── libraryStore.ts             # Flow library (localStorage)
│
├── components/
│   ├── canvas/
│   │   ├── FlowCanvas.tsx           # ReactFlow wrapper
│   │   ├── ApiNode.tsx              # API node renderer
│   │   ├── AnnotationNode.tsx       # Text annotation node
│   │   ├── GroupNode.tsx            # Resizable group frame
│   │   └── ConnectionLine.tsx       # Status-colored edges
│   ├── inspector/
│   │   ├── InspectorPanel.tsx       # Resizable 3-tab sidebar
│   │   ├── ConfigTab.tsx            # Request config + body JSON editor
│   │   ├── RequestTab.tsx           # Resolved request viewer
│   │   ├── ResponseTab.tsx          # Response viewer (JSON/text/null)
│   │   └── KeyValueEditor.tsx       # KV editor (ghost row, bulk edit)
│   ├── toolbar/
│   │   ├── Toolbar.tsx              # All toolbar actions
│   │   └── ImportCurlModal.tsx      # cURL paste + import
│   ├── library/
│   │   ├── FlowLibrary.tsx          # Grid view, search, CRUD
│   │   └── FlowCard.tsx             # Individual flow card
│   ├── environment/
│   │   └── EnvironmentPanel.tsx     # Env management modal
│   ├── json-viewer/
│   │   └── JsonTreeView.tsx         # Tree/Raw, search, copy path, expand modal
│   └── shared/
│       ├── MethodBadge.tsx
│       ├── StatusBadge.tsx
│       ├── VariableAutocomplete.tsx
│       └── ShortcutHint.tsx
│
├── hooks/
│   ├── useVariableAutocomplete.ts
│   └── useKeyboardShortcuts.ts
│
├── utils/
│   ├── fileIO.ts
│   ├── idGenerator.ts
│   ├── curlParser.ts
│   ├── canvasExport.ts
│   └── autoSave.ts
│
proxy/
└── index.ts                         # Express CORS proxy server
```

## Core Data Models

### Flow File Format (.apiview)

```json
{
  "version": 1,
  "metadata": {
    "name": "WooCommerce Deploy",
    "createdAt": "2026-03-19T10:00:00Z",
    "updatedAt": "2026-03-19T12:00:00Z"
  },
  "nodes": [
    {
      "id": "node_123_1",
      "type": "apiNode",
      "position": { "x": 100, "y": 200 },
      "data": {
        "label": "Get Product",
        "description": "Fetch product details",
        "config": {
          "method": "GET",
          "url": "{{base_url}}/api/products/123",
          "headers": [{ "key": "Authorization", "value": "Bearer {{token}}", "enabled": true }],
          "params": [],
          "body": ""
        }
      }
    }
  ],
  "edges": [
    { "id": "edge_node1_node2", "source": "node_1", "target": "node_2" }
  ],
  "environments": [
    { "name": "Local", "variables": [{ "key": "base_url", "value": "http://localhost:8000", "enabled": true }] }
  ],
  "activeEnvironmentName": "Local"
}
```

### Execution Result (in-memory)

```json
{
  "nodeId": "node_123_1",
  "status": 200,
  "statusText": "OK",
  "headers": { "content-type": "application/json" },
  "body": { "id": 123, "name": "Product ABC" },
  "duration_ms": 45,
  "size_bytes": 1234,
  "resolvedRequest": {
    "method": "GET",
    "url": "http://localhost:8000/api/products/123",
    "headers": { "Authorization": "Bearer secret_abc123" },
    "body": ""
  }
}
```

## CORS Strategy

Browser requests are proxied through an Express server on port 3001:
- `POST /proxy` receives request config, forwards to target API, returns response
- Dev command: `npm run dev` runs both Vite + proxy via `concurrently`
