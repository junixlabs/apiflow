# @junixlabs/apiflow-runner

The visual request runner: canvas, response chaining, assertions, and cURL / OpenAPI 3.x / Postman
import. This is the **older half** of apiflow and it is deliberately second in line — see
`NORTH-STAR.md` §3.

It is a separate package so the map side can be worked on, tested and reasoned about without it, and
so retiring it later is a dependency drop rather than an excavation. It is still published, because
`npx @junixlabs/apiflow` opening a canvas is documented behaviour that a refactor must not silently
remove.

```bash
npm run dev          # from the monorepo root
```

`.dependency-cruiser.cjs` forbids this package from importing `map`, `scan` or `cli`, and forbids
them from importing it. The two halves touch each other zero times, and that is enforced rather than
remembered.
