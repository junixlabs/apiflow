import express from 'express';
import type { Express } from 'express';
import { renderApp } from '../view/app';
import { renderHub } from '../view/hub';
import { findProject, workspaceRoot } from '../workspace/registry';
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

// cm:guard Never reads a path from the request — an id is looked up in the registry and the path is
// derived from it. Accepting a path here would hand the whole filesystem to anyone on the loopback.
export function buildApp(): Express {
  const app = express();

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

  // cm:guard Server-Sent Events, and the response is flushed per line: a scan runs for tens of
  // seconds, and a request that answers only at the end is indistinguishable from one that hung.
  app.post('/api/projects/:id/scan', (req, res) => {
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
