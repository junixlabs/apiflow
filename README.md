# apiflow

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
```

### Development

```bash
npm run dev          # Vite dev server + proxy (hot reload)
npm run build        # Production build
npm start            # Serve built app
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

## License

MIT — see [LICENSE](LICENSE).
