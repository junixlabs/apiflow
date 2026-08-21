# API View — Feature Specification

Status legend: DONE = implemented, PARTIAL = partially done, PLANNED = not yet started

---

## F1: Visual Flow Canvas — DONE

### Description
A drag-and-drop canvas where a developer creates, arranges and connects API nodes into a flow.

### Requirements

**Canvas:**
- An infinite canvas with zoom and pan — DONE
- Grid background (dots) — DONE
- A mini-map for large flows — PLANNED (Phase 3)
- Multi-select nodes — PARTIAL (Delete key works, no Shift+Click group select)

**Node types:**
- API node: method badge, URL, status indicator — DONE
- Annotation node: editable text, no handles — DONE (Phase 2)
- Group frame node: resizable dashed rectangle with title — DONE (Phase 2)

**Node display:**
- Method badge (GET=green, POST=yellow, PUT=orange, DELETE=red, PATCH=purple) — DONE
- URL (truncated when long) — DONE
- A custom name (label) — DONE
- A status indicator after a run (success/error/running/idle) — DONE
- A description icon when there are notes — DONE (Phase 2)
- Input port (left) + output port (right) — DONE

**Connection:**
- A line from an output port → an input port — DONE
- An animated dash while it executes — DONE
- Colours: grey (idle), green (success), red (error), animated blue (running) — DONE

---

## F2: Node Configuration Panel — DONE

### Description
A resizable side panel on the right, shown when a node is clicked, where the API call is configured in detail.

### Requirements

**Tabs:**

| Tab | Contents | Status |
|-----|----------|--------|
| Config | Label, Description, Method, URL, Headers, Params, Body | DONE |
| Request | Resolved request (URL, headers, body after variable resolution) | DONE |
| Response | Status, headers, body, timing, size | DONE |

Note: Config tab is a single view with all fields (not separate sub-tabs). Authentication is handled via Headers key-value editor.

**Body JSON editor:**
- Plain textarea with custom JSON validation (not Monaco) — DONE
- Real-time validation: Valid / Invalid / JSON+vars status — DONE
- Format (pretty-print) and Minify buttons, variable-aware — DONE
- Tab key inserts 2 spaces — DONE
- Full-screen expand modal with line numbers — DONE

**KeyValueEditor (Headers, Params):**
- Key-value rows with enable/disable checkbox — DONE
- Ghost row auto-add when typing in last row — DONE
- Bulk edit mode (paste Key: Value per line) — DONE
- 35/65 key/value column ratio — DONE

**Variable resolution:**
- Syntax: `{{variable_name}}` cho environment variables — DONE
- Syntax: `{{nodes["Node Name"].response.body.path}}` cho dynamic variables — DONE (Phase 2)
- An autocomplete popup when you type `{{` — DONE (Phase 2)

**Inspector panel:**
- Resizable (320-800px), width persisted to localStorage — DONE

---

## F3: Flow Execution Engine — DONE

### Description
An engine that executes the flow in topological order, with both sequential and parallel execution.

### Requirements

**Execution logic:**
1. Parse flow graph → topological sort (Kahn's algorithm) — DONE
2. A node with no incoming connection → starts — DONE
3. Nodes on the same level → run in parallel (Promise.allSettled) — DONE
4. Stop on first error (mark remaining as idle) — DONE

**Execution modes:**
- **Run All** — runs the whole flow — DONE
- **Run This Node** — runs a single node on its own — DONE
- **Step-by-Step** — runs one level at a time, pausing between steps — DONE (Phase 2)
- **Run From Here** — PLANNED

**Error handling:**
- A failed node → marked red — DONE
- Stop on Error (the default) — DONE
- Continue on Error option — PLANNED

**Execution results:**
- Keeps the latest run result for each node (in memory) — DONE
- Request history per node (multiple runs stored) — PLANNED (Phase 3)

---

## F4: Response Inspector — DONE

### Description
A panel that shows, per node, the request that was sent and the response that came back.

### Requirements

**Request view:**
- The full URL (with variables resolved) — DONE
- Method badge — DONE
- Headers (collapsible) — DONE
- Body (parsed JSON via JsonTreeView, fallback to raw text) — DONE

**Response view:**
- Status code badge + status text — DONE
- Response headers (collapsible) — DONE
- Response body: JSON tree/raw, plain text, null fallback — DONE
- Response size (bytes) + total duration (ms) — DONE
- Body type label (JSON / Text) — DONE
- Copy body button — DONE

**JSON Viewer (shared component for all JSON display):**
- Tree / Raw view toggle (default: Raw) — DONE
- Search/filter with match highlighting — DONE
- Copy to clipboard — DONE
- Copy JSONPath on hover ($) — DONE
- Expand / Collapse all — DONE
- Collapsed preview (first 3 keys for objects, first items for arrays) — DONE
- Full-screen expand modal with line numbers — DONE
- Line numbers in raw view — DONE

**Not implemented:**
- Timing breakdown (DNS, Connect, TLS, TTFB) — proxy only returns total duration
- HTML rendered preview — PLANNED

---

## F5: Environment Management — DONE

### Description
Environment-variable management, so the context can be switched between local, staging and production.

### Requirements

**Environment:**
- Several environments (add/delete/switch) — DONE
- Each environment is a set of key-value pairs with enable/disable — DONE
- Switched from a dropdown in the toolbar — DONE
- The active environment applies to every node in the flow — DONE

**Variables:**
- Environment-specific variables — DONE
- Global variables (shared across environments) — PLANNED
- Sensitive variable flag (masked display) — PLANNED

**Built-in variables:**
- `{{$timestamp}}`, `{{$randomUUID}}`, `{{$randomInt}}` — PLANNED

---

## F6: Flow Persistence & Sharing — DONE

### Description
Storing and managing flow files.

### Requirements

**File format:**
- `.apiview` extension (JSON) — DONE
- Schema: version, metadata, nodes[], edges[], environments[], activeEnvironmentName — DONE

**Storage:**
- Save/Load via File System Access API with fallback — DONE
- Auto-saves a draft to localStorage every 30 seconds — DONE (Phase 2)
- Restore banner on reload if draft found — DONE (Phase 2)

**Flow Library:**
- A grid view listing the flows (localStorage) — DONE (Phase 2)
- Search by name — DONE (Phase 2)
- Sort theo date — DONE (Phase 2)
- Quick actions: Open, Duplicate, Delete — DONE (Phase 2)

---

## F7: Import Capabilities — PARTIAL

### Requirements

**cURL import:**
- Paste a cURL command → parsed into a node config — DONE (Phase 2)
- Supported flags: `-X`, `-H`, `-d`, `--data-raw`, `-u` — DONE
- Auto-format JSON body on import — DONE
- Handle unknown flags gracefully — DONE

**OpenAPI/Swagger import:** — PLANNED (Phase 3)

**Postman collection import:** — PLANNED (Phase 3)

---

## F8: Export & Documentation — PARTIAL

### Requirements

**Image export:**
- PNG export — DONE (Phase 2)
- SVG export — DONE (Phase 2)

**Data export:**
- Export → Postman collection — PLANNED (Phase 3)
- Export → cURL commands list — PLANNED (Phase 3)

---

## Non-functional Requirements

| Requirement | Target | Status |
|-------------|--------|--------|
| Startup time | < 2 seconds | DONE |
| Node render (100 nodes) | < 1 second, no lag | Not benchmarked |
| API call execution | Never blocks the UI | DONE (async) |
| File size (built JS) | < 500KB gzipped | DONE (~138KB gzipped) |
| Supported platforms | macOS, Linux, Windows | DONE (web-based) |
| Offline capability | 100% (except API calls) | DONE |
