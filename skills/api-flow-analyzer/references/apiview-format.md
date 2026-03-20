# .apiview File Format Reference

## TypeScript Interface

```typescript
interface ApiViewFile {
  version: 1;
  metadata: { name: string; createdAt: string; updatedAt: string; };
  nodes: CoreApiNode[];
  edges: CoreFlowEdge[];
  environments: Environment[];
  activeEnvironmentName: string;
}

interface CoreApiNode {
  id: string;
  type?: string;           // Always "apiNode"
  position: { x: number; y: number };
  data: {
    label: string;
    description?: string;
    config: {
      method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
      url: string;
      headers: { key: string; value: string; enabled: boolean }[];
      params: { key: string; value: string; enabled: boolean }[];
      body: string;        // JSON string or ""
    };
  };
}

interface CoreFlowEdge {
  id: string;
  source: string;
  target: string;
}

interface Environment {
  name: string;
  variables: { key: string; value: string; enabled: boolean }[];
}
```

## Validation Checklist

Before writing each file:
1. `version` is `1` (number)
2. `metadata.name` non-empty
3. `createdAt`/`updatedAt` are ISO 8601
4. Every node has unique `id` and `type: "apiNode"`
5. Every `config.method` is uppercase HTTP method
6. `headers`, `params` are arrays
7. `body` is a string
8. Every edge references valid node IDs
9. `environments` non-empty
10. `activeEnvironmentName` matches an environment

## Complete Example

Input:
```php
// routes/api.php
Route::prefix('api')->middleware(['auth:sanctum'])->group(function () {
    Route::apiResource('users', UserController::class);
});

// app/Http/Requests/StoreUserRequest.php rules():
// 'name' => 'required|string', 'email' => 'required|email', 'role' => 'required|in:admin,user'
```

Output — `user-management.apiview`:
```json
{
  "version": 1,
  "metadata": {
    "name": "User Management",
    "createdAt": "2026-03-20T00:00:00Z",
    "updatedAt": "2026-03-20T00:00:00Z"
  },
  "nodes": [
    {
      "id": "node_1", "type": "apiNode",
      "position": { "x": 200, "y": 100 },
      "data": {
        "label": "List Users",
        "config": {
          "method": "GET", "url": "{{base_url}}/api/users",
          "headers": [
            { "key": "Accept", "value": "application/json", "enabled": true },
            { "key": "Authorization", "value": "Bearer {{token}}", "enabled": true }
          ],
          "params": [], "body": ""
        }
      }
    },
    {
      "id": "node_2", "type": "apiNode",
      "position": { "x": 200, "y": 300 },
      "data": {
        "label": "Create User",
        "config": {
          "method": "POST", "url": "{{base_url}}/api/users",
          "headers": [
            { "key": "Accept", "value": "application/json", "enabled": true },
            { "key": "Content-Type", "value": "application/json", "enabled": true },
            { "key": "Authorization", "value": "Bearer {{token}}", "enabled": true }
          ],
          "params": [],
          "body": "{\"name\":\"example_string\",\"email\":\"user@example.com\",\"role\":\"admin\"}"
        }
      }
    },
    {
      "id": "node_3", "type": "apiNode",
      "position": { "x": 200, "y": 500 },
      "data": {
        "label": "Get User",
        "config": {
          "method": "GET", "url": "{{base_url}}/api/users/{{user_id}}",
          "headers": [
            { "key": "Accept", "value": "application/json", "enabled": true },
            { "key": "Authorization", "value": "Bearer {{token}}", "enabled": true }
          ],
          "params": [{ "key": "user_id", "value": "1", "enabled": true }],
          "body": ""
        }
      }
    },
    {
      "id": "node_4", "type": "apiNode",
      "position": { "x": 200, "y": 700 },
      "data": {
        "label": "Update User",
        "config": {
          "method": "PUT", "url": "{{base_url}}/api/users/{{user_id}}",
          "headers": [
            { "key": "Accept", "value": "application/json", "enabled": true },
            { "key": "Content-Type", "value": "application/json", "enabled": true },
            { "key": "Authorization", "value": "Bearer {{token}}", "enabled": true }
          ],
          "params": [{ "key": "user_id", "value": "1", "enabled": true }],
          "body": "{\"name\":\"example_string\",\"email\":\"user@example.com\",\"role\":\"admin\"}"
        }
      }
    },
    {
      "id": "node_5", "type": "apiNode",
      "position": { "x": 200, "y": 900 },
      "data": {
        "label": "Delete User",
        "config": {
          "method": "DELETE", "url": "{{base_url}}/api/users/{{user_id}}",
          "headers": [
            { "key": "Accept", "value": "application/json", "enabled": true },
            { "key": "Authorization", "value": "Bearer {{token}}", "enabled": true }
          ],
          "params": [{ "key": "user_id", "value": "1", "enabled": true }],
          "body": ""
        }
      }
    }
  ],
  "edges": [
    { "id": "edge_1_2", "source": "node_1", "target": "node_2" },
    { "id": "edge_2_3", "source": "node_2", "target": "node_3" },
    { "id": "edge_3_4", "source": "node_3", "target": "node_4" },
    { "id": "edge_4_5", "source": "node_4", "target": "node_5" }
  ],
  "environments": [
    {
      "name": "Local",
      "variables": [
        { "key": "base_url", "value": "http://localhost:8000", "enabled": true },
        { "key": "token", "value": "your-token-here", "enabled": true },
        { "key": "user_id", "value": "1", "enabled": true }
      ]
    }
  ],
  "activeEnvironmentName": "Local"
}
```
