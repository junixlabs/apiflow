import express from 'express';
import type { Express } from 'express';
import { renderViewer } from '../cli/view';
import { renderHub } from '../view/hub';
import { workspaceRoot } from '../workspace/registry';
import { bestKind, hubProjects } from '../workspace/hubData';
import type { MapKind } from '../workspace/store';
import { mapPath, readMap } from '../workspace/store';

const KINDS: MapKind[] = ['fe', 'be', 'linked'];

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
    res.type('html').send(renderViewer(map, mapPath(project.id, kind)));
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
