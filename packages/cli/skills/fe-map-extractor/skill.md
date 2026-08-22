---
name: fe-map-extractor
description: >
  Map a frontend to the API it consumes — screen → endpoint → field — and answer
  "if I change this endpoint or field, which screens break?". Use when the user
  asks to: map a frontend's API usage, find which screens call an endpoint, work
  out the blast radius of an API or field change, audit who consumes an endpoint,
  or generate an .apimap file. Framework-agnostic: it reads call sites, not
  framework conventions.
---

# FE Map Extractor

Produce an `.apimap` for a frontend, then answer impact questions from it.

**The scanner does the reading, you do the deciding.** `apiflow scan-fe` walks every source
file deterministically and resolves what a machine can resolve. You only look at what it could
not — usually a dozen call sites, not a thousand files. Do not read the tree yourself first.

## What this is not

This maps the **consumer** side. `api-flow-analyzer` maps the **provider** side (backend routes
→ `.apiview`). Both write into `.apiview/`; neither replaces the other. If the user wants "what
endpoints exist", that is the other skill.

## Process

### 1. Scan

```bash
npx @junixlabs/apiflow scan-fe <frontend-root> --name=<name>
```

Writes `<frontend-root>/.apiview/map/<name>.apimap` and prints a report. Read the report, not
the repo.

If the root holds more than one frontend (a monorepo with `apps/*`), **ask which one** before
scanning, and scan them separately. Two frontends in one map produces a graph nobody can act on.

### 2. Read the report

```
**Screens**   how many distinct routes/components make calls
**Endpoints** how many distinct method+path pairs they reach
**Calls**     screen→endpoint edges, split by confidence
**Fields**    response fields traced to a reader

### Unresolved — n
```

`exact` = literal url and an explicit verb. `inferred` = one half was derived (a base-url
variable, a defaulted GET, a hint). `guess` = the path was scraped out of a larger expression.

A scan whose calls are mostly `guess` means the codebase routes its requests through a wrapper
the scanner cannot see through. Say that plainly instead of presenting the map as complete.

### 3. Resolve the Unresolved list — this is the whole job

Every entry names a file and a line. For each one, open **that file only** and answer:

- What is the url variable bound to? Follow it to the constant or the wrapper argument.
- Which verb does it use? Look for `method:`, the wrapper's name, or the function it lives in.
- Is it even HTTP? `fetch` inside a mock, a test helper, or a service worker is not a screen
  calling an API.

Then write `hints.json` **next to the map**:

```json
{
  "resolve": [
    { "file": "src/api/invoices.ts", "line": 42, "url": "/api/invoices/{id}", "method": "DELETE",
      "note": "url comes from INVOICE_BASE + id, INVOICE_BASE = '/api/invoices' in src/config.ts:8" }
  ],
  "ignore": [
    { "file": "src/mocks/handlers.ts", "line": 12 }
  ]
}
```

- `resolve` — you worked out the real endpoint. `note` records how, so the next reader can check you.
- `ignore` — the call site is not a screen calling an API. Use it, do not leave noise in the map.

**Never hand-edit the `.apimap`.** Ids are derived from content so that re-scanning an unchanged
repo produces a byte-identical file; a hand-written id breaks that and the map starts producing
whole-file git diffs. Hints are the only supported way in.

### 4. Re-scan with the hints

```bash
npx @junixlabs/apiflow scan-fe <frontend-root> --name=<name> --hints=<path-to-hints.json>
```

Repeat 3–4 until what remains in Unresolved is genuinely unresolvable — dynamic dispatch, a url
built from server-sent config, a code-generated client with no literal anywhere.

**Leave those in the list.** Do not invent an endpoint to empty the section. A map that hides its
own gaps gets trusted for coverage it does not have, which costs more than having no map.

### 5. Answer the question

```bash
npx @junixlabs/apiflow impact <map.apimap> --endpoint="GET /api/users/{id}"
npx @junixlabs/apiflow impact <map.apimap> --field=email
npx @junixlabs/apiflow impact <map.apimap>          # list endpoints with caller counts
```

Field impact deliberately includes screens that call the endpoint without a traced read, marked
`guess` — a screen can break on a field it never names in code.

### 6. Report

```
## FE Map — {name}

**Frontend**: {path}
**Map**: {path to .apimap}
**Screens**: {n} · **Endpoints**: {n} · **Calls**: {n} (exact {n} · inferred {n} · guess {n})

### Resolved by hand — {n}
- src/api/invoices.ts:42 → DELETE /api/invoices/{id} — INVOICE_BASE + id

### Unresolved — {n or "none"}
- src/api/gen/client.ts:210 — url assembled from a server-sent manifest, no literal path

### Confidence
{one honest sentence: what fraction of calls is exact, and what the map is not safe to conclude}
```

The Unresolved and Confidence sections are not optional. When nothing is unresolved, write
`### Unresolved — none` explicitly, so the reader can tell the check ran from the check being skipped.
