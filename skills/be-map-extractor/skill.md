---
name: be-map-extractor
description: >
  Map a backend's API surface — routes, request payloads and response shapes —
  and confirm the shapes against real responses produced with test data, never
  the live database. Use when the user asks to: map a backend's endpoints,
  extract request/response schemas, verify what an API actually returns, probe
  an API with test data, check whether a DTO matches reality, or link a backend
  map to a frontend .apimap for field-level impact.
---

# BE Map Extractor

Produce an `.apimap` for a backend, confirm its response shapes by running the API against test
data, then link it to the frontend map so field-level impact questions become answerable.

**The CLI does the reading. You do four things it cannot**: fill in the probe harness, decide what
an unresolved route really is, judge whether a mismatch is a bug or a scanner miss, and report.

## Why a probe exists at all

A static scan sees what the code **declares**. It cannot see what the API **sends** — a Resource
that merges extra attributes, a serializer that drops nulls, a middleware that wraps everything in
`{data: …}`. Do not present a code-only map as the API's contract.

The probe closes that gap by running each endpoint **inside the project's own test runner**, which
already points at the test database and rolls back. Never point a probe at a live or staging
database to get a nicer-looking map.

## Process

### 1. Scan

```bash
npx @junixlabs/apiflow scan-be <backend-root> --name=<name>
```

Detects the stack from marker files (`artisan` → Laravel, `go.mod` → Go, `package.json` → Node,
`pyproject.toml`/`requirements.txt` → Python) and writes
`<backend-root>/.apiview/map/<name>.apimap`.

What it extracts per stack:

| Stack | Routes | Request shape | Response shape |
|---|---|---|---|
| Laravel | `Route::verb`, `Route::resource` expanded to 5, `prefix()` groups | FormRequest `rules()` | API Resource `toArray()` |
| Node | NestJS `@Controller` + `@Get`, Express/Fastify `app.verb` | Zod `z.object`, class-validator DTO | return DTO |
| Go | gin/chi/echo/fiber verbs, `HandleFunc` + `.Methods()`, Go 1.22 `"POST /x"` | struct `json:` tags | struct `json:` tags |
| Python | FastAPI `@app.get`, Flask `@app.route(methods=[…])` | Pydantic model on the body param | `response_model=` |

A generic pass also runs on every file, so a sidecar service in another language is not lost.

### 2. Read the report, not the repo

`### Shapes still unknown` lists routes with neither shape found. That list is your work queue and
it is also the probe's reason to exist.

If `**Endpoints**` looks far too low for the repo, the router is doing something the patterns miss
(a route table built from config, a package that registers routes dynamically). Say so, name the
file, and do not pad the map by hand.

### 3. Emit the probe harness

```bash
npx @junixlabs/apiflow probe <map.apimap> --emit
```

Writes a test file in the project's own framework. Then **fill every `/* apiflow:fill */` marker**:

- the app instance the project's existing tests boot,
- authentication — reuse the project's own test login helper (`actingAs`, a test token factory),
- fixture ids — create rows with the project's factories/fixtures and substitute the real key for
  `{param}`.

Read one existing test in the project first and copy how it does all three. Do not invent a new
bootstrap; if the project's tests do not have a working database setup, stop and say so rather
than pointing the harness somewhere real.

### 4. Run it and feed the result back

```bash
<the runWith command the emit step printed>
npx @junixlabs/apiflow probe <map.apimap> --ingest=<root>/apiflow-probe.json
```

Only 2xx responses with a body are ingested; a 401 or 500 body is the error envelope, not the
contract, and gets listed as skipped. A large skipped list means auth or fixtures are not set up
yet — go back to step 3 rather than accepting the map.

The ingest report prints **Declared in code but never sent**. Each line is one of:

- a real bug — the DTO promises a field the code does not send,
- a conditional field — only present for some roles/states, so probe that case too,
- a scanner miss — the shape came from a class that is not actually this endpoint's response.

**Decide which, per field, and say which.** This is the judgement the CLI cannot make.

### 5. Link to the frontend map

```bash
npx @junixlabs/apiflow link <fe.apimap> <be.apimap> --out=<joined.apimap>
npx @junixlabs/apiflow impact <joined.apimap> --field=email
```

Endpoints join on `METHOD + normalized path`; a gateway prefix that only the frontend sees is
recovered by suffix matching when exactly one candidate matches. If **Endpoints seen from both
sides** is near zero, the two halves disagree about the base path — report that instead of the
audit, because every audit number below it will be wrong.

The linked map answers three things neither half could alone:

- **fields the API sends that no screen reads** — dead payload, safe-to-remove candidates,
- **fields declared but never sent** — the code lying about its own contract,
- **endpoints no screen calls** — dead routes, or a frontend the scan did not cover.

Each is a *candidate*, not a verdict: another client (mobile, a partner, a cron) may consume what
this frontend does not. Say that when you report them.

### 6. Report

```
## BE Map — {name}

**Backend**: {path} · **Stack**: {stack}
**Endpoints**: {n} ({n} behind auth)
**Shapes**: {n} declared in code · {n} confirmed by probe · {n} still unknown

### Probe
{how the harness was wired: which fixture helper, which auth path, how many endpoints returned 2xx}

### Declared but never sent — {n}
- `field` — {bug | conditional | scanner miss}, with the reason

### Still unknown — {n or "none"}
- METHOD /path — {why: dynamic dispatch, config-driven routing, no schema anywhere}

### Confidence
{one honest sentence: what fraction of response shapes is observed rather than assumed}
```

`Still unknown` and `Confidence` are not optional. A map that hides its own gaps gets trusted for
coverage it does not have — and here that means someone deletes a field believing nothing reads it.
