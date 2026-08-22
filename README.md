# apiflow

**A dependency map for systems that talk over HTTP** — screen ↔ endpoint ↔ field. It answers one
question, before you edit: **if I change this endpoint or this field, which screens break?**

Postman stores requests; it does not know your screens exist. OpenAPI describes the API, not who
consumes it. Grepping a field name returns a thousand lines that cannot tell a definition from a
consumption. apiflow reads both sides of the wire and keeps the `file:line` for every hop, so an
answer is checkable in thirty seconds rather than taken on trust.

Local-first, git-friendly, open source.

[![npm version](https://img.shields.io/npm/v/@junixlabs/apiflow.svg)](https://www.npmjs.com/package/@junixlabs/apiflow)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

![How apiflow builds and reads a dependency map](docs/img/workflow.svg)

## What each part is worth

| Capability | The value, stated plainly |
|---|---|
| `impact` | The blast radius of a change **before** you make it — which screens, through which client → hook → component chain, at which line. This is the product; everything else exists to make this answer trustworthy. |
| `scan-fe` | You learn which screens consume an API without reading the frontend yourself. Framework-agnostic: it reads call sites, not conventions. |
| `scan-be` | The API's own declared surface, so the two halves get compared instead of assumed. |
| `probe` | Response shapes **confirmed by running**. Turns "the code declares this field" into "the API actually sent it" — the only version safe to build on. Two modes, and the difference matters: `--emit` writes a harness that runs inside the project's own test suite, on a test database; `--live` sends **real requests** to a running API — GET/HEAD only by default, and a non-localhost host needs `--yes-remote`. |
| `link` | Three questions neither half can answer alone: a field the API sends that no screen reads · a field declared but never sent · an endpoint no screen calls. |
| `check` | The map cannot go stale quietly. A CI gate: exit 0 clean · 1 drifted · 2 cannot check. |
| `mcp map` | Your agent asks before it edits a route, a handler, an api client or a response field. 0.4s to connect, 5ms per call on a clean install. |
| [`apiflow-map-audit`](packages/cli/skills/apiflow-map-audit/) | A **skill**, not a command: "how much can I trust this map" becomes a measured number for your repo instead of a label. |
| `ui` · `hub` · `view` | A page you can hand to someone who will never run a CLI. |

## Quick start

```bash
npm install -g @junixlabs/apiflow                                          # or: npx @junixlabs/apiflow …
apiflow project add "web" --fe=/path/to/frontend [--be=/path/to/api]       # ~1s
apiflow project scan web                                                   # 3s–15s
apiflow ui                                                                 # http://127.0.0.1:3030
```

Nothing is written into the project being scanned — maps live in `~/.apiflow/`
(`APIFLOW_HOME` moves that). One side is enough; `--be` is optional.

From a clone, `node packages/cli/bin/cli.js …` replaces `apiflow …` and needs no build:

```bash
git clone https://github.com/junixlabs/apiflow.git && cd apiflow && npm install   # ~15s
node packages/cli/bin/cli.js --help
```

## Ask

List first, then ask — don't guess an endpoint string.

```bash
MAP=~/.apiflow/projects/web/fe.apimap
apiflow impact $MAP                                  # every endpoint, with caller counts
apiflow impact $MAP --endpoint="GET /users/:id"       # which screens break
apiflow impact $MAP --field=email                     # which screens read this field
apiflow impact $MAP --screen=/users/:id               # what one screen depends on
```

```
## Impact — GET /api/users/{param}

3 screen(s) break if this changes:

- **/users/{param}** [exact] — src/pages/users/[id].tsx:14
  client    fetchUser   src/api/users.ts:8
  ↳ hook      useUser     src/hooks/useUser.ts:12
  ↳ screen    UserPage    src/pages/users/[id].tsx:14
```

## Why the labels are the point

An answer without its confidence is a liability, so every claim carries one and they are
load-bearing:

| | |
|---|---|
| `exact` | the path is a literal at the call site |
| `inferred` | one half was derived — a template string, an implicit verb |
| `guess` | the path was assembled, or the screen was reached through a wide module hop |
| **unresolved** | call sites the scanner could **not** read. `0 screens` means *nothing in this map calls it* — never *nothing calls it* |

Unresolved is never folded into another number, and an alert (understood, and dangerous) is never
counted together with an unresolved (not understood at all).

Audited on a real Next.js app — 28 `guess`-level claims sampled with
[`apiflow-map-audit`](packages/cli/skills/apiflow-map-audit/): the **endpoint was right 28/28**, the
**screen 17/28**. Both numbers matter. Read `exact` and `inferred` as answers, `guess` as a lead
worth thirty seconds — and run the audit against your own repo rather than trusting ours.

## For an agent

```json
{ "mcpServers": { "apiflow-map": {
  "command": "apiflow", "args": ["mcp", "map"],
  "env": { "APIFLOW_PROJECT": "web" } } } }
```

From a clone, or when the agent's environment has a trimmed `PATH`, spell it out instead:
`"command": "node", "args": ["/path/to/apiflow/packages/cli/bin/cli.js", "mcp", "map"]`.

Seven read-only tools — `impact_endpoint` · `impact_field` · `screen_deps` · `find` · `map_health` ·
`map_check` · `map_list`. Every answer ends with the map it came from and its unresolved count, so an
agent cannot quote a number without its caveat.

Four skills, each with one job: [`apiflow-impact`](packages/cli/skills/apiflow-impact/) tells the agent *when* to
ask · [`fe-map-extractor`](packages/cli/skills/fe-map-extractor/) and
[`be-map-extractor`](packages/cli/skills/be-map-extractor/) resolve what the scanner could not read ·
[`apiflow-map-audit`](packages/cli/skills/apiflow-map-audit/) measures how often the map is right.

## Keep the map honest

```bash
apiflow check $MAP        # exit 0 clean · 1 drifted · 2 cannot check
apiflow check $MAP --write
apiflow project scan web
```

A scan of an unchanged repo is **byte-identical**, and the file records the repo it came from
(`github.com/acme/app//apps/web`) rather than the machine it ran on — so it can be committed,
reviewed in a pull request, and gated in CI. Two people scanning the same commit get the same bytes,
which is why sharing a map needs no server.

## What it reads

| Side | Coverage |
|---|---|
| Frontend | framework-agnostic — it reads call sites, not conventions, then walks the import graph back to the screen (`client → hook → component → route`), keeping `file:line` for every hop |
| Backend | Laravel · Strapi · NestJS/Express · Go (gin/chi/echo/fiber) · FastAPI/Flask, plus a generic pass on every file |
| Response shapes | from code (Resource / DTO / `response_model` / struct tags), then **confirmed by running**. `probe --emit` writes a harness for the project's own test suite (PHPUnit · vitest+supertest · Go `httptest` · pytest), so it sits on a test database. `probe --live` is the other mode and it does send real requests — never point it at production; see [the probe page](docs/guide/03-probe.md) |

## What it does not answer yet

**"If I change API A, which other APIs are affected — and which value does B take from A?"**

The map connects screens to endpoints and endpoints to fields. It does not yet record that a value
read from A's response is later sent to B, so it cannot walk an API-to-API chain. `screen_deps`
shows which endpoints travel together on one screen, which is a weak proxy and should not be read as
a data dependency. The explicit form of that relationship exists only in the hand-built flows of the
request runner (`{{nodes["Get Product"].response.body.id}}`), never inferred from code.

## Commands

| Command | What it does |
|---|---|
| `project add \| ls \| scan \| rm` | the workspace registry in `~/.apiflow` |
| `scan-fe <dir>` | frontend → screens, endpoints, fields |
| `scan-be <dir>` | backend → routes, payloads, response shapes |
| `probe <map>` | emit a harness, ingest real responses |
| `link <fe> <be>` | join the two halves |
| `impact <map>` | which screens break — `--endpoint` / `--field` / `--screen`, `--json` |
| `check <map>` | is the map still true — CI gate, `--write` to refresh |
| `ui` · `hub` · `view` | browser UI (live, static workspace, single map) |
| `mcp map` · `mcp run` | MCP servers: read the map (7 tools) · run requests (13 tools) |

`apiflow --help` prints this list. Every command takes `--json` where a machine might read it.

## The other half — running requests

The visual flow runner (canvas, response chaining, assertions, cURL/OpenAPI/Postman import) is the
older half of this repo and is deliberately second in line — see [`NORTH-STAR.md`](./NORTH-STAR.md)
§3 and [`docs/request-runner.md`](docs/request-runner.md).

```bash
npx @junixlabs/apiflow            # canvas + proxy
npm run dev                       # from a clone
```

## Docs

Every page in `docs/guide/` is a **transcript replayed by CI** — see
[how that works](docs/guide/README.md). A page that stops matching what the tool prints fails the
build, so none of this can go stale quietly.

- [Your first impact answer](docs/guide/01-first-answer.md) — the whole path against a fixture in this repo
- [A wrapper definition is not a call](docs/guide/02-a-wrapper-definition-is-not-a-call.md) — `upcoming`: a real defect, written down before it is fixed
- [probe](docs/guide/03-probe.md) — record real responses, so a field is `observed` and not only declared
- [FE here, BE elsewhere](docs/guide/04-two-machines.md) — two machines, one map, no server
- [The `.apimap` format](packages/map/SPEC.md) — the public contract
- [What kind of product this is](docs/research/product-shape.md) — the category, the graveyard, and why the shape is what it is
- [`CHANGELOG.md`](./CHANGELOG.md)

## How it is put together

Four packages, and the boundary between them is enforced rather than described.

| Package | Role | Rule that holds it |
|---|---|---|
| `packages/map` | the format: parse · query · serialize · link · diff | **zero dependencies, zero node builtins.** It is the only half that runs in a browser, a worker or a server process |
| `packages/scan` | the extractor: source on disk → `.apimap` | may never be imported by `map` |
| `packages/cli` | the reference implementation: commands · MCP · workspace · view · skills | `mcp/mapTools.ts` must depend on `commands/` — MCP borrows the CLI's resolution, never grows its own |
| `packages/runner` | the visual request runner (the older half) | the two halves import each other zero times |

The accuracy difference between the CLI and MCP is not the query layer — both read the same kernel.
It is that MCP adds an argument-selection step performed by a model. Hence: list first, then ask.

## Contributing

```bash
git clone https://github.com/junixlabs/apiflow.git && cd apiflow && npm install
npm test          # 417 tests, including the docs/guide transcripts
npm run lint
npm run boundary  # the four structural rules
npm run codemap   # the comment convention, at zero errors
npm run build
```

**Read [`NORTH-STAR.md`](./NORTH-STAR.md) before proposing a feature** — §2 is the pain this exists
for, §7 is what will not be built. A proposal that cannot be traced back to §2 is refused, including
the API-to-API question above.

PRs welcome. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

## License

MIT — see [LICENSE](LICENSE).
