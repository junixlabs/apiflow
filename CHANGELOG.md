# Changelog

All notable changes to apiflow are documented here.

---

## [Unreleased]

### Fixed — a wrapper's definition line is no longer a call to itself

`scan-fe` read a client wrapper's own signature as one more occurrence of `name(`, so
`export async function fetchUser(id: string) {` landed in `unresolved` with the parameter list read as
a url expression. On `fixtures/demo-app/web` that was **3 of the 5** entries reported against **3**
real call sites, and no fix could ever have resolved them — permanent noise inside the one number
`apiflow check` watches for drift.

A definition and a call are spelled identically up to the open paren; what separates them is a real
body `{` after the closing one — **and** a position where a definition can legally stand. A bare
`name(…) {` is a definition only as a class member or an object-literal method; everywhere else the
`function` keyword is required, so in expression position it is a call. Getting that second half
wrong is worse than the bug being fixed: `cond ? await fetch(url) : { data: null }` reads as a
signature with a return type, and the call is then dropped from `endpoints` **and** from
`unresolved` — a gap that does not show up as a gap, and that `apiflow check` cannot see. `findCallSites` now drops any site whose
paren belongs to such a head — on every path, not only the wrapper path, so `function request(url) {`
cannot report itself either — and `findHttpWrappers` walks the same heads, so the two halves cannot
drift into disagreeing about what a definition is.

**What it cost.** Fixture `unresolved` **5 → 2** with `Calls` unchanged at **3**. Overshooting to 0
would have been the same failure inverted: the two survivors are real gaps — an identifier passed
where a literal path would be needed — and they must stay visible.
`docs/guide/02-a-wrapper-definition-is-not-a-call.md` was an `upcoming` page asserting the defect was
still there; it is `shipped` now, and its transcript is the gate.

### Fixed — a directory the scanner cannot read no longer ends the scan

`scan-fe` and `scan-be` walked the tree with a bare `readdirSync`, so a single unreadable directory
under the root — a root-owned cache, a mount, `/tmp/snap-private-tmp` — aborted the command with a
raw EACCES stack and produced no map at all. Found by pointing the scanner at a path that happened to
contain one.

Both walks now skip what they cannot open and **print it**: `**Unreadable directories skipped**: N`.
Silence was the other option and it is the worse one — a tree missed without a word reads exactly
like a tree with nothing in it, which is the failure the `Nested checkouts skipped` line already
exists to prevent. The same helper serves both commands, deduped across the config walk and the
source walk, so one unreadable tree is reported once.

One ordering detail, so the next reader does not go looking for a fault that was never there:
`scan-be` cleared its skip list *after* the stack-detection probe ran. That was harmless before —
the probe recorded nothing — and only became wrong once this change gave the probe something to
record, so the reset moved above it in the same commit.

## [1.2.0] — 2026-08-23

The request runner is no longer part of this package.

**A minor bump carrying a breaking removal, deliberately.** Strict semver says 2.0.0. The canvas was
never the thing this package was installed for — the map was — so the number stays 1.x and the
removal is made loud instead: both dropped spellings exit 1 with a pointer, and the section below
leads with what is gone.

### Removed — the canvas, and the two commands that opened it

`packages/runner` (canvas, flow executor, cURL/OpenAPI/Postman import, its own 13-tool MCP server) now
lives at **[junixlabs/apiflow-runner](https://github.com/junixlabs/apiflow-runner)**, with history back
to 2026-03-19 preserved there.

**Breaking.** Two published spellings are gone:

```console
$ apiflow
A bare `apiflow` opened the visual request runner, which is now its own package.
  npm i @junixlabs/apiflow-runner  ·  github.com/junixlabs/apiflow-runner

This command is the map side only now — run `apiflow --help` for what it does.
$ echo $?
1
```

`apiflow --mcp` prints the same pointer for the runner's MCP server.

Both exit 1 with a pointer rather than "unknown command" — a published entry point that vanishes
silently is worse than one that errors.

Why: the two halves share no code and answer different questions. apiflow reads source to build a
screen ↔ endpoint ↔ field map and never sends a request; the runner sends requests and knows nothing
about your screens. The split is why installing this no longer pulls React, Vite, Tailwind and
`@xyflow/react` into a dependency tree that only needed a parser — 12 devDependencies and one runtime
dependency dropped.

`apiflow ui`, `hub`, `view` and `mcp map` are untouched: those read the map and were never the runner.

### Changed — one published package again, and a release path that is checked

The 2026-08-22 restructure into three packages left `@junixlabs/apiflow` depending on
`@junixlabs/apiflow-map` and `@junixlabs/apiflow-scan`, neither of which is on npm. Rather than
publish three, the two are now `private: true` and **bundled into the CLI's tarball**: one install,
nothing resolved against the registry.

They stay separate packages — that is what `.dependency-cruiser.cjs` holds its rules against, and it
is what lets `map` be published unchanged the day a second repo reads a map. What is dropped is
publishing three artifacts for zero external consumers.

```console
$ npm run verify:pack
68 entries
ok — one self-contained tarball, no internal material
```

Two failure modes found while wiring it, both now gated by `tests/publish.test.ts` and
`npm run verify:pack`:

- npm bundles from the packing package's **own** `node_modules`, which workspaces hoist away. Without
  `scripts/prepack-bundle.mjs`, `npm pack` reports `bundled files: 0` and **succeeds** — shipping a
  tarball that cannot install.
- `npm publish` at the repo root packs **170 files, including `.forge/` and `CLAUDE.md`**, into a
  public tarball. `private: true` on the root was the only thing refusing it. The workflow now
  publishes the verified tarball by path.

**Known limitation of the bundling, measured after publishing.** `npm install`, `npm ci`, `npm audit`,
`npm ls` and `npm outdated` are all clean in a consumer project — the lockfile records the bundled
packages as `inBundle: true` with no `resolved` URL, so nothing is fetched. But `npm audit signatures`
fails the whole command:

```console
$ npm audit signatures
npm error 404 Not Found - GET https://registry.npmjs.org/@junixlabs%2fapiflow-scan
```

It queries every name in the tree against the registry and ignores `inBundle`. Nothing is broken by
it, and the workaround is to skip that one command; the real fix is publishing the two packages, which
is waiting on the condition in `NORTH-STAR.md` §7. Recorded here rather than left for a user to find.

398 tests (417 − the 23 that moved with the runner, + 4 for the release contract).

---

## [1.1.13] — 2026-08-21

The blind full walk is the wrong default, and now there is a targeted one. Measured on a real API,
`--fill=1` over the whole GET surface was **63% usable** — the rest were `400`s for required query
params a walk cannot guess and `404`s for ids that do not exist. An API rarely answers to a fictional
id and no query string.

### Added — `--screen=<route>`, impact → probe

A screen names the handful of endpoints it actually reads, and only those are hit. It is the same edge
`apiflow impact --screen` reports (`screenIdsForRoute` → `endpointsForScreen`), handed straight to the
probe.

```bash
apiflow probe linked.apimap --live=http://127.0.0.1:8000 --screen=/account --header="Authorization: Bearer $TOKEN" --fill=1
# **Scoped by `--screen=/account`**: 7 of 1092 endpoints that screen reads · **Sent**: 2
```

- Needs a **linked** (fe+be) map — the screen→endpoint edge is produced by `apiflow link`, so a BE-only
  map has no screens. `--screen` there refuses with a pointer to the linked map, rather than silently
  selecting nothing.
- An unknown route refuses too (exit 2). Composes with `--fill`/`--methods`/`--only`/`--skip`.

This is the shape probe was meant to be used in: not "cover the API", but "confirm the few endpoints the
screen I am changing depends on". The static map stays the core; probe closes the two blind spots
(typed-client response fields, a stack with no response type) for exactly the endpoints a screen reads.

412 tests.

---

## [1.1.12] — 2026-08-21

`--only` is an include filter, and a live authenticated probe showed why that is not enough: the guard
had no way to say *everything except these*.

### Added — `--skip=<pattern>`, the exclusion `--only` cannot express

Three GET routes in a real Laravel app run side effects — `/supervisor` calls
`exec('sudo supervisorctl …')`, `/restart-queue` calls `queue:restart`, `/call-artisan`. They are GET,
so the method guard does not stop them, and they sit outside `/api/`, so an API-surface `--only` cannot
leave them out by pattern. The one time this was left to "remember not to hit them", a full authenticated
walk was launched straight at them (caught and killed before it reached position 376 of 382 — they sort
to the end — so nothing fired).

- `--skip` takes the same substring/glob patterns as `--only`, and is **subtractive**: an endpoint must
  pass the include (if any) **and** clear every skip. Skip wins ties, because the safe default when the
  two filters disagree is *do not send*.
- The scope line prints both filters. Matching nothing still exits 2.

A guard that depends on remembering is not a guard; this is the one that does not.

---

## [1.1.11] — 2026-08-21

Two gaps found by using `probe` rather than by reading it, plus a silent break in `--help` introduced
while fixing them.

### Added — `url` in every sample

`ProbeSample` now carries `url`: the path **actually sent**. `path` stays the template, because it is
the key that joins the sample back onto the endpoint — it has to keep its `{param}`.

Both are needed. A sample of `GET /api/v1/orders/{param}` could not be reproduced from the file: nobody
could tell which id answered, and a 200 you cannot reproduce is a claim, not evidence. `--ingest` now
also prints the sent url on a skipped sample when it differs from the template — "returned 404" is
unactionable until you know it was id 1 that was missing.

The field is optional, so samples files written by 1.1.10 still ingest to the same numbers.

### Added — `--only=<pattern>`, repeatable

Scopes the walk. A plain string matches as a substring of `METHOD PATH`; `*` globs.

```bash
apiflow probe be.apimap --live=http://127.0.0.1:8000 --only='/storage/logs/*' --fill=app.log
# **Scoped by `--only=/storage/logs/*`**: 1 of 1018 endpoints · **Sent**: 1
```

It exists because a fill is positional: `--fill=laravel.log` reached the one route wanting a filename
by way of the 189 wanting an id, so probing a single endpoint meant leaving the tool for `curl` — and a
sample taken by hand is not in the samples file.

- It **narrows** the walk and relaxes nothing: `--only=color-statuses` matched 6 of 1018 endpoints and
  sent **2**, because the GET/HEAD rule still held.
- The scope is **printed**. A filter nobody can see reads as a whole-map run that found two endpoints.
- Matching nothing **exits 2** rather than reporting a clean run over zero endpoints.

### Fixed — a backtick made `apiflow --help` print `NaN`

`HELP` in `bin/cli.js` is a template literal. A `` `*` `` inside a new flag description ended the string
mid-sentence; node still parsed the file, nothing failed, and the entire help output became `NaN`. The
test added asserts the **rendered** output, not the source, because that is the only thing that catches
the next one — verified by putting the backtick back and watching it fail.

403 tests.

---

## [1.1.10] — 2026-08-21

Probing a real Laravel API produced **572 observed fields** where the static reader had 0 — and 271 of
them were translation strings. A dictionary is not a shape.

### Fixed — a keyed collection collapses to `{key}`

- `GET /api/v1/languages` returns the i18n table. Its 100 `data.en.validation.*` keys are translation
  ids — **data, not fields** — and one endpoint contributed 263 "fields" to a map whose whole API had
  354 declared. An endpoint that gained a translation string would have read as an endpoint that
  gained a field.
- `shapeOf` now collapses an object whose keys are values into a single `{key}` path, which is the
  array rule applied to an object: `{key}` is to a dictionary what dropping the index is to a list.
  Several values are sampled into the one path, for the same reason a list samples 20 items.
- **The key count is kept** (`FieldNode.keys`), so the map says "a dictionary of 100 strings" rather
  than pretending the endpoint returns one field, and `probe --ingest` **prints the widest collapses**.
  A collapse nobody can see is a collapse nobody can correct.

### The threshold is measured, and deliberately conservative

Two conditions must both hold: **≥ 20 sibling keys** *and* **every value the same shape**.

| | keys | value types |
|---|---|---|
| widest genuine record, 1,126 Zod-read endpoints | **15** | mixed |
| widest genuine record in the probed bodies | 11 | mixed |
| the dictionaries found | 100 · 65 · 47 · 34 · 25 | single |

Under-collapsing leaves noise; over-collapsing **deletes real field names**. So when the two
conditions disagree the field names survive — `data.en.passwords` (8 keys, all strings) stays
expanded, and that is the intended side to fail on.

### Measured on webapp

| observed fields | before | after |
|---|---|---|
| total | 572 | **136** |
| `GET /statuses/groups` | 216 | **13** |
| `GET /languages` | 263 | **30** |

`/statuses/groups` is the point: 34 status-group names were burying the shape of the status object
itself, and it now reads `data.{key}[].color_status.background_color` — 13 fields that describe the
API instead of 216 that describe today's data. Scan + ingest twice is byte-identical.

---

## [1.1.9] — 2026-08-21

One app reported **11,340 calls across 719 screens**. It has 855 calls across 141 screens. The other
10,485 were the same code counted sixteen times, plus a committed bundle read as source — and until
the numbers were looked at rather than trusted, the map on that app was worse than no map: `impact`
answered a one-file change with sixteen files.

### Fixed — a subtree with its own `.git` is a different checkout

- **Git worktrees were scanned as if they were part of the repo.** `.claude/worktrees/` held **15**
  full copies of the app, so every screen was reported sixteen times and `impact` named sixteen files
  for a one-file change. New `src/cli/scanScope.ts` skips any directory below the scan root that
  carries its own `.git` — the rule is not "skip `.claude`": a worktree, a submodule and a nested
  clone are all *different checkouts*, whoever put them there and whatever they are named. A worktree's
  `.git` is a **file**, not a directory; both are recognised.
- The scan **prints what it skipped** — `Nested checkouts skipped: 15 — …`. A silent skip reads
  exactly like a walk that found nothing there.

### Fixed — a committed bundle is not source

- **`backend/public/widget/chat.js`: 342 KB of minified React on 65 lines.** It produced ~4,000
  `unresolved` entries reading `!0` and `l` as urls — noise that can never be resolved, burying the
  gaps that can. Name-based skipping cannot catch it: it sits in `public/`, not `dist/`.
- New `src/core/generated.ts` decides on **shape**, measured across four real repos: the widest
  *authored* file averages **152 bytes per line** (an inline SVG); the two generated ones average
  **3,490** and **5,268**. The threshold is 400, in the gap and near neither edge. A 4 KB byte floor
  comes first, so a short one-liner is not mistaken for a bundle.
- Dropped when the sources are **read**, not inside `scanFile` — so a bundle never reaches the caller
  graph either. Both passes read the one map.

### Measured

| crm | `scan-fe/3` | `scan-fe/4` |
|---|---|---|
| calls | 11,340 | **855** |
| screens | 719 | **141** |
| endpoints | 300 | **254** |
| unresolved | 13,163 | **192** |

**webapp 879/240/565 and kinetrak 21/17/21 are unchanged**, and webapp's BE gives 108/169 with
the rules on and 108/169 with them stashed off. The fix bites where the defect is and nowhere else.
Re-scanning crm twice is still byte-identical.

Readers bumped to `scan-fe/4` / `scan-be/4`, so `check` says the reader improved rather than
"the code moved".

---

## [1.1.8] — 2026-08-21

`probe` had never been run — and once it could be, it turned out three separate faults were standing
between the map and its own `observed` fields. **observed: 0 → 65** on this repo's own server.

### Added — `probe --live`, and two refusals

- **`apiflow probe <map> --live=<baseUrl>`** walks the endpoints in the map against a *running* API,
  records `{method, path, status, body}` for each, and `--ingest` merges what came back as `observed`
  fields beside the `declared` ones. `--fill=<value>` supplies a `{param}` positionally; an endpoint
  with an unfilled placeholder is skipped **and named**. `--header='K: V'` for auth.
- **GET and HEAD only.** A write method needs `--methods` *and* `--unsafe`. The map lists every
  endpoint it found and that list contains `DELETE`: without this, a diagnostic is a scripted walk over
  someone's write endpoints.
- **A non-localhost base url needs `--yes-remote`.**
- A non-2xx or non-JSON response is still recorded. `--ingest` is what decides a sample is unusable and
  says so per endpoint — dropping them at collection time would turn a 500 into silence.
- New: `docs/probe.md`.

### Fixed — why the runnable harness was never emitted

- **Every Node repo detected as `generic`.** `detectStack` tested the manifest content for
  truthiness, and `probe` records "this manifest exists" as an empty string — so `package.json`
  never matched and the emitted harness was the manual checklist instead of the vitest file. Presence
  is what it tests now; the content only ever decided strapi-vs-node.
- **The stack was read from the output directory, not the repo.** `--emit=<dir>` outside the repo made
  it `generic` again for the same reason.

### Fixed — one masker for every reader

- **The rule "a comment is not code" was implemented twice, and the second copy was broken.** A regex
  character class containing a quote — `/['"\`]/` — put `blankComments` into a string state with no
  newline guard, so it swallowed the **rest of the file** and stopped masking comments entirely. Three
  phantom endpoints reached a published map that way, read out of this scanner's own comments
  (`app.get('/x', h)` in a cm:guard). Both readers now mask through `src/core/mask.ts`.
- **The FE reader was reporting the wrong line for real calls.** Same cause. Verified against source:
  `site-data.ts:76` pointed at `mutationFn:` and now points at `apiSend<…>(` on line 77;
  `api.ts:34` pointed at the `export function` signature and now at the `apiFetch` call on 35. Four
  calls that were being missed entirely are now found — `published-url`, `reconcile/backfill`,
  `reconcile/backfill/reset` and a `policy` patch. **124 → 128 calls**, with `unresolved` unchanged.
- **Route-shaped JSON inside a template literal is not a route.** The probe harness's own example,
  `{ "method": "GET", "path": "/api/users" }`, was published as an endpoint of this repo. The BE
  readers mask template text as well as comments — **JS/TS only**, because a backtick in Go is a raw
  string and struct tags live in one.

### Changed

- Reader versions are `apiflow scan-fe/3` and `apiflow scan-be/3`. Both readers changed what they
  produce for unchanged input, which is exactly when the rule added in 1.1.7 says to bump — so `check`
  will say so once per map.

---

## [1.1.7] — 2026-08-21

The artefact and the readers, finished. **BE fields: 0 → 166** on a real API, and three ways the file
was being written with less than the readers actually knew.

### Fixed — the schema reader was eating its neighbour

- **A one-line `z.object({ … })` swallowed the schema after it.** The reader ended a schema on
  `\n})`, so a schema written on one line had nothing to stop at and the match ran on to the next
  multi-line close — absorbing the next schema, which then vanished from the index entirely. Twenty-two
  schema names that a route correctly asked for resolved to nothing for this reason. Extraction is now
  brace-balanced and quote-aware. **127 → 159 schemas.**
- **Optionality leaked across the comma.** The modifiers were read from a fixed 160-character window,
  which ran past the field's own comma into the next field: `name: z.string(), age: z.number()
  .optional()` reported `name` as optional. That is the wrong direction to be wrong in — it tells a
  caller a field may be absent when the API always sends it. A field now ends at its own top-level
  comma.
- **Only the top-level keys of a schema are its fields.** A nested `z.object({ … })` describes a child
  shape, and lifting its keys into the parent invented fields the endpoint does not have at top level.
- **A discriminated union reads as one shape with branches**: a key present in every member is
  required, a key in one member is optional. Reporting a single branch would promise fields that may
  never arrive; reporting nothing would hide the endpoint.

### Fixed — a handler two modules from its mount can now name its schema

The schema index was always keyed by NAME, so nothing had to follow an import — the missing piece was
the name itself.

- The mount records the **handler symbol** (`.patch(declared(PATCH_POLICY), ...patchPolicyRoute)`).
- A handler index yields, per exported handler, the schema its validator was given
  (`zValidator('json', policyPatchSchema)`, or `X.parse(`) and the response type it annotates
  (`satisfies T`, `c.json<T>`, or a same-file helper it calls whose return type is declared).
- A `z.infer` alias table resolves the TYPE a route names (`PolicyResponse`) to the schema the fields
  live on (`policyResponseSchema`).

Result: request shapes on **42 of the 43 routes that validate one**, response shapes on **23 of the 23
that name one** — both at the ceiling of what the code declares.

### Fixed — the file now keeps the union of what the readers found

- **One endpoint seen by two readers kept only the first half.** A route manifest knows the path and
  the declared gate; the mount site knows the handler — and the handler is what carries the schemas.
  Keeping whichever reader ran first left **72 of 106 endpoints with no handler and no fields at all**.
  Duplicates now merge: the handler comes from whichever reader had it, the source line goes to the
  mount site (where the route is actually served), and a disagreement about `auth` resolves to
  **guarded** — inventing an open endpoint is the one error on that number that gets acted on.

### Fixed — check could not tell a reader upgrade from a code change

- **The generator string is a reader version now** (`apiflow scan-fe/2`, `apiflow scan-be/2`), bumped
  in the same commit as any change to what a reader produces for unchanged input. `apiflow check`
  prints it: *"this map was written by an older reader, so part of any difference below is apiflow
  reading the same code better, not the code changing."* Every map written before this release will say
  so once — that is the message working, not drift.
- **A BE map always reported "No meaningful change" — printed directly under "the map has drifted from
  the code".** The headline reasoned only about calls, and a BE map has none. Its coverage is endpoints
  and its certainty is endpoints carrying a declared shape, so it now says which of those moved.
- **`check` names where it drifted when no endpoint moved**, instead of leaving a verdict that reads as
  a bug in check.

### Measured

webapp BE: 106 endpoints · 159 schemas · **166 fields** · 100 behind auth · 6 public.
webapp BE: unchanged at 1018 · 354 · 881 — no regression. Re-scanning either twice is still
byte-identical.

---

## [1.1.6] — 2026-08-21

The BE half was the weak one. On a real Hono API it understood **2 of 106 routes**; the reconciliation
for that project read "BE not scanned — nothing to reconcile" and the whole cross-side half of the
tool was dark.

### Fixed — a route declared as data is still a route

- **Routes written as `{ method, path }` object literals are read for any node/generic repo**, not only
  for Strapi. That reader existed and was locked behind one stack. On the API measured, every mount is
  `.get(declared(SPEC), h)` with no literal at the call site, so the verb-call readers found 2 routes
  while the other 104 sat in a plain exported array. **2 → 106 endpoints**, which is exactly the
  number its own manifest declares.
- **A mount that names its path through a const is followed.** `const HEALTH = { method: 'GET', path:
  '/health', … }` then `.get(declared(HEALTH), h)` now resolves, and the mount site wins the source
  line over the manifest entry — it is where the route is actually served.
- Requires the path to start with `/`, unlike the Strapi form: this runs over every file in a backend
  repo, and `{ method: 'POST', path: 'upload' }` in an SDK call config is not a route.

### Fixed — a declared protection beats the name heuristic

- **~100 fully guarded routes were about to be reported as "no auth gate found".** That API declares a
  protection on every route and gates them through `middlewareFor(SPEC.protection)`, which matches no
  auth-sounding name. Reading the declaration gives **100 behind auth, 6 public** — the 6 being
  `/health`, the four `/auth/*` endpoints that cannot require a session, and a signed media route.
  Against the manifest: exact.
- Only `public`-shaped words clear the gate (`public`, `none`, `anonymous`, `open`, `guest`). An
  unrecognised kind counts as **guarded**, so a vocabulary this does not know cannot manufacture an
  open endpoint — the direction of the error matters on that particular number.

### Fixed — three ways the BE numbers overstated themselves

- **A test file beside the code it tests is never read.** `src/surface.test.ts` held a
  `{ method: 'GET', path: '/nope-not-declared' }` fixture and it was published as an endpoint. Skips
  `*.test.*`, `*.spec.*`, `*.stories.*`, `*_test.go`, `conftest.py`.
- **One schema gap per endpoint, not per route hit.** A route legitimately gets seen twice now
  (manifest plus mount), and 106 endpoints were reporting **317** missing schemas.
- **`unresolved` was one number wearing the label of one of its two halves.** 881 of webapp's 900
  entries are endpoints whose path is perfectly well known and whose schema was not found — printed
  everywhere as "calls whose path could not be resolved", which is untrue. Every count now separates
  *N calls whose path could not be resolved* from *M endpoints with no request/response schema in the
  code*: the CLI, the rail, the hub rows, the workspace card and the MCP footer.

### Result on a real pair

webapp went from `BE not scanned` to **107 endpoints, 88 seen from both sides, 1 FE-only,
18 declared-but-uncalled**. The one FE-only is real: the frontend builds the last path segment
dynamically where the API enumerates the actions. Re-scanning twice is still byte-identical.

Still open: **fields**. 127 schemas are found in that repo and attached to 0 endpoints, because the
handler lives in another module than the mount — attaching them needs the import-following the FE side
already has.

---

## [1.1.5] — 2026-08-21

### Added — a project side can live on another machine

- **`apiflow project import <id> --fe=<file.apimap> | --be=<file.apimap>`**, plus `--fe-map=` /
  `--be-map=` on `project add`, and the same two fields on **Add project** and **Edit roots** in the
  browser. A frontend on one machine and an API on another no longer need two workspaces: scan each
  side where its code lives, move the `.apimap`, import it.
- **The value is the join, not the transfer.** Once both halves are in one workspace, the API side of
  the map can be asked the frontend's question — `impact --endpoint="DELETE /api/v1/attributes/{param}"`
  answers *which screens break*, from a handler name. Measured on a real pair: 240 screens, 1092
  endpoints, 491 seen from both sides.
- Nothing is hosted, and nothing needs to be. An `.apimap` is derived from content alone — no
  timestamps, no coordinates — so it is a handover artefact by construction. `apiflow ui` still binds
  `127.0.0.1` with no flag to widen it, because a map carries real production paths.
- Import writes a history entry and re-links, exactly as a local scan does, so `check` and the Compare
  pane show what moved between two scans that happened on a different device.
- An imported side is labelled as one rather than pretending: the header shows `BE imported` with the
  root it was scanned on instead of a Re-scan button, `project ls` prints
  `imported — scanned on <root> (no directory on this machine)`, and `project scan` names the machine
  it came from instead of answering "no directory to scan".
- Refused, with the reason: a map of the wrong half (an fe map in the be slot would make the
  reconciliation compare a side against itself and report perfect agreement), a linked map, a path
  that is not a file, and a project with neither a directory nor an import.
- New: `docs/cross-machine.md`.

### Changed

- `sideOf` moved from `src/cli/check.ts` to `src/core/apimap.ts` — the import path is the only change;
  three call sites follow it. Which half a map is comes from its generator string, and that rule now
  has one home.

---

## [1.1.4] — 2026-08-21

Both fixes come from Pass B of the map audit — walking whole user flows instead of sampling the rows
the map already prints. A missing edge is invisible to a sample of the edges that exist, which is why
a 28/28 Pass A sat next to a 2/5 Pass B.

### Fixed — a layout route's calls now reach the screens rendered inside it

- **An endpoint called by a layout reported one screen when it gated the whole app.** `GET /auth/me`
  runs in the `beforeLoad` of `/_authenticated` and decides whether any authenticated screen renders
  at all; `impact` named **1** screen. It now names **24**, each marked
  `inherited from layout /_authenticated` so the reader knows the call site is in the layout, not in
  the screen. Same for a layout that fetches on behalf of its children: `GET /projects/{id}/policy`
  went from 1 screen to 7 — the `/setup` layout plus the six sections that read the result out of
  context.
- Under-reporting is the failure mode that makes an impact answer unsafe to paste into a PR, so this
  is the more important half of the release.
- Derived from the route tree and the file name at query time, so a map already on disk answers
  correctly without a re-scan. An **index** route is never a parent: it shares its directory's route
  string with the layout but wraps nothing, and treating it as one would make `/orders` the ancestor
  of its own sibling `/orders/{id}`.

### Fixed — an import clause is not a use of the thing it binds

- **`POST /auth/refresh` was claimed on 26 of 27 screens, including one that never calls through the
  wrapper.** `/sign-in` takes exactly one thing from `lib/api-fetch`: the `ApiError` class. Its
  `login` deliberately bypasses the 401-retry path, and the code says so. The chain got there because
  a name listed inside a **multi-line** import clause counted as a usage — the guard against that was
  a 24-character lookbehind, and `import {\n  NetworkError,\n  apiFetch,` puts 26 characters between
  the keyword and the name. The usage then landed on a line with no enclosing declaration, which
  widened the chain to "any export of this file" and reached every importer.
- Import, re-export and export clauses are now masked in place, on the same contract as the comment
  mask: equal length, newlines kept, so every line number still resolves.
- Measured on the same frontend: `/sign-in` went from 2 endpoints to **1**, calls 128 → 124, and
  `guess` fell from 64% to **46%** as chains that no longer widen keep their precision.

### Still open

`/paygate-account/{list,card,bank-account}` continue to report an identical set of 39 endpoints, 15
of which are provably the siblings'. That one is a component registry keyed by a prop, so it needs
prop-value tracking rather than a fix — and every one of those rows is labelled `guess`.

---

## [1.1.3] — 2026-08-21

### Fixed — the screen count counts screens

- **`impact` reported one row per call, so a screen that calls an endpoint twice was counted twice.**
  The headline says "N screen(s) break if this changes", which made the blast radius read larger than
  the number of screens involved — measured on a real app, `POST /api/v1/purchase-orders/{param}`
  claimed **3 screens** where there was **1**, reached from three places inside it. The answer now
  carries one entry per screen plus `callSites`, so the second call site stays visible instead of
  being either dropped or double-counted. Across that map 13 duplicate rows collapse into 12 screens.
  Applies to the CLI text, `--json` (new `callSites` field) and the `impact_endpoint` MCP tool.
- **A deduplicated screen keeps the strongest confidence of its call sites, and that call site's
  evidence.** One `exact` call site is proof the screen breaks; letting a `guess` sibling decide the
  label would understate what is known.

---

## [1.1.2] — 2026-08-21

### Fixed — asking the binary its version started a server

- **`apiflow --version` had no handler.** With no positional argument it fell through to the default
  branch, which opens the proxy and the UI — so the first thing a new user types after installing
  bound a port instead of answering. `--version`, `-v` and `version` now print the number and exit,
  answered next to `--help` and before any dispatch.
- **The banner said `v1.0.0` while npm served 1.1.1.** The version was a literal in `bin/cli.js` that
  no release step touched. It is read from `package.json` now, so there is one number, not two.
  Caught by installing the published 1.1.1 tarball into a clean prefix and running the binary.

---

## [1.1.1] — 2026-08-21

### Fixed — a comment naming a symbol is no longer a call

- **`parseModule` scanned comments as code, so documentation invented dependency edges.** The reader
  looks for `\bname\b` to decide which imports a file actually uses; run over raw source, a comment
  that names a symbol counts as a usage. A usage with no enclosing declaration widens the chain to
  `ANY`, and `ANY` matches *every* importer of the file regardless of which export it took — so one
  call fanned out to every route touching the barrel. Two real examples, both from comments this
  project itself would encourage writing:
  - `features/setup/sections.tsx:7` — a comment listing the four components the barrel adapts sent
    `GET /projects/{param}/identity` to all four setup routes instead of `/setup/identity`.
  - `lib/auth-api.ts:85` — a comment on `logout` mentioning `login` created a `login → logout` edge
    and attributed `POST /auth/login` to the authenticated shell.

  Comments are now masked **in place** — same length, newlines kept — because every line number and
  every lookbehind in the parser is an index into that string. Measured on a real 128-call frontend:
  calls 182 → 128 (54 were phantom), `guess` 76% → 64%, `PATCH …/policy` 10 screens → 3 (correct),
  and a fresh 28-claim audit sample went from 17/28 right to **28/28**. Codebases that document well
  were the ones penalised hardest.

  Re-scanning an existing project will change its map. That is the correction landing, and `check`
  will report it as drift.

---

## [1.1.0] — 2026-08-21

### Changed — the repo speaks English

- **Every string, comment, doc and test assertion in the repo is now English.** The CLI output, the
  browser UI (all nine panes, the inspector tabs, the add/edit dialog, the hub), the seven MCP tool
  descriptions, `NORTH-STAR.md`, `AGENTS.md`, the architecture and proposal docs. `lang="vi"` on both
  rendered pages became `lang="en"`, and the two `toLocaleString('vi-VN')` call sites became
  `en-US`, so thousands separators match the surrounding prose. Verified by rendering every pane in
  a browser and grepping the served HTML for Vietnamese letters: 0 hits, 0 console errors. The only
  Vietnamese left in the repo is three test fixtures that exist to prove diacritics fold into an id
  (`Đơn hàng nội bộ` → `don-hang-noi-bo`).
- **`README.md` is 146 lines with a diagram at the top** (`docs/img/workflow.svg`, system fonts, no
  external resources), plus three new docs: `docs/getting-started.md` — the whole path with the real
  output, `docs/formats.md`, `docs/request-runner.md`.
- **The hub's project count reads as English.** `1 project` / `3 projects` instead of `3 project`.

### Fixed — the first ten minutes for someone who just installed it

- **`apiflow hub --out=<dir>` writes where it is told.** The directory was read only as a positional
  argument, so the form the README and getting-started guide both name fell through to the default
  `./apiflow-maps` — inside whatever repo happened to be the working directory. It is the one thing
  the tool promises never to do. Now covered by a test that runs the real CLI from a repo-shaped cwd
  and asserts nothing was written there.
- **A relative path on the command line resolves from where you typed it.** Every subcommand was
  spawned with `cwd` forced to the apiflow install directory, so `apiflow impact rel.apimap` from
  another repo died with ENOENT while looking inside apiflow, and `apiflow hub` with no argument
  wrote its page tree there. tsx finds its tsconfig and node_modules from the script path, not from
  cwd, so the child now simply inherits the caller's.
- **An ssh alias no longer leaks into the repo id.** `git@github.com-junixlabs:org/repo` — an alias
  that exists only in one machine's `~/.ssh/config` — produced `github.com-junixlabs/org/repo`, so
  the same repo got one id from an aliased clone and another from CI's https checkout, defeating the
  one thing the id exists for. The alias suffix is now trimmed inside the last host segment only, so
  a real host with dashes (`git.my-company.com`) is untouched. Found by installing the tool from a
  clean clone the way a new user would.
- **`check` no longer blames the scanner for a code move.** When bytes differ but every count is
  equal, the usual cause is that handlers moved and the `file:line` evidence moved with them — which
  is real drift, because `file:line` is the part a reader clicks. Measured on a live repo: same
  27 screens / 182 calls, 24 chain nodes at new lines.

- **`apiflow … | head` no longer crashes.** A closed pipe reached node as an unhandled `error` event:
  a 20-line stack trace and exit 1 on the most ordinary command a newcomer types. Every CLI now
  tolerates EPIPE. The test drives the real binary through a real closed pipe — a unit test on the
  handler passes while the CLI still crashes, and the reproduction needs output past the ~64KB pipe
  buffer plus `PIPESTATUS[0]` (after a pipeline, `$?` is head's status and is always 0).
- **`impact --endpoint="POST /x"` no longer answers with the wrong verb.** When the exact
  method+path was absent, the fuzzy fallback dropped the method and returned every verb on that
  path — so asking about `POST /mcp` printed the screens of `DELETE /mcp` and `GET /mcp` as if they
  were the answer. The fallback now widens the path only, and when nothing matches it says which
  verbs that path does have (CLI and `impact_endpoint` alike).
- **README leads with the map.** The Quick Start pointed a new reader at `npx @junixlabs/apiflow`,
  which opens the request-runner canvas — the half NORTH-STAR §3 deprioritized — so someone
  following it never reached the dependency map at all. It now starts with clone → `project add` →
  `project scan` → ask, states plainly that the published npm package predates the map commands, and
  shows the MCP block for an agent.

### Added — agent-native (the map as an MCP server)

- **Both MCP servers are now spelled the same way**: `apiflow mcp map` (reads the map) and
  `apiflow mcp run` (executes requests). They used to be a subcommand (`mcp-map`) and a *flag*
  (`--mcp`) for the same kind of thing. `mcp-map` and `--mcp` keep working — the flag is in the
  published README and in installed MCP configs — and bare `apiflow mcp` prints the two choices.
- `apiflow mcp map` — a second MCP server, map-side only (the existing `--mcp` one is the request
  runner and pulls the run half in; this one never touches it, enforced by the dependency-cruiser
  boundary). Tools: `impact_endpoint` · `impact_field` · `screen_deps` · `find` · `map_health` ·
  `map_check` · `map_list`. Answers are compact, carry the `file:line` that proves each screen, and
  every one of them ends with the map it came from and the count of call sites the scanner could not
  resolve — so `0 screens` cannot be read as "nothing calls this". Errors come back as tool text, never
  thrown, so a typo in a route cannot kill the session. Target resolution: `project` (workspace id) →
  `map` (a file path, e.g. one committed in the repo) → `APIFLOW_PROJECT` → the only project there is.
- `skills/apiflow-impact/` — the companion skill: when to ask (before editing a route, handler, api
  client or response field), how to read confidence, and what `0 screens` does and does not mean.
- `apiflow --help` (and `-h`, and `help`) prints the whole command surface and exits. It is answered
  before dispatch on purpose: `apiflow scan-fe --help` used to fall through with no positional
  argument, which means "scan the current directory", and it wrote a map into the repo it was run in.
- Subcommands no longer shell out through `npx`. Measured on a clean install of the tarball:
  `project ls` 0.56s → 0.27s, MCP connect-to-first-tool 1.7s → 0.37s, per tool call 5ms.

### Added — team use (map as shared context)

- **A `.apimap` no longer contains a machine path.** `metadata.root` is now the repo the scan came
  from — `github.com/acme/app//apps/web`, derived from the git remote with any credential stripped —
  so two people scanning one commit produce identical bytes and the file can be committed, reviewed
  in a PR and served to a team. Whatever needs the real directory back (`probe --emit`, `check`)
  resolves it through the local workspace registry.
- `apiflow check <map.apimap> [--root=<dir>] [--json] [--write]` — re-scans and compares against the
  stored map. Exit 0 clean, 1 drifted, 2 cannot check. Prints which endpoints appeared or vanished,
  and separates "different bytes, same structure" from real drift. `--write` refreshes the file.
- `apiflow project scan <id> [--fe] [--be]` — the scan the UI button runs, from a terminal or CI:
  same staging file, same history entry, same automatic re-link. Non-zero exit when a side fails.
- **A BE half too thin to compare no longer accuses the API.** If the endpoints the map would report
  as "FE calls it, the API does not declare it" outnumber every endpoint the API declares, the
  untrustworthy half is the reader: those endpoints become `unpaired` (not compared) instead of
  `feOnly` (compared and wrong), and one `be-partial` alert states both numbers. Measured on a real
  Hono API where the reader understood 2 of 103 routes: 88 invented findings became 1 true one.
- `apiflow impact … --json` — the answer as data (screens, confidence, `file:line`, the caller chain),
  with the unresolved count travelling in every payload so an empty answer cannot be read as "nothing
  calls this". Valid JSON on stdout even when nothing matched; the verdict is the exit code.

### Added — dependency map (the read half)

- `.apimap` format (`src/core/apimap.ts`): screens, endpoints, fields and the edges between them.
  Ids derive from content and no timestamp is written, so re-scanning an unchanged repo produces a
  byte-identical file. Positions are **not** stored — a generated map is laid out at render time.
- `apiflow scan-fe <dir>` — deterministic, framework-agnostic scanner. Finds HTTP call sites,
  normalizes urls onto endpoints, attributes them to a screen (file-based route, else the enclosing
  component) and traces which response fields are read. Every edge carries `exact`/`inferred`/`guess`
  and a `file:line`; what it cannot resolve goes to an Unresolved list rather than being dropped.
- `apiflow impact <map.apimap> --endpoint=… | --field=…` — answers "which screens break if this
  changes", which is the question the whole product exists for.
- `--hints=<file>` — the agent-resolvable half. `skills/fe-map-extractor/` reads the Unresolved list,
  works out what a variable url really is, and feeds it back as hints; ids stay derived by code.

### Added — provider half, and the join

- `apiflow scan-be <dir>` — deterministic backend scanner. Routes, request payloads and response
  shapes from **code**, per stack: Laravel (`Route::verb`, `Route::resource` expanded to 5, group
  prefixes, FormRequest `rules()`, API Resource `toArray()`), NestJS/Express (`@Controller`+`@Get`,
  Zod, class-validator DTO), Go (gin/chi/echo/fiber/`HandleFunc`+`.Methods()`, struct `json:` tags),
  Python (FastAPI/Flask, Pydantic, `response_model=`). A generic pass runs on every file too, so a
  sidecar in another language is not lost. Cross-file: a route naming `UserController@store` is
  followed into the controller, then into its FormRequest and Resource.
- `apiflow probe <map> --emit` / `--ingest=` — **response shapes confirmed against reality**.
  Emits a test in the project's *own* runner (PHPUnit+`RefreshDatabase`, vitest+supertest, Go
  `httptest`, pytest+`TestClient`) so the probe runs on the test database and never touches real
  rows. Ingest merges observed shapes, marks each field `declared` / `observed`, and reports
  **fields declared in code that the running API never sent**. Only 2xx bodies are learned from —
  an error envelope is not a contract.
- `apiflow link <fe.apimap> <be.apimap>` — joins the two halves on `METHOD + normalized path`, with
  suffix matching for a gateway prefix only the frontend sees. Unlocks three questions neither half
  could answer alone: fields the API sends that no screen reads, fields declared but never sent, and
  endpoints no screen calls.
- `skills/be-map-extractor/` — the judgement layer: wire the probe harness into the project's own
  fixtures/auth, and classify each declared-but-never-sent field as bug, conditional, or scanner miss.

### Added — caller hop (screen attribution)

- `src/core/callerGraph.ts` — import graph over the frontend: named/default/namespace imports (type
  imports excluded), local declarations, and intra-file uses. `scan-fe` now walks a call site in an
  api module back through hooks and components to the file-based route that renders it, and records
  the hop count on the screen.
  Without it the answer to "which screen breaks" was the name of an api module. On a real Next.js
  app: **13/203 → 254/321 call sites attributed to a real route**.
  Members are tracked, so `agentsApi.remove` and `agentsApi.list` do not fan out to each other's
  screens. Confidence only ever drops across a hop, and never claims exact.
- Import specifiers resolve through `tsconfig`/`jsconfig` path aliases (`@/*`), relative paths,
  extension guessing and `index.*`.

### Added — workspace and UI (the reading half of the product)

- `apiflow project add|ls|rm` + `~/.apiflow/` — a registry of projects, each with an FE root, a BE
  root and the maps scanned from them. Nothing is ever written inside a scanned repo.
  Maps are stored per project and per kind (`fe`/`be`/`linked`), and every distinct scan is kept in
  `history/`, named by the content hash of the map itself: an unchanged repo re-scans to the same
  bytes, so history only grows when something really changed.
- `apiflow ui [--port=]` — a local server, bound to `127.0.0.1` with no flag to widen it. `/` lists
  every project; `/p/<id>` opens one.
- `apiflow hub <dir>` — the same project list as a self-contained HTML file, for a repo that has no
  server to run.
- The project view has eight panes over one map: endpoints (facet-filtered, with a 5-tab inspector),
  a coverage map that puts every endpoint on screen as one cell coloured by reconciliation state, the
  impact ring (screens against endpoints, one curve per call, hover a row to isolate its branch),
  impact for a single endpoint (the chain of hooks and components out to the screens that break),
  screens (the reverse direction), unresolved (grouped by reason), alerts, and compare.
- `apiflow view` and `apiflow hub` render that same app, with `live: false`. There is one renderer,
  not two: the first week of having two grew a served page with panes the written file never got.
- `src/workspace/alerts.ts` — method mismatch, FE calling a path the API does not declare, an open
  auth gate, an endpoint no screen calls. Severity is graded by the *confidence* of the call that
  found it, so a `guess` never shouts.
  Alerts and Unresolved are counted separately and never added together: an alert is something the
  tool understood and finds dangerous, an unresolved is something it could not understand.
- `src/workspace/diff.ts` — compares the last two scans of a map and leads with a sentence, not a
  number: a scan that saw more call sites while resolving fewer of them exactly says
  *"wider coverage, but less certain"* before it shows the counts.
- A scan button in the project view, streaming the scanner's own output over SSE, then re-linking
  the two halves. The scan writes to a staging file and only replaces the live map once the child
  exits cleanly, so a scan that dies halfway cannot leave a truncated map in place.
- `.dependency-cruiser.cjs` + `npm run boundary` — the map side and the request-runner side may not
  import each other.

### Added — the design layer

- Dark and light palettes from one token string, interpolated into both dark selectors: the media
  query for a viewer who never chose, `[data-theme="dark"]` for one who did. A stored choice is
  applied in `<head>` before the body paints, so a dark setup never flashes white. The rail cycles
  system → light → dark and the hub honours the same choice.
- The header dates the map instead of just naming it: branch and short sha read straight out of
  `.git` of each scanned root, plus how long ago each side was scanned. Where `.git` cannot be read
  it says so rather than leaving the space where a sha belongs empty.
- One KPI band, rendered once and used by both the overview and the endpoints pane, with a delta
  against the previous stored scan. A delta appears only when a previous scan exists — no "▲ 0" on
  a first run — and a sparkline appears only from the third scan, because two points joined by a
  straight line is not a trend.
- Endpoints pane rebuilt for scanning: facet sidebar with a count on every value (counted over the
  whole map, so the number does not move as you filter), 50 rows a page, path and handler on two
  fixed lines with the full value in the title, and an inspector that opens on a row instead of
  asking you to click one. Screens and alerts paginate through the same pager.
- The dependency chain is drawn as a graph, not four lists: nodes in role columns, one arrow per
  real chain edge coloured by the confidence of the call it came from, dashed where the chain lost
  precision. Hovering a node lights its whole branch in both directions, because the question at a
  component is "which screen breaks" and that answer is two hops away.
- The endpoint inspector says when apiflow first saw that endpoint (`first seen in scan 2/3`),
  derived from the stored history. Dates come from file mtime — a `.apimap` deliberately carries no
  timestamp inside it.

### Added — adding a project from the UI

- `+ Add project` on the hub and in a project header, backed by `POST /api/projects`. It registers
  the project and immediately runs the first scan into the same streamed log, because `/p/<id>` with
  no map yet answers "no map yet", and that reads as a failed add.
- `src/server/guard.ts` — this is the only route that takes a filesystem path from a request, so it
  is fenced: the `Host` header must be loopback (a hostname that resolves to 127.0.0.1 is what DNS
  rebinding produces, and Origin agrees with the attacker in that case), `Sec-Fetch-Site` must not
  say cross-site, and any `Origin` must itself be loopback. The scan route is fenced the same way.
  Without it, any page open in the same browser could register the user's home directory as a
  project and have it scanned.
- Refusals are shown verbatim from the server: a directory that does not exist, an id already taken,
  a name no id can be derived from. The registry's messages now read as prose ("FE directory") instead
  of naming CLI flags, because the same text appears in a form that has no `--fe`.
- The dialog, the SSE reader and the scan buttons live in one module shared by the hub and the
  project view — a hub with no projects is exactly where someone needs the button most.

### Added — the hub is a workspace, not a listing

- Totals across every project (endpoints, screens, open auth gates, FE-only paths, unresolved), with
  unresolved kept out of the other counts the way every other page keeps it out.
- Each card names the project's own name, its id, both roots clipped to one line each, and the branch
  and short sha each side sits on — the same revision line a project header carries.
- Per-card actions: `Scan FE` / `Scan BE` streaming into the page, and `Drop from workspace`. A project
  with no map gets a scan button instead of an instruction to go and type the CLI — the page can run
  the scan itself, so the state it describes is the state it can fix.
- `DELETE /api/projects/:id` removes the workspace entry only; the scanned maps stay on disk, which
  is what the confirmation text promises. It answers with the directory it kept, or null when the
  project was removed before its first scan and there is no such directory to name.
- The empty state points at the button instead of at a CLI command, and drops the legend that
  explains numbers no card is showing yet.
- The light/dark control is now on the hub too. Its styles and behaviour moved into `theme.ts` so the
  two pages cannot drift; previously a theme pinned on a project page could not be changed from the
  hub at all.

### Added — editing a project's roots

- `Edit roots` on each hub card and in the project header, and `PATCH /api/projects/:id` behind the same
  write fence as the other two. The dialog is the add dialog reopened with the values filled in; the
  id field disappears and says why, because the id is the directory the scanned maps live under.
- Absent field and empty field mean different things: absent leaves a root alone, empty clears it.
  A form posts every input it has, so without that split editing the FE path could never remove a BE
  path, and the project view's form would wipe the hints file every time it saved.
- A root can move but a map does not follow it, so a map whose recorded `metadata.root` no longer
  matches the project is labelled on the card — the amber kind badge plus the directory it was really
  scanned from. The map is not deleted: it is still a true measurement, of a different repo.
  Saving an edit runs the scan that makes it true again.
- Clearing the last remaining side is refused, and so is a blank name — the old value is kept and the
  refusal is shown rather than the edit being silently dropped.

### Changed — one shell for both pages

The hub and a project page were two designs: a windowed page with the brand in a top bar and the theme
control on the right, versus a full-bleed app with the brand in the rail and the theme control at its
foot. Opening a project felt like leaving the application. They are now the same shell, and the shell
lives in one file — `appStyle.ts` — so the next change lands on both.

- The hub renders into `.app-shell` / `.rail` / `.main` / `.phead` / `.panel` / `.kpistrip` / `.watch`,
  the project page's own components. Its cards' bespoke `.dbox`, `.totals`, `.bar3`, `.lgd` and `.todo`
  are gone; the reconciliation bar is the same `.recon` + `.legend4` with the same four bucket names, so
  a bar on the hub and the bar on the page it links to can no longer tell different stories.
- One rail width (248px) and one brand position for both pages. The brand is now the way back to the
  workspace: a link on a project page, the same element unlinked on the hub, and unlinked in the file
  `apiflow view` writes — a dead link in an offline file is worse than none.
- `+ Add project` moved from the project header to the foot of the rail on both pages. It is a
  workspace action; in the header row it read as one of the things you can do to the project you opened.
- A project page is now titled by the project (`webapp`), not by the map (`webapp-ui+webapp-api`).
  The rail on the hub calls it `webapp`, so landing on a differently-named page read as another thing.
  The map's own name still shows in the generator line under the roots.
- Both pages' tiles carry the same three lines, so the two strips are the same height, and every tile on
  the hub says which map it was measured on — a project can hold three.

### Fixed

- Nav item styling was scoped to `.rail a`, which caught the brand link and handed it a nav item's
  padding: 16px of drift between two pages whose whole point was to look alike. Scoped to `.rail nav a`.

### Changed — the hub is a rail and a detail pane, not a wall of cards

- `/` is now the same shape as a project page: the project list is a rail down the left, one project's
  detail fills the right. Cards in a grid row stretched to the tallest of them, so one project with
  three maps and five buttons left a hole beside the two next to it — and every card had to repeat the
  name, the id, both roots, the revisions and five buttons to be readable on its own.
- Selecting a project writes the hash, so `/#webapp` is a link, a reload comes back to the same
  project, and Back walks the selection. Every switch goes through the hash, so the address bar can
  never name one project while the pane shows another.
- `Whole workspace` sits at the top of the rail: the six workspace totals, and under them one ranked
  list of what is worth looking at across every project — a stale root first, then endpoints with no
  auth gate, then FE paths the API does not declare, down to the unresolved calls. Each line links
  into the pane of the project that carries it. The old strip of big red numbers pointed nowhere: it
  said 40 endpoints had no auth gate without saying which project to open.
- The coverage bar carries its own numbers underneath it, so the two paragraphs of legend and caveat
  that used to explain the page are gone. Segments that are zero are left out instead of printed as 0.
- One primary action per pane (`Open the map →`), the rest beside it, and `Drop from workspace` kept in the
  muted style it had — a project with no map still gets `Scan FE` where the map link would be.
- The rail keeps the search, the side/state filter and the six orderings; the filter is now two small
  selects instead of six chips, because a 300px rail cannot hold a chip row. Only the ordering is
  remembered between visits.
- A marker set before first paint decides whether the unselected panes are hidden, so the page shows
  every project stacked when the script does not run rather than an empty column.
- The totals no longer recompute themselves from the visible cards: the workspace pane says
  `Whole workspace` and means it, and the rail count is what reports how many rows a filter hid.

### Added — sorting and filtering the project list

- A toolbar over the cards: free-text search across name, id and both roots; chips for `both sides`
  / `FE only` / `BE only` / `not scanned` / `map root drifted`; and six orders — name, newest scan, oldest
  scan, most endpoints, most unresolved, and `worth a look first`, whose option label spells out its own
  ranking (a map scanned from a root the project no longer points at outranks every real finding,
  because those findings were measured on a different repo).
- The count says how many are hidden, not just how many are left, and the totals strip is recomputed
  from the visible cards with its subtitle switching to `across the N visible projects` — a row of big
  numbers over a filtered list is read as the total of what is on screen whatever the label says.
- Filtering and sorting happen in the browser over the cards already rendered, so the static hub
  written by `apiflow hub` filters too, and a keystroke does not wipe a running scan log. Only the
  chosen order is remembered between visits; a filter is not, because a hidden project is the kind of
  thing that should not survive a reload.

### Fixed — request runner (the React half)

Every one of these was found by taking the lint errors seriously instead of silencing them: the rules
pointed at four mechanisms that were already broken.

- Running a request no longer yanks the panel to the Response tab from a tab that is already showing
  the run. From Config or Request it still jumps — you clicked Run to see a response, and neither of
  those says anything about one — but Response, Diff and History are left where they are, so a second
  run fills in the diff you opened it for instead of throwing you off it. The tab is read at the
  moment the request finishes, not the moment Run was clicked, so switching tabs during a slow
  request keeps the choice made last.
- The Diff tab could never show a diff. Its "previous result" lived in a ref inside the component,
  and running a request switches the panel to the Response tab — which unmounts the component and
  throws the memory away exactly when the second result arrives. It now reads the run history store,
  which is where the last ten results per node already are, so the first thing you see after a second
  run is the diff. Being keyed by node also stops one node's run being diffed against another's.
- The inspector persisted the width of the last `mousemove`, not of the drag. Release the mouse after
  a fast final move and the panel came back a few dozen pixels off. Mouseup now computes the final
  width from its own coordinates, which also removes the ref that mirrored state during render.
- The draft banner and the draft itself were two pieces of state that could disagree; they are now
  one, so dismissing the banner cannot leave a draft behind for a later Restore to load. The draft is
  read while rendering rather than in an effect.
- The fullscreen JSON viewer had a suppression comment for an a11y rule this config does not even
  load — a warning that could never fire. The modal now says it is a dialog instead.
- `showSaveFilePicker` / `showOpenFilePicker` were reached through `window as any`. They are declared
  with the shape actually used, so a typo in an option name fails to compile.

### Fixed

- `[hidden]` was losing to the cards' own `display:flex`, so the first cut of the filter counted
  correctly and hid nothing. The shared sheet now carries one `[hidden] { display:none !important }`
  rule, and `hub.test.ts` fails if it goes.
- `headlineFor` called a scan "more certain" when coverage grew and every confidence share moved
  0.0pp. It now says coverage grew and certainty held, which is what the panel underneath shows.
- A literal newline inside a quoted string in an embedded script broke the whole script in the
  browser, and the only symptom was one console error on a page that still rendered. `scripts.test.ts`
  now compiles every embedded script, alone and concatenated the way the page ships them.

### Changed

- `.apimap` fields now carry `kind` (`request`/`response`), `type`, and independent `declared` /
  `observed` flags, plus `declaredAs` when a wrapper (`{data: …}`) renames the observed path.
- FE scanner follows callback parameters: `rows.data.map(u => u.email)` now traces `data.email`.
  Without it every list screen traced nothing and the link audit called live fields dead.

### Added — tests

- vitest, and 90 tests over `src/core/` (apimap, feScanner, executor, assertionRunner,
  variableResolver, topologicalSort, all three parsers, curl exporter, beScanner, shape, probe harness, link).

### Removed

- Loop node. The executor treated it as a pass-through while shipping a full config UI; a headline
  feature that does not run is worse than an absent one. Gone from executor, canvas, inspector,
  toolbar, store and types.

### Fixed

- `apiflow` (serve mode) builds `dist/` on demand instead of exiting — a git clone had no way to run
  the documented first command.
- `proxy/` and `src/mcp/` are now type-checked (`tsconfig.node.json`), which surfaced and fixed an
  unchecked `res.json()` cast in `httpClient` and dead code in the proxy.

### Internal

- E2E pipeline dispatch smoke test marker (ISS-5).

---

## [0.4.0] - 2026-03-20

### Phase 4: Claude Code Integration

**Core Engine Separation:**
- Extracted pure TypeScript engine into `src/core/` (11 modules) — no React, Zustand, or DOM dependencies
- Core modules: executor, variableResolver, topologicalSort, assertionRunner, httpClient, curlParser, curlExporter, openApiParser, postmanParser, idGenerator, types
- Existing `src/engine/` and `src/utils/` now re-export from core — zero breaking changes for UI code
- Added `sendRequestDirect()` in httpClient for Node.js environments (bypasses CORS proxy)
- Executor refactored to callback-based pattern (`ExecutionCallbacks` interface)

**MCP Server:**
- MCP server at `src/mcp/` using `@modelcontextprotocol/sdk` with stdio transport
- 12 tools: `load_flow`, `save_flow`, `list_nodes`, `add_node`, `update_node`, `delete_node`, `connect_nodes`, `run_node`, `run_flow`, `set_environment`, `export_curl`, `import_collection`
- 3 resources: `apiview://flow/state`, `apiview://flow/results`, `apiview://flow/environments`
- In-memory state manager (`McpState`) replaces Zustand for MCP context
- Run with: `npm run dev:mcp` or `claude mcp add apiflow -- npx tsx src/mcp/server.ts`

**Laravel Analyzer Skill:**
- Claude Code skill at `skills/api-flow-analyzer/skill.md`
- Analyzes Laravel routes, controllers, services, FormRequest validation rules
- Generates `.apiview` flow files grouped by controller/resource
- Includes CRUD template at `skills/api-flow-analyzer/templates/laravel-crud.json`

**Project Overview Dashboard:**
- Dashboard view accessible from toolbar
- Flow result cards with pass/fail status, node count, duration
- Batch run: execute all saved flows with progress tracking
- Summary stats: total, passed, failed, not run
- Sort by name, status, or date

---

## [0.3.0] - 2026-03-20

### Phase 3: Integration & Advanced

**Import/Export:**
- OpenAPI 3.x import (JSON/YAML) — auto-detect format, extract endpoints with headers/params/body examples
- Postman collection v2.x import — recursive folder traversal, URL resolution, header/body mapping
- Export to Postman collection v2.1 JSON with environment variables
- Export cURL commands: per-node (copy button in inspector) + all nodes (toolbar menu)

**Test Assertions:**
- 4 assertion types: status_equals, body_contains, jsonpath_match, header_exists
- Per-node assertion editor in Config tab with type dropdown, target/expected inputs
- Green/red badge on canvas nodes showing assertion pass/fail
- Assertions run automatically after each node execution

**Response Diff:**
- Diff tab in inspector comparing previous vs current run
- Color-coded: green (added), red (removed), yellow (changed)
- Compares status, headers, and body

**Request History:**
- History tab in inspector showing last 10 runs per node
- Each entry: timestamp, status badge, duration, size
- Expandable with full response body (JsonTreeView)
- Clear history per node

**Theme:**
- Dark/Light theme toggle in toolbar
- CSS variable-based theming with `[data-theme]` attribute
- Persisted to localStorage, flash-free on reload (inline script)

**MiniMap:**
- ReactFlow MiniMap in bottom-right of canvas
- Node coloring by type (API=blue, annotation=gray, group=dark)

**Environment Quick-Switch:**
- Dropdown in toolbar showing all environments
- Active environment with green indicator
- One-click switch

---

## [0.2.0] - 2026-03-19

### Phase 2: Developer Experience

**Dynamic Variables:**
- `{{nodes["Node Name"].response.body.path}}` syntax to chain responses between nodes
- `getValueByPath` helper supports dot-path navigation with array indexing `[0]`
- Resolution order: node variables first, environment variables second

**Variable Autocomplete:**
- Dropdown on typing `{{` in URL and body fields
- Suggestions from environment variables and node response paths (depth 3)
- Keyboard navigation: arrows, Enter to select, Escape to close

**cURL Import:**
- Paste cURL from browser DevTools
- Parses -X, -H, -d/--data-raw, -u (Basic auth), multi-line continuations
- Auto-formats JSON body on import
- Handles unknown flags gracefully

**Step-by-Step Execution:**
- Run flow level by level with "Step Through" mode
- "Next Step" button shows progress (current/total)
- Stop stepping at any point

**Canvas Enhancements:**
- Annotation nodes: double-click to edit text, Ctrl+Enter to save
- Group frame nodes: resizable dashed rectangle with title
- Node description/notes field with icon indicator on canvas

**Export:**
- Canvas export to PNG and SVG via html-to-image
- Controls excluded from export

**Flow Library:**
- Grid view of saved flows in localStorage
- Search by name, sort by date
- Actions: open, duplicate, delete

**Auto-save:**
- Draft saved to localStorage every 30 seconds
- Restore banner on reload if unsaved draft found

**Undo/Redo:**
- History stack (50 max) for structural operations
- Tracked: add/delete node, connect, edge delete, node drag
- Toolbar buttons + Ctrl+Z / Ctrl+Shift+Z

**Keyboard Shortcuts:**
- Ctrl+Z Undo, Ctrl+Shift+Z Redo, Ctrl+S Save, Ctrl+O Open
- Ctrl+Enter Run All, Ctrl+I Import cURL, Escape deselect/close
- Platform-aware hints (Cmd on macOS)

**Inspector Panel:**
- Resizable 320-800px with drag handle
- Width persisted to localStorage

**JSON Viewer:**
- Tree/Raw toggle (default Raw)
- Search/filter with match highlighting
- Copy JSONPath on hover ($ button per row)
- Expand/Collapse all
- Collapsed preview (first 3 keys for objects)
- Full-screen expand modal with line numbers
- Copy to clipboard

**Body JSON Editor:**
- Real-time validation (valid/invalid/has-vars)
- Format (pretty-print) and Minify buttons — variable-aware
- Tab key inserts 2 spaces
- Full-screen expand modal with line numbers and synced scroll

**KeyValueEditor:**
- Ghost row auto-adds when typing in last row
- Bulk edit mode: paste Key: Value per line
- 35/65 key/value column ratio

---

## [0.1.0] - 2026-03-19

### Phase 1: MVP

- React 19 + @xyflow/react 12 + Zustand 5 + Vite 8 + Tailwind 4 + TypeScript 5.9
- Infinite canvas with zoom, pan, dot grid background
- API nodes: create (5 HTTP methods), delete, drag, method badge, URL display
- Connections: drag between node ports, bezier curves, status-colored (idle/running/success/error)
- Execution engine: Kahn's topological sort, parallel per level, stop on error
- Run All flow + Run single node
- Inspector panel: Config (method/URL/headers/params/body), Request (resolved), Response (status/headers/body/timing)
- Environment variables: multiple environments, add/delete/switch, key-value with enable/disable
- Save/Load .apiview files (File System Access API with fallback)
- CORS proxy server (Express on port 3001)
- JSON tree viewer with collapse/expand
