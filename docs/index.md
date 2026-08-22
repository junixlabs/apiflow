---
title: apiflow
---

# If I change this, what breaks?

<p class="lede">A dependency map for systems that talk over HTTP — <em>screen ↔ endpoint ↔ field</em>. Answered before you edit.</p>

<p class="sub">Postman stores requests; it does not know your screens exist. OpenAPI describes the API, not who consumes it. Grepping a field name returns a thousand lines that cannot tell a definition from a consumption. apiflow reads both sides of the wire and keeps the <code>file:line</code> for every hop, so an answer is checkable in thirty seconds rather than taken on trust.</p>

```console?prompt=%24+
$ apiflow scan-fe fixtures/demo-app/web --name=demo --out=$TMP/fe.apimap
## FE Map Scan Results

**Screens**: 3
**Endpoints**: 3
**Calls**: 3 (exact 0 · inferred 2 · guess 1)
$ apiflow impact $TMP/fe.apimap --endpoint="GET /users/{param}"
## Impact — GET /users/{param}

1 screen(s) break if this changes:

- **/users/{param}** [guess] — src/api/users.ts:4 · via 2 hop(s) → src/pages/users/[id].tsx:4
  client    fetchUser  src/api/users.ts:3
  ↳ hook      useUser  src/hooks/useUser.ts:4
  ↳ screen    UserPage  src/pages/users/[id].tsx:4
```

<p class="sub">That block is not an illustration. CI runs both commands against
<code>fixtures/demo-app/</code> on every push and fails if a single line above stops appearing — the
same rule every page of the guide is held to.</p>

## Install

```bash
npm install -g @junixlabs/apiflow
apiflow project add "web" --fe=/path/to/frontend [--be=/path/to/api]
apiflow project scan web
apiflow impact ~/.apiflow/projects/web/fe.apimap --field=email
```

## The guide

Every page is a **transcript replayed by CI** on every push — not prose about the tool, but a
recording of it. A page that stops matching what the tool prints fails the build, which is the only
reason you should believe any of it. [How that works →](guide/)

<div class="cards">
  <a class="card" href="guide/01-first-answer.html">
    <span class="pill shipped">shipped</span>
    <h3>Your first impact answer</h3>
    <p>The whole path against a four-file fixture committed to this repo.</p>
  </a>
  <a class="card" href="guide/02-a-wrapper-definition-is-not-a-call.html">
    <span class="pill upcoming">upcoming</span>
    <h3>A wrapper definition is not a call</h3>
    <p>A real defect, written down before it is fixed. CI asserts this one still fails.</p>
  </a>
  <a class="card" href="guide/03-probe.html">
    <span class="pill reference">reference</span>
    <h3>probe — confirm by running</h3>
    <p>Turn “the code declares this field” into “the API actually sent it”.</p>
  </a>
  <a class="card" href="guide/04-two-machines.html">
    <span class="pill reference">reference</span>
    <h3>FE here, BE elsewhere</h3>
    <p>Two machines, one map, no server. The file travels; nothing is hosted.</p>
  </a>
</div>

`upcoming` failing on purpose is the load-bearing part: a page cannot claim to work, and cannot stay a
roadmap after it starts working. **Status is a test result, not a label somebody remembered to change.**

## Why the labels are the point

An answer without its confidence is a liability, so every claim carries one:

| Label | What it means |
|---|---|
| `exact` | the path is a literal at the call site |
| `inferred` | one half was derived — a template string, an implicit verb |
| `guess` | the path was assembled, or the screen was reached through a wide module hop |
| **unresolved** | call sites the scanner could **not** read. `0 screens` means *nothing in this map calls it* — never *nothing calls it* |

Audited on a real Next.js app: 28 `guess`-level claims sampled, the **endpoint was right 28/28**, the
**screen 17/28**. Both numbers matter. Read `exact` and `inferred` as answers, `guess` as a lead worth
thirty seconds — and run the audit against your own repo rather than trusting ours.

## Reference

- [The `.apimap` format](https://github.com/junixlabs/apiflow/blob/main/packages/map/SPEC.md) — the public contract, and the gap it still has
- [What kind of product this is](research/product-shape.html) — the category, its graveyard, and the two roads Mermaid and draw.io took
- [NORTH-STAR](https://github.com/junixlabs/apiflow/blob/main/NORTH-STAR.md) — §2 the pain this exists for, §7 what will not be built yet
