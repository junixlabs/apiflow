# API View

**Visual API flow testing tool.** Build flows, chain requests, test assertions. Local-first, git-friendly, open source.

The only API testing tool where you can **see** how your APIs connect.

## Quick Start

```bash
# Clone and run
git clone https://github.com/junixlabs/apiflow.git
cd apiflow
npm install
npm run dev
```

Opens at `http://localhost:5173` with proxy on port `3001`.

## Features

**Visual Canvas** - Drag-and-drop API nodes on an infinite canvas. See how endpoints connect at a glance.

**Chain Responses** - Use `{{nodes["Get User"].response.body.id}}` to pass data between requests automatically.

**Test Assertions** - Status codes, body content, JSONPath matching, header checks. Green/red badges on canvas.

**Import Anything** - Paste cURL, drop an OpenAPI spec, or import a Postman collection.

**Conditional Branching** - If/else nodes: route flow based on response status or body content.

**Loop/Pagination** - Iterate through paginated APIs automatically.

**Per-Node Auth** - Bearer Token, Basic Auth, or API Key per endpoint. Mix auth schemes in one flow.

**Endpoint Library** - Configure once, reuse everywhere. Drag from library into any flow.

**Project Storage** - `.apiview` files are JSON. Commit alongside code. Share via git.

**Multiple Environments** - Switch between Local, Staging, Production with one click.

**Step-by-Step Execution** - Run flow level by level. Inspect between steps.

**Response Diff** - Compare consecutive runs to spot changes.

**Request History** - Browse last 10 runs per node.

**Dark/Light Theme** - Toggle in toolbar.

**Export** - PNG, SVG, Postman collection, cURL commands.

**Dashboard** - Batch run all flows, see pass/fail overview.

**MCP Server** - Connect to Claude Code for AI-powered flow building.

**Laravel Analyzer** - Auto-generate flows from Laravel routes and controllers.

## Usage

### Development
```bash
npm run dev          # Start web UI + proxy
npm run dev:mcp      # Start MCP server for Claude Code
npm run build        # Production build
```

### With a project
```bash
npm start -- --project=/path/to/your/api-project
```

Flows are stored in `your-project/.apiview/flows/` and can be committed to git.

### MCP Server (Claude Code)
```bash
claude mcp add api-view -- npx tsx /path/to/api-view/src/mcp/server.ts
```

Then ask Claude: "Create a flow for my API endpoints" or "Run the deploy flow".

### Laravel Analyzer
Copy the skill to your project:
```bash
cp -r skills/api-flow-analyzer /your-project/.claude/skills/
```

Then ask Claude: "Analyze this Laravel project and generate API flows".

## Architecture

```
src/
  core/          Pure TypeScript engine (no React)
  components/    React UI components
  store/         Zustand state management
  engine/        UI-to-core bridge
  mcp/           MCP server for Claude Code
  hooks/         React hooks
  utils/         Utilities

proxy/           Express CORS proxy + file API
skills/          Claude Code skills
```

## Tech Stack

- React 19 + @xyflow/react 12 (canvas)
- Zustand 5 (state)
- Tailwind CSS 4 (styling)
- Vite 8 (build)
- TypeScript 5.9
- Lucide React (icons)
- Express 5 (proxy)
- @modelcontextprotocol/sdk (MCP)

## .apiview File Format

```json
{
  "version": 2,
  "metadata": { "name": "My Flow", "createdAt": "...", "updatedAt": "..." },
  "nodes": [...],
  "edges": [...],
  "assertions": { "node_id": [...] }
}
```

Environments are stored separately in `.apiview/environments/`.

## License

MIT
