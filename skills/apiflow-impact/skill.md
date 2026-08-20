---
name: apiflow-impact
description: >
  Before changing an endpoint, a route handler, an API client or a response field,
  find out which screens consume it — and after changing it, check the map still
  matches the code. Use when the user asks "what breaks if I change this", when you
  are about to edit a route/handler/contract/api-client file, when you need to know
  who consumes an endpoint or field, or when a committed .apimap may be stale.
  Reads an existing map through the apiflow-map MCP server; does not read the tree.
---

# apiflow impact

Answer **"đổi cái này thì màn nào vỡ?"** from a map that already exists, in one tool call,
before touching the code.

## When to reach for this

- You are about to edit a file that declares or calls an endpoint — a route file, a controller,
  an api client, a query hook, a response DTO/schema.
- Someone asks who consumes an endpoint or a field.
- You changed the API surface and need to know whether the committed map is now stale.

Do **not** grep the tree for a route string first. Grep cannot tell a definition from a
consumption, and it stops at the api module — the map already walked client → hook → component →
screen and kept the `file:line` for every hop.

## The tools

| Tool | Use it for |
|---|---|
| `impact_endpoint` | which screens break if this endpoint changes (`verbose` adds the call chain) |
| `impact_field` | which screens break if this response field changes |
| `screen_deps` | what one screen depends on |
| `find` | you do not know the exact route/field string yet |
| `map_health` | how much of the map to trust before quoting it |
| `map_check` | is the map still true (re-scans; seconds to tens of seconds) |
| `map_list` | which projects have a map at all |

Pass `project` (workspace id) unless there is exactly one project. Pass `map` for a `.apimap`
file that is not in the workspace — for example one committed in the repo you are working in.

## How to read the answer

Every answer ends with the map it came from and **how many call sites the scanner could not
resolve**. Those two facts are part of the answer, not a footnote:

- `exact` — the path is a literal at the call site.
- `inferred` — one half was derived (a template, an implicit verb).
- `guess` — the path was assembled, or the screen was reached through a wide module hop. Real
  signal, not proof.
- **`0 màn vỡ` is not "nothing uses it".** It means nothing *in this map* calls it. If the
  unresolved count is not zero, say so in the same sentence.
- If `map_health` says the BE half is too thin to compare, do not act on "FE gọi, API không
  khai" — that column is the scanner's blind spot, not a defect in the API.

## What to do with it

1. Ask before editing. Name the screens you are about to affect, with their `file:line`.
2. If the blast radius is bigger than the user expects, say so **before** you start, not after.
3. After changing the API surface, run `map_check` (or `apiflow project scan <id>`) and refresh
   the committed map in the same change — a map that lags the code answers with yesterday's truth.

## What this is not

This reads a map. Building one is `fe-map-extractor` (consumer side) and `be-map-extractor`
(provider side). If there is no map yet, `map_list` says so and those skills are the way in.
