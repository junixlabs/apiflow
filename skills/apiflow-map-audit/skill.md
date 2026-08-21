---
name: apiflow-map-audit
description: >
  Measure how right an .apimap actually is, instead of trusting its own labels.
  Two passes: a reproducible sample of guess-level claims checked against the
  code, and a use-case pass that asks whether the map can answer a real user
  story end to end. Use when the user asks: is this map accurate, how much can I
  trust it, audit the map, verify the impact answers, or check a scan before the
  team starts relying on it.
---

# apiflow map audit

An `.apimap` labels every claim `exact`, `inferred` or `guess`, and quarantines what it could not
read into `unresolved`. What it cannot do is tell you **how often a `guess` is right**. Measured on
two real frontends, `guess` is 76% and 81% of all calls — so that unmeasured number is most of the
map. This skill produces it.

## What this is not

- Not scan repair. Resolving the `unresolved` list is [`fe-map-extractor`](../fe-map-extractor/) —
  that fixes **gaps**. This audits **claims the map already makes**.
- Not a gap report. An `unresolved` entry is a declared gap, not a wrong answer. **Never count it as
  an error** — doing so punishes the one behaviour that keeps the map honest.
- Not a rewrite. You never edit the `.apimap`, and you never write anything into the repo being
  audited. Findings go to the report; fixes go to `hints.json` under `~/.apiflow/`.

## Pass A — sample the claims

### 1. List, then pull the claims per endpoint

```bash
MAP=~/.apiflow/projects/<id>/fe.apimap
apiflow impact $MAP                                   # every endpoint, with caller counts
apiflow impact $MAP --endpoint="<method> <path>" --json
```

The `--json` answer is the contract you audit:

```
matches[].endpoint          { method, path }
matches[].screens[]         { route, label, confidence, at, hops, callSites, chain[] }
matches[].screens[].chain[] { role, symbol, at, precise }
```

One entry per screen, not per call: `callSites` says how many places in that screen reach the
endpoint, so the screen count is never inflated by a screen that calls it twice.

Each `screens[]` entry with `confidence: "guess"` is one claim: *this screen breaks if this endpoint
changes, and here is the call site*.

### 2. Pick the sample deterministically — not at random

Collect every guess-level claim as `(method, path, route, at)`, sort by that tuple, then take every
`ceil(total / N)`-th entry. Default `N = 30`, floor 20.

Two reasons it is a stride and not a random draw: the same map yields the **same sample**, so a
second audit measures the code rather than the dice; and a stride spreads the sample across
endpoints, where a random draw piles 12 claims onto the one endpoint with 200 callers.

Say the sample size and the population out loud in the report. A rate from 30 of 139 is an estimate,
and presenting it as the truth is the same failure this skill exists to catch.

### 3. Verify one claim at a time

Open **only** `at` and the files named in `chain[]`. Never read the tree first. For each claim:

| Verdict | What it means |
|---|---|
| `right` | that screen really does reach that endpoint, through that chain |
| `wrong-screen` | the endpoint is real, but this screen does not reach it — usually a module hop that re-exports to many consumers |
| `wrong-endpoint` | the path or the verb is not what this call site sends |
| `not-http` | a mock, a test helper, a service worker, a commented block |

`hops` and `precise: false` are where the wrongness concentrates: a chain that lost precision is the
scanner saying it followed a re-export. Check those first — that is where a sample earns its cost.

### 4. Put every failure in exactly one of two buckets

- **hint** — the code is readable, the scanner just needed a name (a wrapper, a base url, a verb).
  Write it into `hints.json` and re-scan; the code re-derives the ids, so the map stays byte-stable.
- **scanner-bug** — no hint can fix it, the reader is wrong. Record the smallest input that
  reproduces it. A path template with nested braces collapsing into one junk endpoint that collects
  24 callers is this bucket, not the hint bucket.

## Pass B — walk a real use case

The sample says how often the map is right. It cannot say whether the map is right about **the flows
people actually care about**. That needs use cases from whoever owns the product.

Input, one entry per story, in `~/.apiflow/projects/<id>/use-cases.md`:

```
- id: US-1
  story: a member opens the members page and sees the organisations they belong to
  screens: [/_authenticated/members]        # optional, only if the owner already knows
```

For each story:

1. Ask the map, do not read the code yet — `screen_deps` for the screens the story names, or `find`
   plus `impact_endpoint` when it names an endpoint instead.
2. Write down what the map claims the story touches: screens, endpoints, fields.
3. **Now** open the code for that flow and compare in both directions:
   - **missing** — the story provably calls an endpoint the map does not attach to that screen. This
     is the expensive kind: an impact answer for that endpoint would have under-reported.
   - **extra** — the map attaches something the flow does not touch. Over-reporting; cheaper, but it
     is what makes people stop trusting the answer.
4. A story whose endpoints are all in `unresolved` is not a failure of Pass B — it is a scan gap.
   Send it to `fe-map-extractor` and say so.

## Report

```
## Map audit — {project}/{kind}

**Map**: {path} · **root**: {metadata.root}
**Population**: {calls} calls — exact {n} · inferred {n} · guess {n} · unresolved {n} (not graded)

### Pass A — {sampled} of {guess-total} guess-level claims, stride {k}

| verdict | n | rate |
|---|---|---|
| right | | |
| wrong-screen | | |
| wrong-endpoint | | |
| not-http | | |

**Guess-level claims that hold: {n}/{sampled} ({rate})**

#### hints — {n}
- src/lib/x-api.ts:22 → wrapper `apiFetch` sends `{{base}}/orgs`, verb from the method argument

#### scanner bugs — {n}
- `GET /${{params` — normalizePath does not unwrap a nested `${{…}}`, so one template becomes an
  endpoint of its own and collects {n} callers. Smallest repro: {snippet}

### Pass B — {n} use cases

| story | map says | missing | extra | verdict |
|---|---|---|---|---|

### What this map is good for

One sentence, earned by the numbers above: an answer you can act on, or a search aid that narrows
{calls} call sites to a handful. Both are useful. Only one of them is safe to paste into a PR.
```

## Rules

- Report the rate you measured, including when it is bad. A map that overstates itself is the exact
  failure this skill exists to catch, and an audit that flatters the map is worse than no audit.
- `0 screens` for an endpoint means nothing **in this map** calls it. Never write it as "nothing
  calls it", and always print the unresolved count in the same breath.
- Never grade `unresolved` as an error, and never fold it into the sample.
- Never edit the `.apimap`, and never write into the repo being audited.
