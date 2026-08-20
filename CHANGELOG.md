# Changelog

All notable changes to API View are documented here.

---

## [Unreleased]

### Added — agent-native (the map as an MCP server)

- `apiflow mcp-map` — a second MCP server, map-side only (the existing `--mcp` one is the request
  runner and pulls the run half in; this one never touches it, enforced by the dependency-cruiser
  boundary). Tools: `impact_endpoint` · `impact_field` · `screen_deps` · `find` · `map_health` ·
  `map_check` · `map_list`. Answers are compact, carry the `file:line` that proves each screen, and
  every one of them ends with the map it came from and the count of call sites the scanner could not
  resolve — so `0 màn` cannot be read as "nothing calls this". Errors come back as tool text, never
  thrown, so a typo in a route cannot kill the session. Target resolution: `project` (workspace id) →
  `map` (a file path, e.g. one committed in the repo) → `APIFLOW_PROJECT` → the only project there is.
- `skills/apiflow-impact/` — the companion skill: when to ask (before editing a route, handler, api
  client or response field), how to read confidence, and what `0 màn` does and does not mean.
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
  *"phủ rộng hơn, nhưng chắc chắn kém đi"* before it shows the counts.
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
- The endpoint inspector says when apiflow first saw that endpoint (`xuất hiện ở bản scan thứ 2/3`),
  derived from the stored history. Dates come from file mtime — a `.apimap` deliberately carries no
  timestamp inside it.

### Added — adding a project from the UI

- `+ Thêm project` on the hub and in a project header, backed by `POST /api/projects`. It registers
  the project and immediately runs the first scan into the same streamed log, because `/p/<id>` with
  no map yet answers "chưa có map nào", and that reads as a failed add.
- `src/server/guard.ts` — this is the only route that takes a filesystem path from a request, so it
  is fenced: the `Host` header must be loopback (a hostname that resolves to 127.0.0.1 is what DNS
  rebinding produces, and Origin agrees with the attacker in that case), `Sec-Fetch-Site` must not
  say cross-site, and any `Origin` must itself be loopback. The scan route is fenced the same way.
  Without it, any page open in the same browser could register the user's home directory as a
  project and have it scanned.
- Refusals are shown verbatim from the server: a directory that does not exist, an id already taken,
  a name no id can be derived from. The registry's messages now read as prose ("thư mục FE") instead
  of naming CLI flags, because the same text appears in a form that has no `--fe`.
- The dialog, the SSE reader and the scan buttons live in one module shared by the hub and the
  project view — a hub with no projects is exactly where someone needs the button most.

### Added — the hub is a workspace, not a listing

- Totals across every project (endpoints, screens, open auth gates, FE-only paths, unresolved), with
  unresolved kept out of the other counts the way every other page keeps it out.
- Each card names the project's own name, its id, both roots clipped to one line each, and the branch
  and short sha each side sits on — the same revision line a project header carries.
- Per-card actions: `Scan FE` / `Scan BE` streaming into the page, and `Bỏ khỏi workspace`. A project
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

- `Sửa gốc` on each hub card and in the project header, and `PATCH /api/projects/:id` behind the same
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
- `+ Thêm project` moved from the project header to the foot of the rail on both pages. It is a
  workspace action; in the header row it read as one of the things you can do to the project you opened.
- A project page is now titled by the project (`adminhub`), not by the map (`adminhub-ui+adminhub-api`).
  The rail on the hub calls it `adminhub`, so landing on a differently-named page read as another thing.
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
- Selecting a project writes the hash, so `/#adminhub` is a link, a reload comes back to the same
  project, and Back walks the selection. Every switch goes through the hash, so the address bar can
  never name one project while the pane shows another.
- `Toàn workspace` sits at the top of the rail: the six workspace totals, and under them one ranked
  list of what is worth looking at across every project — a stale root first, then endpoints with no
  auth gate, then FE paths the API does not declare, down to the unresolved calls. Each line links
  into the pane of the project that carries it. The old strip of big red numbers pointed nowhere: it
  said 40 endpoints had no auth gate without saying which project to open.
- The coverage bar carries its own numbers underneath it, so the two paragraphs of legend and caveat
  that used to explain the page are gone. Segments that are zero are left out instead of printed as 0.
- One primary action per pane (`Mở bản đồ →`), the rest beside it, and `Bỏ khỏi workspace` kept in the
  muted style it had — a project with no map still gets `Scan FE` where the map link would be.
- The rail keeps the search, the side/state filter and the six orderings; the filter is now two small
  selects instead of six chips, because a 300px rail cannot hold a chip row. Only the ordering is
  remembered between visits.
- A marker set before first paint decides whether the unselected panes are hidden, so the page shows
  every project stacked when the script does not run rather than an empty column.
- The totals no longer recompute themselves from the visible cards: the workspace pane says
  `Toàn workspace` and means it, and the rail count is what reports how many rows a filter hid.

### Added — sorting and filtering the project list

- A toolbar over the cards: free-text search across name, id and both roots; chips for `cả hai phía`
  / `chỉ FE` / `chỉ BE` / `chưa scan` / `map lệch gốc`; and six orders — name, newest scan, oldest
  scan, most endpoints, most unresolved, and `đáng để mắt`, whose option label spells out its own
  ranking (a map scanned from a root the project no longer points at outranks every real finding,
  because those findings were measured on a different repo).
- The count says how many are hidden, not just how many are left, and the totals strip is recomputed
  from the visible cards with its subtitle switching to `trên N project đang hiện` — a row of big
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
- `headlineFor` called a scan "chắc chắn hơn" when coverage grew and every confidence share moved
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
