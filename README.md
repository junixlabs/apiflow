# apiflow

> **Mục tiêu & cái không được làm:** [`NORTH-STAR.md`](./NORTH-STAR.md) — đọc trước khi thêm tính năng.

**Visual API flow testing tool.** Build flows, chain requests, test assertions. Local-first, git-friendly, open source.

The only API testing tool where you can **see** how your APIs connect.

[![npm version](https://img.shields.io/npm/v/@junixlabs/apiflow.svg)](https://www.npmjs.com/package/@junixlabs/apiflow)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Quick Start

```bash
npx @junixlabs/apiflow
```

That's it. Opens in your browser. No account, no cloud, no setup.

### With a project

```bash
npx @junixlabs/apiflow --project=/path/to/your-api-project
```

Flows are stored in `your-project/.apiview/` and can be committed to git.

### From source

```bash
git clone https://github.com/junixlabs/apiflow.git
cd apiflow
npm install
npm run dev
```

## Dependency map — which screens break if I change this?

The half no request-store can answer. Scan a frontend, then ask.

```bash
# Scan a frontend — deterministic, framework-agnostic, no config
npx @junixlabs/apiflow scan-fe ./my-frontend --name=web

# Ask the question
npx @junixlabs/apiflow impact ./my-frontend/.apiview/map/web.apimap --endpoint="GET /api/users/{id}"
npx @junixlabs/apiflow impact ./my-frontend/.apiview/map/web.apimap --field=email
```

```
## Impact — GET /api/users/{param}

2 screen(s) break if this changes:

- **/users/{param}** [exact] — src/pages/users/[id].tsx:14
- **AccountMenu** [guess]  — src/components/AccountMenu.tsx:31
```

The scanner finds HTTP call sites, normalizes urls onto endpoints, and attributes each to a
**screen**. When the call lives in an api module rather than a page — the usual case — it walks the
import graph back through hooks and components until it reaches a file-based route, and reports how
many hops that took. Members are kept apart, so `agentsApi.remove` does not drag in every screen
that only calls `agentsApi.list`. It also traces which response fields get read. Every edge carries a confidence — `exact`, `inferred` or `guess` — and a
`file:line`. What it cannot resolve goes into an **Unresolved** list instead of being dropped.

To close that list, `skills/fe-map-extractor/` reads only those call sites, works out what a
variable url really is, and feeds the answers back as `--hints=hints.json`. Ids stay derived by
code, so a re-scan of an unchanged repo produces a byte-identical `.apimap`.

### The backend half

```bash
# Routes + payload + response shapes, from code
npx @junixlabs/apiflow scan-be ./my-api --name=api

# Confirm the response shapes against reality — using the project's OWN test runner,
# so it hits the test database and never touches real rows
npx @junixlabs/apiflow probe ./my-api/.apiview/map/api.apimap --emit
#   fill the /* apiflow:fill */ markers (app instance, auth, fixture ids), run the test, then:
npx @junixlabs/apiflow probe ./my-api/.apiview/map/api.apimap --ingest=./my-api/apiflow-probe.json
```

Stacks read directly: **Laravel** (`Route::resource` expanded, group prefixes, FormRequest
`rules()`, API Resource `toArray()`), **NestJS / Express** (`@Controller`+`@Get`, Zod,
class-validator), **Go** (gin/chi/echo/fiber/`HandleFunc`, struct `json:` tags), **Python**
(FastAPI/Flask, Pydantic, `response_model=`). A generic pass runs on every file regardless.

Response shapes are **not** taken from an OpenAPI spec — a spec drifts from the code. They come
from the code, then get confirmed by the probe. Each field records `declared` and `observed`
independently, so *declared but never sent* is a finding rather than a silent assumption.

### Joining the halves

```bash
npx @junixlabs/apiflow link ./web/.apiview/map/web.apimap ./my-api/.apiview/map/api.apimap --out=full.apimap
npx @junixlabs/apiflow impact full.apimap --field=email
```

Endpoints join on `METHOD + normalized path`, with suffix matching for a gateway prefix only the
frontend sees. The joined map answers what neither half could alone:

- **fields the API sends that no screen reads** — dead payload candidates
- **fields the code declares but the probe never saw** — the code lying about its contract
- **endpoints no screen calls** — dead routes, or a frontend that was not scanned

Each is a candidate, not a verdict: another client may consume what this frontend does not.

`skills/be-map-extractor/` covers the judgement the CLI cannot make — wiring the probe into the
project's fixtures, and classifying each mismatch. `skills/api-flow-analyzer/` remains the
agent-only route mapper for stacks the CLI does not cover yet.

## Features

### Visual Canvas
Drag-and-drop API nodes on an infinite canvas. See how your endpoints connect at a glance.

### Chain Responses
Use `{{nodes["Get User"].response.body.id}}` to pass data between requests automatically.

### Test Assertions
Add assertions per node — status codes, body content, JSONPath matching, header checks. Green/red badges show pass/fail directly on the canvas.

### Import Anything
- **cURL** — paste from browser DevTools
- **OpenAPI 3.x** — drop a Swagger spec (JSON/YAML)
- **Postman** — import collections with headers, body, folders

### Conditional Branching
If/else nodes: route flow based on response status or body content. Build upsert patterns (GET → if exists PUT, else POST).

### Per-Node Auth
Bearer Token, Basic Auth, or API Key — each node can use a different auth scheme in the same flow.

### Endpoint Library
Configure an endpoint once, save to library, drag into any flow. No more re-configuring the same GET /products in every flow.

### Project Storage
`.apiview` files are JSON. Store them in `.apiview/` alongside your code. Commit to git. Share via pull requests.

### Multiple Environments
Define Local, Staging, Production environments with different base URLs and credentials. Switch with one click.

### Step-by-Step Execution
Run flow level by level. Inspect results between each step.

### Response Diff
Compare consecutive runs to spot what changed.

### Request History
Browse last 10 runs per node with full response details.

### Export
- PNG / SVG (canvas screenshot)
- Postman Collection (JSON)
- cURL commands (all nodes or per-node copy)

### Dashboard
Batch run all saved flows. See pass/fail overview at a glance.

### Dark / Light Theme
Toggle in toolbar. Preference persisted.

### MCP Server
Connect to Claude Code via 12 MCP tools. Let AI build and run flows for you.

### Laravel Analyzer
Claude Code skill that auto-generates `.apiview` flow files from Laravel routes, controllers, and validation rules.

### FE Map Extractor
Claude Code skill that closes the gaps `scan-fe` cannot resolve on its own — see the dependency map section above.

### BE Map Extractor
Claude Code skill that wires the probe harness into a project's own fixtures and auth, then classifies every declared-but-never-sent field as a bug, a conditional, or a scanner miss.

## Usage

### CLI

```bash
# Run (serves pre-built app + proxy)
npx @junixlabs/apiflow

# Run with a project directory
npx @junixlabs/apiflow --project=/path/to/my-api

# Run on custom port
npx @junixlabs/apiflow --port=4000

# Start MCP server for Claude Code
npx @junixlabs/apiflow --mcp

# Map a frontend's API usage
npx @junixlabs/apiflow scan-fe ./my-frontend --name=web [--hints=hints.json]

# Map a backend, and confirm its response shapes with test data
npx @junixlabs/apiflow scan-be ./my-api --name=api
npx @junixlabs/apiflow probe ./my-api/.apiview/map/api.apimap --emit
npx @junixlabs/apiflow probe ./my-api/.apiview/map/api.apimap --ingest=./my-api/apiflow-probe.json

# Join them, then ask
npx @junixlabs/apiflow link web.apimap api.apimap --out=full.apimap
npx @junixlabs/apiflow impact full.apimap --endpoint="GET /api/users"
```

### Development

```bash
npm run dev          # Vite dev server + proxy (hot reload)
npm run build        # Production build
npm start            # Serve built app (builds dist/ on first run)
npm test             # Run the test suite
npm run dev:mcp      # MCP server only
```

### MCP Server (Claude Code)

```bash
claude mcp add apiflow -- npx @junixlabs/apiflow --mcp
```

Then ask Claude:
- "Create a flow for my deploy endpoints"
- "Run the checkout flow"
- "Export all nodes as cURL"

### Laravel Analyzer

```bash
# Copy skill to your Laravel project
cp -r node_modules/@junixlabs/apiflow/skills/api-flow-analyzer .claude/skills/
```

Then ask Claude: "Analyze this Laravel project and generate API flows."

## Project Storage

When you open a project, apiflow creates:

```
your-project/
└── .apiview/
    ├── config.json              # Project settings
    ├── environments/            # Shared across all flows
    │   ├── local.json
    │   └── staging.json
    ├── flows/                   # Your API flows (git-commit these)
    │   ├── user-management.apiview
    │   └── deploy/
    │       └── product-v2.apiview
    ├── map/                      # Dependency maps from `scan-fe` (git-commit these)
    │   └── web.apimap
    ├── library/                 # Reusable endpoint templates
    │   └── endpoints.json
    ├── results/                 # Last run results (gitignored)
    └── .gitignore
```

## .apiview File Format

```json
{
  "version": 2,
  "metadata": {
    "name": "My Flow",
    "createdAt": "2026-03-20T00:00:00Z",
    "updatedAt": "2026-03-20T00:00:00Z"
  },
  "nodes": [
    {
      "id": "node_1",
      "type": "apiNode",
      "position": { "x": 200, "y": 100 },
      "data": {
        "label": "Get Users",
        "config": {
          "method": "GET",
          "url": "{{base_url}}/api/users",
          "headers": [{ "key": "Authorization", "value": "Bearer {{token}}", "enabled": true }],
          "params": [],
          "body": ""
        }
      }
    }
  ],
  "edges": [{ "id": "edge_1_2", "source": "node_1", "target": "node_2" }],
  "assertions": {
    "node_1": [{ "id": "a1", "type": "status_equals", "target": "", "expected": "200", "enabled": true }]
  }
}
```

## .apimap File Format

Generated by `scan-fe`. No positions and no timestamp — the map is laid out at render time, and
the file stays byte-identical across scans of an unchanged repo so it diffs cleanly in git.

```json
{
  "version": 1,
  "metadata": { "name": "web", "root": "/repo/web", "generator": "apiflow scan-fe/1" },
  "screens":   [{ "id": "sc_users-param", "label": "/users/{param}", "route": "/users/{param}",
                  "source": { "file": "src/pages/users/[id].tsx", "line": 1 } }],
  "endpoints": [{ "id": "ep_get-api-users-param", "method": "GET", "path": "/api/users/{param}" }],
  "fields":    [{ "id": "fl_ep_get-api-users-param_data-email",
                  "endpointId": "ep_get-api-users-param", "path": "data.email" }],
  "calls":     [{ "screenId": "sc_users-param", "endpointId": "ep_get-api-users-param",
                  "via": "axios", "confidence": "inferred",
                  "source": { "file": "src/pages/users/[id].tsx", "line": 5 } }],
  "reads":     [{ "screenId": "sc_users-param", "fieldId": "fl_ep_get-api-users-param_data-email",
                  "confidence": "guess",
                  "source": { "file": "src/pages/users/[id].tsx", "line": 6 } }],
  "unresolved": [{ "source": { "file": "src/api/gen.ts", "line": 210 },
                   "reason": "url is a variable or expression: endpoint",
                   "snippet": "return fetch(endpoint, init);" }]
}
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19, @xyflow/react 12 |
| State | Zustand 5 |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| Fonts | Inter + JetBrains Mono |
| Build | Vite 8, TypeScript 5.9 |
| Proxy | Express 5 |
| MCP | @modelcontextprotocol/sdk |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+O` | Open / Library |
| `Ctrl+Enter` | Run All |
| `Ctrl+I` | Import cURL |
| `Escape` | Deselect / Close |
| `Delete` | Delete selected node |

## Contributing

```bash
git clone https://github.com/junixlabs/apiflow.git
cd apiflow
npm install
npm run dev
```

Open http://localhost:5173. PRs welcome.

Please review our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## License

MIT — see [LICENSE](LICENSE).
