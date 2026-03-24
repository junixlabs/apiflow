#!/usr/bin/env node

import { spawn } from 'child_process';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');

const args = process.argv.slice(2);
const projectArg = args.find(a => a.startsWith('--project='));
const projectDir = projectArg ? projectArg.split('=')[1] : null;
const port = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] || '3000', 10);

// --mcp mode: start MCP server
if (args.includes('--mcp')) {
  const mcpServer = join(root, 'src', 'mcp', 'server.ts');
  const child = spawn('npx', ['tsx', mcpServer], { stdio: 'inherit', cwd: root });
  child.on('exit', (code) => process.exit(code ?? 0));
  process.on('SIGINT', () => { child.kill(); process.exit(); });
  process.on('SIGTERM', () => { child.kill(); process.exit(); });
} else {
  // Start proxy server
  const proxyScript = join(root, 'proxy', 'index.ts');
  const proxy = spawn('npx', ['tsx', proxyScript], { stdio: 'pipe', cwd: root });
  proxy.stdout?.on('data', (d) => { const m = d.toString().trim(); if (m) console.log(m); });
  proxy.stderr?.on('data', (d) => { const m = d.toString().trim(); if (m && !m.includes('ExperimentalWarning')) console.error(m); });

  // Serve pre-built dist/ as static files
  if (!existsSync(distDir)) {
    console.error('dist/ not found. Run `npm run build` first, or use `npm run dev` for development.');
    proxy.kill();
    process.exit(1);
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
