---
title: The guide is the test
blurb: Why every page in this section is a transcript replayed by CI, and what shipped / upcoming / reference mean.
---

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

Inside a ` ```console?prompt=%24+ ` block, a line starting `$ ` is a command; the lines after it are
expected output. `apiflow` resolves to this checkout's CLI, `$TMP` to a throwaway `APIFLOW_HOME`.

The `?prompt=%24+` is not decoration. It tells the highlighter that a prompt ends at *dollar-space*,
because its default treats any line containing `$`, `#` or `>` as a command — which would print
apiflow's own output styled as something you typed. On a page whose only claim is that it is a
faithful recording, that is the one rendering error that matters.

Matching is a **subsequence**: every expected line must appear, in order. Not byte equality — an
exact-output assertion breaks on a counter nobody promised and teaches the next person to delete the
test.

## The pages

<div class="cards">
  <a class="card" href="01-first-answer.html">
    <span class="pill shipped">shipped</span>
    <h3>Your first impact answer</h3>
    <p>Scan a frontend, ask which screens break, read the client → hook → screen chain.</p>
  </a>
  <a class="card" href="02-a-wrapper-definition-is-not-a-call.html">
    <span class="pill upcoming">upcoming</span>
    <h3>A wrapper definition is not a call</h3>
    <p>A scanner defect the fixture found. CI asserts this transcript still fails.</p>
  </a>
  <a class="card" href="03-probe.html">
    <span class="pill reference">reference</span>
    <h3>probe — confirm by running</h3>
    <p>Needs a live API, so CI cannot replay it.</p>
  </a>
  <a class="card" href="04-two-machines.html">
    <span class="pill reference">reference</span>
    <h3>FE here, BE elsewhere</h3>
    <p>Needs two machines, which is the whole point of the page.</p>
  </a>
</div>
