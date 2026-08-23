# Contributing

```bash
git clone https://github.com/junixlabs/apiflow.git && cd apiflow && npm install
node packages/cli/bin/cli.js --help     # runs from a clone, no build step
```

**Read [`NORTH-STAR.md`](./NORTH-STAR.md) before proposing a feature** — §2 is the pain this exists
for, §7 is what will not be built yet and under what condition each prohibition opens. A proposal
that cannot be traced back to §2 is refused.

## The six gates

All six run in CI on every push, and a green local run is the same run — with one exception, stated
under `map:check` below.

```bash
npm test           # unit tests + the docs transcripts + the fixture-map gate's own tamper test
npm run lint
npm run boundary   # the five structural rules in .dependency-cruiser.cjs
npm run codemap    # the comment convention, at zero errors
npm run build
npm run map:check  # the committed fixture maps still match the fixture source
```

`npm run boundary` is not style. `packages/map` may import no node builtin, `map` may never import
`scan`, neither may reach back into `cli`, and `mcp/mapTools.ts` must depend on `commands/` — the CLI
is the reference implementation and MCP borrows its resolution rather than growing its own.

`npm run map:check` is the one gate made of the product. `fixtures/demo-app/maps/` holds three
committed maps — the FE half, the BE half, and the linked join — and the gate re-derives all three
from the fixture source and fails on any byte difference. The halves are judged by `apiflow check`
itself, so the gate a user is told to put in their CI is the same gate this repo runs on every push.
The linked map is compared differently, because `apiflow check` refuses a linked map by design: there
is no single side to re-scan, so the gate re-runs `apiflow link` over the two committed halves and
compares bytes. Between them the whole chain is covered — `check` holds each half against the source,
the re-link holds the join against the halves.

Each half is then compared byte for byte against a fresh scan as well, which `check` does **not** do:
it decides on `serializeMap(stored) === serializeMap(fresh)`, comparing two maps it re-serialized
itself, so a golden reformatted or minified in place still passes it. That is the right call for
`check` — a user's map is not required to be pretty — and the wrong one here, because the claim these
three files exist to hold is about the file, not about what the file parses into.

**The one place a local run is not the CI run.** A map records the repo it came from, and `check`
exits 2 rather than reporting drift when the git origin does not match — so this gate needs a clone
whose `origin` normalizes to `github.com/junixlabs/apiflow`. On a fork, on an ssh-alias remote such
as `git@github-work:…`, or on a source download with no `.git` at all, it exits 2 and `map:refresh`
cannot fix it: the origin check runs before the write. Nothing here can fix that either, because
repo identity in the map is the property that makes the map shareable at all. Same constraint already
binds `tests/guide.test.ts`, whose transcripts print that root verbatim.

**When it goes red, the fix is to refresh and commit:**

```bash
npm run map:refresh   # then commit the maps; the diff IS the change in scanner output
```

Never by dropping a map from the gate. These three files are the repo's only assertion that one
source produces one set of bytes, which is the premise under sharing a map with no server, reviewing
one in a pull request, and `check` gating somebody else's CI. A red gate on a scanner change is the
gate working: read the diff, and if the new bytes are the better answer, commit them in the same
change that produced them.

The maps live outside both scan roots and outside `.apiview/` — that path is gitignored on purpose,
and apiflow writing nothing into the tree it scans is a property worth more than the convenience.

## Releasing — three packages, one artifact

`packages/map` and `packages/scan` are `private: true` and are **never published**. They are bundled
into `@junixlabs/apiflow`'s tarball by `bundleDependencies`, so a user installs one package and
nothing resolves against the registry.

```bash
npm run verify:pack        # packs packages/cli and asserts the result
```

Two things that are easy to get wrong, both now gated:

- **npm bundles from the packing package's own `node_modules`**, and workspaces hoist the symlinks to
  the repo root instead. Without `scripts/prepack-bundle.mjs` materialising them, `npm pack` prints
  `bundled files: 0` and succeeds — publishing a tarball whose dependencies 404. `prepack` does the
  copy, `postpack` removes it.
- **Never run a bare `npm publish`.** At the repo root it packs 170 files, `.forge/` and `CLAUDE.md`
  among them, into a public tarball. `private: true` on the root is the only thing refusing it today.
  The workflow publishes the tarball `verify:pack` checked, by path.

They are separate packages so `.dependency-cruiser.cjs` has paths to hold and so `map` can be
published unchanged the day a second repo reads a map. Until that repo exists, publishing three
packages would be three release steps for one consumer count of zero.

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
