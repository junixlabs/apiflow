# Laravel

Markers: `artisan`, `routes/`, `app/Http/Controllers/`.

## Routes (skill.md §3)

`routes/api.php` first, `routes/web.php` as fallback. Full grammar — groups,
prefixes, `Route::resource` expansion, `apiResource`, model binding, edge cases:
[../route-parsing.md](../route-parsing.md).

Auth: a route is authenticated when its middleware stack contains `auth`,
`auth:sanctum`, `auth:api`, or a guard alias defined in `app/Http/Kernel.php`.

Closure routes have no named handler — they go straight to the unresolved list.

## Handlers (§4)

`app/Http/Controllers/{Controller}.php`, one method per action.

- **Request shape** — the action's first parameter. If its type is `Request`
  there is no schema; if it is anything else it is a FormRequest, read
  `app/Http/Requests/{Name}.php` and parse `rules()`.
- **Injected services** — constructor parameters.
- **Outbound calls** — `Http::get/post/...` (Laravel HTTP client) or Guzzle.
- **Response** — `response()->json(...)` or an API Resource class.

## Bodies (§5)

Rule-string → example-value table: [../formrequest-rules.md](../formrequest-rules.md).

Validation declared inline via `$request->validate([...])` counts as a schema —
parse it the same way.

## Grouping (§7)

One workflow per controller. `UserController` → `user-management.apiview`.

A CRUD starting point is at [../../assets/laravel-crud.json](../../assets/laravel-crud.json).

## Gotchas

- `Route::resource` generates seven routes, `apiResource` five. Enumerate the
  expansion, do not emit one node for the macro.
- Sanctum/Passport add routes from the package, not from `routes/`. Note them as
  present but out of scope unless asked.
