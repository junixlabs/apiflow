# API View — Claude Code Integration & Skill Vision

## 1. Expanded Problem

Mọi backend project = tập hợp nhiều workflow nhỏ: user registration, order processing, payment, inventory sync, deployment pipeline... Mỗi workflow gồm chuỗi API calls có thứ tự, phụ thuộc data lẫn nhau.

**Vấn đề hiện tại:**
- Không có tool nào **phân tích code → tự sinh flow → test → overview** trong 1 pipeline
- Developer phải manually tạo flow cho từng endpoint — tốn thời gian, dễ thiếu sót
- Khi code thay đổi, flow không tự cập nhật → documentation drift
- Không có cái nhìn tổng quan: bao nhiêu workflow, endpoint nào chưa có flow, flow nào đang fail

**Giải pháp:** 3 thành phần tích hợp — auto-analyze codebase, chạy flow qua MCP, visual review trên Web UI.

---

## 2. System Architecture (3 Components)

```
[Claude Code Skill — Laravel Analyzer]
  │  Reads: routes/api.php, Controllers/, Services/, Models/, Jobs/
  │  Outputs: .apiview flow files
  │
  ▼
[API View MCP Server] ←── stdio ──→ [Claude Code CLI]
  │  Tools: create_flow, run_flow, inspect_node, open_ui...
  │  Resources: flow://current, flow://results
  │
  ▼
[API View Web UI] ←── HTTP ──→ [Browser]
  │  Canvas, Inspector, Project Overview
  │
  ▼
[Core Engine] (shared by MCP + Web UI)
  │  Execution, Variable resolution, Flow CRUD, File I/O
```

**Data flow:**
1. Skill phân tích Laravel codebase → sinh `.apiview` files vào `flows/`
2. MCP Server load `.apiview` files → expose tools cho Claude Code
3. Claude Code gọi `run_flow` → Core Engine execute → trả kết quả
4. Web UI đọc cùng `.apiview` files + results → render canvas

---

## 3. Component 1: Claude Code Skill (Laravel Analyzer)

### Input
Laravel project source code trong working directory.

### Process

1. **Parse routes** — Đọc `routes/api.php` + `routes/web.php`
   - Extract: method, URL pattern, middleware, controller@action
   - Group by prefix/middleware group

2. **Trace controller → service** — Với mỗi endpoint:
   - `app/Http/Controllers/` → tìm method → identify Service injection
   - `app/Services/` → business logic, external API calls (Http::, Guzzle)
   - `app/Jobs/` → async workflows dispatched từ controller/service

3. **Identify data flow**
   - DB queries (Eloquent) → data transforms → response structure
   - External API calls: URL, method, payload pattern
   - Cross-service calls: Service A → Service B

4. **Extract request details**
   - `app/Http/Requests/` → validation rules → generate example request body
   - `app/Models/` → relationships → understand data structure
   - `config/services.php` → third-party API configs
   - `.env` → environment variables cần thiết

5. **Group endpoints thành workflows**
   - Related endpoints (cùng resource, cùng feature) → 1 flow
   - Detect dependency chain: endpoint A output → endpoint B input

6. **Generate `.apiview` flow files**
   - Mỗi workflow → 1 file trong `flows/`
   - Nodes cho mỗi API endpoint trong flow
   - Connections theo thứ tự logic
   - Example request body từ validation rules
   - Environment variables từ `.env`

### Output
```
flows/
├── user-registration.apiview
├── product-deploy-woocommerce.apiview
├── order-sync-shopify.apiview
├── payment-processing.apiview
└── inventory-management.apiview
```

### Laravel-Specific Parsing Map

| Source | Extract |
|--------|---------|
| `routes/api.php`, `routes/web.php` | Endpoints: method, URL, middleware, controller |
| `app/Http/Controllers/` | Method → Service injection → business logic entry |
| `app/Services/` | Business logic, external API calls, cross-service deps |
| `app/Models/` | Relationships, data structure, scopes |
| `app/Jobs/` | Async workflows, queue connections |
| `app/Http/Requests/` | Validation rules → example body generation |
| `config/services.php` | Third-party API configs (keys, URLs) |
| `.env` | Environment variables for flow execution |

---

## 4. Component 2: MCP Server

### MCP Tools (12)

| Tool | Description | Use Case |
|------|-------------|----------|
| `create_flow` | Tạo flow mới từ name + description | Skill tạo flow từ analysis |
| `add_node` | Thêm API node vào flow | Build flow programmatically |
| `configure_node` | Config node (method, url, headers, body) | Set request details |
| `connect_nodes` | Nối 2 nodes (source → target) | Define execution order |
| `run_flow` | Chạy toàn bộ flow | Auto-test, batch testing |
| `run_node` | Chạy 1 node cụ thể | Debug single endpoint |
| `inspect_node` | Xem response chi tiết (headers, body, timing) | Debug data shape |
| `list_flows` | Liệt kê tất cả flows trong project | Overview, discovery |
| `open_flow` | Load flow file đã lưu | Resume work |
| `delete_flow` | Xóa flow | Cleanup |
| `export_flow` | Export flow (cURL commands, PNG) | Documentation |
| `open_ui` | Mở Web UI trong browser | Visual inspection |

### MCP Resources

| Resource URI | Description |
|--------------|-------------|
| `flow://current` | Flow đang active trong session |
| `flow://results` | Kết quả chạy gần nhất |
| `flow://{name}` | Flow đã lưu theo tên |

### Transport
- **stdio** — Claude Code native support, không cần HTTP server
- Protocol: JSON-RPC 2.0
- SDK: `@modelcontextprotocol/sdk`

---

## 5. Component 3: Project Overview (Web UI Extension)

Dashboard trong Web UI hiển thị toàn cảnh project:

- **Flow summary** — Tổng số flows, last run timestamp
- **Pass/Fail status** — Mỗi flow: passed / failed / not run
- **API coverage** — Endpoints nào đã có flow, endpoints nào chưa có
- **Flow dependency map** — Flows nào share API endpoints
- **Last run results** — Batch run summary với drill-down

---

## 6. Use Cases

### UC1: Full Auto-Analyze → Generate → Test

```
User: Phân tích project và tạo flow cho tất cả API workflows

Claude: [Skill chạy Laravel Analyzer]
        Phân tích routes/api.php → 42 endpoints
        Grouped thành 15 workflows
        Đã tạo 15 flow files:
        → flows/user-registration.apiview (3 nodes)
        → flows/product-deploy-woocommerce.apiview (4 nodes)
        → flows/order-sync-shopify.apiview (5 nodes)
        → flows/payment-processing.apiview (3 nodes)
        ...

User: Chạy tất cả

Claude: [run_flow × 15]
        ✅ 12/15 flows passed
        ❌ 3 flows failed:
          - order-sync: node "Get Orders" → 401 Unauthorized
          - payment: node "Charge" → 500 timeout
          - inventory: node "Update Stock" → 422 validation error
```

### UC2: Debug Specific Flow

```
User: Debug flow order-sync

Claude: [inspect_node "Get Orders"]
        Request: GET /api/orders?platform=shopify
        Headers: Authorization: Bearer {{SHOPIFY_TOKEN}}
        Response: 401 — {"error": "token expired"}

        → Token trong environment đã hết hạn, cần refresh.
        Cập nhật SHOPIFY_TOKEN trong .env rồi chạy lại?
```

### UC3: Planning New Feature

```
User: Tôi cần build tính năng sync inventory với Lazada

Claude: Dựa trên codebase hiện tại, flow sẽ gồm:
        1. GET /api/products → lấy inventory local
        2. GET /api/shops/{id} → lấy Lazada credentials
        3. POST /api/inventory/sync → collect + transform + call Lazada API

        [create_flow "lazada-inventory-sync"]
        [add_node × 3 + connect_nodes × 2]
        [open_ui]

        Đã mở browser để review flow trước khi code.
```

### UC4: Regenerate After Code Changes

```
User: Tôi vừa refactor OrderService, cập nhật lại flows

Claude: [Skill re-analyze OrderService]
        Phát hiện thay đổi:
        - order-sync.apiview: endpoint /api/orders/sync đổi thành /api/v2/orders/sync
        - order-create.apiview: thêm node "Validate Inventory" trước "Create Order"

        Đã cập nhật 2 flow files. Chạy lại để verify?
```

---

## 7. User Stories (Epic 7: Claude Code Integration)

### US-7.1: Auto-Analyze Codebase → Generate All Flows

**As a** backend developer
**I want to** Claude phân tích Laravel codebase và tự tạo flow files
**So that** tôi có full API flow coverage mà không cần tạo thủ công

**Acceptance Criteria:**
- Skill đọc routes, controllers, services thành công
- Sinh `.apiview` files đúng format, load được trong Web UI
- Mỗi flow có nodes, connections, và example request body

### US-7.2: Run All Flows và Xem Summary

**As a** backend developer
**I want to** chạy tất cả flows và xem tổng kết pass/fail
**So that** tôi biết ngay trạng thái overall của project APIs

**Acceptance Criteria:**
- `run_flow` chạy được batch (tất cả flows)
- Summary hiển thị: total, passed, failed, với chi tiết lỗi
- Kết quả lưu lại để xem trong Web UI

### US-7.3: Debug Flow Cụ Thể Qua Claude Conversation

**As a** backend developer
**I want to** hỏi Claude debug 1 flow bị fail
**So that** Claude inspect response, phân tích lỗi, gợi ý fix

**Acceptance Criteria:**
- `inspect_node` trả về full request/response details
- Claude phân tích được root cause từ response
- Gợi ý actionable fix (update env, fix code, etc.)

### US-7.4: Create Flow Cho Feature Mới (Planning)

**As a** backend developer
**I want to** mô tả feature mới → Claude tạo flow draft
**So that** tôi visualize API chain trước khi code

**Acceptance Criteria:**
- Claude tạo flow dựa trên mô tả + existing codebase context
- Flow mở được trong Web UI để review
- Có thể edit flow trong UI trước khi implement

### US-7.5: Xem Project Overview Trong Web UI

**As a** backend developer
**I want to** mở dashboard xem tổng quan tất cả flows
**So that** tôi biết API coverage, status, và dependencies

**Acceptance Criteria:**
- Dashboard hiển thị tất cả flows + status
- API coverage: % endpoints có flow
- Click vào flow → mở canvas chi tiết

### US-7.6: Regenerate Flows Khi Code Thay Đổi

**As a** backend developer
**I want to** re-run analyzer khi code thay đổi
**So that** flows luôn sync với code thực tế

**Acceptance Criteria:**
- Skill detect thay đổi so với flow hiện tại
- Chỉ update flows bị ảnh hưởng, không regenerate tất cả
- Hiển thị diff: thay đổi gì trong mỗi flow
