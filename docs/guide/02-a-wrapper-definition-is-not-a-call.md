---
title: A wrapper definition is not a call
blurb: A real scanner defect, written down before it is fixed. CI asserts this page still fails.
status: upcoming
---

# A wrapper definition is not a call site

**This page is `upcoming`: the transcript below does not run yet, and CI asserts that it does not.**
The day it starts passing, CI fails and tells you to change the status to `shipped`. That is the
whole point — a roadmap page cannot claim to work, and cannot stay a roadmap page after it works.

## The defect

`fixtures/demo-app/web` has four files and three real call sites, yet `scan-fe` reports **five**
`unresolved` entries. Three of them are not call sites at all — they are the *definition* lines of
the client wrappers the scanner had just decided to follow:

```
src/api/users.ts:3 — url is a variable or expression: id: string
  `export async function fetchUser(id: string) {`
```

Once `fetchUser` is registered as a wrapper, every occurrence of `fetchUser(` reads as a call — and a
function's own signature is an occurrence. The parameter list `(id: string)` is then read as a url
expression.

This matters more than the count suggests. `unresolved` is the one number the map promises never to
fold into another, and it is what `apiflow check` watches for drift. Padding it with definitions
makes a real new gap invisible inside noise that can never be resolved.

## The expected output after the fix

```console?prompt=%24+
$ apiflow scan-fe fixtures/demo-app/web --name=demo --out=$TMP/fe.apimap
**Calls**: 3 (exact 0 · inferred 2 · guess 1)
### Unresolved — 2
```

The two that must survive are the genuine ones: `removeUser` builds its url from a variable, and the
call inside `useUser` passes an identifier the scanner cannot resolve to a literal. The three
definition lines must go.

Found by writing this guide, not by reading the code — which is the argument for writing the guide
first.
