# apiflow — north star

> A **screen ↔ endpoint ↔ field** map for systems that talk over HTTP — laid out visually as nodes,
> the way n8n does it, and runnable as an e2e test.

**This file exists to stop the goal from drifting.** Read §2 and §7 before adding any feature. This
repo has already gone quiet for four months once; this file exists so that whoever comes back next
still knows what it is for.

Updated 2026-08-20. Siblings: `README.md` · `~/tools/repo-gates/NORTH-STAR.md` (the index of the four
products).

---

## 1. The question it answers

> **“If I change this, what else breaks?”** — answered **before** the edit.

apiflow's raw material: **screens ↔ endpoints ↔ fields.**

## 2. Who hurts, and why

**Who:** the person about to change an endpoint or a field who does not know which screens consume
it. And the person new to a large frontend who does not know which screen calls which API.

**The pain is NOT** “there is no tool for testing APIs” — that space is crowded, and Postman already
sits inside the owner's own pipeline.

**The pain is:** **nobody can answer “if I change this field, which screens break”.** Postman **does
not know your screens exist** — it stores requests, not the relationship between a request and the
UI. Swagger/OpenAPI describes the API, not who consumes it. Grepping a field name returns a thousand
lines that cannot tell a definition from a consumption.

## 3. Two uses — and the order of priority

1. **Reading (where it stands alone).** Which screen calls which API · how the APIs connect · where a
   field is used.
2. **Running (where it meets Postman).** That same map turned into an automated, visual e2e test flow.

**Keep that order.** Doing half 2 first is walking straight into an occupied product with a repo that
has zero tests.

| What already exists | Why it cannot replace this |
|---|---|
| Postman / Bruno / Insomnia | stores requests, **does not know screens exist** |
| OpenAPI / Swagger | describes the API, not its consumers |
| Playwright / Cypress | can run a flow, cannot **answer** the impact question |
| grepping a field name | cannot tell a definition from a consumption, has no structure |

## 4. The evidence today (measured 2026-08-19) — no varnish

```
0 tests                      — no *.test.*, no *.spec.*, no vitest/jest config
cannot build from a clone     — dist/ is gitignored, no node_modules → bin/cli.js dies at once
last commit 2026-04-27        — quiet for 3.7 months
2,123 lines of docs/proposals/* — the README is longer than the code
src/core/executor.ts:298      — the loop node is a NO-OP passthrough, despite a full UI and types
```

**Dealt with (2026-08-19, the same day).** The first four lines: 90 tests for `src/core/`;
`bin/cli.js` builds itself; the loop node is deleted. The `docs/proposals` line stands — §7 forbids
writing more, it does not require a cleanup. What was added: `scan-fe` · `scan-be` · `probe` ·
`link` · `impact` — extraction on both sides plus the join between them, none of which **existed**
before.

**What is genuinely good:** `src/core/` (1,435 lines) is really headless, shared by both the React app
and the MCP server — `src/engine/*` and `src/utils/*` are re-export shims, not copies. The executor
has retry/backoff, per-node auth, variable chaining, and branching with pruning. All four assertion
kinds are fully implemented. The cURL / OpenAPI 3.x / Postman parsers are real.

**The only piece that HAS ACTUALLY LIVED:** `skills/api-flow-analyzer/` — a byte-identical copy runs
inside an internal project, turning Laravel routes into a flow. It is the **agent-only** version of
what `scan-be` now does in code; it stays for the stacks the CLI does not cover yet.

The map has had both halves since 2026-08-19: `scan-fe` (screen → endpoint → fields read) and
`scan-be` + `probe` (endpoint → payload → response **measured with test data**), joined by `link`.

**Security — dealt with.** `.claude/` and `.mcp.json` in the working tree hold internal configuration
(a customer's hosts and operational skills). They were untracked but also **not ignored**, in a public
repo — a single `git add -A` would have published them. Now in `.gitignore`, commit `793f9ef` on
`main`. Neither had ever entered git, so **no history rewrite was needed**.

Do not write host or customer names into this file: it is public, so describing the leak mechanism is
enough — naming the thing that must stay hidden would redo the very leak just closed.

## 5. North star

> **The number of times a person answers “if I change this endpoint/field, which screens break” with
> apiflow — an answer they previously had to go and ask a colleague for.**

| Milestone | Target |
|---|---|
| 30 days | builds from a clean clone · the loop node is decided · `src/core/` has tests |
| 60 days | maps **one real frontend**: screen → endpoint → field |
| 90 days | answers **one real impact question** — or archive |

## 6. Kill criteria — the strictest of the four products

90 days without **mapping one real frontend and answering one real impact question** → archive the
repo.

Exactly three pieces would be kept:
1. `skills/api-flow-analyzer/` — it has actually lived inside an internal project.
2. `src/core/{postmanParser,openApiParser,curlParser,curlExporter}.ts` + `src/utils/postmanExporter.ts`
   → `forge/packages/core/src/integrations/postman/` (forge can write a collection but has no local
   parser/generator).
3. `src/core/{executor,assertionRunner,httpClient,variableResolver,topologicalSort}.ts`
   (~730 lines, zero deps) — an optional headless runner for the `forge-test` stage.

These survival conditions are written down because the root diagnosis was: **“done” was never
defined, so it was never possible to stop.**

## 7. Do not build

- **Do not build the “run the tests” half before the “map” half stands up.** That is walking into
  Postman with a repo that has zero tests.
- **Do not carry a stub forward.** The loop node: implement it, or delete both `LoopConfigTab` and
  `LoopNodeConfig`. A headline feature with a complete UI that does not run is worse than not having
  it.
- **Do not write more `docs/proposals/`.** It is already 2,123 lines for a repo with zero tests. That
  is the fingerprint of exactly the failure mode that killed four other repos.
- **Do not `git add -A` in this repo.** `.claude/` and `.mcp.json` are ignored now, but the repo is
  public and the working directory holds internal material.
- **Do not build more canvas before the extraction side exists.** The canvas is how the map **gets
  read** — meaningless while there is no map to read.

## 8. The road for this repo

This order replaces the old list (the previous version filed the canvas under “drop”, which is wrong
under the current positioning).

1. ✅ **Builds again from a clean clone.** `bin/cli.js` builds `dist/` itself when it is missing.
2. ✅ **The FE extraction side.** `apiflow scan-fe` + `.apimap` + `apiflow impact` +
   `skills/fe-map-extractor`.
2b. ✅ **The BE extraction side, in the CLI, plus probe.** `apiflow scan-be` (4 stacks + a generic
   pass), `apiflow probe` (real responses measured with test data), `apiflow link` (joins the two
   halves), `skills/be-map-extractor`. `api-flow-analyzer` is now the agent-only version of the same
   job.
3. ✅ **Decide the loop node.** Deleted.
4. ✅ **Tests for `src/core/`.** 90 tests: executor, assertionRunner, the three parsers, and the whole
   new map layer.
5. ✅ **Map one real frontend** (the 60-day milestone in §5) — done against a real Next.js + Strapi
   system: 196 FE endpoints · 419 BE endpoints · 166 seen from both sides. The impact answer was
   verified by hand: `GET /agents` → `/admin/agents`, through the right page → component → hook →
   api client chain. Left to do: resolve the Unresolved entries with hints, and run `probe` for real
   inside the project's own test suite.
6. **A map that a team and an agent can share** (moved ahead of the canvas — see §9, 2026-08-20).
   ✅ `.apimap` no longer carries machine paths (`metadata.root` is a repo id), so it can be committed
   and reviewed · ✅ `apiflow impact --json` + exit codes · ✅ `apiflow check` as a CI gate.
   ✅ `apiflow mcp map` (7 map-reading tools) + `skills/apiflow-impact` · ✅ wired into two real
   projects (`.mcp.json` + a block in `CLAUDE.md` + the skill — all three per-machine/gitignored
   files, so nothing touched those repos' histories).
   Left to do: **one place to keep the shared map** (the server keeps **maps**, not code — scanning
   still runs where the code is; the loopback fence must be **replaced** by auth, not removed), and
   the CI gate plus a map committed in the repo — both wait on the hosting decision, because a server
   takes the place of a committed map.

7. **A canvas that reads the map.** Only after §8.6 — layout via elkjs/dagre, collapsed by default,
   focus one node and expand by degree. Never render the whole map.
8. **Only then** consider binding it as an MCP into `pipelineConfig.states.testing.mcpServers`
   (`pipeline-config-schema.ts:245` — config only, no change to forge core).

Of the four products, apiflow goes public **last** — because **least has been built**, not because it
is worth less.

## 9. Decision log

- **2026-08-20** — **The map has to be *shareable* before the canvas is worth discussing.** The owner
  moved apiflow from a one-machine tool to **shared context** for a team and for agents, on two real
  projects. So §8.6 (canvas) drops down the list: a canvas is how **one person** reads the map, while
  what is missing is **many people and agents reading the same map**. Three things were done inside
  this decision: machine paths removed from `.apimap` (measured: two scans of the same commit produce
  byte-identical files, `grep '/home'` = 0), `impact --json` + exit codes for hooks and CI, and
  `apiflow check` as a CI gate. `check` caught **real** drift the day it was built: a project had
  edited its HTTP client after the previous scan → 190 → 182 calls, unresolved 6 → 7; the committed
  map was already wrong and nobody knew.
- **2026-08-20** — **If it goes on the web, the server keeps *maps*, not code.** Scanning needs the
  code on disk, so scanning belongs on a dev machine or the repo's CI; the server only receives the
  generated `.apimap`, keeps the registry plus history, and answers agents. It must not clone private
  repos to scan them itself (another token, another runner, more attack surface for a job that only
  needs to read results). And `apiflow ui` must not be opened to `0.0.0.0` (one person's machine
  becoming a dependency of the whole team — the loopback fence exists precisely to prevent that).
  Three conditions before anything is exposed on a network: real auth **replacing** the
  `localWritesOnly` fence, a registry keyed on **git remote + subdir** instead of machine paths, and
  the map served only behind auth on an internal network — an `.apimap` is a customer's internal API
  surface.
- **2026-08-19** — **A call site has to trace back to a screen, not stop at the api module.** Run for
  real against a Next.js app: only 13/203 calls resolved to a route, the rest stopped at `agentsApi`,
  `usersApi` — correct, but not the question in §1. Added `callerGraph`: the import graph plus
  same-file edges (a hook calling an api client), traced to the file that owns a route. After that:
  **254/321**. It distinguishes members, so `agentsApi.remove` does not drag in screens that only use
  `agentsApi.list`.
- **2026-08-19** — **Do not trust an OpenAPI spec as the source of a response.** A spec stale against
  the code is the normal case. Responses come from **the code** (Resource/DTO/`response_model`/struct
  tags), then get **confirmed by running for real against test data** — the generated harness runs
  inside the project's own test suite (PHPUnit `RefreshDatabase`, vitest+supertest, Go `httptest`,
  pytest `TestClient`), so it sits on a test database and never touches the real one. Each field
  carries `declared` and `observed` as separate flags: declared but not observed = the code is lying.
- **2026-08-19** — **The BE side uses the CLI too; an agent does not read the code.** Routes and
  payloads are declared statically, so scanning them in code is more accurate and cheaper. The agent
  is left with the four things a machine cannot do: filling in the probe harness, classifying a
  mismatched field (bug / conditional / scanner miss), and reporting.
- **2026-08-19** — **Join the FE and BE `.apimap`.** Matched on `METHOD + normalized path`, with
  suffix matching for a gateway prefix. It opens three questions neither half can answer alone: a
  field the API sends that no screen reads · a field declared but never sent · an endpoint no screen
  calls.
- **2026-08-19** — **The reading map lays out at render time and stores no coordinates.** Studied
  jsoncrack (Apache-2.0, `reaflow` → `elkjs` in a web worker, with a `NODE_LIMIT` because a DOM graph
  dies at scale): it never stores `x/y`. `.apiview` keeps coordinates, for flows a person laid out by
  hand; `.apimap` — a machine-generated map — stores relationships only. Nobody drags 300 nodes by
  hand, and generated coordinates would turn every re-scan into a whole-file diff. Same reason:
  `.apimap` has **no** `generatedAt`.
- **2026-08-19** — **The FE extraction side was the missing piece, not `api-flow-analyzer`.**
  `api-flow-analyzer` scans the **backend** (route → endpoint) — exactly what Swagger already does.
  The half that stands alone in §2 is *which screen consumes this endpoint*, and before that day
  there was not one line of code for it. Built: `scan-fe` (a deterministic CLI) +
  `skills/fe-map-extractor` (the agent handles only what the CLI cannot decide).
- **2026-08-19** — **Delete the loop node** instead of implementing it. §7 demands a decision; loop is
  a *running* feature, exactly the half being deprioritized.
- **2026-08-19** — **Withdrew the conclusion “apiflow owns nothing of its own”.** That conclusion was
  true of the value statement inferred *from the code* (a flow runner with a canvas, competing with
  Postman). The owner's statement is a screen ↔ API ↔ field dependency map — and under that, apiflow
  owns something real.
- **2026-08-19** — `api-flow-analyzer` promoted from “a fragment worth salvaging” to **the core of the
  product**.
- **2026-08-19** — Closed the `.claude/` + `.mcp.json` leak; commit `793f9ef`.
- **2026-08-19** — Remote switched to `git@github.com-junixlabs:junixlabs/apiflow.git` (the plain
  `git@github.com:` form authenticated as the wrong account and **the push was rejected**).
- **2026-04-27** — The last commit before the repo went quiet. The final piece of work was
  CONTRIBUTING/LICENSE/CHANGELOG, not the product.
