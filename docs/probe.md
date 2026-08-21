# probe — fields the code does not declare

A scan reads **declarations**. Two things it cannot read: a response assembled at runtime, and a field
the code declares but the API never actually sends. `probe` fills both by recording real responses.

There are two ways to run it, and they answer to different risks.

## Against a running API — `--live`

```bash
apiflow probe ~/.apiflow/projects/demo/be.apimap --live=http://127.0.0.1:3000
apiflow probe ~/.apiflow/projects/demo/be.apimap --ingest=./apiflow-probe.json
```

Walks the endpoints in the map, records `{method, path, status, body}` for each, and writes one JSON
file. Then `--ingest` merges the shapes it saw into the map as `observed` fields, alongside the
`declared` ones.

| flag | |
|---|---|
| `--fill=<value>` | a value for a `{param}`, positional — two placeholders take two `--fill`s. An endpoint with an unfilled placeholder is skipped and named. |
| `--header='K: V'` | repeatable; an auth header goes here |
| `--methods=GET,POST` | default is `GET` alone |
| `--out=<file>` | default `apiflow-probe.json` beside the map |

**Two refusals, both deliberate.** The map lists every endpoint it found, and that list contains
`DELETE`:

- A write method needs `--unsafe` as well as `--methods`. Otherwise a diagnostic becomes a scripted
  walk over every write endpoint the map knows about.
- A base url that is not localhost needs `--yes-remote`.

A non-2xx or a non-JSON body is still recorded. `--ingest` is what decides a sample is unusable, and
it says so per endpoint — dropping them at collection time would turn a 500 into silence.

## Inside the project's own test runner — `--emit`

```bash
apiflow probe ~/.apiflow/projects/demo/be.apimap --emit --root=/path/to/api
```

Writes a harness in the shape the repo already tests in — a vitest file for Node, a Feature test for
Laravel, `go test` for Go, pytest for Python — with `/* apiflow:fill */` markers for the app instance
and any auth. It runs against the **test** database, which is the safer place to hit a write endpoint.

## What it changes in the map

- `fields[].observed` — this shape really came back from the API.
- `endpoints[].probed` — this endpoint has been hit at least once.
- **Declared in code but never sent**: a field the scan found in a schema that no recorded response
  contained. That is the interesting half; it is either a shape the API stopped sending or a schema
  nobody updated.

Measured on this repo's own server: 27 endpoints scanned, 12 GETs sent, 4 answered 200, **65 observed
fields** merged — nested paths included (`projects.maps.scannedAt`). The other 8 were 404 because that
map holds the endpoints of two servers and only one was running; `--ingest` listed each one and why.
