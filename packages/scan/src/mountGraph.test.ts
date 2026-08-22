import { describe, expect, it } from 'vitest';
import type { ResolveImport } from './callerGraph';
import { buildMountGraph, joinPrefix, prefixesFor } from './mountGraph';

const APP = `import { createIdentityModule } from "./modules/identity/index.js";
import { registerHealth } from "./health.js";

export function createApp(deps: Deps) {
  const app = express();
  app.use(helmet());
  app.use("/api/v1", deps.identityRouter);
  registerHealth(app);
  return app;
}`;

const WIRING = `import { createIdentityModule } from "./modules/identity/index.js";

export function bootstrap(prisma: PrismaClient) {
  return createApp({
    identityRouter: createIdentityModule(prisma),
  });
}`;

const MODULE = `import { createTeamRouter } from "./http/team-router.js";
import { createRoleRouter } from "./http/role-router.js";

export function createIdentityModule(prisma: PrismaClient): Router {
  const root = Router();
  const deps = { prisma };
  root.use(
    "/teams",
    createTeamRouter(deps),
  );
  root.use(createRoleRouter(deps));
  return root;
}`;

const TEAM = `export function createTeamRouter(dependencies: Deps): Router {
  const router = Router();
  router.use(dependencies.authenticate);
  router.get("/memberships", handler);
  return router;
}`;

const ROLE = `export function createRoleRouter(dependencies: Deps): Router {
  const router = Router();
  router.get("/roles", handler);
  return router;
}`;

const HEALTH = `export function registerHealth(app: Express): void {
  app.get("/health", (_req, res) => res.json({ ok: true }));
}`;

const files = [
  { file: 'src/app.ts', content: APP },
  { file: 'src/index.ts', content: WIRING },
  { file: 'src/modules/identity/index.ts', content: MODULE },
  { file: 'src/modules/identity/http/team-router.ts', content: TEAM },
  { file: 'src/modules/identity/http/role-router.ts', content: ROLE },
  { file: 'src/health.ts', content: HEALTH },
];

const resolve: ResolveImport = (from, spec) => {
  const map: Record<string, string> = {
    './modules/identity/index.js': 'src/modules/identity/index.ts',
    './http/team-router.js': 'src/modules/identity/http/team-router.ts',
    './http/role-router.js': 'src/modules/identity/http/role-router.ts',
    './health.js': 'src/health.ts',
  };
  void from;
  return map[spec] ?? null;
};

const graph = buildMountGraph(files, resolve);

describe('joinPrefix', () => {
  it('collapses duplicate and trailing slashes', () => {
    expect(joinPrefix('/api/v1', '/')).toBe('/api/v1');
    expect(joinPrefix('/api/v1', '/teams')).toBe('/api/v1/teams');
    expect(joinPrefix('', '/')).toBe('/');
  });
});

describe('buildMountGraph', () => {
  it('walks app -> DI binding -> module factory -> router', () => {
    expect(prefixesFor(graph, 'src/modules/identity/http/team-router.ts', 'createTeamRouter', 'router')).toEqual([
      '/api/v1/teams',
    ]);
  });

  it('keeps the parent prefix for a mount with no path of its own', () => {
    expect(prefixesFor(graph, 'src/modules/identity/http/role-router.ts', 'createRoleRouter', 'router')).toEqual([
      '/api/v1',
    ]);
  });

  it('carries the prefix into a registrar that is handed the app', () => {
    expect(prefixesFor(graph, 'src/health.ts', 'registerHealth', 'app')).toEqual(['']);
  });

  it('reports nothing unresolved for a fully wired app', () => {
    expect(graph.unresolved).toEqual([]);
  });

  it('does not report a bare middleware mount as unresolved', () => {
    const noisy = buildMountGraph(
      [{ file: 'a.ts', content: 'const app = express();\napp.use(helmet());\napp.use(cors());' }],
      () => null
    );
    expect(noisy.unresolved).toEqual([]);
  });

  it('records a prefixed mount it cannot resolve', () => {
    const broken = buildMountGraph(
      [{ file: 'a.ts', content: 'const app = express();\napp.use("/api", mysteryRouter);' }],
      () => null
    );
    expect(broken.unresolved).toEqual([{ file: 'a.ts', line: 2, target: 'mysteryRouter' }]);
  });

  it('terminates when a router is mounted into itself', () => {
    const cyclic = buildMountGraph(
      [{ file: 'a.ts', content: 'const app = express();\nconst r = Router();\napp.use("/a", r);\nr.use("/b", r);' }],
      () => null
    );
    expect(prefixesFor(cyclic, 'a.ts', ' module', 'r').length).toBeLessThan(12);
  });
});
