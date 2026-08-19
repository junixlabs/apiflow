# Next.js route handlers

Markers: `next` in `package.json`, plus `app/api/` (App Router) or `pages/api/`
(Pages Router). A project can contain both.

## Routes (§3)

**App Router** — path is the directory path under `app/`, and the file must be
named `route.ts|js`. One endpoint per exported HTTP-verb function:

```
app/api/users/route.ts         export async function GET / POST
app/api/users/[id]/route.ts    export async function GET / PATCH / DELETE
```

Segment conventions that change the URL: `[id]` → `{id}`, `[...slug]` →
catch-all, `(group)` → **does not appear in the URL**, `@slot` → parallel route,
not an endpoint. Getting `(group)` wrong shifts every path under it.

**Pages Router** — every file under `pages/api/` is one endpoint; the method is
branched on `req.method` inside the default export. Read the branch to know
which verbs actually exist rather than assuming all five.

Also check `basePath` and any `rewrites`/`redirects` in `next.config.*` — they
change the externally reachable path.

Server Actions are not HTTP endpoints in the mappable sense. Skip them and say so.

## Handlers (§4) and bodies (§5)

Request shape from, in order: a Zod (or similar) `parse`/`safeParse` call on the
body, the TypeScript type asserted on `await req.json()`, or nothing.

Auth: a call to the session/auth helper (`auth()`, `getServerSession`,
`createClient().auth.getUser()`, or a middleware match in `middleware.ts`).
`middleware.ts` applies by `matcher` config — read it, since it authenticates
routes whose own file shows no auth at all.

## Grouping (§7)

One workflow per top-level segment under `api/` — `app/api/users/**` →
`user-management.apiview`.
