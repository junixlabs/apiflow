import express from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const app = express();
const PORT = 3001;

// --- State ---
let activeProjectDir: string | null = null;
const RECENT_FILE = path.join(os.homedir(), '.apiview', 'recent.json');

// --- Helpers ---

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeName(name: string): boolean {
  return !name.includes('..') && !name.includes('/') && !name.includes('\\');
}

function sanitizePath(name: string): boolean {
  return !name.includes('..') && !name.includes('\\') && !name.startsWith('/');
}

function ensureApiViewDir(dir: string): void {
  const base = path.join(dir, '.apiview');
  const dirs = ['flows', 'environments', 'results', 'library'];

  if (!fs.existsSync(base)) {
    fs.mkdirSync(base, { recursive: true });
  }

  for (const d of dirs) {
    const p = path.join(base, d);
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
    }
  }

  const configPath = path.join(base, 'config.json');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({
      name: path.basename(dir),
      activeEnvironment: 'default',
      defaultTimeout: 30000,
    }, null, 2));
  }

  const gitignorePath = path.join(base, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, 'results/\n');
  }

  const defaultEnvPath = path.join(base, 'environments', 'default.json');
  if (!fs.existsSync(defaultEnvPath)) {
    fs.writeFileSync(defaultEnvPath, JSON.stringify({
      name: 'Default',
      variables: [{ key: '', value: '', enabled: true }],
    }, null, 2));
  }
}

// --- Middleware ---

app.use(cors());
app.use(express.json());

// Guard: all /api/* routes except /api/projects and /api/project/open require activeProjectDir
app.use('/api', (req, res, next) => {
  const exempt = ['/projects', '/project/open'];
  if (exempt.includes(req.path)) {
    next();
    return;
  }
  if (activeProjectDir === null) {
    res.status(400).json({ error: 'NO_PROJECT', message: 'No active project. Open a project first.' });
    return;
  }
  next();
});

// --- Existing proxy route ---

app.post('/proxy', async (req, res) => {
  const { method, url, headers = {}, body, timeout = 30000 } = req.body;

  if (!url) {
    res.json({ error: 'MISSING_URL', message: 'URL is required', duration_ms: 0 });
    return;
  }

  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const fetchOptions: RequestInit = {
      method: method || 'GET',
      headers,
      signal: controller.signal,
    };

    if (body && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timer);

    const duration_ms = Date.now() - start;
    const responseText = await response.text();
    const size_bytes = new TextEncoder().encode(responseText).length;

    let responseBody: unknown;
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      duration_ms,
      size_bytes,
    });
  } catch (err) {
    const duration_ms = Date.now() - start;
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const message = isAbort
      ? `Request timeout after ${timeout}ms — the server did not respond in time`
      : err instanceof Error ? err.message : 'Unknown error';
    const errorCode = isAbort ? 'TIMEOUT' : 'REQUEST_FAILED';
    res.json({
      error: errorCode,
      message,
      duration_ms,
    });
  }
});

// ===========================================
// File API Routes
// ===========================================

// --- Project management ---

app.get('/api/projects', async (_req, res) => {
  try {
    if (!fs.existsSync(RECENT_FILE)) {
      res.json([]);
      return;
    }
    const data = JSON.parse(fs.readFileSync(RECENT_FILE, 'utf-8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'READ_FAILED', message: err instanceof Error ? err.message : 'Failed to read recent projects' });
  }
});

app.post('/api/project/open', async (req, res) => {
  try {
    const { dir } = req.body;
    if (!dir || typeof dir !== 'string') {
      res.status(400).json({ error: 'INVALID_DIR', message: 'dir is required' });
      return;
    }
    if (!fs.existsSync(dir)) {
      res.status(400).json({ error: 'DIR_NOT_FOUND', message: `Directory does not exist: ${dir}` });
      return;
    }

    ensureApiViewDir(dir);
    activeProjectDir = dir;

    // Update recent projects
    const recentDir = path.dirname(RECENT_FILE);
    if (!fs.existsSync(recentDir)) {
      fs.mkdirSync(recentDir, { recursive: true });
    }

    let recents: Array<{ dir: string; name: string; lastOpened: string }> = [];
    if (fs.existsSync(RECENT_FILE)) {
      try {
        recents = JSON.parse(fs.readFileSync(RECENT_FILE, 'utf-8'));
      } catch {
        recents = [];
      }
    }

    recents = recents.filter((r) => r.dir !== dir);
    recents.unshift({ dir, name: path.basename(dir), lastOpened: new Date().toISOString() });
    fs.writeFileSync(RECENT_FILE, JSON.stringify(recents, null, 2));

    const config = JSON.parse(fs.readFileSync(path.join(dir, '.apiview', 'config.json'), 'utf-8'));
    res.json({ dir, config });
  } catch (err) {
    res.status(500).json({ error: 'OPEN_FAILED', message: err instanceof Error ? err.message : 'Failed to open project' });
  }
});

app.get('/api/project/active', async (_req, res) => {
  try {
    if (!activeProjectDir) {
      res.json(null);
      return;
    }
    const configPath = path.join(activeProjectDir, '.apiview', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    res.json({ dir: activeProjectDir, config });
  } catch (err) {
    res.status(500).json({ error: 'READ_FAILED', message: err instanceof Error ? err.message : 'Failed to read active project' });
  }
});

// --- Flow CRUD ---

interface FlowInfo {
  name: string;
  fileName: string;
  folder?: string;
  updatedAt: string | null;
  nodeCount: number;
}

function scanFlowsRecursive(dir: string, baseDir: string): FlowInfo[] {
  const results: FlowInfo[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanFlowsRecursive(fullPath, baseDir));
    } else if (entry.name.endsWith('.apiview')) {
      try {
        const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        const relativePath = path.relative(baseDir, fullPath).replace('.apiview', '');
        const folder = path.dirname(relativePath);
        results.push({
          name: content.metadata?.name || entry.name.replace('.apiview', ''),
          fileName: relativePath,
          folder: folder === '.' ? undefined : folder,
          updatedAt: content.metadata?.updatedAt || null,
          nodeCount: Array.isArray(content.nodes) ? content.nodes.filter((n: { type?: string }) => n.type === 'apiNode').length : 0,
        });
      } catch { /* skip malformed */ }
    }
  }
  return results;
}

app.get('/api/flows', async (_req, res) => {
  try {
    const flowsDir = path.join(activeProjectDir!, '.apiview', 'flows');
    const flows = scanFlowsRecursive(flowsDir, flowsDir);

    flows.sort((a, b) => {
      if (!a.updatedAt && !b.updatedAt) return 0;
      if (!a.updatedAt) return 1;
      if (!b.updatedAt) return -1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    res.json(flows);
  } catch (err) {
    res.status(500).json({ error: 'READ_FAILED', message: err instanceof Error ? err.message : 'Failed to read flows' });
  }
});

app.get('/api/flow/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    if (!sanitizePath(name)) {
      res.status(400).json({ error: 'INVALID_NAME', message: 'Invalid flow name' });
      return;
    }
    const filePath = path.join(activeProjectDir!, '.apiview', 'flows', `${name}.apiview`);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'NOT_FOUND', message: `Flow not found: ${name}` });
      return;
    }
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: 'READ_FAILED', message: err instanceof Error ? err.message : 'Failed to read flow' });
  }
});

app.put('/api/flow/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    if (!sanitizePath(name)) {
      res.status(400).json({ error: 'INVALID_NAME', message: 'Invalid flow name' });
      return;
    }
    const filePath = path.join(activeProjectDir!, '.apiview', 'flows', `${name}.apiview`);
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'WRITE_FAILED', message: err instanceof Error ? err.message : 'Failed to write flow' });
  }
});

app.delete('/api/flow/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    if (!sanitizePath(name)) {
      res.status(400).json({ error: 'INVALID_NAME', message: 'Invalid flow name' });
      return;
    }
    const filePath = path.join(activeProjectDir!, '.apiview', 'flows', `${name}.apiview`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const resultsPath = path.join(activeProjectDir!, '.apiview', 'results', `${name}.results.json`);
    if (fs.existsSync(resultsPath)) {
      fs.unlinkSync(resultsPath);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DELETE_FAILED', message: err instanceof Error ? err.message : 'Failed to delete flow' });
  }
});

// --- Environment CRUD ---

app.get('/api/environments', async (_req, res) => {
  try {
    const envsDir = path.join(activeProjectDir!, '.apiview', 'environments');
    if (!fs.existsSync(envsDir)) {
      res.json([]);
      return;
    }

    const files = fs.readdirSync(envsDir).filter((f) => f.endsWith('.json'));
    const envs = [];

    for (const file of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(envsDir, file), 'utf-8'));
        envs.push(content);
      } catch {
        // Skip malformed files
      }
    }

    res.json(envs);
  } catch (err) {
    res.status(500).json({ error: 'READ_FAILED', message: err instanceof Error ? err.message : 'Failed to read environments' });
  }
});

app.put('/api/environment/:name', async (req, res) => {
  try {
    const { name } = req.params;
    if (!sanitizeName(name)) {
      res.status(400).json({ error: 'INVALID_NAME', message: 'Invalid environment name' });
      return;
    }
    const filePath = path.join(activeProjectDir!, '.apiview', 'environments', `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'WRITE_FAILED', message: err instanceof Error ? err.message : 'Failed to write environment' });
  }
});

app.delete('/api/environment/:name', async (req, res) => {
  try {
    const { name } = req.params;
    if (!sanitizeName(name)) {
      res.status(400).json({ error: 'INVALID_NAME', message: 'Invalid environment name' });
      return;
    }
    const filePath = path.join(activeProjectDir!, '.apiview', 'environments', `${name}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DELETE_FAILED', message: err instanceof Error ? err.message : 'Failed to delete environment' });
  }
});

// --- Results ---

app.get('/api/results/:name', async (req, res) => {
  try {
    const { name } = req.params;
    if (!sanitizeName(name)) {
      res.status(400).json({ error: 'INVALID_NAME', message: 'Invalid results name' });
      return;
    }
    const filePath = path.join(activeProjectDir!, '.apiview', 'results', `${name}.results.json`);
    if (!fs.existsSync(filePath)) {
      res.json(null);
      return;
    }
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: 'READ_FAILED', message: err instanceof Error ? err.message : 'Failed to read results' });
  }
});

app.put('/api/results/:name', async (req, res) => {
  try {
    const { name } = req.params;
    if (!sanitizeName(name)) {
      res.status(400).json({ error: 'INVALID_NAME', message: 'Invalid results name' });
      return;
    }
    const filePath = path.join(activeProjectDir!, '.apiview', 'results', `${name}.results.json`);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'WRITE_FAILED', message: err instanceof Error ? err.message : 'Failed to write results' });
  }
});

// --- Config ---

app.get('/api/config', async (_req, res) => {
  try {
    const configPath = path.join(activeProjectDir!, '.apiview', 'config.json');
    const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: 'READ_FAILED', message: err instanceof Error ? err.message : 'Failed to read config' });
  }
});

app.put('/api/config', async (req, res) => {
  try {
    const configPath = path.join(activeProjectDir!, '.apiview', 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'WRITE_FAILED', message: err instanceof Error ? err.message : 'Failed to write config' });
  }
});

// --- Endpoint Library ---

app.get('/api/library/endpoints', async (_req, res) => {
  try {
    const filePath = path.join(activeProjectDir!, '.apiview', 'library', 'endpoints.json');
    if (!fs.existsSync(filePath)) { res.json([]); return; }
    res.json(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
  } catch (err) { res.status(500).json({ error: 'READ_FAILED', message: err instanceof Error ? err.message : '' }); }
});

app.put('/api/library/endpoints', async (req, res) => {
  try {
    const dir = path.join(activeProjectDir!, '.apiview', 'library');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'endpoints.json'), JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'WRITE_FAILED', message: err instanceof Error ? err.message : '' }); }
});

// --- Flow Folders ---

function scanFoldersRecursive(dir: string, baseDir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      results.push(relativePath);
      results.push(...scanFoldersRecursive(fullPath, baseDir));
    }
  }
  return results;
}

app.get('/api/flow-folders', async (_req, res) => {
  try {
    const flowsDir = path.join(activeProjectDir!, '.apiview', 'flows');
    const folders = scanFoldersRecursive(flowsDir, flowsDir);
    res.json(folders);
  } catch (err) {
    res.status(500).json({ error: 'READ_FAILED', message: err instanceof Error ? err.message : '' });
  }
});

app.post('/api/flow-folder', async (req, res) => {
  try {
    const { path: folderPath } = req.body;
    if (!folderPath || typeof folderPath !== 'string' || !sanitizePath(folderPath)) {
      res.status(400).json({ error: 'INVALID_PATH', message: 'Invalid folder path' });
      return;
    }
    const fullPath = path.join(activeProjectDir!, '.apiview', 'flows', folderPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'CREATE_FAILED', message: err instanceof Error ? err.message : '' });
  }
});

// ===========================================

app.listen(PORT, () => {
  console.log(`[proxy] CORS proxy running on http://localhost:${PORT}`);
});
