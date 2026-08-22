# The guide is the test

Every page in this directory is executed by `tests/guide.test.ts` on every push. A page is not
documentation *about* apiflow; it is a transcript *of* apiflow, replayed.

This exists because the previous docs went stale in the ordinary way: nothing could fail. The README
said 332 tests when there were 412, `RELEASE.md` described a product two positioning changes old, and
`docs/proposals/` — 1,544 lines of user stories and specs — described a canvas-first tool the repo had
already stopped being. None of it could break a build, so none of it got fixed.

## The one question a page must survive

> **Can this page be wrong, and how would you find out this week?**

- *"As a developer I want to see which screens break"* — cannot be wrong. That is a proposal. It does
  not belong here, and `NORTH-STAR.md` §7 forbids writing more of them.
- *"Run this, see these six lines"* — can be wrong three ways: the command does not exist, the output
  differs, or nobody cares. The first two fail CI. The third is why you hand the page to a person
  before you write the code.

## Frontmatter

```yaml
---
status: shipped | upcoming | reference
---
```

| status | CI asserts | Meaning |
|---|---|---|
| `shipped` | the transcript **passes** | the feature works, and this is what it prints |
| `upcoming` | the transcript **fails** | written before the code. When it starts passing, CI fails and tells you to flip the status |
| `reference` | nothing is replayed, and `why-not-replayed:` must be present | genuinely un-replayable in CI (needs a live API, needs two machines) |

`upcoming` failing on purpose is the load-bearing half. It blocks drift in **both** directions: a page
cannot claim `shipped` for something broken, and cannot sit at `upcoming` after it starts working.
**Status is a test result, not a label somebody remembered to change.**

`reference` is the only escape hatch, so it must state why — otherwise every page whose transcript
broke would quietly become a reference page.

## Writing a page

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
difference between this directory and the `docs/proposals/` that was deleted.

## Transcript format

Inside a ` ```console ` block, a line starting `$ ` is a command; the lines after it are expected
output. `apiflow` resolves to this checkout's CLI, `$TMP` to a throwaway `APIFLOW_HOME`.

Matching is a **subsequence**: every expected line must appear, in order. Not byte equality — an
exact-output assertion breaks on a counter nobody promised and teaches the next person to delete the
test.
