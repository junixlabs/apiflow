import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'packages/cli/bin/cli.js');

// cm:why The only place in this repo holding both halves of an app, so the only place the pipeline
// can be closed: apiflow is a CLI, with no screen to scan and no endpoint to serve.
// cm:edge lockstep -> fixtures/demo-app — editing any source file under the fixture changes these
// maps, and this gate is what turns that into a failing build instead of a silent divergence.
const SIDES = [
  { file: 'web.apimap', scan: 'fixtures/demo-app/web', command: 'scan-fe' },
  { file: 'api.apimap', scan: 'fixtures/demo-app/api', command: 'scan-be' },
];
const LINKED = 'linked.apimap';

// cm:guard Goldens live OUTSIDE both scan roots and outside the gitignored `.apiview/`: a map written
// inside the tree being scanned breaks "apiflow writes nothing into the project it reads".
const DEFAULT_DIR = 'fixtures/demo-app/maps';

const args = process.argv.slice(2);
const write = args.includes('--write');
// cm:why Exists so the gate can be tested: tests/fixture-map.test.ts copies the goldens elsewhere,
// corrupts one and asserts this script goes red, without ever mutating a tracked file.
// cm:guard Only the MAP directory moves. The scan roots stay real, because a map records the repo it
// came from and `check` refuses a root whose git origin does not match.
const dir = join(root, args.find((a) => a.startsWith('--dir='))?.slice('--dir='.length) ?? DEFAULT_DIR);

const scratch = mkdtempSync(join(tmpdir(), 'apiflow-fixture-map-'));
const failures = [];

function apiflow(argv) {
  return spawnSync(process.execPath, [cli, ...argv], { cwd: root, encoding: 'utf8' });
}

// cm:why Re-scanning needs the name the stored map was written under, the same way `check` takes it
// from `stored.metadata.name` — a scan under a different name diverges on every id.
function mapName(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8')).metadata.name;
  } catch {
    return null;
  }
}

function readIfPossible(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

// cm:why Names the first differing line instead of dumping both files: the gate has to say WHERE it
// diverged to be worth reading, and four thousand characters of JSON in a CI log is read by nobody.
// cm:why `check` reports drift in the vocabulary of the map — endpoints, screens, unresolved — which
// is the right verdict at the wrong altitude for "a scanner rewrote one string".
function reportDifference(stored, rebuilt) {
  const a = stored.split('\n');
  const b = rebuilt.split('\n');
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  console.log(`First difference at line ${String(i + 1)} of ${String(a.length)} (${String(b.length)} rebuilt):`);
  console.log(`- committed: ${a[i] ?? '<end of file>'}`);
  console.log(`- rebuilt:   ${b[i] ?? '<end of file>'}`);
  return i + 1;
}

// cm:why The halves are judged by `apiflow check` itself, not a byte compare written here: a gate the
// product does not own can pass while the product is broken, and this puts `check` on the daily path.
// cm:guard But `check` alone does NOT byte-gate the file: it decides on
// `serializeMap(stored) === serializeMap(fresh)`, comparing two maps it re-serialized itself.
// cm:guard So the committed bytes are re-scanned and compared here as well — measured: minifying a
// golden to one line changes every byte after the first and `check` still says it matches.
for (const { file, scan, command } of SIDES) {
  const map = join(dir, file);
  const run = apiflow(['check', map, `--root=${scan}`, ...(write ? ['--write'] : [])]);
  process.stdout.write(run.stdout ?? '');
  process.stderr.write(run.stderr ?? '');
  if (run.status !== 0) failures.push(`${relative(root, map)} — apiflow check exited ${String(run.status)}`);
  // cm:why Exit 2 is check declining to answer — wrong root, wrong side — so there is no verdict to
  // add a byte compare to, and re-scanning would invent a divergence out of a question never asked.
  if (write || (run.status !== 0 && run.status !== 1)) continue;
  // cm:guard An unparseable map ALSO exits 1, because check dies on it and node reports 1 for an
  // uncaught throw — so read the name defensively or the gate crashes instead of reporting.
  const name = mapName(map);
  if (name === null) continue;
  const fresh = join(scratch, file);
  const rescan = apiflow([command, scan, `--name=${name}`, `--out=${fresh}`]);
  if (rescan.status !== 0) {
    failures.push(`${relative(root, map)} — apiflow ${command} exited ${String(rescan.status)}`);
    continue;
  }
  const stored = readFileSync(map, 'utf8');
  const rebuilt = readFileSync(fresh, 'utf8');
  if (stored === rebuilt) continue;
  const line = reportDifference(stored, rebuilt);
  // cm:why Only reported when `check` passed, because a drifted map is already in the list above and
  // naming it twice reads as two problems.
  if (run.status === 0) {
    console.log('`apiflow check` passed on this map: it re-serializes what it parsed, so a difference');
    console.log('in the file itself — formatting, key order, a missing trailing newline — is invisible');
    console.log('to it. These maps are shared as FILES, so the file is what has to match.');
    failures.push(`${relative(root, map)} — the file differs from a fresh scan at line ${String(line)}`);
  }
}

// cm:why `apiflow check` REFUSES a linked map by design: `sideOf()` is null for generator `apiflow
// link/1`, so there is no single side to re-scan.
// cm:why Left ungated, this would be the one stage of the pipeline nothing checks — `linkMaps` lives
// there, and it is the stage that turns two maps into the answer a reader actually opens.
// cm:why So this side is re-linked and compared byte for byte, which is the claim `check` makes
// internally anyway: same source in, same bytes out.
const linked = join(dir, LINKED);
const fe = join(dir, SIDES[0].file);
const be = join(dir, SIDES[1].file);
console.log('## apiflow link');
console.log('');
console.log(`**Map**: ${linked}`);
// cm:guard Says in the CI log why this map is gated differently. A reader who sees two `check`
// sections and one `link` section must not have to guess that the third was skipped.
console.log('`apiflow check` cannot judge a linked map — there is no single side to re-scan — so this');
console.log('one is re-linked from the two halves above and compared byte for byte.');
if (write) {
  const run = apiflow(['link', fe, be, `--out=${linked}`]);
  process.stderr.write(run.stderr ?? '');
  if (run.status !== 0) failures.push(`${relative(root, linked)} — apiflow link exited ${String(run.status)}`);
  else console.log('Relinked from the two halves above.');
} else {
  const fresh = join(scratch, LINKED);
  const run = apiflow(['link', fe, be, `--out=${fresh}`]);
  console.log('');
  // cm:guard Reports an unreadable map instead of throwing on the read: dropping a map from the gate
  // is the one action CONTRIBUTING forbids by name, so it must not answer with a stack trace.
  // cm:guard Catches rather than testing existence — a directory and a mode-000 file both exist and
  // both throw, and the earlier existsSync spelling let those two through to an uncaught error.
  const stored = readIfPossible(linked);
  if (run.status !== 0) {
    process.stderr.write(run.stderr ?? '');
    failures.push(`${relative(root, linked)} — apiflow link exited ${String(run.status)}`);
  } else if (stored === null) {
    console.log('**Verdict**: this map could not be read. It is not optional — see the note below.');
    failures.push(`${relative(root, linked)} — missing or unreadable`);
  } else {
    const rebuilt = readFileSync(fresh, 'utf8');
    if (stored === rebuilt) {
      console.log('Re-linking the two halves reproduced it byte for byte. Nothing to do.');
    } else {
      console.log('**Verdict**: re-linking the two halves no longer reproduces this map.');
      const line = reportDifference(stored, rebuilt);
      failures.push(`${relative(root, linked)} — differs from a fresh link at line ${String(line)}`);
    }
  }
}

rmSync(scratch, { recursive: true, force: true });

if (failures.length > 0) {
  console.error('');
  console.error('The committed fixture maps no longer match what the pipeline produces:');
  for (const f of failures) console.error(`  - ${f}`);
  console.error('');
  // cm:guard The fix is to refresh and commit, never to drop a map from the list above: these three
  // files are the repo's only assertion that one source produces one set of bytes.
  console.error('If the scanner changed on purpose, refresh them and commit the result:');
  console.error('  npm run map:refresh');
  process.exit(1);
}

console.log('');
console.log(
  write
    ? 'Fixture maps refreshed. Commit them — the diff IS the change in scanner output.'
    : 'Fixture maps match the fixture source.',
);
