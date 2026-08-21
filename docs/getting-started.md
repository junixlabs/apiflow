# Getting started

The whole path, with the output you should actually see. Measured on a clean clone.

## 1. Install

```bash
npm install -g @junixlabs/apiflow     # then: apiflow --help
```

Or from a clone (~15s), which is also the contributor path — every `apiflow …` below becomes
`node bin/cli.js …`:

```bash
git clone https://github.com/junixlabs/apiflow.git && cd apiflow && npm install
node bin/cli.js --help
```

No build step is needed for anything on the map side. `apiflow` with no subcommand (the canvas app)
builds `dist/` on first run; the map commands never touch it.

## 2. Register a project (~1s)

```bash
apiflow project add "web" --fe=/path/to/frontend --be=/path/to/api
```

```
Added **web** — web
- FE /path/to/frontend
- BE /path/to/api

Workspace: /home/you/.apiflow
```

One side is enough — a frontend-only project is a valid project. The registry holds the paths;
nothing is written into the project itself. `APIFLOW_HOME=/tmp/scratch` gives you a throwaway
workspace, which is the easiest way to try this without disturbing anything.

## 3. Scan (3s–15s)

```bash
apiflow project scan web
```

```
wrote /home/you/.apiflow/projects/web/fe.apimap
web/fe — fe done — 89 endpoints · 27 screens
wrote /home/you/.apiflow/projects/web/be.apimap
re-linked: 91 endpoints · web/linked.apimap
web/be — be done — 2 endpoints · 0 screens
```

Reference points: a 280-file React frontend takes **0.9s**; a 1583-endpoint pair of repos
(565 frontend + 1018 backend endpoints) takes **14s** for both sides plus the join.

Re-running on an unchanged repo produces a **byte-identical** file — there is no timestamp in it, so
it diffs cleanly and two people scanning the same commit get the same bytes.

## 4. Look at it

```bash
apiflow ui                  # http://127.0.0.1:3030
```

The hub lists every project; opening one gives nine panes — overview, endpoints, coverage map,
impact ring, impact for one endpoint, screens, unresolved, alerts, and a comparison against the
previous scan. It binds `127.0.0.1` only and has no flag to widen that.

Prefer a file you can send to someone? `apiflow view $MAP --out=map.html` writes one
self-contained page, and `hub --out=<dir>` writes the whole workspace as static HTML.

## 5. Ask

```bash
MAP=~/.apiflow/projects/web/fe.apimap
apiflow impact $MAP | head -20
```

List first. Guessing an endpoint string is the most common way to get an empty answer:

```
## web — 89 endpoint(s), 27 screen(s)

- DELETE /admin/credentials/{param} — 1 caller(s)
- DELETE /admin/users/{param} — 1 caller(s)
...
```

Then ask for one of them:

```bash
apiflow impact $MAP --endpoint="GET /orgs"
apiflow impact $MAP --field=email
apiflow impact $MAP --screen=/users/:id
apiflow impact $MAP --endpoint="GET /orgs" --json   # exit 0 found · 2 nothing found
```

```
## Impact — GET /orgs

8 screen(s) break if this changes:

- **/_authenticated/members** [inferred] — src/lib/orgs-api.ts:22 · via 3 hop(s) → src/routes/_authenticated/members.tsx:11
  client    useOrgs  src/lib/orgs-api.ts:19
  ↳ component Members  src/features/members/index.tsx:41
  ↳ screen    Route  src/routes/_authenticated/members.tsx:11
```

If you name a verb the map does not have on that path, it says so and names the verbs it does have —
it will not silently answer about a different method. A miss reads `Nothing matches GET /api/auth/me
in web.`, never an empty list.

## 6. Wire it into an agent

`.mcp.json` in the repo you work in:

```json
{ "mcpServers": { "apiflow-map": {
  "command": "node", "args": ["/path/to/apiflow/bin/cli.js", "mcp", "map"],
  "env": { "APIFLOW_PROJECT": "web" } } } }
```

Restart the session — MCP servers are started once, at session start. Then the agent has
`impact_endpoint`, `impact_field`, `screen_deps`, `find`, `map_health`, `map_check` and `map_list`.

Install the companion skill so the agent knows *when* to ask:

```bash
mkdir -p /path/to/your-repo/.claude/skills
ln -s /path/to/apiflow/skills/apiflow-impact /path/to/your-repo/.claude/skills/apiflow-impact
```

For a monorepo, or for a pair of repos that form one system, point every `.mcp.json` at the **same**
`APIFLOW_PROJECT`. Then asking `impact_endpoint` from inside the API repo answers with frontend
screens — which is the thing neither repo can answer on its own.

## 7. Keep it from going stale

```bash
apiflow check $MAP            # exit 0 clean · 1 drifted · 2 cannot check
apiflow check $MAP --write    # refresh in place
```

`check` re-scans and compares. It names the endpoints that appeared or vanished, and it separates
"different bytes, same counts" — usually code that moved, taking every `file:line` with it — from a
real change in the endpoint list. Both are drift: `file:line` is the part a reader clicks.

Cheap enough for CI: 0.55s–1.5s per side. A map committed in the repo plus `check` in the pipeline
means a pull request that changes the API surface shows the map diff next to the code diff.

## When a map looks thin

The tool tells you which of these you are in — `map_health`, or the alerts pane.

| Symptom | What it means |
|---|---|
| `exact 0`, everything `guess` | every call goes through a wrapper (`apiFetch<T>(path)`), so no path is a literal at the call site. The endpoints are still right; the confidence is honest about how they were derived |
| `0 fields` | responses are never destructured at the call site (typical with react-query + typed wrappers). The shape lives in the type argument, which the scanner does not read yet |
| a long **unresolved** list | the scanner met a variable URL. Feed it back with `--hints=`, or let [`skills/fe-map-extractor/`](../skills/fe-map-extractor/) resolve them |
| **one** `be-partial` alert | the backend reader understood far fewer routes than the frontend calls, so the comparison is suppressed on purpose. Do **not** act on "frontend calls it, the API does not declare it" while this fires — that column is the reader's blind spot, not a defect in the API |
| `0 screens` for an endpoint you know is used | nothing *in this map* calls it. Check the unresolved count in the same answer before concluding anything |

## Where things live

```
~/.apiflow/
├── workspace.json                 # the registry: id, name, fe/be paths
└── projects/<id>/
    ├── fe.apimap                  # frontend side
    ├── be.apimap                  # backend side
    ├── linked.apimap              # the join, rebuilt after either side is scanned
    └── history/                   # previous scans, for the comparison pane
```

Nothing is ever written into the project being scanned unless you point `--out` there yourself.
