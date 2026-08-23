# apiflow

**A dependency map for systems that talk over HTTP** — screen ↔ endpoint ↔ field. It answers one
question, before you edit: **if I change this endpoint or this field, which screens break?**

Postman stores requests; it does not know your screens exist. OpenAPI describes the API, not who
consumes it. Grepping a field name cannot tell a definition from a consumption. apiflow reads both
sides of the wire and keeps the `file:line` for every hop, so an answer is checkable in thirty
seconds rather than taken on trust.

Local-first, git-friendly, open source.

[![npm version](https://img.shields.io/npm/v/@junixlabs/apiflow.svg)](https://www.npmjs.com/package/@junixlabs/apiflow)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

📖 **[Documentation](https://junixlabs.github.io/apiflow/)** — every page there is a transcript CI
replays, so it cannot go stale quietly.

![How apiflow builds and reads a dependency map](docs/img/workflow.svg)

## Quick start

```bash
npm install -g @junixlabs/apiflow                                     # or: npx @junixlabs/apiflow …
apiflow project add "web" --fe=/path/to/frontend [--be=/path/to/api]
apiflow project scan web
apiflow ui                                                            # http://127.0.0.1:3030
```

Nothing is written into the project being scanned — maps live in `~/.apiflow/` (`APIFLOW_HOME` moves
that). One side is enough; `--be` is optional.

## Ask

List first, then ask — don't guess an endpoint string.

```bash
MAP=~/.apiflow/projects/web/fe.apimap
apiflow impact $MAP                                  # every endpoint, with caller counts
apiflow impact $MAP --endpoint="GET /users/:id"       # which screens break
apiflow impact $MAP --field=email                     # which screens read this field
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

An answer without its confidence is a liability, so every claim carries one:

| Label | What it means |
|---|---|
| `exact` | the path is a literal at the call site |
| `inferred` | one half was derived — a template string, an implicit verb |
| `guess` | the path was assembled, or the screen was reached through a wide module hop |
| **unresolved** | call sites the scanner could **not** read. `0 screens` means *nothing in this map calls it* — never *nothing calls it* |

`unresolved` is never folded into another number. Audited on a real Next.js app with
[`apiflow-map-audit`](packages/cli/skills/apiflow-map-audit/): 28 `guess`-level claims sampled, the
**endpoint right 28/28**, the **screen 17/28** — run it against your own repo rather than trusting
ours.

## Commands

| Command | What it does |
|---|---|
| `project add \| ls \| scan \| rm` | the workspace registry in `~/.apiflow` |
| `scan-fe <dir>` | frontend → screens, endpoints, fields |
| `scan-be <dir>` | backend → routes, payloads, response shapes |
| `probe <map>` | confirm shapes by running — `--emit` a harness for the project's own test suite, or `--live` against a running API |
| `link <fe> <be>` | join the two halves: a field sent but never read, declared but never sent, an endpoint nobody calls |
| `impact <map>` | which screens break — `--endpoint` / `--field` / `--screen`, `--json` |
| `check <map>` | is the map still true — CI gate, exit 0 clean · 1 drifted · 2 cannot check |
| `diff <a> <b>` | two map files, no source and any generator — did the build match the map it was designed from? exit 0 match · 1 diverged · 2 no verdict |
| `ui` · `hub` · `view` | browser UI (live, static workspace, single map) |
| `mcp map` | MCP server for an agent: 7 read-only tools over the map |

Every command takes `--json` where a machine might read it. A scan of an unchanged repo is
**byte-identical** and records the repo it came from, never the machine — so a map can be committed,
reviewed in a PR, and gated in CI without a server.

**Backends read today:** Laravel · Strapi · NestJS/Express · Go (gin/chi/echo/fiber) ·
FastAPI/Flask, plus a generic pass. The frontend side is framework-agnostic: it reads call sites,
not conventions.

## For an agent

```json
{ "mcpServers": { "apiflow-map": {
  "command": "apiflow", "args": ["mcp", "map"],
  "env": { "APIFLOW_PROJECT": "web" } } } }
```

Seven read-only tools. Every answer ends with the map it came from and its unresolved count, so an
agent cannot quote a number without its caveat. Four [skills](packages/cli/skills/) cover when to
ask, how to resolve what the scanner could not read, and how to measure the map's accuracy.

## What it does not answer yet

**"If I change API A, which other APIs are affected?"** The map connects screens to endpoints and
endpoints to fields; it does not record that a value from A's response is later sent to B, so it
cannot walk an API-to-API chain. `screen_deps` shows which endpoints travel together on one screen —
a weak proxy, not a data dependency.

## How it is put together

Three packages, one published artifact. The boundary between them is enforced rather than described.

| Package | Role | Rule that holds it |
|---|---|---|
| `packages/map` | the format: parse · query · serialize · link · diff | **zero dependencies, zero node builtins** — the only half that runs in a browser or a worker |
| `packages/scan` | the extractor: source on disk → `.apimap` | may never be imported by `map` |
| `packages/cli` | the reference implementation: commands · MCP · workspace · view · skills | `mcp/mapTools.ts` must depend on `commands/` — MCP borrows the CLI's resolution |

The visual request runner that used to be the fourth package — canvas, flow execution,
cURL/OpenAPI/Postman import — is now
[junixlabs/apiflow-runner](https://github.com/junixlabs/apiflow-runner). It answered a bare `apiflow`
and `apiflow mcp run`; both now print where it went. That split is why installing this no longer
pulls React into your dependency tree.

`npm install @junixlabs/apiflow` gives you **one** package: `map` and `scan` are bundled into its
tarball, not fetched. They are separate packages so the rules above have something to hold and so
`map` can be published the day a second repo reads a map — not so you have three installs to keep in
step. `npm run verify:pack` asserts the tarball is self-contained, and the release publishes exactly
the tarball it verified.

The accuracy gap between the CLI and MCP is not the query layer — both read the same kernel. It is
that MCP adds an argument-selection step performed by a model. Hence: list first, then ask.

## Contributing

Six gates, the docs-authoring rule and the diagram convention are in
[`CONTRIBUTING.md`](./CONTRIBUTING.md). **Read [`NORTH-STAR.md`](./NORTH-STAR.md) before proposing a
feature** — §2 is the pain this exists for, §7 is what will not be built. A proposal that cannot be
traced back to §2 is refused, including the API-to-API question above.

[Code of Conduct](CODE_OF_CONDUCT.md) · [`CHANGELOG.md`](./CHANGELOG.md)

## License

MIT — see [LICENSE](LICENSE).
