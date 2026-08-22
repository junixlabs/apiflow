# apiflow — router

This file **points**; it holds no rules. Rules live where they can be enforced.

- **Product goal, the pain it answers, and what must NOT be built → [`NORTH-STAR.md`](./NORTH-STAR.md)**
  Read §2 (whose pain) and §7 (do not build) **before proposing any feature**.
  A proposal that cannot be traced back to a pain in §2 is rejected.
- Mechanics and contracts → `packages/map/SPEC.md` (the `.apimap` format), then `README.md`.
- **Docs are executed, not written.** Every ` ```console ` block published under `docs/` is replayed by
  `tests/guide.test.ts` on every push — the front page included. Read
  [`CONTRIBUTING.md`](./CONTRIBUTING.md#writing-a-documentation-page) before adding or editing a page: `shipped` must pass,
  `upcoming` must fail, `reference` must say why it cannot be replayed. Do not write a doc for work
  that is not being done now — that is what `docs/proposals/` was, and it was deleted.
- **The site is built with the real Pages image.** `docker run ghcr.io/actions/jekyll-build-pages`
  against `docs/` catches what reading markdown cannot: invalid frontmatter YAML, Liquid that silently
  renders nothing, a fence whose highlighter options got dropped.
- **Structure is enforced, not described.** Four rules in `.dependency-cruiser.cjs` fail CI: `map`
  imports no node builtin, `map` never imports `scan`, the engine never imports the runner, and
  `mcp/mapTools.ts` must depend on `commands/` — the CLI is the reference implementation and MCP
  borrows its resolution rather than growing its own.
- **Comments are gated.** `npm run codemap` (`cm verify`) runs in CI and is at **zero errors**. An
  annotation is ONE line plus at most ONE continuation; a third line is prose again and fails. Long
  rationale becomes several annotations, or a module header at the top of the file. Ordinary comments
  are frozen legacy only — 299 remain, and the count may go down, never up.
- Research already done (do not repeat it) → [`docs/research/product-shape.md`](./docs/research/product-shape.md).
- Context on the four sibling products → `~/tools/repo-gates/NORTH-STAR.md`.
- Open work (issue tracker) → Forge, project `apiflow`, projectId `36a0dce3-8469-41df-995b-197f28af9127`.
  That is where work state lives; do not write TODOs into the code.

One line to remember: **the screen ↔ endpoint ↔ field map first; running requests second.**
