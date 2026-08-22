# Contributing

```bash
git clone https://github.com/junixlabs/apiflow.git && cd apiflow && npm install
node packages/cli/bin/cli.js --help     # runs from a clone, no build step
```

**Read [`NORTH-STAR.md`](./NORTH-STAR.md) before proposing a feature** — §2 is the pain this exists
for, §7 is what will not be built yet and under what condition each prohibition opens. A proposal
that cannot be traced back to §2 is refused.

## The five gates

All five run in CI on every push, and a green local run is the same run.

```bash
npm test          # unit tests + the docs transcripts
npm run lint
npm run boundary  # the four structural rules in .dependency-cruiser.cjs
npm run codemap   # the comment convention, at zero errors
npm run build
```

`npm run boundary` is not style. `packages/map` may import no node builtin, `map` may never import
`scan`, the engine may never import the runner, and `mcp/mapTools.ts` must depend on `commands/` —
the CLI is the reference implementation and MCP borrows its resolution rather than growing its own.

## Writing a documentation page

Pages under `docs/` are executed, not written: `tests/guide.test.ts` replays every ` ```console `
block on every push. Before adding one, the page must survive one question:

> **Can this page be wrong, and how would you find out this week?**

*"As a developer I want to see which screens break"* cannot be wrong — that is a proposal, and §7
forbids writing more of them. *"Run this, see these six lines"* can be wrong three ways: the command
does not exist, the output differs, or nobody cares. The first two fail CI. The third is why you hand
the page to a person before you write the code.

1. Write the transcript **first**, against `fixtures/demo-app/` — a four-file frontend committed to
   this repo. Never against a real codebase: these pages are published, and an `.apimap` of someone's
   app is their internal API surface.
2. If you cannot write the expected output, you do not understand the feature yet. That is the design
   review, and it is free.
3. Hand it to someone who has not seen the code. If they cannot follow it, the feature is wrong, not
   the page.
4. Only then implement, until the transcript runs.
5. Flip `upcoming` → `shipped`. CI will tell you when it is time.

**A page may only be written for work being done now.** No specs for next quarter — that is the single
difference between `docs/` and the `docs/proposals/` that was deleted.

### Transcript format

````markdown
```console?prompt=%24+
$ apiflow scan-fe fixtures/demo-app/web --name=demo --out=$TMP/fe.apimap
## FE Map Scan Results
**Screens**: 3
```
````

A line starting `$ ` is a command; the lines after it are expected output. `apiflow` resolves to this
checkout's CLI, `$TMP` to a throwaway `APIFLOW_HOME`.

The `?prompt=%24+` is not decoration: it tells the highlighter a prompt ends at *dollar-space*,
because the default treats any line containing `$`, `#` or `>` as a command — which renders apiflow's
own output as something you typed. On a page whose only claim is that it is a faithful recording,
that is the one rendering error that matters.

Matching is a **subsequence**: every expected line must appear, in order. Not byte equality — an
exact-output assertion breaks on a counter nobody promised, and teaches the next person to delete the
test.

### Building the site locally

Reading the markdown does not catch invalid frontmatter YAML, Liquid that renders nothing, or a fence
whose highlighter options got dropped. Build it with the image GitHub Pages itself uses:

```bash
cp public/favicon.svg docs/assets/favicon.svg
docker run --rm -v "$PWD:/w" -v /tmp/site:/out \
  -e GITHUB_WORKSPACE=/w -e INPUT_SOURCE=docs -e INPUT_DESTINATION=../out \
  ghcr.io/actions/jekyll-build-pages:latest
```

### Diagrams

`docs/_includes/diagrams/*.svg` are hand-authored and inlined, never `<img>`-linked — every colour is
a CSS token, so one file is correct in both themes with no JavaScript. Mermaid is not used: a
build-time render cannot follow the reader's theme. Reuse the class vocabulary the existing diagrams
share (`dg-node`, `dg-edge`, `dg-name`, …) rather than inventing per-diagram styles, and keep one
concern per diagram — split rather than crowd.

## Comments

`npm run codemap` enforces the convention in [`AGENTS.md`](./AGENTS.md): no comment that a tool can
already derive, and the five `cm:` annotations for what no tool can. An annotation is one line plus at
most one continuation.

PRs welcome. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.
