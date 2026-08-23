#!/usr/bin/env node

import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');


// cm:why Resolves tsx directly instead of `npx tsx`: npx costs ~0.3s per subcommand on a clean
// install, and the map MCP server pays it at session start (1.7s → 1.1s to first tool).
// cm:why Falls back to npx only if tsx cannot be resolved, which means a broken dependency tree.
function tsxRunner(script, rest) {
  try {
    const tsx = createRequire(import.meta.url).resolve('tsx/cli');
    return [process.execPath, [tsx, script, ...rest]];
  } catch {
    return ['npx', ['tsx', script, ...rest]];
  }
}

const args = process.argv.slice(2);
// cm:guard No backtick and no ${...} anywhere in this string — it is a template literal, and one
// backtick in a flag description ended it mid-sentence and made `apiflow --help` print `NaN`.
// cm:guard The break is silent: node parses the file fine, the rest of the help becomes code.
const HELP = `apiflow — a screen ↔ endpoint ↔ field map

  apiflow ui [--port=3030]       serve the multi-project workspace on 127.0.0.1
  apiflow hub --out=<dir>        export the workspace as static HTML

  apiflow project add <name> --fe=<dir> [--be=<dir>] [--id=<slug>]
                                 [--fe-map=<file>] [--be-map=<file>]  a side scanned elsewhere
  apiflow project import <id> --fe=<file.apimap> | --be=<file.apimap>
  apiflow project ls [--json]
  apiflow project scan <id> [--fe] [--be]
  apiflow project rm <id>

  apiflow scan-fe <dir> [--name=] [--hints=] [--out=] [--json]
  apiflow scan-be <dir> [--name=] [--out=] [--json]
  apiflow probe <map> --emit[=<dir>] | --ingest=<results.json>
  apiflow probe <map> --live=<baseUrl> [--fill=<v>…] [--header='K: V'] [--methods=GET]
                                 [--only=<pattern>…]  scope the walk; substring, or * to glob
                                 [--skip=<pattern>…]  exclude endpoints (wins over --only)
                                 [--screen=<route>…]  probe only what a screen reads (linked map)
                                 walks the map against a RUNNING api and records what came back.
                                 GET/HEAD only unless --methods and --unsafe say otherwise, and a
                                 non-localhost host needs --yes-remote.
  apiflow link <fe.apimap> <be.apimap> --out=<full.apimap>

  apiflow impact <map> [--endpoint=… | --field=… | --screen=…] [--json]
  apiflow check <map> [--root=<dir>] [--json] [--write]
  apiflow diff <before.apimap> <after.apimap> [--json]
                                 compares two maps as files — no source, no scanner, any generator.
                                 Exits 1 when the counted surface differs, so CI can gate a build
                                 against the map it was designed from.
  apiflow view <map> --out=<file.html>

  apiflow mcp map                MCP server that READS THE MAP — 7 tools, for an agent
                                 (old alias: mcp-map)

  apiflow --version              print the installed version
  apiflow --help                 this text

Workspace: ~/.apiflow — apiflow writes nothing into the project it scans unless --out points there.

The visual request runner (canvas, flow execution, cURL/OpenAPI/Postman import) is now its own
package: github.com/junixlabs/apiflow-runner. It used to answer a bare apiflow, with no arguments.`;

// cm:guard --help is answered BEFORE dispatch. `apiflow scan-fe --help` used to fall through with no
// positional argument, which means "scan the current directory" — it scanned this repo.
// cm:guard A help flag must never be able to start a scan.
if (args.includes('--help') || args.includes('-h') || args[0] === 'help') {
  console.log(HELP);
  process.exit(0);
}

// cm:guard `--version` is answered here for the same reason `--help` is: with no positional argument
// it fell through to the dev server, so asking a published binary its version started a listener.
// cm:edge contract -> package.json — the number is read from the manifest, never written twice: the
// banner below said v1.0.0 while npm served 1.1.1, and a version string nobody bumps is worse than none.
const VERSION = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

if (args.includes('--version') || args.includes('-v') || args[0] === 'version') {
  console.log(VERSION);
  process.exit(0);
}

// cm:edge protocol -> packages/cli/src/commands/scanFe.ts — subcommands are matched before the flag parsing below,
// so `apiflow scan-fe <dir>` never falls through to the serve path and never needs dist/.
// cm:guard Paths are relative to this package's src/, not to src/commands/: the map MCP server lives
// outside commands/, and a ../ escape from commands/ is how a layout change breaks one entry.
const SUBCOMMANDS = {
  'scan-fe': 'commands/scanFe.ts',
  'scan-be': 'commands/scanBe.ts',
  probe: 'commands/probe.ts',
  link: 'commands/link.ts',
  impact: 'commands/impact.ts',
  check: 'commands/check.ts',
  diff: 'commands/diff.ts',
  'mcp-map': 'mcp/mapServer.ts',
  view: 'commands/view.ts',
  project: 'commands/project.ts',
  ui: 'commands/ui.ts',
  hub: 'commands/hub.ts',
};
// cm:why Still a two-word form with one entry: `mcp map` was chosen when there were two servers,
// and the spelling is in published configs. `run` left with the runner package.
const MCP_SERVERS = { map: 'mcp/mapServer.ts' };

let subcommand = SUBCOMMANDS[args[0]];
let forwarded = args.slice(1);
if (args[0] === 'mcp') {
  subcommand = MCP_SERVERS[args[1]];
  forwarded = args.slice(2);
  if (!subcommand) {
    console.error('apiflow mcp map   — reads the map (7 tools, for an agent)');
    if (args[1] === 'run') {
      console.error('');
      console.error('`mcp run` moved to @junixlabs/apiflow-runner (github.com/junixlabs/apiflow-runner).');
    }
    process.exit(1);
  }
}

// cm:guard An unrecognised first word must NOT fall through to the serve path: `apiflow map-audit`
// (a name the README's own table advertises) used to start a canvas on :3000 and report success.
// cm:guard Same fault class as the `--version` one fixed in d5ce40f, which was fixed for that one
// token only.
if (subcommand === undefined && args[0] !== undefined && !args[0].startsWith('-')) {
  console.error(`apiflow: unknown command "${args[0]}"`);
  console.error(`Commands: ${[...Object.keys(SUBCOMMANDS), 'mcp'].sort().join(' · ')}`);
  console.error('Run `apiflow --help` for the full list.');
  process.exit(1);
}

if (subcommand) {
  const script = join(root, 'src', subcommand);
  const [cmd, argv] = tsxRunner(script, forwarded);
  // cm:guard Keeps the caller's cwd. tsx resolves its tsconfig from the script path, but every
  // relative argument a user types resolves from cwd — `root` put them in the install directory.
  const child = spawn(cmd, argv, { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code ?? 0));
  // cm:guard Forwards the signal: `apiflow ui` is long-running, and without this, killing this
  // wrapper leaves the tsx child holding the port with no parent left to stop it.
  process.on('SIGINT', () => { child.kill('SIGINT'); });
  process.on('SIGTERM', () => { child.kill('SIGTERM'); });
}
// cm:edge contract -> README.md — a bare `apiflow` opened the canvas and `--mcp` ran the runner's
// MCP server; both are published spellings, so they must say where it went, not fail as unknown.
// cm:guard A published entry point that vanishes silently is worse than one that errors: `apiflow`
// with no arguments opened a canvas on every install since 1.0.0.
else {
  console.error(
    args.includes('--mcp')
      ? '`--mcp` ran the request-runner MCP server, which is now its own package.'
      : 'A bare `apiflow` opened the visual request runner, which is now its own package.',
  );
  console.error('  npm i @junixlabs/apiflow-runner  ·  github.com/junixlabs/apiflow-runner');
  console.error('');
  console.error('This command is the map side only now — run `apiflow --help` for what it does.');
  process.exit(1);
}
