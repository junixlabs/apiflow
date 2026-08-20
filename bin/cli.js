#!/usr/bin/env node

import { spawn, spawnSync } from 'child_process';
import { createRequire } from 'module';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');

// cm:why Spawns tsx through its resolved entry instead of `npx tsx`: measured on a clean install,
// npx costs ~0.3s of registry/bin resolution on EVERY subcommand, and the map MCP server pays it at
// session start where it is felt most (1.7s → 1.1s to first tool). Falls back to npx only if tsx
// cannot be resolved, which on a normal install means the dependency tree is broken anyway.
function tsxRunner(script, rest) {
  try {
    const tsx = createRequire(import.meta.url).resolve('tsx/cli');
    return [process.execPath, [tsx, script, ...rest]];
  } catch {
    return ['npx', ['tsx', script, ...rest]];
  }
}

const args = process.argv.slice(2);
const HELP = `apiflow — bản đồ màn hình ↔ endpoint ↔ field

  apiflow                        mở app (proxy + UI đã build)
  apiflow ui [--port=3030]       mở workspace nhiều project ở 127.0.0.1
  apiflow hub --out=<dir>        xuất workspace ra HTML tĩnh

  apiflow project add <tên> --fe=<dir> [--be=<dir>] [--id=<slug>]
  apiflow project ls [--json]
  apiflow project scan <id> [--fe] [--be]
  apiflow project rm <id>

  apiflow scan-fe <dir> [--name=] [--hints=] [--out=] [--json]
  apiflow scan-be <dir> [--name=] [--out=] [--json]
  apiflow probe <map> --emit[=<dir>] | --ingest=<results.json>
  apiflow link <fe.apimap> <be.apimap> --out=<full.apimap>

  apiflow impact <map> [--endpoint=… | --field=… | --screen=…] [--json]
  apiflow check <map> [--root=<dir>] [--json] [--write]
  apiflow view <map> --out=<file.html>

  apiflow mcp-map                MCP server đọc bản đồ (cho agent)
  apiflow --mcp                  MCP server chạy request (flow runner)

Workspace: ~/.apiflow — apiflow không ghi gì vào project được scan trừ khi --out trỏ vào đó.`;

// cm:guard --help must be answered BEFORE dispatch: `apiflow scan-fe --help` used to fall through
// with no positional argument, which means "scan the current directory" — it scanned this repo and
// wrote a map into it. A help flag must never be able to start a scan.
if (args.includes('--help') || args.includes('-h') || args[0] === 'help') {
  console.log(HELP);
  process.exit(0);
}

const projectArg = args.find(a => a.startsWith('--project='));
const projectDir = projectArg ? projectArg.split('=')[1] : null;
const port = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] || '3000', 10);

// cm:edge protocol -> src/cli/scanFe.ts — subcommands are matched before the flag parsing below,
// so `apiflow scan-fe <dir>` never falls through to the serve path and never needs dist/.
// cm:guard Paths are relative to src/, not to src/cli/: the map MCP server lives outside cli/, and
// spelling it as a ../ escape from cli/ is how a package layout change breaks one entry silently.
const SUBCOMMANDS = {
  'scan-fe': 'cli/scanFe.ts',
  'scan-be': 'cli/scanBe.ts',
  probe: 'cli/probe.ts',
  link: 'cli/link.ts',
  impact: 'cli/impact.ts',
  check: 'cli/check.ts',
  'mcp-map': 'mcp/mapServer.ts',
  view: 'cli/view.ts',
  project: 'cli/project.ts',
  ui: 'cli/ui.ts',
  hub: 'cli/hub.ts',
};
const subcommand = SUBCOMMANDS[args[0]];

if (subcommand) {
  const script = join(root, 'src', subcommand);
  const [cmd, argv] = tsxRunner(script, args.slice(1));
  const child = spawn(cmd, argv, { stdio: 'inherit', cwd: root });
  child.on('exit', (code) => process.exit(code ?? 0));
  // cm:guard Forwards the signal: `apiflow ui` is long-running, and without this, killing this
  // wrapper leaves the tsx child holding the port with no parent left to stop it.
  process.on('SIGINT', () => { child.kill('SIGINT'); });
  process.on('SIGTERM', () => { child.kill('SIGTERM'); });
}
// --mcp mode: start MCP server
else if (args.includes('--mcp')) {
  const mcpServer = join(root, 'src', 'mcp', 'server.ts');
  const [cmd, argv] = tsxRunner(mcpServer, []);
  const child = spawn(cmd, argv, { stdio: 'inherit', cwd: root });
  child.on('exit', (code) => process.exit(code ?? 0));
  process.on('SIGINT', () => { child.kill(); process.exit(); });
  process.on('SIGTERM', () => { child.kill(); process.exit(); });
} else {
  // Start proxy server
  const proxyScript = join(root, 'proxy', 'index.ts');
  const proxy = spawn('npx', ['tsx', proxyScript], { stdio: 'pipe', cwd: root });
  proxy.stdout?.on('data', (d) => { const m = d.toString().trim(); if (m) console.log(m); });
  proxy.stderr?.on('data', (d) => { const m = d.toString().trim(); if (m && !m.includes('ExperimentalWarning')) console.error(m); });

  // cm:edge contract -> package.json — `files` ships a prebuilt dist/ to npm, but dist/ is
  // gitignored, so a git clone arrives here with nothing to serve and must build on demand.
  if (!existsSync(distDir)) {
    const canBuild = existsSync(join(root, 'node_modules', 'vite'));
    if (!canBuild) {
      console.error('dist/ not found and this install cannot build it (no devDependencies).');
      console.error('Reinstall the package, or from a source checkout run `npm install`.');
      proxy.kill();
      process.exit(1);
    }
    console.log('  dist/ not found — building (first run only)...\n');
    const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', cwd: root, shell: process.platform === 'win32' });
    if (build.status !== 0 || !existsSync(distDir)) {
      console.error('\nBuild failed. Fix the errors above, or run `npm run dev` for development.');
      proxy.kill();
      process.exit(1);
    }
  }

  const mimeTypes = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  };

  const server = createServer((req, res) => {
    let filePath = join(distDir, req.url === '/' ? 'index.html' : req.url);
    // SPA fallback: if file not found, serve index.html
    if (!existsSync(filePath)) filePath = join(distDir, 'index.html');

    try {
      const content = readFileSync(filePath);
      const ext = '.' + filePath.split('.').pop();
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(port, () => {
    console.log(`\n  apiflow v1.0.0\n`);
    console.log(`  App:   http://localhost:${port}`);
    console.log(`  Proxy: http://localhost:3001\n`);

    // Open project if specified
    if (projectDir) {
      setTimeout(() => {
        fetch('http://localhost:3001/api/project/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dir: projectDir }),
        }).catch(() => {});
      }, 1500);
    }

    // Open browser
    const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    spawn(open, [`http://localhost:${port}`], { stdio: 'ignore', detached: true }).unref();
  });

  const cleanup = () => { proxy.kill(); server.close(); process.exit(); };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
