# Strapi

Marker: `@strapi/strapi` in `package.json`.

## Routes (§3) — check which of two styles the project uses

Strapi allows routes to be **generated** or **written explicitly**, and the two
look nothing alike. Decide first:

```
grep -rl createCoreRouter src/api    # generated style
grep -rl "routes:"        src/api/*/routes/*   # explicit style
```

**Explicit style** — a `routes/*.ts|js` file default-exports `{ routes: [...] }`.
Each entry is one endpoint and carries `method`, `path`, `handler`, `config`.
This is the whole surface; nothing is generated behind it. Read the array.

**Generated style** — the file default-exports `createCoreRouter('api::x.x')`.
Nothing in the file lists the endpoints, so you must expand them yourself from
`src/api/{name}/content-types/{name}/schema.json`:

- `kind: "collectionType"` → five routes
  ```
  GET    /api/{plural}        POST /api/{plural}
  GET    /api/{plural}/{id}   PUT  /api/{plural}/{id}
  DELETE /api/{plural}/{id}
  ```
- `kind: "singleType"` → `GET`, `PUT`, `DELETE` on `/api/{singular}`

Take the segment from `info.pluralName` / `info.singularName`, **not** the
folder name — they diverge. A `createCoreRouter` call may also pass
`{ only: [...] }` or `{ except: [...] }`, which trims the five.

A project can mix both styles per content type. Check every route file.

Also scan `src/plugins/*/server/routes/`. Admin routes (`/admin/...`) are
Strapi's own — out of scope unless asked.

**Normalise path params**: Strapi paths are Koa-style `:id`. The `.apiview` URL
needs `{id}`.

**Prefix**: explicit routes are mounted under `/api` by default. Confirm against
`config/server.*` before assuming it.

## Auth (§4)

Three mechanisms, all in the route entry's `config`:

- `auth: false` → public.
- `policies: ['global::is-authenticated', ...]` → authenticated; the policy name
  carries the real rule and lives in `src/policies/`.
- neither present → authenticated, with the concrete permission granted per-role
  in Users & Permissions at runtime. Record it as authenticated and note that
  the role **cannot be read from source**.

## Handlers (§4)

`src/api/{name}/controllers/{name}.ts`, method named by the `handler` field
(`ticket-box.find` → `find` in the `ticket-box` controller). A
`createCoreController` with no override means default behaviour, and then the
request shape is the content-type schema.

## Bodies (§5)

From `schema.json` `attributes`. Map `type` → example value:
`string`/`text`/`uid`→`"text"`, `integer`/`biginteger`→`1`, `decimal`/`float`→`1.5`,
`boolean`→`true`, `date`→`"2026-01-01"`, `datetime`→ISO string,
`enumeration`→first value of `enum`, `relation`→`1` (or `[1]` when the relation
is `oneToMany`/`manyToMany`), `component`→nested object from the component
schema, `json`→`{}`, `media`→`1`.

**Strapi v4+ wraps writes**: the body is `{ "data": { ...attributes } }`, not the
attributes at top level. Getting this wrong makes every POST/PUT node fail on
its first run.

Custom handlers take whatever they read off `ctx.request.body` — read the
controller method; do not assume the content-type schema applies to them.

Useful query params on list endpoints: `populate`, `filters`, `sort`,
`pagination[page]`, `pagination[pageSize]`.

## Grouping (§7)

One workflow per `src/api/{name}` folder — it is both the content type and the
router, so the grouping is unambiguous.
