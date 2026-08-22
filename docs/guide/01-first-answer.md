---
title: Your first impact answer
blurb: Scan a frontend and ask which screens break, against a four-file fixture committed to this repo.
status: shipped
---

# Your first impact answer

Everything below is replayed by CI on every push (`tests/guide.test.ts`). If a line here stops
matching what the tool prints, the build fails — so this page cannot quietly go stale.

It runs against `fixtures/demo-app/`, a four-file frontend committed to this repo, so the output is
the same on your machine as in CI and no real codebase is involved.

## 1. Read the frontend

```console?prompt=%24+
$ apiflow scan-fe fixtures/demo-app/web --name=demo --out=$TMP/fe.apimap
## FE Map Scan Results
**Root**: github.com/junixlabs/apiflow//fixtures/demo-app/web
**Written**: $TMP/fe.apimap
**Screens**: 3
**Endpoints**: 3
**Calls**: 3 (exact 0 · inferred 2 · guess 1)
```

Nothing was written into `fixtures/demo-app/`. The map records the repo it came from, never the
machine it ran on, which is why two people scanning the same commit get the same bytes.

## 2. Ask what the map holds

Ask before you guess an endpoint string — the answer is the exact form the next command takes.

```console?prompt=%24+
$ apiflow impact $TMP/fe.apimap
## demo — 3 endpoint(s), 3 screen(s)
- DELETE /users/{param} — 1 caller(s)
- GET /api/users — 1 caller(s)
- GET /users/{param} — 1 caller(s)
```

Two of these paths start `/users`, one starts `/api/users`. That is not a bug: `listUsers` writes
the literal `'/api/users'`, while `fetchUser` builds `` `${BASE}/users/${id}` `` — so the base url is
a variable the scanner keeps separate rather than inventing a join for.

## 3. The answer the tool exists for

```console?prompt=%24+
$ apiflow impact $TMP/fe.apimap --endpoint="GET /users/{param}"
## Impact — GET /users/{param}
1 screen(s) break if this changes:
client    fetchUser  src/api/users.ts:3
↳ hook      useUser  src/hooks/useUser.ts:4
↳ screen    UserPage  src/pages/users/[id].tsx:4
```

Three hops, each with a `file:line` you can open. The claim is labelled `guess` because the screen
was reached through a module hop — read `exact` and `inferred` as answers, `guess` as a lead worth
thirty seconds. The label is the product; an answer without its confidence is a liability.

## 4. What it will not tell you

```console?prompt=%24+
$ apiflow impact $TMP/fe.apimap --endpoint="GET /api/users/{param}"
Nothing matches GET /api/users/{param} in demo.
```

`Nothing matches` means *nothing in this map* — never *nothing calls it*. The scan also left five
call sites `unresolved`, and those are never folded into the numbers above.
