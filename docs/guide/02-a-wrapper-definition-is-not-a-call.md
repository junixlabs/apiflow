---
title: A wrapper definition is not a call
blurb: A scanner defect found by writing the page before the code. The transcript below is now the proof it is gone.
status: shipped
---

# A wrapper definition is not a call site

**This page was `upcoming` while the defect existed** — CI asserted the transcript below did *not*
run. The day the fix landed the gate went red and demanded this status change. That is the whole
point: a roadmap page cannot claim to work, and cannot stay a roadmap page after it does.

## The defect

`fixtures/demo-app/web` has four files and three real call sites, yet `scan-fe` reported **five**
`unresolved` entries. Three of them were not call sites at all — they were the *definition* lines of
the client wrappers the scanner had just decided to follow:

```
src/api/users.ts:3 — url is a variable or expression: id: string
  `export async function fetchUser(id: string) {`
```

Once `fetchUser` is registered as a wrapper, every occurrence of `fetchUser(` reads as a call — and a
function's own signature is an occurrence. The parameter list `(id: string)` was then read as a url
expression.

This matters more than the count suggests. `unresolved` is the one number the map promises never to
fold into another, and it is what `apiflow check` watches for drift. Padding it with definitions
makes a real new gap invisible inside noise that can never be resolved.

## What it does now

```console?prompt=%24+
$ apiflow scan-fe fixtures/demo-app/web --name=demo --out=$TMP/fe.apimap
**Calls**: 3 (exact 0 · inferred 2 · guess 1)
### Unresolved — 2
- src/hooks/useUser.ts:4 — url is a variable or expression: id
  `return fetchUser(id);`
- src/pages/users/[id].tsx:4 — url is a variable or expression: id
  `const user = useUser(id);`
```

`Calls` did not move: the three `fetch` calls in `src/api/users.ts` were always found. What changed is
that the three definition lines stopped competing with them for space in `unresolved`.

## Why two must survive

Overshooting to zero would be the same failure in the other direction — a map that looks complete
because it stopped admitting what it cannot see. The two that remain are genuine:

- `src/hooks/useUser.ts:4` calls `fetchUser(id)` and `src/pages/users/[id].tsx:4` calls `useUser(id)`.
  Both pass an identifier, and no static pass can reduce an identifier to a literal path.

`removeUser` is **not** among them, though an earlier draft of this page said it was. Its url is built
from a variable — ``fetch(`${BASE}/users/${id}`)`` — and the scanner resolves that to `/users/{param}`
with `BASE` recorded as the base-url variable. It is one of the three counted calls; only its line 13
*definition* was ever in the list, exactly like the other two.

## How it is told apart

A definition and a call spell the name identically up to the open paren. The discriminator is what
follows the closing one: a real body `{`, past an optional return type. `findCallSites` drops any site
whose open paren belongs to such a head — on every path, not only the wrapper path, so
`function request(url) {` cannot report itself either.

Found by writing this guide, not by reading the code — which is the argument for writing the guide
first.
