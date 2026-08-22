---
title: apiflow
---

# apiflow

<p class="lede">A dependency map for systems that talk over HTTP. Which screens break if you change
an endpoint or a response field — answered before you edit, with the <code>file:line</code> for every
hop.</p>

<figure class="diagram">
  <div class="scroll">{% include diagrams/model.svg %}</div>
  <figcaption>Three node kinds and two edges. Nothing here is drawn by hand — every node and every
  edge was read out of source, and keeps the file and line it came from.</figcaption>
</figure>

## How it works

<figure class="diagram">
  <div class="scroll">{% include diagrams/pipeline.svg %}</div>
  <figcaption>Each side is scanned where it lives, into its own file. <code>link</code> joins them. The
  map is a file, derived from content alone — two people scanning the same commit get the same bytes,
  and nothing is hosted.</figcaption>
</figure>

## Install

```bash
npm install -g @junixlabs/apiflow
apiflow project add "web" --fe=/path/to/frontend [--be=/path/to/api]
apiflow project scan web
apiflow impact ~/.apiflow/projects/web/fe.apimap --field=email
```

## Every claim carries its confidence

| Label | What it means |
|---|---|
| `exact` | the path is a literal at the call site |
| `inferred` | one half was derived — a template string, an implicit verb |
| `guess` | the path was assembled, or the screen was reached through a wide module hop |
| **unresolved** | call sites the scanner could **not** read. `0 screens` means *nothing in this map calls it* — never *nothing calls it* |

Audited on a real Next.js app: 28 `guess`-level claims sampled, the **endpoint was right 28/28**, the
**screen 17/28**. Read `exact` and `inferred` as answers, `guess` as a lead worth thirty seconds.

## Documentation

Every page below is a **transcript replayed by CI**, not prose about the tool — one that stops matching
what the tool prints fails the build. [How that works →](guide/)

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

- [The `.apimap` format](https://github.com/junixlabs/apiflow/blob/main/packages/map/SPEC.md) — the public contract, and the gap it still has
- [What kind of product this is](research/product-shape.html) — the category, its graveyard, and the two roads Mermaid and draw.io took
