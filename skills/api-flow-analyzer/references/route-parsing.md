# Route Parsing Reference

## Standard Routes

```php
Route::{method}('{path}', [{Controller}::class, '{action}'])
Route::{method}('{path}', '{Controller}@{action}')
```

Methods: `get`, `post`, `put`, `patch`, `delete`, `options`, `any`.

## Resource Routes

```php
Route::apiResource('users', UserController::class);
// Expands to: index(GET), store(POST), show(GET), update(PUT), destroy(DELETE)

Route::resource('users', UserController::class);
// Additionally: create(GET), edit(GET)
```

Handle `.only([...])` and `.except([...])` chaining.

## Route Groups

```php
Route::prefix('api/v1')->middleware(['auth:sanctum'])->group(function () {
    Route::get('/users', [UserController::class, 'index']);
});
```

Concatenate prefixes from all parent groups. Track middleware from all levels.

## Nested Resources

```php
Route::apiResource('posts.comments', CommentController::class);
// → /posts/{post}/comments, /posts/{post}/comments/{comment}
```

Track all path parameters.

## Invokable Controllers

```php
Route::post('/webhook', WebhookController::class);
```

Action method is `__invoke`. Label: controller name without "Controller" suffix.

## Subdirectory Controllers

```php
use App\Http\Controllers\Api\V1\UserController;
```

Map namespace to path: `app/Http/Controllers/Api/V1/UserController.php`.

## Route Model Binding

```php
public function show(User $user)
```

Parameter `user` maps to `{user}` in route. Use `{{user_id}}` in generated URL.

## Auth Middleware Mapping

| Middleware | Header |
|---|---|
| `auth:sanctum` | `Authorization: Bearer {{token}}` |
| `auth:api` | `Authorization: Bearer {{token}}` |
| `auth` | `Authorization: Bearer {{token}}` |
| (none) | Omit Authorization header |

## Query Parameters

If controller uses `$request->query('page')` pattern, add:
```json
{ "key": "page", "value": "1", "enabled": false }
{ "key": "per_page", "value": "15", "enabled": false }
```

Set `enabled: false` for optional params.

## Skip Rules
- Closure routes (no controller) → skip, note in summary
- Missing controller file → skip, note in summary
- Missing action method → skip, note in summary
