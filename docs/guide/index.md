---
title: The guide is the test
blurb: Why every page here is a transcript replayed by CI, and what shipped / upcoming / reference mean.
---

# The guide is the test

Every page here is executed by `tests/guide.test.ts` on every push. A page is not documentation
*about* apiflow; it is a transcript *of* apiflow, replayed. That is the only reason you should believe
any of it.

This exists because the previous docs went stale in the ordinary way: nothing could fail. The README
claimed a test count 80 short of the real one, `RELEASE.md` described a product two positioning
changes old, and `docs/proposals/` — 1,544 lines of user stories — described a canvas-first tool the
repo had already stopped being. None of it could break a build, so none of it got fixed.

## What the three statuses mean

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

Matching is a **subsequence**, not byte equality: every expected line must appear, in order. An
exact-output assertion breaks on a counter nobody promised, and teaches the next person to delete the
test. Writing one is [in CONTRIBUTING](https://github.com/junixlabs/apiflow/blob/main/CONTRIBUTING.md#writing-a-documentation-page).

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
