# apiflow — north star

> A **screen ↔ endpoint ↔ field** map for systems that talk over HTTP: an engine that produces a
> portable, git-diffable artifact, and hosts — a CLI, an MCP server, a page — that answer questions
> from it.

**This file exists to stop the goal from drifting.** Read §2 and §7 before adding any feature. This
repo has already gone quiet for four months once; this file exists so that whoever comes back next
still knows what it is for.

Updated 2026-08-22. Siblings: `README.md` · `~/tools/repo-gates/NORTH-STAR.md` (the index of the four
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

## 3. Two parts — the axis that decides everything

Updated 2026-08-22. The previous version of this section split the repo into *reading* and *running*.
That axis is still true but it is not the one that decides where code goes. This one is:

| Part | What it is | Where it runs | The rule that holds it |
|---|---|---|---|
| **1a — the format** (`packages/map`) | parse · query · serialize · link · diff | anywhere: node, a browser, a worker, a server process | **zero dependencies, zero node builtins.** Enforced in `.dependency-cruiser.cjs` |
| **1b — the extractor** (`packages/scan`) | source on disk → `.apimap` | a dev machine or the repo's CI | needs `fs`, so `map` may never import it |
| **2 — the hosts** (`packages/cli`) | commands · MCP · workspace · view · skills | wherever a person or an agent is | the CLI is the **reference implementation**; MCP borrows its resolution, never grows its own |

"Generate the file" is `scan` plus `map`'s serializer; "load the file" is `map`'s parser plus its
queries. The serializer lives with the parser because the intern/expand pair must round-trip and a
`cm:edge lockstep` across a package boundary is a lockstep nobody checks.

**Why `map` must stay pure is not tidiness.** A store needs I/O. Forbidding I/O forbids the kernel
growing a store — which is the only thing a hosted product would have left to sell. draw.io learned
this the expensive way: in 2024-08 it added a clause to its own Apache-2.0 licence to stop its open
core replacing its paid Confluence integration, and reverted it four months later
(`docs/research/product-shape.md` §4).

**What this repo is, and is not.** This repo is 1a, 1b and the local hosts — nothing else. Running
requests left on 2026-08-23 (`junixlabs/apiflow-runner`), and the hosted product, if it is ever
started, gets its own private repo that consumes `@junixlabs/apiflow-map` from npm rather than forking
it. The order still holds: the map first, anything that sends a request second.

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

The paragraph above describes code that is no longer here: `src/core/` became `packages/runner/src/core/`
and left for `junixlabs/apiflow-runner` on 2026-08-23. It is kept because this section is a dated
snapshot, and an audit whose findings get edited later is not an audit.

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
1. `packages/cli/skills/api-flow-analyzer/` — it has actually lived inside an internal project.
2. The collection parsers, now in `junixlabs/apiflow-runner` at
   `src/core/{postmanParser,openApiParser,curlParser,curlExporter}.ts` +
   `src/utils/postmanExporter.ts` → `forge/packages/core/src/integrations/postman/` (forge can write a
   collection but has no local parser/generator).
3. That repo's `src/core/{executor,assertionRunner,httpClient,variableResolver,topologicalSort}.ts`
   (~730 lines, zero deps) — an optional headless runner for the `forge-test` stage.
   Both now live outside this repo, so §6 archiving this one no longer touches them.

A fourth is now worth keeping and was not before: **`packages/map`** — zero dependencies, zero I/O,
and it is the whole answer to "which screens break". It is the piece another product could adopt
without adopting apiflow.

These survival conditions are written down because the root diagnosis was: **“done” was never
defined, so it was never possible to stop.**

## 7. Not yet — and the condition that opens each one

Updated 2026-08-22. This section used to be a list of prohibitions. A prohibition invites the
argument "this time is different". A **condition** can be checked, so it ends the argument instead.

| Not yet | Opens when |
|---|---|
| a hosted/SaaS map | a real CI is already pushing a map somewhere. Not before |
| OIDC, tenancy, sharing, RLS | there is a **second person** in an org. Not before |
| the canvas that reads the map | someone **asks for it twice**. It is how *one person* reads a map, and that is CodeSee's road, which ended in a shutdown |
| incremental scanning | one scan of a real repo passes **60 seconds** |
| an ingest envelope (commit, branch, sha) | something actually ingests |
| a schema-generated type layer | the first time a hand-written type and the format disagree, or the first externally-supplied `.apimap` arrives |

And these stay flatly forbidden, because each one has already cost this repo something:

- **Do not carry a stub forward.** A headline feature with a complete UI that does not run is worse
  than not having it. The loop node was deleted rather than finished, and that was right.
- **Do not write code for a consumer that does not exist.** This is the general form of the rule
  above, and it is what killed `docs/proposals/`: 1,544 lines of specification for a repo with zero
  tests.
- **Do not write a document for work that is not being done now.** `docs/guide/` is the only place
  documentation goes, every page there is replayed by CI, and a page may be written one step ahead of
  the code only as `status: upcoming` — which CI asserts is still failing.
- **Do not `git add -A` in this repo.** It is public and the working directory holds internal
  material. See the 2026-08-22 entry in §9: customer repo identifiers reached the public history once
  already.
- **Do not put a product UI in this repo.** The hosted/SaaS side, whenever §7 opens it, is a separate
  private repo that depends on `@junixlabs/apiflow-map` from npm. A shared `node_modules` holding
  React or an ORM makes `map-stays-pure` meaningless the day it lands, and that rule is what keeps a
  store out of the kernel (§3).
- **Do not point `probe --live` at anything but a test environment.** GET/HEAD-only and
  `--yes-remote` are the guards; they exist because a full authenticated walk was once launched at
  three GET routes that shell out to `supervisorctl`, and was stopped at position 376 of 382.

## 8. The road for this repo

Rewritten 2026-08-22. Items 1–5 of the previous list are done and stay done; what follows is what is
left, under the §3 axis.

1. ✅ **Builds from a clean clone** · **FE extraction** · **BE extraction + probe** · **the loop node
   decided (deleted)** · **tests for the core** · **one real frontend mapped** — all shipped between
   2026-08-19 and 2026-08-21.
2. ✅ **The structure is enforced, not described.** Three packages, five dependency-cruiser rules, CI on
   every push (it previously ran only on a version tag, so nothing was gated).
3. ✅ **Documentation that cannot go stale.** `docs/guide/` is replayed by `tests/guide.test.ts`;
   `shipped` must pass, `upcoming` must fail, `reference` must say why it cannot be replayed.
   `docs/proposals/`, `docs/architecture/` and `docs/decisions/` deleted.
4. **A map a team and an agent share — the part that does not need a server.** `.apimap` is already
   byte-identical and machine-path-free, `impact --json` and `check` already exist. What is left is
   the loop that closes deterministically: **apiflow's own map committed to this repo and gated by
   `apiflow check` in its own CI.** This was previously filed as waiting on a hosting decision. It is
   not: two people scanning one commit get identical bytes, so sharing needs no server, and hosting is
   a separate and later question (§7).
5. ✅ **The comment-grammar debt is paid and the gate is on.** `npm run codemap` runs in CI and reports
   **0 errors**; 157 of 160 legacy prose comments are cleaned and the remaining 3 are frozen, not
   invisible. The gate went on only after the number reached zero — a red gate teaches people to ignore
   gates.
6. ✅ **What the fixture found is fixed.** A client wrapper's own definition line was read as a call
   site, so `fixtures/demo-app/web` reported **5** `unresolved` for **3** real call sites — three of
   them permanently unresolvable, inside the one number the map promises never to fold into another.
   The discriminator is the body brace after the signature, and one shape now answers both questions:
   the call-site scanner and the wrapper walk read the same definition heads. Fixture `unresolved`
   **5 → 2**, `Calls` unchanged at 3, and the two that remain are real gaps. `docs/guide/02` flipped
   itself to `shipped` — the gate went red the moment the fix worked, which is what it was for.
7. **Decide what §5 measures.** The current north-star metric — "the number of times a person answers
   the impact question with apiflow" — is not instrumented and cannot be. The measurable candidates are
   Nx-shaped: how many times `check` blocked a stale map, how many `mcp map` calls a week from the
   projects it is wired into. **Open; the owner's call.**
8. ✅ **The runner's fate is decided: split out** to `junixlabs/apiflow-runner` on 2026-08-23, with
   history intact back to 2026-03-19. See the §9 entry. What stays open is whether `forge` takes the
   parsers per §6 — a question for `forge`, not for this repo.
9. ✅ **One published artifact, and a release path that fails loudly.** `map` and `scan` are private and
   bundled; `npm run verify:pack` asserts the tarball is self-contained and carries no internal
   material. Publishing `map` on its own is not forbidden — it is waiting on the same condition as
   everything else in §7: a second repo that reads a map.

## 9. Decision log

- **2026-08-23** — **The request runner is its own repo; this one is the engine only.** It was 9,873
  lines: 5,094 of React canvas with zero tests, against 1,729 lines of tested headless core. Split to
  `junixlabs/apiflow-runner` rather than retired, because the core is real — four working parsers, an
  executor with retry, branching and four assertion kinds — and because it holds the one thing the map
  cannot express: a value travelling from one response into the next request. No static analysis infers
  that; it exists only in a flow someone drew, so retiring it would delete the only place this project
  can say it.
  The measured reason to move it rather than a tidiness one: `react`, `react-dom`, `@xyflow/react`,
  `lucide-react` and `html-to-image` were runner-only, and published 1.1.13 shipped every one of them
  to anyone installing a CLI that needed a parser. After the split, `npm run boundary` cruises 61
  modules instead of 157, and frozen legacy-comment debt fell from 299 to 3 — it lived in the
  components.
  The cost, paid deliberately: a bare `apiflow` opened the canvas on every install since 1.0.0, and
  `apiflow mcp run` served 13 tools. Both now exit 1 with a pointer to the new package, because a
  published entry point that vanishes silently is worse than one that errors.
  **The release blocker this opened is closed** by the entry below: the two engine packages are bundled
  into the CLI's tarball rather than published.

- **2026-08-23** — **Three packages, one published artifact — and the release path is now checked.**
  The restructure the day before left `@junixlabs/apiflow` depending on two packages that do not exist
  on npm. Publishing all three was the obvious fix and the wrong one: the enforced boundary lives in
  `.dependency-cruiser.cjs` as **path** regexes (`^packages/map/`), so it costs nothing to keep and
  gains nothing from being published. `map` and `scan` are now `private: true` and bundled. They stay
  separate packages because that is what the rules hold against, and because `map` can then be
  published unchanged the day a second repo reads a map — the same shape as every other §7 condition.
  Two things were found while wiring it, and both **succeed silently** when wrong, which is why each
  now has a gate rather than a note. npm bundles from the packing package's own `node_modules`, which
  workspaces hoist to the root: without `scripts/prepack-bundle.mjs` materialising them, `npm pack`
  prints `bundled files: 0` and exits 0, publishing a tarball that cannot install. And `npm publish` at
  the repo root packs **170 files, `.forge/` and `CLAUDE.md` among them**, into a public tarball —
  `private: true` on the root was the only thing refusing it, and `publish.yml` pointed straight at it.
  The release now publishes the tarball `npm run verify:pack` checked, by path. Verified by installing
  it into an empty directory and running both halves: `scan-fe` wrote a map, `impact` read it back.

- **2026-08-22** — **Prose refuses no commit; the structure is now a package boundary.** The repo
  described "two halves" in a paragraph and enforced it with one lint rule over path regexes. It is now
  four packages with four rules that fail CI, and the load-bearing one is `map-stays-pure`: zero node
  builtins in `packages/map`. Verified by adding an `fs` import and watching the gate fail. That rule
  is a *business* boundary wearing a technical costume — a store needs I/O, so forbidding I/O forbids
  the kernel growing one, which is what draw.io's reverted 2024-08 licence clause was trying to do
  after the fact. Also: CI now runs on push and pull_request. It previously ran only on a version tag,
  which means for the whole life of the repo no rule had teeth on an ordinary commit.
- **2026-08-22** — **Documentation is executed or it is deleted.** Measured staleness: README claimed
  332 tests against 412; `RELEASE.md` still described v1.0.0 as a "Visual API flow testing tool" with
  Visual Canvas as its first highlight; `docs/proposals/` held 1,544 lines describing a positioning
  §9 had withdrawn on 2026-08-19 — and six of its eight files had been *translated to English* on
  2026-08-21, i.e. maintained rather than abandoned. None of it could fail anything. Now: `docs/guide/`
  only, every page a transcript CI replays. `upcoming` pages must FAIL, so a page can neither claim to
  work nor stay a roadmap after it works — status is a test result, not a label. `reference` is the one
  escape hatch and must state why it cannot be replayed. **This is document-first with the one property
  `docs/proposals/` lacked: a page can be wrong, and CI says so this week.**
- **2026-08-22** — **The fixture is a precondition for publishing, not a convenience.**
  `fixtures/demo-app/` exists because guide transcripts are published, and an `.apimap` of a real
  project is that project's internal API surface. It paid for itself immediately: writing the first
  page surfaced a scanner defect nobody had read the code closely enough to find — a wrapper's own
  definition line counted as an unresolved call site.
- **2026-08-22** — **Customer repo identifiers had reached the public history.**
  `scanOrigin.test.ts` carried real private-repo names, a vendored schema carried an internal org, and
  a mockup published a customer system's measured numbers. Unlike the `.claude/` leak §9 closed on
  2026-08-19 — which had never entered git — **this one is in pushed history**. Sanitized forward to
  neutral names (`acme`, `webapp`, `demo`); the history still holds it, and rewriting it is the owner's
  decision (0 stars, 0 forks, so it is still feasible). `.forge/` was left alone: it is vendored
  tooling that an upgrade overwrites.
- **2026-08-22** — **A quality loop can only be closed where there is no model in it.** An earlier
  draft of this plan proposed measuring whether the agent asks before it edits. That is a function of
  the model, the skill and the harness — none of which this repo controls. So: CI (`check`, exit codes)
  is the only place a hard gate belongs, and the agent surface is a *surface*, whose contract is
  stability and completeness instead. Concretely, that means refuse-and-enumerate over fuzzy matching,
  every answer carrying its own caveat, no silent truncation, and outputs that are valid inputs. The
  first three are already implemented; the fourth needs a round-trip test and does not have one yet.
- **2026-08-22** — **The CLI is the reference implementation and MCP is an adapter.** Both read the
  same kernel, so the accuracy gap is not the query layer — it is that MCP adds an argument-selection
  step performed by a model. `packages/cli/src/mcp/mapTools.ts` already imported the CLI's resolution;
  a `required` rule in `.dependency-cruiser.cjs` now makes that structural rather than accidental, and
  `mcp/` sits next to `commands/` so borrowing is the natural act and reimplementing is the odd one.
- **2026-08-22** — **AI-first does not need a new artifact; the writable surface already exists.** The
  earlier claim that a machine-generated `.apimap` closes off Mermaid's format-led road was too broad:
  the criterion is not "can a human write it" but "can whoever authors it emit it", and with agents as
  authors that holds. But what agents write is `hints.json`, not the map — a hinted call resolves to
  `inferred`, never `exact`, and the skill records a `note` "so the next reader can check you". That
  split must survive: `.apimap` is **evidence** while a diagram is **intent**, and an agent writing the
  map directly would reduce apiflow to asking a model which screens call an endpoint, which is the
  thing it exists to replace. The new risk this creates is that a confident `note` can be a guess, so
  `apiflow-map-audit` stops being optional at the point agents write a large share of the map.
- **2026-08-22** — **Shape: draw.io, not Mermaid Chart.** Free OSS core, no accounts, the artifact
  living in the user's own repo, distribution through a host that already has the users — GitHub PR
  checks, and the agent's context via MCP and skills. Mermaid Chart's shape (a standalone SaaS with
  accounts) was built by a funded company after the format had 8M users; apiflow has 9 downloads a
  week. Consequence taken deliberately: if the primary consumer is an agent, the canvas is not a
  priority. The honest gap, recorded so it is not glossed: draw.io works because the Atlassian
  Marketplace is a payment rail into an existing budget, and the AI-first channel has no equivalent
  rail yet. AI-first answers what to build and how to distribute, not how to charge.

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
