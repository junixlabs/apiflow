---
title: Unresolved is a backlog, not an error log
blurb: The same gap spelled 101 different ways is one line of work. Ranking by shape is what makes the list actionable.
status: shipped
---

# Unresolved is a backlog, not an error log

`unresolved` is the one number this map promises never to fold into another: every call site the
reader could not resolve, admitted rather than hidden. That honesty has a cost — on a real API the
list is long, and a long list of individually-true lines does not tell you what to do next.

The reason is that a `reason` string carries the *specific* thing that failed. Three of the eight
reasons the two scanners can emit interpolate variable text into the sentence, so **one cause reads
as N distinct lines**:

| written by | reason | varies by |
|---|---|---|
| `scan-be` | `GET /users/{param} — no request or response schema found in code` | the verb and the path — once per endpoint |
| `scan-fe` | `url is a variable or expression: id` | 60 characters of the source expression |
| `scan-fe` | `reachable from 7+ screens through re-exports — …` | the fan-out count |

On the Hono API this repo measured, the reader understood 2 routes out of 103. The other ~101 were
**one** shape: no schema declared in code. Reading it as 101 problems is what makes a backlog feel
like a defect list.

## What the scanners print now

Underneath the flat list, both halves rank the same entries by shape.

```console?prompt=%24+
$ apiflow scan-be fixtures/demo-app/api --name=demo --out=$TMP/be.apimap
### Shapes still unknown — 3
- src/routes/users.ts:5 — GET /users — no request or response schema found in code
- src/routes/users.ts:6 — GET /users/{param} — no request or response schema found in code
- src/routes/users.ts:7 — DELETE /users/{param} — no request or response schema found in code
**Ranked by shape** — 1 shape behind 3 entries:
- 3× no request or response schema found in code (e.g. src/routes/users.ts:5)
```

Three lines, three different strings, **one** piece of work. The frontend half reads the same way:

```console?prompt=%24+
$ apiflow scan-fe fixtures/demo-app/web --name=demo --out=$TMP/fe.apimap
### Unresolved — 2
- src/hooks/useUser.ts:4 — url is a variable or expression: id
- src/pages/users/[id].tsx:4 — url is a variable or expression: id
**Ranked by shape** — 1 shape behind 2 entries:
- 2× url is a variable or expression (e.g. src/hooks/useUser.ts:4)
```

The fixture is four files, so both counts are small enough to add up by eye. The point is the ratio:
the fixture's `1 shape behind 3 entries` is the Hono API's `1 shape behind 101 entries`, and only the
second one is a roadmap you would not have guessed.

## What a shape is, and what it deliberately is not

Normalization is three narrow rules, one per producer that interpolates — cut everything before the
first ` — ` when the line opens with an HTTP verb, cut at the first `: `, and collapse digit runs to
`N` when the line opens with `reachable from `. It is **not** a general "erase anything
variable-looking" pass, and each rule is gated on something only its own producer writes. Both halves
of that matter: a wider rule folds two different causes into one line, and an *ungated* rule fires on
a reason it was not written for — the digit rule, before it was gated, turned the surviving path
`/v1/reports 2024` into `/vN/reports N`, a string nothing in the tool ever emits. A ranking that
points at a shape nobody wrote is worse than no ranking at all. The five reasons that are already
fixed strings pass through byte-identical, which is asserted per string.

A useful consequence: **a shape carries no URL and no payload.** The variable half of the sentence —
the path, the source expression — is exactly what normalization removes. A ranking is a thing you can
paste into an issue from a codebase you cannot show anyone, which is why the path cut is anchored to
the separator rather than matching the path as one token: a route may legitimately contain a space
(`/user profile`), and a strip that missed it echoed the path back into the ranking line.

## Nothing entered the map

The ranking is derived when the report is printed. It is not a field in the `.apimap`, and neither
scanner's `GENERATOR` version moved: the fixture maps are byte-for-byte what they were before this
page existed. `apiflow check` distinguishes "the code moved" from "the reader improved" by that
version string, so a presentation change must not touch it.

## The cap says what it hid

Only the top five shapes are printed. When there are more, the last line states how many shapes and
how many entries are not shown — because a list that quietly shows its head reads as the whole
backlog, which is the failure the flat 50-entry list above it already has.
