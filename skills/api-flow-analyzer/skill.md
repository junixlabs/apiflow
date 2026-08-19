---
name: api-flow-analyzer
description: >
  Analyze any backend codebase and generate .apiview flow files for apiflow —
  no OpenAPI spec required. Use when the user asks to: map a project's API
  endpoints, collect all APIs in a project, generate API flow files from source,
  create .apiview files, scan a codebase for API workflows, build API
  documentation from code, or produce visual API flows. Works on Laravel,
  Strapi, Express/NestJS, Next.js route handlers, Go (net/http, chi, gin, echo,
  mux), FastAPI/Flask/Django, and has a generic fallback for unlisted stacks.
---

# API Flow Analyzer

Read a backend's source and produce `.apiview` files: one workflow per resource,
each node a real endpoint with method, URL, headers and an example body.

**No OpenAPI, Swagger or Postman export is needed as input.** The routes in the
code are the source of truth. Where the code cannot answer, say so — see step 8.

## What is invariant, and what is not

Steps 1–8 below are the same for every stack. Only **where routes live and how
request shape is declared** differs, and that lives in one file per stack under
`references/stacks/`.

Do not invent a new procedure per project. If a stack is missing, follow §2.4
and then write the stack file so the next run is cheap.

## Process

### 1. Locate the API root

The project root is often not the API root. Check, in order:

- `backend/`, `api/`, `server/`, `services/*/`, `apps/api/`, `src/api/`
- the root itself

A repo can hold more than one API (e.g. a Go service plus a Python worker).
**Ask which one to map before mapping** rather than merging them into one flow —
two APIs in one `.apiview` produces a diagram nobody can act on.

### 2. Detect the stack

Match on marker files, most specific first:

| Marker | Stack | Guide |
|---|---|---|
| `artisan` + `routes/` | Laravel | [stacks/laravel.md](references/stacks/laravel.md) |
| `@strapi/strapi` in `package.json` | Strapi | [stacks/strapi.md](references/stacks/strapi.md) |
| `next` in `package.json` + `app/api/` or `pages/api/` | Next.js | [stacks/nextjs.md](references/stacks/nextjs.md) |
| `@nestjs/core` in `package.json` | NestJS | [stacks/express-nest.md](references/stacks/express-nest.md) |
| `express`, `fastify`, `koa`, `hono` in `package.json` | Express-family | [stacks/express-nest.md](references/stacks/express-nest.md) |
| `go.mod` | Go | [stacks/go-http.md](references/stacks/go-http.md) |
| `fastapi`, `flask`, `django` in `pyproject.toml` / `requirements*.txt` | Python | [stacks/python.md](references/stacks/python.md) |
| none of the above | — | §2.4 |

#### 2.4 Unlisted stack — generic fallback

Never stop here. Every HTTP server registers routes somewhere findable:

1. Find the process entrypoint (`main.*`, `index.*`, `app.*`, `cmd/*/main.go`,
   or the `start`/`dev` script in the manifest).
2. From there follow the server bootstrap until you reach the call that binds a
   path to a handler. Grep for the HTTP verbs as strings — `"GET"`, `.get(`,
   `@Get`, `#[get(` — and for path literals starting with `/`.
3. Record every binding you find, then continue from step 3 below.

State in the report that the stack was unlisted and the route list may be
incomplete. **Do not present a generic-fallback result as if it were exhaustive.**

### 3. Enumerate routes

Produce, for every endpoint:

```
{ method, path, handler, middleware[], auth: bool, source: "file:line" }
```

`source` is required — it is what makes the map checkable later. A node whose
origin cannot be pointed at is a guess.

Expand what the stack expands implicitly: resource/CRUD macros, route groups
and prefixes, versioning, auto-generated content-type routes. The stack guide
says which of these exist.

### 4. Trace each handler

Read the handler and extract:

- **Request shape** — validation schema, DTO, typed struct, serializer, or
  FormRequest. The stack guide names the mechanism.
- **Path/query parameters** and their types.
- **Auth** — whether a middleware/guard/dependency enforces it.
- **Outbound calls** — HTTP calls this handler makes to other services. These
  become their own nodes if they cross a boundary you are mapping.

Handlers you cannot read (dynamic dispatch, generated code, missing file) go to
the unresolved list in step 8. Do not emit a node with an invented body.

### 5. Generate example bodies

Turn the request shape into example JSON. Rules → values mapping for Laravel is
in [formrequest-rules.md](references/formrequest-rules.md); the same shape of
mapping applies to Zod, class-validator, Pydantic and Go struct tags.

No schema found → empty body `""` and a line in the unresolved list. An invented
body that looks authoritative is worse than an empty one.

### 6. Read environment

Find the env file (`.env`, `.env.example`, `config/*.yaml`, `docker-compose.yml`
environment block). Extract:

- app/base URL → `base_url`
- external service URLs → one variable each
- keys, secrets, tokens → **placeholder names only, never copy a real value**

Prefer `.env.example` over `.env` when both exist: it carries the variable names
without the live secrets.

Default when nothing is found:

```json
[
  { "key": "base_url", "value": "http://localhost:8000", "enabled": true },
  { "key": "token", "value": "your-token-here", "enabled": true }
]
```

### 7. Group into workflows and write files

One workflow per resource — controller, router file, module, or content-type,
whichever the stack groups by.

- Name: drop the stack's suffix (`Controller`, `Router`, `Handler`, `Resource`),
  kebab-case, append `-management`.
- File: **`{api_root}/.apiview/flows/{workflow-name}.apiview`** — dotted dir,
  `flows/` subdir. This is the only path apiflow reads; a file written to a
  plain `apiview/` directory is invisible to the app and the run looks like it
  produced nothing.
- The rest of the `.apiview/` scaffold (`config.json`, `environments/`,
  `results/`, `library/`, and a `.gitignore` covering `results/`) is created by
  apiflow when the project is opened. Create `flows/` yourself if it is absent;
  do not hand-write the other files.
- Node/edge construction, positions, and the full file format:
  [apiview-format.md](references/apiview-format.md). Note that `method`, `url`,
  `headers`, `params` and `body` live under **`data.config`**, not flat on
  `data` — a flat node loads without error and renders empty.
- Edges: CRUD order (list → create → get → update → delete → other). When the
  stack is not CRUD-shaped, order by dependency: an endpoint that needs an id
  comes after the one that returns it.

### 8. Report — including what failed

```
## API Flow Analyzer Results

**API root**: {path}
**Stack**: {stack} (detected via {marker})
**Routes found**: {n}
**Workflows generated**: {n}

### Generated
- .apiview/flows/user-management.apiview — 5 endpoints

### Unresolved — {n} route(s)
- POST /webhook/{provider} — handler resolved at runtime, cannot trace
- GET /report/export — no schema found, body left empty
- (closure/inline handler, no named target)
```

**The unresolved section is not optional and must never be omitted when empty
of content but non-empty in fact.** A map that hides its own gaps gets trusted
for coverage it does not have, which is the one failure mode that costs more
than having no map at all.

If nothing was unresolved, write `### Unresolved — none` explicitly, so the
reader can tell the check ran from the check being skipped.
