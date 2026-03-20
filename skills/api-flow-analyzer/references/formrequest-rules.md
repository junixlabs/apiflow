# FormRequest Validation Rules → Example Values

## Location

FormRequest files: `app/Http/Requests/{Name}.php`

Detect in controller method signature:
```php
public function store(StoreUserRequest $request)
// If type is NOT Request or Illuminate\Http\Request → it's a FormRequest
```

## Rule Mapping Table

| Rule | Example value |
|---|---|
| `string` | `"example_string"` |
| `email` | `"user@example.com"` |
| `integer`, `numeric` | `1` |
| `boolean` | `true` |
| `array` | `[]` |
| `date` | `"2026-01-01"` |
| `url` | `"https://example.com"` |
| `uuid` | `"550e8400-e29b-41d4-a716-446655440000"` |
| `ip` | `"127.0.0.1"` |
| `json` | `"{}"` |
| `file`, `image` | skip (not JSON body) |
| `in:val1,val2,...` | first value: `"val1"` |
| `exists:{table},{col}` | `1` |
| `confirmed` | duplicate field + `_confirmation` suffix |
| `nullable` (no type) | `null` |
| `min:{n}` + `string` | string of length n |
| `max:{n}` + `integer` | `n` |
| `regex:{pattern}` | `"matching_string"` |

## Nested Fields

```php
'items.*.name' => 'required|string'
// → {"items": [{"name": "example_string"}]}

'address.city' => 'required|string'
// → {"address": {"city": "example_string"}}
```

## Fallbacks

- FormRequest not found → body = `""`
- `rules()` method not parseable → body = `""`
- Unknown rule type → use `"example_value"`
