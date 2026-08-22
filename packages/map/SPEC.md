# File formats — the contract of `@junixlabs/apiflow-map`

This is the public contract. Anything that reads or writes an `.apimap` reads this file, so it lives
with the package that owns the format rather than in `docs/`.

**Known gap:** the TypeScript types in `src/apimap.ts` are hand-written, i.e. they are the source
rather than a derivative of a schema. SCIP names exactly this as the first reason LSIF was slow to
work with (`docs/research/product-shape.md` §2). `parseMap` validates `version` and nothing
structural, which is enough for a file you produced yourself and not enough for a file you received.


Two file types, one workspace layout.

| | |
|---|---|
| `.apimap` | a **generated** dependency map — screens, endpoints, fields and the edges between them |
| `.apiview` | a **hand-built** request flow — nodes, edges, assertions, positions |

The difference matters: nobody drags 300 nodes by hand, so a generated map stores relationships and
is laid out at render time. A flow someone built by hand keeps its coordinates.

## `.apimap`

Produced by `scan-fe`, `scan-be` and `link`. No timestamp and no coordinates, and every id derives
from content — so re-scanning an unchanged repo produces a **byte-identical** file.

`metadata.root` is the **repo** the scan came from, never a path on the machine that ran it: the git
remote normalized to `host/path`, with any credential stripped and any local ssh alias trimmed, plus
the scanned subdirectory after `//`. That is what makes the file shareable — two people scanning the
same commit produce the same bytes, so it can be committed and reviewed in a pull request.

```json
{
  "version": 1,
  "metadata": {
    "name": "web",
    "root": "github.com/acme/app//apps/web",
    "generator": "apiflow scan-fe/1"
  },
  "screens":   [{ "id": "sc_users-param", "label": "/users/{param}", "route": "/users/{param}",
                  "source": { "file": "src/pages/users/[id].tsx", "line": 1 }, "viaHops": 3 }],
  "endpoints": [{ "id": "ep_get-api-users-param", "method": "GET", "path": "/api/users/{param}",
                  "auth": true, "source": { "file": "app/Http/routes.php", "line": 42 } }],
  "fields":    [{ "id": "fl_ep_get-api-users-param_data-email",
                  "endpointId": "ep_get-api-users-param", "path": "data.email",
                  "kind": "response", "declared": true, "observed": true }],
  "calls":     [{ "screenId": "sc_users-param", "endpointId": "ep_get-api-users-param",
                  "via": "axios", "confidence": "inferred", "chain": [0, 1, 2],
                  "source": { "file": "src/api/users.ts", "line": 5 } }],
  "reads":     [{ "screenId": "sc_users-param", "fieldId": "fl_ep_get-api-users-param_data-email",
                  "confidence": "guess",
                  "source": { "file": "src/pages/users/[id].tsx", "line": 6 } }],
  "unresolved": [{ "source": { "file": "src/api/gen.ts", "line": 210 },
                   "reason": "url is a variable or expression: endpoint",
                   "snippet": "return fetch(endpoint, init);" }],
  "chainNodes": [{ "file": "src/api/users.ts", "symbol": "fetchUser", "line": 8,
                   "role": "client", "precise": true }]
}
```

| Key | Meaning |
|---|---|
| `screens` | a file-based route, or the component the call sits in when no route could be reached |
| `endpoints` | `METHOD` + normalized path. `source` present means the **backend declared it**; absent means only a frontend call was seen |
| `fields` | a response field. `declared` comes from code, `observed` from a real run — declared without observed means the code is lying |
| `calls` | screen → endpoint, with `confidence` and the `file:line` of the call site. `chain` indexes into `chainNodes` |
| `reads` | screen → field. The half no request store has |
| `unresolved` | call sites the scanner could not read. **Never** folded into any other count |
| `chainNodes` | the deduplicated hops: `client` → `hook` → `component` → `module` → `screen`, each with `precise` |

`confidence` is one of `exact` (a literal path at the call site), `inferred` (one half derived) or
`guess` (assembled, or reached through a wide module hop). An edge is only as strong as its weakest
half: a certain URL reached through a guessed verb is a guess.

## `.apiview`

A flow you built. Version 2 stores node positions, per-node auth and assertions.

```json
{
  "version": 2,
  "metadata": { "name": "My Flow", "createdAt": "…", "updatedAt": "…" },
  "nodes": [{
    "id": "node_1", "type": "apiNode", "position": { "x": 200, "y": 100 },
    "data": { "label": "Get Users", "config": {
      "method": "GET", "url": "{{base_url}}/api/users",
      "headers": [{ "key": "Authorization", "value": "Bearer {{token}}", "enabled": true }],
      "params": [], "body": ""
    } }
  }],
  "edges": [{ "id": "edge_1_2", "source": "node_1", "target": "node_2" }],
  "assertions": {
    "node_1": [{ "id": "a1", "type": "status_equals", "target": "", "expected": "200", "enabled": true }]
  }
}
```

## Layout

Maps live outside the scanned project, in the workspace:

```
~/.apiflow/
├── workspace.json              # registry: id, name, fe/be paths, hints
└── projects/<id>/
    ├── fe.apimap
    ├── be.apimap
    ├── linked.apimap
    └── history/                # previous scans, for the comparison pane
```

`APIFLOW_HOME` moves the whole workspace, which is how the tests keep away from a real one.

Flows built in the canvas live next to the code, because they are authored artifacts:

```
your-project/
└── .apiview/
    ├── config.json
    ├── environments/           # local.json, staging.json …
    ├── flows/                  # *.apiview — commit these
    ├── library/                # reusable endpoint templates
    ├── map/                    # only if you point `scan-fe --out` here
    ├── results/                # last run results (gitignored)
    └── .gitignore
```
