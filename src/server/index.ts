import express from 'express';
import type { Express, Request } from 'express';
import { renderApp } from '../view/app';
import { renderHub } from '../view/hub';
import { ID, addProject, findProject, slug, workspaceRoot } from '../workspace/registry';
import { localWritesOnly } from './guard';
import type { ScanEvent } from '../workspace/runScan';
import { scanInBackground } from '../workspace/runScan';
import { bestKind, hubProjects } from '../workspace/hubData';
import type { MapKind } from '../workspace/store';
import { historyOf, mapPath, projectDir, readMap } from '../workspace/store';
import type { MapDiff } from '../workspace/diff';
import { diffMaps } from '../workspace/diff';
import { parseMap } from '../core/apimap';
import { sidesOf } from '../workspace/sides';
import { endpointHistory, mapSeries } from '../workspace/series';
import { readFileSync } from 'fs';
import { join } from 'path';

const KINDS: MapKind[] = ['fe', 'be', 'linked'];

// cm:why Compares the two most recent stored scans, not "now vs a timestamp": history is keyed by
// content hash, so two entries exist only when a re-scan actually found something different.
function diffFor(id: string, kind: MapKind): MapDiff | undefined {
  const entries = historyOf(id, kind);
  if (entries.length < 2) return undefined;
  const dir = join(projectDir(id), 'history');
  const before = parseMap(readFileSync(join(dir, entries[entries.length - 2]), 'utf8'));
  const after = parseMap(readFileSync(join(dir, entries[entries.length - 1]), 'utf8'));
  return diffMaps(before, after);
}

// cm:guard Every READ route resolves an id through the registry and never takes a path from the
// request. The one route that does take paths is POST /api/projects, and it sits behind
// localWritesOnly for exactly that reason — see src/server/guard.ts.
export function buildApp(): Express {
  const app = express();
  app.use(express.json({ limit: '16kb' }));

  app.get('/', (_req, res) => {
    const projects = hubProjects();
    res.type('html').send(
      renderHub(
        projects,
        {
          workspace: workspaceRoot(),
          live: true,
          linkTo: (project) => (bestKind(project) === null ? null : `/p/${project.id}`),
        },
        Date.now()
      )
    );
  });

  app.get('/p/:id', (req, res) => {
    const project = hubProjects().find((p) => p.id === req.params.id);
    if (!project) {
      res.status(404).type('text/plain; charset=utf-8').send(`Không có project nào tên ${req.params.id}`);
      return;
    }
    const requested = req.query.kind;
    const kind = KINDS.includes(requested as MapKind) ? (requested as MapKind) : bestKind(project);
    if (kind === null) {
      res.status(404).type('text/plain; charset=utf-8').send(`${project.id} chưa có map nào — chạy apiflow scan-fe trước.`);
      return;
    }
    const map = readMap(project.id, kind);
    if (map === null) {
      res.status(404).type('text/plain; charset=utf-8').send(`${project.id} không có map ${kind}`);
      return;
    }
    res.type('html').send(renderApp({
      map,
      projectId: project.id,
      sourcePath: mapPath(project.id, kind),
      live: true,
      kind,
      sides: sidesOf(project.id),
      now: Date.now(),
      series: mapSeries(project.id, kind),
      epHistory: endpointHistory(project.id, kind),
      diff: diffFor(project.id, kind),
    }));
  });

  // cm:why Rejects a name apiflow cannot use BEFORE touching the disk, and says what to type
  // instead: `slug()` silently returns '' for a name with no latin letters, and the registry's own
  // message ("id không hợp lệ") does not tell the person which field to fix.
  // cm:edge contract -> src/view/panes.ts submitAdd() — it renders `message` verbatim to the user.
  app.post('/api/projects', localWritesOnly, (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const text = (key: string): string | undefined => {
      const value = body[key];
      return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
    };
    const name = text('name');
    if (name === undefined) {
      res.status(400).json({ error: 'NO_NAME', message: 'thiếu tên project' });
      return;
    }
    const fe = text('fe');
    const be = text('be');
    if (fe === undefined && be === undefined) {
      res.status(400).json({ error: 'NO_ROOT', message: 'cần ít nhất một thư mục FE hoặc BE' });
      return;
    }
    const id = text('id') ?? slug(name);
    if (!ID.test(id)) {
      res.status(400).json({
        error: 'BAD_ID',
        message: `không rút được id từ tên "${name}" — điền ô id bằng chữ thường, số và dấu gạch`,
      });
      return;
    }
    try {
      const entry = addProject({ name, fe, be, hints: text('hints'), id });
      res.status(201).json({ project: entry });
    } catch (err) {
      res.status(400).json({ error: 'REFUSED', message: err instanceof Error ? err.message : String(err) });
    }
  });

  // cm:guard Server-Sent Events, and the response is flushed per line: a scan runs for tens of
  // seconds, and a request that answers only at the end is indistinguishable from one that hung.
  app.post('/api/projects/:id/scan', localWritesOnly, (req: Request<{ id: string }>, res) => {
    const kind = req.query.kind === 'be' ? 'be' : 'fe';
    if (findProject(req.params.id) === undefined) {
      res.status(404).json({ error: 'NO_PROJECT' });
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    const send = (event: ScanEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    const running = scanInBackground(req.params.id, kind, (event) => {
      send(event);
      if (event.kind !== 'log') res.end();
    });
    req.on('close', () => running.cancel());
  });

  app.get('/api/projects', (_req, res) => {
    res.json({ workspace: workspaceRoot(), projects: hubProjects() });
  });

  app.get('/api/map/:id/:kind', (req, res) => {
    const kind = req.params.kind as MapKind;
    if (!KINDS.includes(kind)) {
      res.status(400).json({ error: 'BAD_KIND', message: `kind phải là một trong ${KINDS.join(', ')}` });
      return;
    }
    try {
      const map = readMap(req.params.id, kind);
      if (map === null) {
        res.status(404).json({ error: 'NO_MAP', message: `${req.params.id} không có map ${kind}` });
        return;
      }
      res.json(map);
    } catch (err) {
      res.status(400).json({ error: 'BAD_ID', message: err instanceof Error ? err.message : String(err) });
    }
  });

  return app;
}

export interface ServeOptions {
  port: number;
  host: string;
}

// cm:guard Binds the loopback and takes no flag to widen it. A map names internal paths, customer
// resources and every endpoint with no auth gate — it is not a thing to serve on a LAN by accident.
export function serve(options: ServeOptions): Promise<{ close: () => void; port: number }> {
  return new Promise((resolveServer, reject) => {
    const server = buildApp().listen(options.port, options.host);
    server.once('listening', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : options.port;
      resolveServer({ close: () => server.close(), port });
    });
    server.once('error', reject);
  });
}
