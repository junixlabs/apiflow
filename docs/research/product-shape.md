# What kind of product this is

Researched 2026-08-22. Written down so nobody has to research it again in three months.

## 1. The category has a name and a reference architecture

apiflow is an **indexer + index format + query kernel**: a producer reads source, emits a portable
artifact, a consumer queries it. That is a known shape, not an invention.

| Product | Producer | Artifact | Consumer |
|---|---|---|---|
| [SCIP](https://scip-code.org/) (Sourcegraph, replaced LSIF) | ~9 indexers: `scip-java`, `scip-typescript`, `rust-analyzer`, `scip-clang`, `scip-python` | protobuf index | Sourcegraph, Searchfox, Glean, GitLab |
| [Code Property Graph](https://github.com/ShiftLeftSecurity/codepropertygraph) (Joern) | per-language frontends | `cpg.proto`, published as a *suggested open standard* | CPGQL |
| CodeQL | `codeql database create` | database | query packs |
| [OpenRewrite / Moderne](https://docs.openrewrite.org/concepts-and-explanations/lossless-semantic-trees) | OpenRewrite engine | LST | recipes |
| [Nx](https://nx.dev/docs/features/ci-features/affected) | `nx graph` | project graph JSON | `nx affected` |
| SBOM | many generators | CycloneDX / SPDX | many scanners |

Using this vocabulary means the design decisions can be inherited.

## 2. Four lessons SCIP drew from LSIF — apiflow already had two

Sourcegraph's [SCIP announcement](https://sourcegraph.com/blog/announcing-scip) names why LSIF failed.

| LSIF's fault | apiflow |
|---|---|
| no machine-readable schema → no static types, slow development | **missing.** TypeScript types are hand-written, i.e. the source rather than a derivative. A schema should be the source and the types generated from it |
| opaque numeric ids → undebuggable by eye, blocks incremental indexing | **already right**, and it is the strongest property here: `endpointId`/`screenId`/`slug` derive from content and read as text. One partial violation: `serializeMap` interns chain nodes to integer indices (159% → 70% file growth), bounded by `expandChains` so nothing above the format sees an index |
| slow, large in-memory structures | measured: 2.24 MB file → 7.0 MB parsed heap on the largest real map. Fine now; this is what breaks at 10× |
| global ids block incremental indexing | content-derived ids make incremental scanning *possible*; nothing implements it. At monorepo scale, "re-scan everything" is what kills adoption |

**Protobuf vs JSON: diverge on purpose.** SCIP chose protobuf (10–20% smaller, static types).
apiflow's JSON has a property protobuf cannot easily give: byte-identical, git-diffable, reviewable in
a pull request. That is the whole basis of committing the map. Keep JSON.

## 3. The graveyard, and what the survivors have in common

| | What it was | How it ended |
|---|---|---|
| **CodeSee** | code-map SaaS, auto-generated maps *without storing code* | announced shutdown 2024-02; [acquired by GitKraken 2024-05](https://www.gitkraken.com/blog/gitkraken-launches-devex-platform-acquires-codesee) |
| **Optic** | API diff/drift, MIT | [Atlassian 2024-04](https://www.atlassian.com/blog/announcements/optic-acquisition) → [repo archived 2026-01](https://specshield.io/blog/optic-is-dead-migration-guide), never integrated |
| **Akita** | API discovery from traffic | [Postman 2023-07](https://www.businesswire.com/news/home/20230719991128/en/Postman-Acquires-Akita-Software-to-Help-Build-the-Future-of-API-Observability) |
| **blast-radius.dev** | PR-time impact analysis for API/schema/contract changes across repos | **defunct.** The author's own conclusion: *"the problem exists, it's not a priority for teams right now"* |
| **Sourcetrail** | OSS desktop code explorer | company closed, [archived end of 2021](https://news.ycombinator.com/item?id=28637193); 1,600+ forks, no successor product |

| Survivor | Why |
|---|---|
| Moderne / OpenRewrite | recipes **change code**: 38,000 call sites across 400 repos, with an audit trail. The artifact is a means |
| Nx | `nx affected` **cuts CI time**. The graph pays for itself in minutes not spent |
| SCIP / Sourcegraph | open format, many indexers; the company sells search and serving, not the format |
| CodeQL | free for open source, [license-gated for non-OSS codebases](https://github.com/github/codeql-cli-binaries/blob/main/LICENSE.md), sold via Advanced Security |

> **A map is not a product. A map that closes a loop is.**
> Everything that died sold "see your codebase". Everything alive attaches the artifact to an action
> with a measurable unit: tests not run, call sites fixed, a breaking change blocked in CI.

apiflow's only loop-closing consumers today are `check` (a CI gate) and `impact --json` (a hook).

Read blast-radius precisely: it analysed **backend contracts between services** and made **no**
UI-to-API claim, so the screen side is untouched by it. But its demand finding must be faced — the bet
is that the *screen* question pulls where the *service* question did not, and the cheapest way to test
that is asking five teams, not building a SaaS.

## 4. Two roads: Mermaid and draw.io

| | [Mermaid](https://www.opencoreventures.com/blog/mermaid-chart-from-open-source-project-to-raising-a-7-5m-seed-round) | [draw.io](https://en.wikipedia.org/wiki/Diagrams.net) |
|---|---|---|
| Led with | the **format** | the **app** |
| Artifact | hand-written text, and it *is* the source | `.drawio` XML, owned by the app; nothing else produces it |
| How it won | consumers embedded it natively: [GitHub 2022-02](https://github.blog/developer-skills/github/include-diagrams-markdown-files-mermaid/), then GitLab, Notion, Obsidian. 85k stars, 8M+ users | free web + desktop, **no login**, most successful app in the Atlassian Marketplace |
| Money | Mermaid Chart, open core, **$7.5M seed 2024-03** (OCV, Sequoia, M12), CEO hired in | Confluence/Jira integrations, from ~$1.27/user/month, free ≤10 users |
| Data | SaaS with accounts | stored as **page attachments in Confluence, nowhere else**; [never sent to their servers, even in transit](https://drawio-app.com/blog/drawio-data-protection/) |

Why Mermaid's format won, in its own terms: *diagrams live in version control, are reviewable in pull
requests, and update when the text changes.* That is apiflow's committed-map thesis, already proven by
someone else.

**The scar worth learning from:** in 2024-08 (v24.7.8) draw.io added a clause to its own Apache-2.0
license forbidding use inside Confluence/Jira, to protect its own integration revenue — and reverted
it by 2024-12 (v25.0.2). That is what happens when the open core can replace the paid product. For
apiflow: if `packages/map` could serve maps over HTTP, anyone hosts it for their team in an afternoon
and a hosted product has nothing left to sell. Hence `map-stays-pure` in
`.dependency-cruiser.cjs`: a store needs I/O, so forbidding I/O forbids the kernel growing one.

### Which road fits

Mermaid's road needs a property `.apimap` lacks: a **human-authored** artifact. Nobody hand-writes
1,092 endpoints, so there is no authoring act for a third party to support natively.

But the criterion is not "can a human write it" — it is "can whoever authors it emit it". With agents
as authors that condition holds, and **the writable surface already exists and is already correct**:
agents write `hints.json`, not the map. `packages/scan/src/feScanner.ts` gives a hinted call
`inferred`, never `exact`; the skill records a `note` "so the next reader can check you"; hints are the
only supported way in. The split survives because `.apimap` is **evidence** while a Mermaid diagram is
**intent** — a diagram has no truth condition, a map does. If an agent could write the map directly,
apiflow degrades into asking a model which screens call an endpoint, which is the thing it replaces.

So: **draw.io's shape** — free OSS core, no accounts, the artifact living in the user's own repo,
distribution through a host that already has the users (GitHub PR checks; the agent's context via MCP
and skills). Consequence worth taking: if the primary consumer is an agent, the canvas is not a
priority — that is the *human viewer* road, which is CodeSee's road.

The honest gap: draw.io works because the Atlassian Marketplace is a payment rail into an existing
budget. The AI-first channel has no equivalent rail yet. GitHub Marketplace is the closest real one; a
paid self-host licence is second; agent plugin marketplaces are distribution, not yet revenue. So
AI-first answers *what to build and how to distribute* — not *how to charge*. Do not build OIDC and
multi-tenancy on the assumption that the second question is answered.
