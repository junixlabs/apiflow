import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile } from '@junixlabs/apiflow-map';
import { endpointsForScreen, finalizeApiMap, parseMap, screenIdsForRoute, undeliveredFields } from '@junixlabs/apiflow-map';
import type { Stack } from '@junixlabs/apiflow-scan';
import { detectStack } from '@junixlabs/apiflow-scan';
import type { ProbeSample } from '@junixlabs/apiflow-scan';
import { buildHarness, ingestSamples } from '@junixlabs/apiflow-scan';
import { localRootFor } from '../workspace/registry';
import { tolerateClosedPipe } from './stdio';

const RESULT_FILE = 'apiflow-probe.json';
const MANIFESTS = ['artisan', 'composer.json', 'package.json', 'go.mod', 'pyproject.toml', 'requirements.txt'];

function loadMap(path: string): ApiMapFile {
  const map = parseMap(readFileSync(path, 'utf8'));
  if (map.version !== 1) throw new Error(`unsupported .apimap version: ${String(map.version)}`);
  return map;
}

function stackOf(root: string, override?: string): Stack {
  if (override) return override as Stack;
  const manifests: Record<string, string> = {};
  for (const name of MANIFESTS) if (existsSync(join(root, name))) manifests[name] = '';
  return detectStack(manifests);
}


// cm:why `--only` exists because a fill is positional: `--fill=laravel.log` reaches the one route that
// wants a filename by way of the other 189 that do not. Without a scope the only way to probe one
// endpoint was to leave the tool and use curl, and a sample taken by hand is not in the samples file.
function matchesAny(method: string, path: string, patterns: string[]): boolean {
  const subject = `${method} ${path}`.toLowerCase();
  return patterns.some((raw) => {
    const pattern = raw.toLowerCase();
    if (!pattern.includes('*')) return subject.includes(pattern);
    const rx = new RegExp(`^${pattern.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
    return rx.test(subject) || rx.test(path.toLowerCase());
  });
}

export function matchesOnly(method: string, path: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true;
  return matchesAny(method, path, patterns);
}

// cm:why `--skip` is the exclusion `--only` cannot express. The three GET routes that run
// `sudo supervisorctl` / `queue:restart` sit at the END of the walk, so an --only that covers the API
// surface still can't leave them out by pattern — and the one time this was a manual "remember not
// to", the full walk was launched straight at them. A subtractive filter is the guard that does not
// depend on remembering.
// cm:edge protocol -> matchesOnly() — skip is applied AFTER only: an endpoint must pass the include
// (if any) AND clear every skip pattern. Skip wins ties, because the safe default when the two
// filters disagree is "do not send".
export function passesScope(method: string, path: string, only: string[], skip: string[]): boolean {
  if (!matchesOnly(method, path, only)) return false;
  if (skip.length > 0 && matchesAny(method, path, skip)) return false;
  return true;
}

// cm:why This is impact→probe: instead of walking 1018 endpoints with a fictional `--fill=1`, a screen
// names the handful it actually reads and the walk hits exactly those. Measured on a real API, a blind
// full walk of the GET surface was 63% usable; the rest were 400s for query params a walk cannot guess
// and 404s for ids that do not exist. A screen's own dependency list is the only honest scope.
// cm:guard Needs a map with BOTH sides — screens map to endpoints only in a linked (fe+be) map. A
// pure BE map has zero screens, so `--screen` there would silently select nothing; that is refused.
export function endpointsForScreens(
  map: ApiMapFile,
  routes: string[]
): { keys: Set<string>; unmatched: string[] } {
  const keys = new Set<string>();
  const unmatched: string[] = [];
  for (const route of routes) {
    const ids = screenIdsForRoute(map, route);
    if (ids.length === 0) { unmatched.push(route); continue; }
    for (const id of ids) {
      for (const dep of endpointsForScreen(map, id)) {
        keys.add(`${dep.endpoint.method} ${dep.endpoint.path}`);
      }
    }
  }
  return { keys, unmatched };
}

const SAFE_METHODS = new Set(['GET', 'HEAD']);
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/;

// cm:guard GET and HEAD only unless `--methods` names more AND `--unsafe` is passed. A probe walks
// every endpoint in the map, and that list contains DELETE — running it against a live API is how a
// diagnostic tool deletes someone's data.
// cm:guard A non-local base url needs `--yes-remote`. The same list pointed at a production host is a
// scripted walk over every write endpoint the map knows about.
export function liveTargets(
  endpoints: Array<{ method: string; path: string }>,
  fills: Record<string, string>,
  methods: Set<string>
): { ready: Array<{ method: string; path: string; url: string }>; unfilled: string[] } {
  const ready: Array<{ method: string; path: string; url: string }> = [];
  const unfilled: string[] = [];
  for (const e of endpoints) {
    if (e.method === 'UNKNOWN' || !methods.has(e.method)) continue;
    let i = 0;
    let missing = false;
    // cm:why Positional: `{param}` carries no name in the map, so `--fill` is read in order —
    // `--fill=1 --fill=fe` fills the first and second placeholder of a two-param path.
    const url = e.path.replace(/\{param\}/g, () => {
      const value = fills[String(i++)] ?? fills.param;
      if (value === undefined) missing = true;
      return value ?? '{param}';
    });
    if (missing) unfilled.push(`${e.method} ${e.path}`);
    else ready.push({ method: e.method, path: e.path, url });
  }
  return { ready, unfilled };
}

async function runLive(map: ApiMapFile, base: string, args: string[], mapPath: string): Promise<void> {
  const flag = (n: string): string | undefined => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
  const all = args.filter((a) => a.startsWith('--fill=')).map((a) => a.slice('--fill='.length));
  const fills: Record<string, string> = {};
  all.forEach((v, i) => { fills[String(i)] = v.includes('=') ? v.split('=').slice(1).join('=') : v; });
  for (const v of all) if (v.includes('=')) fills[v.split('=')[0]] = v.split('=').slice(1).join('=');

  const url = new URL(base);
  if (!LOCAL_HOST.test(url.hostname) && !args.includes('--yes-remote')) {
    console.error(`${url.hostname} is not localhost. Probing a remote host sends every request in the`);
    console.error('map to it — pass --yes-remote if that is really what you want.');
    process.exit(2);
  }
  const asked = new Set((flag('methods') ?? 'GET').split(',').map((m) => m.trim().toUpperCase()).filter(Boolean));
  const unsafe = [...asked].filter((m) => !SAFE_METHODS.has(m));
  if (unsafe.length > 0 && !args.includes('--unsafe')) {
    console.error(`${unsafe.join(', ')} can change data on the server. Pass --unsafe to send them.`);
    process.exit(2);
  }

  const headers: Record<string, string> = { accept: 'application/json' };
  for (const a of args.filter((x) => x.startsWith('--header='))) {
    const raw = a.slice('--header='.length);
    const at = raw.indexOf(':');
    if (at > 0) headers[raw.slice(0, at).trim()] = raw.slice(at + 1).trim();
  }

  const only = args.filter((a) => a.startsWith('--only=')).map((a) => a.slice('--only='.length));
  const skip = args.filter((a) => a.startsWith('--skip=')).map((a) => a.slice('--skip='.length));
  const screens = args.filter((a) => a.startsWith('--screen=')).map((a) => a.slice('--screen='.length));
  let screenKeys: Set<string> | undefined;
  if (screens.length > 0) {
    if (map.screens.length === 0) {
      console.error('--screen needs a map that has screens. This map has none — it is a BE-only map.');
      console.error('Probe the linked (fe+be) map so a screen can name the endpoints it reads.');
      process.exit(2);
    }
    const { keys, unmatched } = endpointsForScreens(map, screens);
    if (unmatched.length > 0) {
      console.error(`No screen named ${unmatched.join(', ')} in this map. Nothing was sent.`);
      process.exit(2);
    }
    screenKeys = keys;
  }
  const scoped = map.endpoints.filter(
    (e) => passesScope(e.method, e.path, only, skip) && (screenKeys === undefined || screenKeys.has(`${e.method} ${e.path}`))
  );
  if ((only.length > 0 || skip.length > 0 || screens.length > 0) && scoped.length === 0) {
    console.error(`--only/--skip/--screen left no endpoint in the map. Nothing was sent.`);
    process.exit(2);
  }
  const { ready, unfilled } = liveTargets(scoped, fills, asked);
  const samples: ProbeSample[] = [];
  let failed = 0;
  for (const t of ready) {
    try {
      const res = await fetch(new URL(t.url, base), { method: t.method, headers, signal: AbortSignal.timeout(10_000) });
      const text = await res.text();
      // cm:why Records the sample even on a non-2xx and even when the body is not JSON: `ingest` is
      // what decides a sample is unusable, and it says why per endpoint. Dropping them here would
      // turn a 500 into silence.
      let body: unknown = text;
      try { body = JSON.parse(text); } catch { /* left as text */ }
      samples.push({ method: t.method, path: t.path, status: res.status, body, url: t.url });
    } catch (err) {
      failed++;
      console.error(`- ${t.method} ${t.url} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const out = resolve(flag('out') ?? join(dirname(mapPath), RESULT_FILE));
  writeFileSync(out, `${JSON.stringify(samples, null, 2)}\n`);
  console.log('## Probe — live');
  console.log('');
  console.log(`**Base**: ${base} · **methods**: ${[...asked].join(', ')}`);
  // cm:why A scope that is not printed reads as a whole-map run that found two endpoints.
  if (only.length > 0 || skip.length > 0 || screens.length > 0) {
    const by = [
      screens.length ? `--screen=${screens.join(',')}` : '',
      only.length ? `--only=${only.join(',')}` : '',
      skip.length ? `--skip=${skip.join(',')}` : '',
    ].filter(Boolean).join(' ');
    const tail = screens.length ? ` that ${screens.length === 1 ? 'screen reads' : 'those screens read'}` : '';
    console.log(`**Scoped by \`${by}\`**: ${scoped.length} of ${map.endpoints.length} endpoints${tail}`);
  }
  console.log(`**Sent**: ${ready.length} · **answered**: ${samples.length} · **unreachable**: ${failed}`);
  console.log(`**Skipped for an unfilled \`{param}\`**: ${unfilled.length}${unfilled.length > 0 ? ` — pass --fill=<value>` : ''}`);
  console.log(`**Samples**: ${out}`);
  const codes = new Map<number, number>();
  for (const s of samples) codes.set(s.status, (codes.get(s.status) ?? 0) + 1);
  console.log(`**Status**: ${[...codes].sort((a, b) => a[0] - b[0]).map(([c, n]) => `${c}×${n}`).join(' · ')}`);
  console.log('');
  console.log(`Feed it back: \`apiflow probe ${mapPath} --ingest=${out}\``);
}

function main(): void {
  tolerateClosedPipe();
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const flag = (n: string): string | undefined => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

  if (positional.length === 0) {
    console.error('Usage: apiflow probe <file.apimap> --emit[=<dir>] | --ingest=<results.json>');
    console.error('       apiflow probe <file.apimap> --live=<baseUrl> [--fill=<value>…] [--methods=GET]');
    process.exit(1);
  }
  const mapPath = resolve(positional[0]);
  const map = loadMap(mapPath);
  const ingestPath = flag('ingest');

  if (ingestPath) {
    const samples = JSON.parse(readFileSync(resolve(ingestPath), 'utf8')) as ProbeSample[];
    const { map: next, applied, skipped } = ingestSamples(map, samples);

    const observed = next.fields.filter((f) => f.observed).length;
    const finalized = finalizeApiMap(next);
    const lying = undeliveredFields(finalized);
    writeFileSync(mapPath, `${JSON.stringify(finalized, null, 2)}\n`);
    console.log('## Probe ingest');
    console.log('');
    console.log(`**Samples**: ${samples.length} · applied ${samples.length - skipped.length} · skipped ${skipped.length}`);
    console.log(`**Fields now observed**: ${observed} (${applied} field observations merged)`);
    console.log(`**Probed endpoints**: ${next.endpoints.filter((e) => e.probed).length}/${next.endpoints.length}`);
    // cm:why A collapse that is not printed reads as an endpoint with one field. Naming the widest
    // ones is also the only way a WRONG collapse — a real 20-field record read as a dictionary — is
    // ever noticed by whoever knows the API.
    const dicts = finalized.fields.filter((f) => f.keys !== undefined).sort((a, b) => (b.keys ?? 0) - (a.keys ?? 0));
    if (dicts.length > 0) {
      const byId = new Map(finalized.endpoints.map((e) => [e.id, e]));
      const total = dicts.reduce((n, f) => n + (f.keys ?? 0), 0);
      console.log(`**Dictionaries collapsed**: ${dicts.length} — ${total} keys held out of the field list`);
      for (const f of dicts.slice(0, 5)) {
        const ep = byId.get(f.endpointId);
        console.log(`- ${ep?.method} ${ep?.path} → \`${f.path}\` — ${f.keys} keys of ${f.type}`);
      }
    }
    console.log('');
    console.log(`### Declared in code but never sent — ${lying.length === 0 ? 'none' : lying.length}`);
    for (const a of lying.slice(0, 30)) {
      console.log(`- ${a.endpoint.method} ${a.endpoint.path} → \`${a.field.path}\` — ${a.field.source?.file ?? '?'}:${a.field.source?.line ?? '?'}`);
    }
    if (skipped.length > 0) {
      console.log('');
      console.log(`### Skipped samples — ${skipped.length}`);
      for (const s of skipped.slice(0, 20)) {
        const why = s.status < 200 || s.status >= 300 ? `status ${s.status} is not a success` : s.body == null ? 'empty body' : 'endpoint not in the map';
        // cm:why Prints the url actually sent when it differs from the template — "GET /orders/{param}
        // returned 404" is unactionable until you know it was id 1 that was missing.
        const sent = s.url && s.url !== s.path ? ` (sent ${s.url})` : '';
        console.log(`- ${s.method} ${s.path}${sent} — ${why}`);
      }
    }
    return;
  }

  const live = flag('live');
  if (live !== undefined) {
    void runLive(map, live, args, mapPath);
    return;
  }

  const root = flag('root') ?? localRootFor(map.metadata.root);
  if (root === undefined) {
    console.error(`No idea where ${map.metadata.root} lives on this machine.`);
    console.error('The map records the repo, not a machine path — pass --root=<dir>,');
    console.error('or register the project: apiflow project add <name> --be=<dir>');
    process.exit(1);
  }
  const emitDir = resolve(flag('emit') ?? root);
  // cm:guard The stack belongs to the REPO being probed, not to the directory the harness is written
  // to. Reading it from --emit meant any path outside the repo detected as `generic`, so every Node
  // project got the manual checklist instead of the runnable test — which is why nobody ever ran it.
  const stack = stackOf(root, flag('stack'));
  const harness = buildHarness(stack, map.endpoints, RESULT_FILE);
  const target = join(emitDir, harness.filename);
  mkdirSync(dirname(target), { recursive: true });

  if (existsSync(target) && !args.includes('--force')) {
    console.error(`Refusing to overwrite ${target} — pass --force if that is what you want.`);
    process.exit(1);
  }
  writeFileSync(target, harness.content);

  console.log('## Probe harness emitted');
  console.log('');
  console.log(`**Stack**: ${stack}`);
  console.log(`**File**: ${target}`);
  console.log(`**Endpoints covered**: ${map.endpoints.filter((e) => e.method !== 'UNKNOWN').length}`);
  console.log('');
  console.log('Next:');
  console.log(`1. Fill every \`/* apiflow:fill */\` marker — app instance, auth, and seeded fixture ids.`);
  console.log(`2. Run it: \`${harness.runWith}\``);
  console.log(`3. Feed the result back: \`apiflow probe ${mapPath} --ingest=${join(emitDir, RESULT_FILE)}\``);
  console.log('');
  console.log('It runs inside the project test runner, so it hits the test database, not a real one.');
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
