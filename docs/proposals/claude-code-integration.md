# API View — Claude Code Integration & Skill Vision

## 1. Expanded Problem

Every backend project is a collection of small workflows: user registration, order processing, payment, inventory sync, a deployment pipeline… Each workflow is an ordered chain of API calls whose data depends on the calls before it.

**The problem today:**
- No tool does **analyze the code → generate the flow → test → overview** in one pipeline
- A developer has to build a flow per endpoint by hand — slow, and easy to leave gaps
- When the code changes, the flow does not follow → documentation drift
- No overview: how many workflows there are, which endpoints have no flow, which flows are failing

**The solution:** three integrated components — auto-analyze the codebase, run flows through MCP, review visually in the web UI.

---

## 2. System Architecture (3 Components)

```
[Claude Code Skill — Laravel Analyzer]
  │  Reads: routes/api.php, Controllers/, Services/, Models/, Jobs/
  │  Outputs: .apiview flow files
  │
  ▼
[API View MCP Server] ←── stdio ──→ [Claude Code CLI]
  │  Tools: create_flow, run_flow, inspect_node, open_ui...
  │  Resources: flow://current, flow://results
  │
  ▼
[API View Web UI] ←── HTTP ──→ [Browser]
  │  Canvas, Inspector, Project Overview
  │
  ▼
[Core Engine] (shared by MCP + Web UI)
  │  Execution, Variable resolution, Flow CRUD, File I/O
```

**Data flow:**
1. The skill analyzes the Laravel codebase → writes `.apiview` files into `flows/`
2. The MCP server loads the `.apiview` files → exposes tools to Claude Code
3. Claude Code calls `run_flow` → the core engine executes → results come back
4. The web UI reads the same `.apiview` files + results → renders the canvas

---

## 3. Component 1: Claude Code Skill (Laravel Analyzer)

### Input
A Laravel project's source code in the working directory.

### Process

1. **Parse routes** — read `routes/api.php` + `routes/web.php`
   - Extract: method, URL pattern, middleware, controller@action
   - Group by prefix/middleware group

2. **Trace controller → service** — for each endpoint:
   - `app/Http/Controllers/` → find the method → identify the injected service
   - `app/Services/` → business logic, external API calls (Http::, Guzzle)
   - `app/Jobs/` → async workflows dispatched from a controller/service

3. **Identify data flow**
   - DB queries (Eloquent) → data transforms → response structure
   - External API calls: URL, method, payload pattern
   - Cross-service calls: Service A → Service B

4. **Extract request details**
   - `app/Http/Requests/` → validation rules → generate example request body
   - `app/Models/` → relationships → understand data structure
   - `config/services.php` → third-party API configs
   - `.env` → the environment variables needed

5. **Group endpoints into workflows**
   - Related endpoints (same resource, same feature) → one flow
   - Detect dependency chain: endpoint A output → endpoint B input

6. **Generate `.apiview` flow files**
   - One file per workflow in `flows/`
   - A node for every API endpoint in the flow
   - Connections in logical order
   - An example request body from the validation rules
   - Environment variables from `.env`

### Output
```
flows/
├── user-registration.apiview
├── product-deploy-woocommerce.apiview
├── order-sync-shopify.apiview
├── payment-processing.apiview
└── inventory-management.apiview
```

### Laravel-Specific Parsing Map

| Source | Extract |
|--------|---------|
| `routes/api.php`, `routes/web.php` | Endpoints: method, URL, middleware, controller |
| `app/Http/Controllers/` | Method → Service injection → business logic entry |
| `app/Services/` | Business logic, external API calls, cross-service deps |
| `app/Models/` | Relationships, data structure, scopes |
| `app/Jobs/` | Async workflows, queue connections |
| `app/Http/Requests/` | Validation rules → example body generation |
| `config/services.php` | Third-party API configs (keys, URLs) |
| `.env` | Environment variables for flow execution |

---

## 4. Component 2: MCP Server

### MCP Tools (12)

| Tool | Description | Use Case |
|------|-------------|----------|
| `create_flow` | Creates a flow from a name + description | The skill creates a flow from its analysis |
| `add_node` | Adds an API node to a flow | Build a flow programmatically |
| `configure_node` | Configures a node (method, url, headers, body) | Set the request details |
| `connect_nodes` | Connects two nodes (source → target) | Define the execution order |
| `run_flow` | Runs the whole flow | Auto-test, batch testing |
| `run_node` | Runs one specific node | Debug a single endpoint |
| `inspect_node` | Shows the response in detail (headers, body, timing) | Debug the data shape |
| `list_flows` | Lists every flow in the project | Overview, discovery |
| `open_flow` | Loads a saved flow file | Resume work |
| `delete_flow` | Deletes a flow | Cleanup |
| `export_flow` | Export flow (cURL commands, PNG) | Documentation |
| `open_ui` | Opens the web UI in a browser | Visual inspection |

### MCP Resources

| Resource URI | Description |
|--------------|-------------|
| `flow://current` | The flow active in this session |
| `flow://results` | The results of the latest run |
| `flow://{name}` | A saved flow, by name |

### Transport
- **stdio** — native Claude Code support, no HTTP server needed
- Protocol: JSON-RPC 2.0
- SDK: `@modelcontextprotocol/sdk`

---

## 5. Component 3: Project Overview (Web UI Extension)

A dashboard in the web UI showing the whole project:

- **Flow summary** — the total number of flows, the last run timestamp
- **Pass/Fail status** — per flow: passed / failed / not run
- **API coverage** — which endpoints have a flow and which do not
- **Flow dependency map** — which flows share API endpoints
- **Last run results** — a batch run summary with drill-down

---

## 6. Use Cases

### UC1: Full Auto-Analyze → Generate → Test

```
User: Analyze the project and create a flow for every API workflow

Claude: [the skill runs the Laravel analyzer]
        Parsed routes/api.php → 42 endpoints
        Grouped into 15 workflows
        Wrote 15 flow files:
        → flows/user-registration.apiview (3 nodes)
        → flows/product-deploy-woocommerce.apiview (4 nodes)
        → flows/order-sync-shopify.apiview (5 nodes)
        → flows/payment-processing.apiview (3 nodes)
        ...

User: Run all of them

Claude: [run_flow × 15]
        ✅ 12/15 flows passed
        ❌ 3 flows failed:
          - order-sync: node "Get Orders" → 401 Unauthorized
          - payment: node "Charge" → 500 timeout
          - inventory: node "Update Stock" → 422 validation error
```

### UC2: Debug Specific Flow

```
User: Debug flow order-sync

Claude: [inspect_node "Get Orders"]
        Request: GET /api/orders?platform=shopify
        Headers: Authorization: Bearer {{SHOPIFY_TOKEN}}
        Response: 401 — {"error": "token expired"}

        → The token in the environment has expired and needs refreshing.
        Update SHOPIFY_TOKEN in .env and run it again?
```

### UC3: Planning New Feature

```
User: I need to build an inventory sync with Lazada

Claude: Based on the current codebase, the flow would be:
        1. GET /api/products → read the local inventory
        2. GET /api/shops/{id} → read the Lazada credentials
        3. POST /api/inventory/sync → collect + transform + call Lazada API

        [create_flow "lazada-inventory-sync"]
        [add_node × 3 + connect_nodes × 2]
        [open_ui]

        Opened the browser so you can review the flow before writing code.
```

### UC4: Regenerate After Code Changes

```
User: I just refactored OrderService, update the flows

Claude: [Skill re-analyze OrderService]
        Changes detected:
        - order-sync.apiview: the endpoint /api/orders/sync became /api/v2/orders/sync
        - order-create.apiview: a "Validate Inventory" node added before "Create Order"

        Updated 2 flow files. Run them again to verify?
```

---

## 7. User Stories (Epic 7: Claude Code Integration)

### US-7.1: Auto-Analyze Codebase → Generate All Flows

**As a** backend developer
**I want to** have Claude analyze the Laravel codebase and create the flow files itself
**So that** I get full API flow coverage without building them by hand

**Acceptance Criteria:**
- The skill reads routes, controllers and services successfully
- It writes `.apiview` files in the right format, loadable in the web UI
- Every flow has nodes, connections, and an example request body

### US-7.2: Run all flows and see a summary

**As a** backend developer
**I want to** run every flow and see a pass/fail summary
**So that** I know the overall state of the project's APIs at a glance

**Acceptance Criteria:**
- `run_flow` can run a batch (every flow)
- The summary shows: total, passed, failed, with the error detail
- Results are stored so they can be viewed in the web UI

### US-7.3: Debug a specific flow through a conversation with Claude

**As a** backend developer
**I want to** ask Claude to debug a failing flow
**So that** Claude inspects the response, analyzes the error, and suggests a fix

**Acceptance Criteria:**
- `inspect_node` returns the full request/response detail
- Claude can work out the root cause from the response
- It suggests an actionable fix (update the env, fix the code, etc.)

### US-7.4: Create a flow for a new feature (planning)

**As a** backend developer
**I want to** describe a new feature → Claude drafts the flow
**So that** I can see the API chain before writing code

**Acceptance Criteria:**
- Claude builds the flow from the description + the existing codebase context
- The flow opens in the web UI for review
- The flow can be edited in the UI before implementation

### US-7.5: See the project overview in the web UI

**As a** backend developer
**I want to** open a dashboard covering every flow
**So that** I know the API coverage, the status and the dependencies

**Acceptance Criteria:**
- The dashboard lists every flow + its status
- API coverage: the % of endpoints that have a flow
- Click a flow → open its canvas in detail

### US-7.6: Regenerate flows when the code changes

**As a** backend developer
**I want to** re-run the analyzer when the code changes
**So that** the flows stay in sync with the code as it actually is

**Acceptance Criteria:**
- The skill detects what changed against the current flows
- Only the affected flows are updated, not all of them
- It shows a diff: what changed in each flow
