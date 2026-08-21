import type { ApiMapFile, EndpointNode, FieldNode } from './apimap';
import { fieldId } from './apimap';
import type { Stack } from './beScanner';
import { shapeOf } from './shape';

export interface ProbeSample {
  method: string;
  path: string;
  status: number;
  body: unknown;
  // cm:why `path` is the TEMPLATE — it is the join key back onto the endpoint, so it must keep its
  // `{param}`. `url` is what was actually sent. Without it a sample of `/api/v1/orders/{param}` cannot
  // be reproduced: nobody can tell which id answered, so a 200 is a claim rather than evidence.
  // cm:edge contract -> src/cli/probe.ts runLive() — set from the filled target, never hand-written.
  url?: string;
}

export interface Harness {
  filename: string;
  content: string;
  runWith: string;
}

const FILL = '/* apiflow:fill */';

// cm:guard Every template must run inside the project's OWN test runner, never against a live
// server — that is what puts it on the test database and keeps a probe from mutating real rows.
export function buildHarness(stack: Stack, endpoints: EndpointNode[], outFile: string): Harness {
  const list = endpoints
    .filter((e) => e.method !== 'UNKNOWN')
    .map((e) => [e.method, e.path] as const);

  switch (stack) {
    case 'laravel':
      return { filename: 'tests/Feature/ApiflowProbeTest.php', runWith: 'php artisan test --filter=ApiflowProbe', content: laravel(list, outFile) };
    case 'node':
      return { filename: 'apiflow-probe.test.ts', runWith: 'npx vitest run apiflow-probe.test.ts', content: node(list, outFile) };
    case 'go':
      return { filename: 'apiflow_probe_test.go', runWith: 'go test ./... -run TestApiflowProbe', content: go(list, outFile) };
    case 'python':
      return { filename: 'test_apiflow_probe.py', runWith: 'pytest test_apiflow_probe.py', content: python(list, outFile) };
    default:
      return { filename: 'apiflow-probe.md', runWith: '(see file)', content: generic(list, outFile) };
  }
}

type Pair = readonly (readonly [string, string])[];

function laravel(list: Pair, out: string): string {
  const rows = list.map(([m, p]) => `            ['${m}', '${p}'],`).join('\n');
  return `<?php

namespace Tests\\Feature;

use Illuminate\\Foundation\\Testing\\RefreshDatabase;
use Tests\\TestCase;

class ApiflowProbeTest extends TestCase
{
    use RefreshDatabase;

    public function test_apiflow_probe(): void
    {
        ${FILL} seed the fixtures these endpoints read, and set \\$id to a real key:
        // \\$user = \\User::factory()->create();  \\$this->actingAs(\\$user, 'sanctum');
        \\$id = 1;

        \\$endpoints = [
${rows}
        ];

        \\$samples = [];
        foreach (\\$endpoints as [\\$method, \\$path]) {
            \\$url = str_replace('{param}', (string) \\$id, \\$path);
            \\$response = \\$this->json(\\$method, \\$url);
            \\$samples[] = [
                'method' => \\$method,
                'path' => \\$path,
                'status' => \\$response->status(),
                'body' => json_decode(\\$response->getContent(), true),
            ];
        }

        file_put_contents(base_path('${out}'), json_encode(\\$samples, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        \\$this->assertNotEmpty(\\$samples);
    }
}
`;
}

function node(list: Pair, out: string): string {
  const rows = list.map(([m, p]) => `  ['${m}', '${p}'],`).join('\n');
  return `import { writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import request from 'supertest';

${FILL} import the app instance your tests already boot, and any auth header they use:
// import { app } from './src/app';
// const AUTH = { Authorization: \`Bearer \${process.env.TEST_TOKEN}\` };
const AUTH: Record<string, string> = {};
const ID = '1';

const ENDPOINTS: Array<[string, string]> = [
${rows}
];

test('apiflow probe', async () => {
  const samples = [];
  for (const [method, path] of ENDPOINTS) {
    const url = path.replaceAll('{param}', ID);
    const res = await request(app)[method.toLowerCase() as 'get'](url).set(AUTH);
    samples.push({ method, path, status: res.status, body: res.body });
  }
  writeFileSync('${out}', JSON.stringify(samples, null, 2));
  expect(samples.length).toBeGreaterThan(0);
});
`;
}

function go(list: Pair, out: string): string {
  const rows = list.map(([m, p]) => `\t\t{"${m}", "${p}"},`).join('\n');
  return `package main

import (
\t"encoding/json"
\t"net/http"
\t"net/http/httptest"
\t"os"
\t"strings"
\t"testing"
)

func TestApiflowProbe(t *testing.T) {
\t${FILL} build the same router your app serves, seeded against the test database:
\t// router := NewRouter(testDB(t))
\tsrv := httptest.NewServer(router)
\tdefer srv.Close()

\tid := "1"
\tendpoints := [][2]string{
${rows}
\t}

\ttype sample struct {
\t\tMethod string      \`json:"method"\`
\t\tPath   string      \`json:"path"\`
\t\tStatus int         \`json:"status"\`
\t\tBody   interface{} \`json:"body"\`
\t}

\tsamples := []sample{}
\tfor _, e := range endpoints {
\t\turl := srv.URL + strings.ReplaceAll(e[1], "{param}", id)
\t\treq, _ := http.NewRequest(e[0], url, nil)
\t\tres, err := srv.Client().Do(req)
\t\tif err != nil {
\t\t\tcontinue
\t\t}
\t\tvar body interface{}
\t\tjson.NewDecoder(res.Body).Decode(&body)
\t\tres.Body.Close()
\t\tsamples = append(samples, sample{e[0], e[1], res.StatusCode, body})
\t}

\tf, _ := json.MarshalIndent(samples, "", "  ")
\tos.WriteFile("${out}", f, 0o644)
}
`;
}

function python(list: Pair, out: string): string {
  const rows = list.map(([m, p]) => `    ("${m}", "${p}"),`).join('\n');
  return `import json

from fastapi.testclient import TestClient

${FILL} import the app your tests already use, pointed at the test database:
# from app.main import app
# client = TestClient(app); client.headers.update({"Authorization": f"Bearer {TEST_TOKEN}"})
client = TestClient(app)
ID = "1"

ENDPOINTS = [
${rows}
]


def test_apiflow_probe():
    samples = []
    for method, path in ENDPOINTS:
        url = path.replace("{param}", ID)
        response = client.request(method, url)
        try:
            body = response.json()
        except ValueError:
            body = None
        samples.append({"method": method, "path": path, "status": response.status_code, "body": body})

    with open("${out}", "w") as fh:
        json.dump(samples, fh, indent=2)

    assert samples
`;
}

function generic(list: Pair, out: string): string {
  const rows = list.map(([m, p]) => `- ${m} ${p}`).join('\n');
  return `# apiflow probe — manual harness

No stack template matched this repo. Write a test in whatever runner this project already uses,
so the probe runs against the **test database**, hit each endpoint below, and append one object
per call to \`${out}\`:

    { "method": "GET", "path": "/api/users", "status": 200, "body": <parsed response> }

Endpoints to cover:

${rows}
`;
}

// cm:why status is checked, not just parsed: a 401 or 500 body is a real response but its shape is
// the error envelope, and folding that into the map would record the wrong contract as observed.
export function ingestSamples(map: ApiMapFile, samples: ProbeSample[]): { map: ApiMapFile; applied: number; skipped: ProbeSample[] } {
  const byPath = new Map<string, EndpointNode>();
  for (const e of map.endpoints) byPath.set(`${e.method} ${e.path}`, e);

  const fields = new Map<string, FieldNode>(map.fields.map((f) => [f.id, { ...f }]));
  const probed = new Set<string>();
  const skipped: ProbeSample[] = [];
  let applied = 0;

  for (const sample of samples) {
    const endpoint = byPath.get(`${sample.method.toUpperCase()} ${sample.path}`);
    if (!endpoint || sample.status < 200 || sample.status >= 300 || sample.body == null) {
      skipped.push(sample);
      continue;
    }
    probed.add(endpoint.id);
    for (const shape of shapeOf(sample.body)) {
      const id = fieldId(endpoint.id, shape.path, 'response');
      const existing = fields.get(id);
      fields.set(id, {
        id,
        endpointId: endpoint.id,
        path: shape.path,
        kind: 'response',
        type: existing?.type && existing.type !== 'unknown' ? existing.type : shape.type,
        nullable: existing?.nullable || shape.nullable,
        optional: existing?.optional,
        declared: existing?.declared,
        observed: true,
        keys: shape.keys ?? existing?.keys,
        source: existing?.source,
      });
      applied++;
    }
  }

  return {
    map: {
      ...map,
      endpoints: map.endpoints.map((e) => (probed.has(e.id) ? { ...e, probed: true } : e)),
      fields: reconcileWrappers([...fields.values()], probed),
    },
    applied,
    skipped,
  };
}

// cm:why A Laravel Resource declares `id` but the response is `{"data":{"id":…}}`; a serializer
// wraps, a paginator nests. Without this, every wrapped field reads as "declared but never sent".
export function reconcileWrappers(fields: FieldNode[], probed: Set<string>): FieldNode[] {
  const out = fields.filter((f) => !(f.kind === 'response' && f.declared && !f.observed && probed.has(f.endpointId)));
  const orphans = fields.filter((f) => f.kind === 'response' && f.declared && !f.observed && probed.has(f.endpointId));

  for (const orphan of orphans) {
    const matches = out.filter(
      (f) =>
        f.endpointId === orphan.endpointId &&
        f.kind === 'response' &&
        f.observed &&
        (f.path === orphan.path || f.path.endsWith(`.${orphan.path}`))
    );
    if (matches.length !== 1) {
      out.push(orphan);
      continue;
    }
    const target = matches[0];
    target.declared = true;
    target.source = target.source ?? orphan.source;
    if (target.path !== orphan.path) target.declaredAs = orphan.path;
  }
  return out;
}
