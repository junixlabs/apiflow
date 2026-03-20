#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const args = process.argv.slice(2);

// --mcp mode: start MCP server
if (args.includes('--mcp')) {
  const mcpServer = join(root, 'src', 'mcp', 'server.ts');
  const child = spawn('npx', ['tsx', mcpServer], {
    stdio: 'inherit',
    cwd: root,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
  process.on('SIGINT', () => child.kill());
  process.on('SIGTERM', () => child.kill());
} else {
  // Default: start dev server (proxy + vite)
  const projectArg = args.find(a => a.startsWith('--project='));
  const projectDir = projectArg ? projectArg.split('=')[1] : null;

  console.log('Starting API View...');

  // Start proxy server
  const proxy = spawn('npx', ['tsx', join(root, 'proxy', 'index.ts')], {
    stdio: 'pipe',
    cwd: root,
  });

  proxy.stdout?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(msg);
  });

  proxy.stderr?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg && !msg.includes('ExperimentalWarning')) console.error(msg);
  });

  // Check if dist/ exists (production build) or need vite dev
  const distDir = join(root, 'dist');
  let app;

  if (existsSync(distDir)) {
    // Serve pre-built dist
    app = spawn('npx', ['serve', distDir, '-l', '3000', '-s'], {
      stdio: 'pipe',
      cwd: root,
    });
  } else {
    // Dev mode with vite
    app = spawn('npx', ['vite', '--port', '3000'], {
      stdio: 'pipe',
      cwd: root,
    });
  }

  app.stdout?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(msg);

    // Auto-open browser when ready
    if (msg.includes('localhost:3000') || msg.includes('Local:')) {
      const url = 'http://localhost:3000';
      console.log(`\n  API View ready at ${url}\n`);

      // Open project if specified
      if (projectDir) {
        setTimeout(() => {
          fetch('http://localhost:3001/api/project/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dir: projectDir }),
          }).catch(() => {});
        }, 1000);
      }

      // Open browser
      const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      spawn(open, [url], { stdio: 'ignore', detached: true }).unref();
    }
  });

  app.stderr?.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg && !msg.includes('ExperimentalWarning')) console.error(msg);
  });

  // Cleanup on exit
  const cleanup = () => {
    proxy.kill();
    app.kill();
    process.exit();
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
