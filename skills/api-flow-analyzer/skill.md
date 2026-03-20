---
name: api-flow-analyzer
description: >
  Analyze a Laravel codebase and generate .apiview flow files for API View.
  Use when the user asks to: analyze a Laravel project's API endpoints,
  generate API flow files from routes, create .apiview files from a Laravel app,
  scan a codebase for API workflows, extract API documentation from Laravel,
  or produce visual API flow files. Requires a Laravel project with artisan,
  routes/ directory, and app/Http/Controllers/.
---

# API Flow Analyzer

Analyze a Laravel project and generate `.apiview` files — one per controller, with nodes for each endpoint, connected sequentially in CRUD order.

## Process

### 1. Verify Laravel project

Confirm these exist at project root:
- `artisan`
- `routes/` (with `api.php` or `web.php`)
- `app/Http/Controllers/`

If missing, stop: "This does not appear to be a Laravel project."

### 2. Parse routes

Read `routes/api.php` first. Fall back to `routes/web.php` if no api.php.

Extract every route: method, path, controller, action, middleware, prefix.

For route patterns, groups, resource expansion, and edge cases, see [references/route-parsing.md](references/route-parsing.md).

Build a list of route objects:
```
{ method, path, controller, action, middleware[], prefix }
```

Skip closure routes (note in summary).

### 3. Trace controllers

For each controller, read `app/Http/Controllers/{Controller}.php`.

For each action method, extract:
- **FormRequest class** — if param type is not `Request`, it's a FormRequest
- **Constructor injection** — injected services
- **External API calls** — `Http::get/post`, Guzzle patterns
- **Response pattern** — `response()->json()`, API Resources

Skip missing controllers/methods (note in summary).

### 4. Generate request bodies

For each FormRequest found, read `app/Http/Requests/{Name}.php`.

Parse `rules()` method → generate example JSON body.

For the full rule-to-value mapping table, see [references/formrequest-rules.md](references/formrequest-rules.md).

### 5. Read environment

Read `.env` at project root. Extract:
- `APP_URL` → `base_url`
- `*_API_URL`, `*_BASE_URL` → external service URLs
- `*_KEY`, `*_SECRET`, `*_TOKEN` → placeholders only, **never copy real secrets**

Default if no `.env`:
```json
[
  { "key": "base_url", "value": "http://localhost:8000", "enabled": true },
  { "key": "token", "value": "your-token-here", "enabled": true }
]
```

### 6. Group into workflows

One workflow per controller:
- `UserController` → `user-management.apiview` ("User Management")
- `OrderItemController` → `order-item-management.apiview`

Naming: remove `Controller`, kebab-case, append `-management`.

### 7. Generate .apiview files

For each workflow, generate JSON matching the ApiViewFile format.

For the full TypeScript interface, validation checklist, and a complete example, see [references/apiview-format.md](references/apiview-format.md).

A CRUD template is available at [assets/laravel-crud.json](assets/laravel-crud.json).

**Node construction:**
- `id`: `"node_{n}"` (incrementing)
- `type`: `"apiNode"`
- `position`: `{ x: 200, y: n * 200 + 100 }` (vertical stack)
- `label`: `index`→"List {R}s", `store`→"Create {R}", `show`→"Get {R}", `update`→"Update {R}", `destroy`→"Delete {R}"
- `url`: `{{base_url}}{path}` — replace `{param}` with `{{param_id}}`
- `headers`: Always `Accept: application/json`. Add `Content-Type` for POST/PUT/PATCH. Add `Authorization: Bearer {{token}}` if auth middleware.
- `body`: JSON string from FormRequest rules for POST/PUT/PATCH. Empty `""` for GET/DELETE.

**Edges:** Sequential in CRUD order: index → store → show → update → destroy → other.

**Environment:** Variables from step 5 + any route parameter IDs (`user_id`, etc.).

### 8. Write output

Write to `{project_root}/apiview/`. Create directory if needed.

File names: `{workflow-name}.apiview`

### 9. Summary

Output a report:
```
## API Flow Analyzer Results

**Project**: {path}
**Routes found**: {n}
**Workflows generated**: {n}

### Generated:
- apiview/user-management.apiview — 5 endpoints (CRUD)
- apiview/auth-management.apiview — 2 endpoints

### Skipped:
- Closure route: GET /health
- Missing controller: ReportController
```
