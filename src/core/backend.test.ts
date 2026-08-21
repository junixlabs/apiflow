import { describe, expect, it } from 'vitest';
import { shapeOf, mergeShapes } from './shape';
import { toMapMethod } from './apimap';
import { detectStack, indexClasses, isBackendFile, laravelRouteFilePrefixes, resolveHandlerSchemas, scanBackendFile } from './beScanner';
import { buildHarness, ingestSamples, reconcileWrappers } from './probeHarness';
import { createApiMap, endpointId, endpointsWithTracedReads, fieldId, finalizeApiMap, linkMaps, matchEndpointBySuffix, unreadResponseFields, undeliveredFields } from './apimap';
import type { ApiMapFile, FieldNode } from './apimap';
import { lambdaReads } from './feScanner';

describe('shapeOf', () => {
  it('flattens nested objects into dotted paths', () => {
    const shape = shapeOf({ data: { id: 1, profile: { email: 'a@b.co' } } });
    const byPath = new Map(shape.map((f) => [f.path, f.type]));
    expect(byPath.get('data')).toBe('object');
    expect(byPath.get('data.id')).toBe('number');
    expect(byPath.get('data.profile.email')).toBe('string');
  });

  it('collapses array elements onto one path', () => {
    const shape = shapeOf({ rows: [{ id: 1 }, { id: 2 }, { id: 3 }] });
    expect(shape.filter((f) => f.path === 'rows.id')).toHaveLength(1);
  });

  it('records a null as nullable rather than a type', () => {
    const shape = shapeOf({ a: null });
    expect(shape[0]).toMatchObject({ path: 'a', type: 'null', nullable: true });
  });

  it('widens rather than overwrites when two samples disagree', () => {
    const merged = mergeShapes(shapeOf({ a: 1, b: 'x' }), shapeOf({ a: null, c: true }));
    const byPath = new Map(merged.map((f) => [f.path, f]));
    expect(byPath.get('a')?.nullable).toBe(true);
    expect(byPath.get('b')?.optional).toBe(true);
    expect(byPath.get('c')?.optional).toBe(true);
  });
});

describe('detectStack', () => {
  it('picks the stack from marker files', () => {
    expect(detectStack({ artisan: '' })).toBe('laravel');
    expect(detectStack({ 'go.mod': '' })).toBe('go');
    expect(detectStack({ 'package.json': '{}' })).toBe('node');
    expect(detectStack({ 'pyproject.toml': '' })).toBe('python');
    expect(detectStack({})).toBe('generic');
  });
});

describe('isBackendFile', () => {
  it('skips vendored and test code', () => {
    expect(isBackendFile('app/Http/Controllers/UserController.php')).toBe(true);
    expect(isBackendFile('vendor/laravel/framework/src/X.php')).toBe(false);
    expect(isBackendFile('tests/Feature/UserTest.php')).toBe(false);
  });
});

describe('scanBackendFile — laravel', () => {
  const routes = `<?php
Route::middleware('auth:sanctum')->prefix('v1')->group(function () {
    Route::apiResource('users', \\App\\Http\\Controllers\\UserController::class);
    Route::get('reports/{id}', [\\App\\Http\\Controllers\\ReportController::class, 'show']);
});`;

  it('expands apiResource the way Laravel registers it, PATCH included', () => {
    const scan = scanBackendFile('routes/api.php', routes, 'laravel');
    const users = scan.routes.filter((r) => r.path.startsWith('/v1/users'));
    expect(users.map((r) => r.method).sort()).toEqual(['DELETE', 'GET', 'GET', 'PATCH', 'POST', 'PUT']);
    expect(users.every((r) => r.auth)).toBe(true);
  });

  it('reads an explicit controller tuple', () => {
    const scan = scanBackendFile('routes/api.php', routes, 'laravel');
    const report = scan.routes.find((r) => r.path === '/v1/reports/{param}');
    expect(report?.handler).toBe('ReportController@show');
  });

  it('turns FormRequest rules into typed fields', () => {
    const src = `<?php
class StoreUserRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => 'required|string',
            'age' => 'nullable|integer',
            'active' => 'required|boolean',
        ];
    }
}`;
    const scan = scanBackendFile('app/Http/Requests/StoreUserRequest.php', src, 'laravel');
    const fields = new Map(scan.schemas[0].fields.map((f) => [f.path, f]));
    expect(scan.schemas[0].name).toBe('StoreUserRequest');
    expect(fields.get('name')).toMatchObject({ type: 'string', optional: false });
    expect(fields.get('age')).toMatchObject({ type: 'number', optional: true });
    expect(fields.get('active')).toMatchObject({ type: 'boolean' });
  });
});

describe('resolveHandlerSchemas', () => {
  it('follows a controller into its FormRequest and Resource', () => {
    const controller = `<?php
class UserController extends Controller
{
    public function store(StoreUserRequest $request)
    {
        return new UserResource(User::create($request->validated()));
    }
}`;
    const classes = indexClasses([{ file: 'app/Http/Controllers/UserController.php', content: controller }]);
    const resolved = resolveHandlerSchemas(
      { method: 'POST', path: '/v1/users', handler: 'UserController@store', source: { file: 'routes/api.php', line: 3 } },
      classes
    );
    expect(resolved.requestSchema).toBe('StoreUserRequest');
    expect(resolved.responseSchema).toBe('UserResource');
  });

  it('ignores a bare Request type hint, which carries no schema', () => {
    const controller = '<?php\nclass PingController { public function show(Request $r) { return 1; } }';
    const classes = indexClasses([{ file: 'a.php', content: controller }]);
    const resolved = resolveHandlerSchemas(
      { method: 'GET', path: '/ping', handler: 'PingController@show', source: { file: 'r.php', line: 1 } },
      classes
    );
    expect(resolved.requestSchema).toBeUndefined();
  });
});

describe('scanBackendFile — other stacks', () => {
  it('joins a NestJS controller prefix with its method path', () => {
    const src = `@Controller('users')
export class UserController {
  @Get(':id')
  findOne(@Param('id') id: string) { return 1; }

  @Post()
  create(@Body() dto: CreateUserDto) { return 2; }
}`;
    const scan = scanBackendFile('src/user.controller.ts', src, 'node');
    const paths = scan.routes.map((r) => `${r.method} ${r.path}`).sort();
    expect(paths).toEqual(['GET /users/{param}', 'POST /users']);
    expect(scan.routes.find((r) => r.method === 'POST')?.requestSchema).toBe('CreateUserDto');
  });

  it('reads a zod schema', () => {
    const src = `const CreateUser = z.object({
  name: z.string(),
  age: z.number().optional(),
});`;
    const scan = scanBackendFile('src/schema.ts', src, 'node');
    expect(scan.schemas[0].name).toBe('CreateUser');
    expect(scan.schemas[0].fields).toEqual([
      { path: 'name', type: 'string', optional: false },
      { path: 'age', type: 'number', optional: true },
    ]);
  });

  it('reads go struct json tags and a verb on a chained call', () => {
    const src = `type User struct {
	ID    int    \`json:"id"\`
	Email string \`json:"email,omitempty"\`
}

func routes(r *mux.Router) {
	r.HandleFunc("/api/users", listUsers).Methods("GET")
}`;
    const scan = scanBackendFile('main.go', src, 'go');
    expect(scan.schemas[0].fields).toEqual([
      { path: 'id', type: 'number', optional: false },
      { path: 'email', type: 'string', optional: true },
    ]);
    expect(scan.routes[0]).toMatchObject({ method: 'GET', path: '/api/users' });
  });

  it('reads FastAPI decorators with a response_model', () => {
    const src = `class UserOut(BaseModel):
    id: int
    email: str
    nickname: Optional[str] = None


@router.get("/users/{id}", response_model=UserOut)
async def get_user(id: int):
    return 1`;
    const scan = scanBackendFile('app/api.py', src, 'python');
    expect(scan.routes[0]).toMatchObject({ method: 'GET', path: '/users/{param}', responseSchema: 'UserOut' });
    const fields = new Map(scan.schemas[0].fields.map((f) => [f.path, f]));
    expect(fields.get('id')).toMatchObject({ type: 'number' });
    expect(fields.get('nickname')).toMatchObject({ type: 'string', optional: true });
  });
});

describe('scanBackendFile — strapi', () => {
  const routeFile = `const rbac = (p: string) => ({ policies: ['global::is-authenticated'] });

export default {
  routes: [
    { method: 'GET', path: '/agents', handler: 'agent.find', config: rbac('agents:read') },
    { method: 'POST', path: '/agents', handler: 'agent.create', config: rbac('agents:create') },
    { method: 'DELETE', path: '/agents/:id', handler: 'agent.delete', config: rbac('agents:delete') },
    { method: 'GET', path: '/agents/me/permissions/check', handler: 'agent.check', config: { auth: false } },
  ],
};`;

  it('reads routes declared as data, not as calls', () => {
    const scan = scanBackendFile('src/api/agent/routes/agent.ts', routeFile, 'strapi');
    expect(scan.routes.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /agents',
      'POST /agents',
      'DELETE /agents/{param}',
      'GET /agents/me/permissions/check',
    ]);
  });

  it('treats a strapi route as authenticated unless auth is explicitly false', () => {
    const scan = scanBackendFile('src/api/agent/routes/agent.ts', routeFile, 'strapi');
    expect(scan.routes.filter((r) => r.auth)).toHaveLength(3);
    expect(scan.routes.find((r) => r.path.endsWith('/check'))?.auth).toBe(false);
  });

  it('inherits the folder content type only for CRUD-shaped paths', () => {
    const scan = scanBackendFile('src/api/agent/routes/agent.ts', routeFile, 'strapi');
    const byPath = new Map(scan.routes.map((r) => [`${r.method} ${r.path}`, r]));
    expect(byPath.get('GET /agents')?.responseSchema).toBe('agent');
    expect(byPath.get('POST /agents')?.requestSchema).toBe('agent');
    expect(byPath.get('GET /agents/me/permissions/check')?.responseSchema).toBeUndefined();
  });

  it('does not claim a response shape for DELETE', () => {
    const scan = scanBackendFile('src/api/agent/routes/agent.ts', routeFile, 'strapi');
    expect(scan.routes.find((r) => r.method === 'DELETE')?.responseSchema).toBeUndefined();
  });

  it('turns a content-type schema into typed fields', () => {
    const schema = JSON.stringify({
      info: { singularName: 'agent', pluralName: 'agents' },
      attributes: {
        name: { type: 'string', required: true },
        seats: { type: 'integer' },
        tenant: { type: 'relation' },
      },
    });
    const scan = scanBackendFile('src/api/agent/content-types/agent/schema.json', schema, 'strapi');
    expect(scan.schemas[0].name).toBe('agent');
    expect(scan.schemas[0].fields).toEqual([
      { path: 'name', type: 'string', optional: false },
      { path: 'seats', type: 'number', optional: true },
      { path: 'tenant', type: 'object', optional: true },
    ]);
  });

  it('detects strapi from the manifest rather than calling it plain node', () => {
    expect(detectStack({ 'package.json': '{"dependencies":{"@strapi/strapi":"5.0.0"}}' })).toBe('strapi');
    expect(detectStack({ 'package.json': '{"dependencies":{"express":"4"}}' })).toBe('node');
  });
});

describe('buildHarness', () => {
  it('emits a test in the project runner, not a live-server script', () => {
    const endpoints = [{ id: 'e', method: 'GET' as const, path: '/api/users' }];
    const laravel = buildHarness('laravel', endpoints, 'apiflow-probe.json');
    expect(laravel.filename).toBe('tests/Feature/ApiflowProbeTest.php');
    expect(laravel.content).toContain('RefreshDatabase');
    expect(laravel.content).toContain('/* apiflow:fill */');
    expect(buildHarness('go', endpoints, 'o.json').content).toContain('httptest.NewServer');
    expect(buildHarness('python', endpoints, 'o.json').content).toContain('TestClient');
  });

  it('leaves out endpoints with no known verb', () => {
    const content = buildHarness('node', [{ id: 'e', method: 'UNKNOWN', path: '/x' }], 'o.json').content;
    expect(content).not.toContain("'/x'");
  });
});

function baseMap(): ApiMapFile {
  const map = createApiMap('be', '/be', 'test');
  const eid = endpointId('GET', '/v1/users');
  map.endpoints.push({ id: eid, method: 'GET', path: '/v1/users', handler: 'UserController@index' });
  map.fields.push(
    { id: fieldId(eid, 'id'), endpointId: eid, path: 'id', kind: 'response', declared: true, source: { file: 'R.php', line: 5 } },
    { id: fieldId(eid, 'internal_score'), endpointId: eid, path: 'internal_score', kind: 'response', declared: true, source: { file: 'R.php', line: 5 } }
  );
  return finalizeApiMap(map);
}

describe('ingestSamples', () => {
  it('marks fields observed from a real 2xx body', () => {
    const { map, skipped } = ingestSamples(baseMap(), [
      { method: 'GET', path: '/v1/users', status: 200, body: { data: { id: 1, avatar: 'x' } } },
    ]);
    expect(skipped).toHaveLength(0);
    const observed = map.fields.filter((f) => f.observed).map((f) => f.path).sort();
    expect(observed).toEqual(['data', 'data.avatar', 'data.id']);
    expect(map.endpoints[0].probed).toBe(true);
  });

  it('refuses to learn a contract from an error response', () => {
    const { map, skipped } = ingestSamples(baseMap(), [
      { method: 'GET', path: '/v1/users', status: 401, body: { message: 'Unauthenticated.' } },
    ]);
    expect(skipped).toHaveLength(1);
    expect(map.fields.some((f) => f.observed)).toBe(false);
  });

  it('reconciles a declared field with its wrapped observed path', () => {
    const { map } = ingestSamples(baseMap(), [
      { method: 'GET', path: '/v1/users', status: 200, body: { data: { id: 1 } } },
    ]);
    const wrapped = map.fields.find((f) => f.path === 'data.id');
    expect(wrapped).toMatchObject({ declared: true, observed: true, declaredAs: 'id' });
  });

  it('leaves a genuinely missing field flagged', () => {
    const { map } = ingestSamples(baseMap(), [
      { method: 'GET', path: '/v1/users', status: 200, body: { data: { id: 1 } } },
    ]);
    const missing = undeliveredFields(finalizeApiMap(map));
    expect(missing.map((m) => m.field.path)).toEqual(['internal_score']);
  });
});

describe('reconcileWrappers', () => {
  it('does not reconcile when the suffix is ambiguous', () => {
    const fields: FieldNode[] = [
      { id: 'a', endpointId: 'e', path: 'id', kind: 'response', declared: true },
      { id: 'b', endpointId: 'e', path: 'data.id', kind: 'response', observed: true },
      { id: 'c', endpointId: 'e', path: 'meta.id', kind: 'response', observed: true },
    ];
    const out = reconcileWrappers(fields, new Set(['e']));
    expect(out.find((f) => f.path === 'id')).toBeDefined();
    expect(out.find((f) => f.path === 'data.id')?.declared).toBeUndefined();
  });
});

describe('linkMaps', () => {
  const fe = finalizeApiMap({
    ...createApiMap('fe', '/fe', 'test'),
    screens: [{ id: 'sc_users', label: '/users', route: '/users', source: { file: 'p.tsx', line: 1 } }],
    endpoints: [{ id: endpointId('GET', '/api/v1/users'), method: 'GET', path: '/api/v1/users' }],
    fields: [
      { id: fieldId(endpointId('GET', '/api/v1/users'), 'data.id'), endpointId: endpointId('GET', '/api/v1/users'), path: 'data.id', kind: 'response' },
    ],
    calls: [
      { screenId: 'sc_users', endpointId: endpointId('GET', '/api/v1/users'), via: 'fetch', confidence: 'exact', source: { file: 'p.tsx', line: 3 } },
    ],
    reads: [
      { screenId: 'sc_users', fieldId: fieldId(endpointId('GET', '/api/v1/users'), 'data.id'), confidence: 'guess', source: { file: 'p.tsx', line: 4 } },
    ],
    unresolved: [],
  });

  it('matches a gateway-prefixed frontend path onto the backend route', () => {
    const joined = linkMaps(fe, baseMap(), 'full');
    expect(joined.endpoints).toHaveLength(1);
    expect(joined.endpoints[0].path).toBe('/v1/users');
    expect(joined.calls[0].endpointId).toBe(endpointId('GET', '/v1/users'));
  });

  it('carries the frontend read onto the backend field node', () => {
    const joined = linkMaps(fe, baseMap(), 'full');
    const read = joined.reads[0];
    expect(joined.fields.find((f) => f.id === read.fieldId)?.path).toBe('data.id');
  });

  it('reports backend fields no screen reads', () => {
    const joined = linkMaps(fe, baseMap(), 'full');
    expect(unreadResponseFields(joined).map((a) => a.field.path).sort()).toEqual(['id', 'internal_score']);
  });

  it('claims nothing about an endpoint whose frontend reads were never traced', () => {
    const blind = { ...fe, fields: [], reads: [] };
    const joined = linkMaps(blind, baseMap(), 'full');
    expect(endpointsWithTracedReads(joined).size).toBe(0);
    expect(unreadResponseFields(joined)).toHaveLength(0);
  });

  it('refuses an ambiguous suffix match', () => {
    const candidates = [
      { id: 'a', method: 'GET' as const, path: '/api/v1/users' },
      { id: 'b', method: 'GET' as const, path: '/v2/api/v1/users' },
    ];
    expect(matchEndpointBySuffix(candidates, { id: 'c', method: 'GET', path: '/v1/users' })).toBeNull();
  });

  it('never fuses two verbs of the same resource', () => {
    const candidates = [{ id: 'a', method: 'DELETE' as const, path: '/api/v1/users' }];
    expect(matchEndpointBySuffix(candidates, { id: 'c', method: 'GET', path: '/v1/users' })).toBeNull();
  });
});

describe('lambdaReads', () => {
  it('follows a callback parameter into the field it reads', () => {
    expect(lambdaReads('.map((u) => u.email + u.name)', 4, 'data').sort()).toEqual(['data.email', 'data.name']);
  });

  it('handles a bare parameter', () => {
    expect(lambdaReads('.map(u => u.id)', 4, 'rows')).toEqual(['rows.id']);
  });

  it('returns nothing when there is no callback', () => {
    expect(lambdaReads('.length', 0, 'rows')).toEqual([]);
  });
});

describe('scanBackendFile — laravel route file shapes', () => {
  const ROUTES = `<?php

Route::group(['prefix' => 'v1'], function () {
    Route::group(['middleware' => ['auth', 'company']], function () {
        Route::apiResource('my-files', 'MyFileController', [
            'parameters' => ['my-files' => 'my_file_id']
        ]);
        // Route::post('products/{id}/update-sku', 'ProductController@updateSku');
        # Route::get('legacy', 'LegacyController@index');
        Route::get('reports/{id}', [ReportController::class, 'show']);
    });

    Route::group(['middleware' => 'dodgeprint_auth'], function () {
        Route::post('webhook/{platform}/{shop}', 'WebhookController@handle');
    });

    Route::get('languages', 'TranslationController@languages');
});`;

  const scan = scanBackendFile('routes/api.php', ROUTES, 'laravel');
  const paths = scan.routes.map((r) => `${r.method} ${r.path}`);

  it('expands a resource whose controller is a quoted string', () => {
    expect(paths).toEqual(
      expect.arrayContaining([
        'GET /v1/my-files',
        'POST /v1/my-files',
        'GET /v1/my-files/{param}',
        'PUT /v1/my-files/{param}',
        'DELETE /v1/my-files/{param}',
      ])
    );
  });

  it('leaves a commented-out route out of the map', () => {
    expect(paths.some((p) => p.includes('update-sku'))).toBe(false);
    expect(paths.some((p) => p.includes('legacy'))).toBe(false);
  });

  it('reads auth from the enclosing group, however far above it sits', () => {
    expect(scan.routes.find((r) => r.path === '/v1/reports/{param}')?.auth).toBe(true);
    expect(scan.routes.find((r) => r.path === '/v1/my-files')?.auth).toBe(true);
  });

  it('counts a project-named guard like `dodgeprint_auth` as auth', () => {
    expect(scan.routes.find((r) => r.path === '/v1/webhook/{param}/{param}')?.auth).toBe(true);
  });

  it('reports a route outside every guarded group as open', () => {
    expect(scan.routes.find((r) => r.path === '/v1/languages')?.auth).toBe(false);
  });
});

describe('laravelRouteFilePrefixes', () => {
  const PROVIDER = `<?php
class RouteServiceProvider extends ServiceProvider
{
    public function boot()
    {
        $this->routes(function () {
            Route::prefix('api')
                ->middleware('api')
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->group(base_path('routes/web.php'));

            // Route::prefix('legacy')->group(base_path('routes/legacy.php'));
        });
    }
}`;

  const BOOTSTRAP = `<?php
return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v2',
        commands: __DIR__.'/../routes/console.php',
    )
    ->create();`;

  it('reads the prefix the provider mounts a route file under', () => {
    const found = laravelRouteFilePrefixes([{ file: 'app/Providers/RouteServiceProvider.php', content: PROVIDER }]);
    expect(found.get('routes/api.php')).toBe('/api');
    expect(found.get('routes/web.php')).toBe('');
  });

  it('ignores a mount that is commented out', () => {
    const found = laravelRouteFilePrefixes([{ file: 'app/Providers/RouteServiceProvider.php', content: PROVIDER }]);
    expect(found.has('routes/legacy.php')).toBe(false);
  });

  it('reads the Laravel 11 bootstrap form, apiPrefix included', () => {
    const found = laravelRouteFilePrefixes([{ file: 'bootstrap/app.php', content: BOOTSTRAP }]);
    expect(found.get('routes/api.php')).toBe('/api/v2');
    expect(found.get('routes/web.php')).toBe('');
  });

  it('defaults the api mount to /api when no apiPrefix is given', () => {
    const plain = BOOTSTRAP.replace("        apiPrefix: 'api/v2',\n", '');
    expect(laravelRouteFilePrefixes([{ file: 'bootstrap/app.php', content: plain }]).get('routes/api.php')).toBe('/api');
  });
});

describe('resource actions restricted by only/except', () => {
  const ROUTES = `<?php
Route::apiResource('stocks', 'StockController', [
    'parameters' => ['stocks' => 'stock_id']
])->only(['index']);
Route::apiResource('menus', MenuController::class)->except(['destroy']);
Route::apiResource('plain', PlainController::class);`;

  const scan = scanBackendFile('routes/api.php', ROUTES, 'laravel');
  const of = (base: string) => scan.routes.filter((r) => r.path.startsWith(`/${base}`)).map((r) => r.method).sort();

  it('emits only the actions named by ->only', () => {
    expect(of('stocks')).toEqual(['GET']);
  });

  it('drops the actions named by ->except across a multi-line call', () => {
    expect(of('menus').filter((m) => m === 'DELETE')).toEqual([]);
  });

  it('still emits every action when the resource is unrestricted', () => {
    expect(of('plain')).toEqual(['DELETE', 'GET', 'GET', 'PATCH', 'POST', 'PUT']);
  });

  it('answers update on PATCH as well as PUT', () => {
    expect(of('menus')).toEqual(['GET', 'GET', 'PATCH', 'POST', 'PUT']);
  });
});

describe('laravel auth is read from the middleware slot only', () => {
  const ROUTES = `<?php
Route::group(['prefix' => 'v1'], function () {
    Route::post('sign-in', [\\App\\Http\\Controllers\\AuthController::class, 'signIn']);
    Route::group(['middleware' => ['auth', 'company']], function () {
        Route::get('orders', 'OrderController@index');
    });
    Route::group(['middleware' => 'webhook_managements'], function () {
        Route::post('webhooks/{platform}/{shop}', 'WebhookController@handle');
    });
    Route::middleware('catalog_auth')->group(function () {
        Route::get('ctl-sites', 'SiteController@index');
    });
});`;

  const scan = scanBackendFile('routes/api.php', ROUTES, 'laravel');
  const authOf = (path: string) => scan.routes.find((r) => r.path === path)?.auth;

  it('does not call a login endpoint guarded just because its controller is named Auth', () => {
    expect(authOf('/v1/sign-in')).toBe(false);
  });

  it('reads a guard out of the enclosing group', () => {
    expect(authOf('/v1/orders')).toBe(true);
  });

  it('reads the fluent Route::middleware form too', () => {
    expect(authOf('/v1/ctl-sites')).toBe(true);
  });

  it('leaves a gate it cannot classify undefined rather than calling it open', () => {
    expect(authOf('/v1/webhooks/{param}/{param}')).toBeUndefined();
  });
});

describe('verb outside the union', () => {
  // cm:why `as MapMethod` used to let this through: HttpMethod had no OPTIONS, so the type claimed
  // a value that could not exist while the scanner happily produced it.
  it('keeps OPTIONS and turns an unpinnable verb into UNKNOWN', () => {
    expect(toMapMethod('options')).toBe('OPTIONS');
    expect(toMapMethod('GET')).toBe('GET');
    expect(toMapMethod('any')).toBe('UNKNOWN');
    expect(toMapMethod('all')).toBe('UNKNOWN');
    expect(toMapMethod(' patch ')).toBe('PATCH');
  });

  it('emits OPTIONS from a Laravel route instead of a value off the union', () => {
    const scan = scanBackendFile('routes/api.php', "<?php\nRoute::options('/ping', 'PingController@options');\n", 'laravel');
    expect(scan.routes.map((r) => r.method)).toContain('OPTIONS');
  });
});

// cm:why A route declared as DATA is not a Strapi peculiarity. Measured on a real Hono API, every
// mount is `.get(declared(SPEC), h)` with no literal at the call site: the verb-call readers found 2
// of 106 routes, and the other 104 sat in a plain exported array the reader never looked at.
describe('routes declared as object literals', () => {
  it('reads a manifest of { method, path } literals in a node repo', () => {
    const src = [
      "export const ROUTES = [",
      "  { method: 'GET', path: '/health', protection: { kind: 'public', reason: 'liveness' } },",
      "  { method: 'POST', path: '/auth/login', protection: { kind: 'public', reason: 'mints a session' } },",
      "  { method: 'PATCH', path: '/projects/:id/policy', protection: { kind: 'project', action: 'policy.write' } },",
      "]",
    ].join('\n');
    const out = scanBackendFile('src/surface.ts', src, 'node');
    const seen = out.routes.map((r) => `${r.method} ${r.path}`).sort();
    expect(seen).toEqual(['GET /health', 'PATCH /projects/{param}/policy', 'POST /auth/login']);
  });

  // cm:guard A declared protection beats the name heuristic: this API states the gate on every route,
  // and reading `middlewareFor(SPEC.protection)` as nothing reported guarded routes as open.
  it('takes the gate from the declared protection, and only public clears it', () => {
    const src = [
      "const A = { method: 'GET', path: '/health', protection: { kind: 'public', reason: 'probe' } }",
      "const B = { method: 'GET', path: '/me', protection: { kind: 'session' } }",
      "const C = { method: 'GET', path: '/x', protection: { kind: 'somethingNew' } }",
    ].join('\n');
    const gate = new Map(scanBackendFile('src/surface.ts', src, 'node').routes.map((r) => [r.path, r.auth]));
    // cm:why `false` and undefined are different answers: a route DECLARED public is known to have no
    // gate, which is not the same as a route whose gate could not be found.
    expect(gate.get('/health')).toBe(false);
    expect(gate.get('/me')).toBe(true);
    expect(gate.get('/x')).toBe(true);
  });

  it('follows a const to its path when the mount takes no literal', () => {
    const src = [
      "const HEALTH = { method: 'GET', path: '/health', protection: { kind: 'public', reason: 'probe' } }",
      "const PATCH_POLICY = { method: 'PATCH', path: '/projects/:id/policy', protection: { kind: 'project' } }",
      "const app = new Hono()",
      "  .get(declared(HEALTH), (c) => c.json({ ok: true }))",
      "  .patch(declared(PATCH_POLICY), ...patchPolicyRoute)",
    ].join('\n');
    const out = scanBackendFile('src/index.ts', src, 'node');
    const mounted = out.routes.filter((r) => r.source.line >= 4);
    expect(mounted.map((r) => `${r.method} ${r.path}`)).toEqual(['GET /health', 'PATCH /projects/{param}/policy']);
  });

  // cm:guard A fixture must never become part of the surface: `src/surface.test.ts` held a
  // { method: 'GET', path: '/nope-not-declared' } literal, and it was published as an endpoint.
  it('never reads a test file beside the code it tests', () => {
    expect(isBackendFile('src/surface.test.ts')).toBe(false);
    expect(isBackendFile('src/routes/policy.spec.tsx')).toBe(false);
    expect(isBackendFile('internal/api/server_test.go')).toBe(false);
    expect(isBackendFile('src/surface.ts')).toBe(true);
  });
});
