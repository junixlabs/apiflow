---
title: apiflow
---

# apiflow

**A dependency map for systems that talk over HTTP** — screen ↔ endpoint ↔ field. It answers one
question, before you edit: **if I change this endpoint or this field, which screens break?**

[Source on GitHub](https://github.com/junixlabs/apiflow) · [npm](https://www.npmjs.com/package/@junixlabs/apiflow)

```bash
npm install -g @junixlabs/apiflow
apiflow project add "web" --fe=/path/to/frontend [--be=/path/to/api]
apiflow project scan web
```

## The guide

Every page below is a **transcript replayed by CI** on every push — not prose about the tool, but a
recording of it. A page that stops matching what the tool prints fails the build, which is the only
reason you should believe any of it. [How that works](guide/).

| Page | Status | |
|---|---|---|
| [Your first impact answer](guide/01-first-answer.html) | `shipped` | the whole path, against a fixture in this repo |
| [A wrapper definition is not a call](guide/02-a-wrapper-definition-is-not-a-call.html) | `upcoming` | a real defect, written down before it is fixed — CI asserts this one still **fails** |
| [probe](guide/03-probe.html) | `reference` | needs a live API, so it cannot be replayed |
| [FE here, BE elsewhere](guide/04-two-machines.html) | `reference` | needs two machines |

`upcoming` failing on purpose is the load-bearing part: a page cannot claim to work, and cannot stay a
roadmap after it starts working. **Status is a test result, not a label somebody remembered to change.**

## Reference

- [The `.apimap` format](https://github.com/junixlabs/apiflow/blob/main/packages/map/SPEC.md) — the public contract
- [What kind of product this is](research/product-shape.html) — the category, the graveyard, and why the shape is what it is
- [NORTH-STAR](https://github.com/junixlabs/apiflow/blob/main/NORTH-STAR.md) — the pain it exists for (§2) and what will not be built yet (§7)
