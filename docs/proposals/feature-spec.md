# API View — Feature Specification

Status legend: DONE = implemented, PARTIAL = partially done, PLANNED = not yet started

---

## F1: Visual Flow Canvas — DONE

### Mô tả
Canvas kéo thả cho phép developer tạo, sắp xếp, và kết nối các API node để hình thành flow.

### Yêu cầu chi tiết

**Canvas:**
- Infinite canvas với zoom và pan — DONE
- Grid background (dots) — DONE
- Mini-map cho flow lớn — PLANNED (Phase 3)
- Multi-select nodes — PARTIAL (Delete key works, no Shift+Click group select)

**Node types:**
- API node: method badge, URL, status indicator — DONE
- Annotation node: editable text, no handles — DONE (Phase 2)
- Group frame node: resizable dashed rectangle with title — DONE (Phase 2)

**Node display:**
- Method badge (GET=xanh lá, POST=vàng, PUT=cam, DELETE=đỏ, PATCH=tím) — DONE
- URL (truncated nếu dài) — DONE
- Tên tùy chỉnh (label) — DONE
- Status indicator sau khi chạy (success/error/running/idle) — DONE
- Description icon nếu có notes — DONE (Phase 2)
- Input port (trái) + Output port (phải) — DONE

**Connection:**
- Đường nối giữa output port → input port — DONE
- Animated dash khi đang thực thi — DONE
- Màu: xám (idle), xanh (success), đỏ (error), xanh dương animated (running) — DONE

---

## F2: Node Configuration Panel — DONE

### Mô tả
Side panel bên phải (resizable) hiển thị khi click vào node, cho phép cấu hình chi tiết API call.

### Yêu cầu chi tiết

**Tabs:**

| Tab | Nội dung | Status |
|-----|----------|--------|
| Config | Label, Description, Method, URL, Headers, Params, Body | DONE |
| Request | Resolved request (URL, headers, body after variable resolution) | DONE |
| Response | Status, headers, body, timing, size | DONE |

Note: Config tab is a single view with all fields (not separate sub-tabs). Authentication is handled via Headers key-value editor.

**Body JSON editor:**
- Plain textarea with custom JSON validation (not Monaco) — DONE
- Real-time validation: Valid / Invalid / JSON+vars status — DONE
- Format (pretty-print) and Minify buttons, variable-aware — DONE
- Tab key inserts 2 spaces — DONE
- Full-screen expand modal with line numbers — DONE

**KeyValueEditor (Headers, Params):**
- Key-value rows with enable/disable checkbox — DONE
- Ghost row auto-add when typing in last row — DONE
- Bulk edit mode (paste Key: Value per line) — DONE
- 35/65 key/value column ratio — DONE

**Variable resolution:**
- Syntax: `{{variable_name}}` cho environment variables — DONE
- Syntax: `{{nodes["Node Name"].response.body.path}}` cho dynamic variables — DONE (Phase 2)
- Autocomplete popup khi gõ `{{` — DONE (Phase 2)

**Inspector panel:**
- Resizable (320-800px), width persisted to localStorage — DONE

---

## F3: Flow Execution Engine — DONE

### Mô tả
Engine thực thi flow theo thứ tự topological, hỗ trợ sequential và parallel execution.

### Yêu cầu chi tiết

**Execution logic:**
1. Parse flow graph → topological sort (Kahn's algorithm) — DONE
2. Node không có incoming connection → bắt đầu — DONE
3. Nodes cùng level → chạy parallel (Promise.allSettled) — DONE
4. Stop on first error (mark remaining as idle) — DONE

**Execution modes:**
- **Run All** — Chạy toàn bộ flow — DONE
- **Run This Node** — Chạy 1 node riêng lẻ — DONE
- **Step-by-Step** — Chạy từng level, dừng giữa mỗi bước — DONE (Phase 2)
- **Run From Here** — PLANNED

**Error handling:**
- Node lỗi → đánh dấu đỏ — DONE
- Stop on Error (mặc định) — DONE
- Continue on Error option — PLANNED

**Execution results:**
- Lưu kết quả lần chạy gần nhất cho mỗi node (in-memory) — DONE
- Request history per node (multiple runs stored) — PLANNED (Phase 3)

---

## F4: Response Inspector — DONE

### Mô tả
Panel hiển thị chi tiết request đã gửi và response nhận được cho mỗi node.

### Yêu cầu chi tiết

**Request view:**
- Full URL (đã resolve variables) — DONE
- Method badge — DONE
- Headers (collapsible) — DONE
- Body (parsed JSON via JsonTreeView, fallback to raw text) — DONE

**Response view:**
- Status code badge + status text — DONE
- Response headers (collapsible) — DONE
- Response body: JSON tree/raw, plain text, null fallback — DONE
- Response size (bytes) + total duration (ms) — DONE
- Body type label (JSON / Text) — DONE
- Copy body button — DONE

**JSON Viewer (shared component for all JSON display):**
- Tree / Raw view toggle (default: Raw) — DONE
- Search/filter with match highlighting — DONE
- Copy to clipboard — DONE
- Copy JSONPath on hover ($) — DONE
- Expand / Collapse all — DONE
- Collapsed preview (first 3 keys for objects, first items for arrays) — DONE
- Full-screen expand modal with line numbers — DONE
- Line numbers in raw view — DONE

**Not implemented:**
- Timing breakdown (DNS, Connect, TLS, TTFB) — proxy only returns total duration
- HTML rendered preview — PLANNED

---

## F5: Environment Management — DONE

### Mô tả
Quản lý biến môi trường cho phép switch context giữa local, staging, production.

### Yêu cầu chi tiết

**Environment:**
- Tạo nhiều environment (add/delete/switch) — DONE
- Mỗi environment là tập key-value pairs with enable/disable — DONE
- Switch bằng dropdown ở toolbar — DONE
- Active environment apply cho tất cả node trong flow — DONE

**Variables:**
- Environment-specific variables — DONE
- Global variables (shared across environments) — PLANNED
- Sensitive variable flag (masked display) — PLANNED

**Built-in variables:**
- `{{$timestamp}}`, `{{$randomUUID}}`, `{{$randomInt}}` — PLANNED

---

## F6: Flow Persistence & Sharing — DONE

### Mô tả
Lưu trữ và quản lý flow files.

### Yêu cầu chi tiết

**File format:**
- `.apiview` extension (JSON) — DONE
- Schema: version, metadata, nodes[], edges[], environments[], activeEnvironmentName — DONE

**Storage:**
- Save/Load via File System Access API with fallback — DONE
- Auto-save draft to localStorage mỗi 30 giây — DONE (Phase 2)
- Restore banner on reload if draft found — DONE (Phase 2)

**Flow Library:**
- Grid view hiển thị danh sách flow (localStorage) — DONE (Phase 2)
- Search theo tên — DONE (Phase 2)
- Sort theo date — DONE (Phase 2)
- Quick actions: Open, Duplicate, Delete — DONE (Phase 2)

---

## F7: Import Capabilities — PARTIAL

### Yêu cầu chi tiết

**cURL import:**
- Paste cURL command → parse thành node config — DONE (Phase 2)
- Hỗ trợ flags: `-X`, `-H`, `-d`, `--data-raw`, `-u` — DONE
- Auto-format JSON body on import — DONE
- Handle unknown flags gracefully — DONE

**OpenAPI/Swagger import:** — PLANNED (Phase 3)

**Postman collection import:** — PLANNED (Phase 3)

---

## F8: Export & Documentation — PARTIAL

### Yêu cầu chi tiết

**Image export:**
- PNG export — DONE (Phase 2)
- SVG export — DONE (Phase 2)

**Data export:**
- Export → Postman collection — PLANNED (Phase 3)
- Export → cURL commands list — PLANNED (Phase 3)

---

## Non-functional Requirements

| Requirement | Target | Status |
|-------------|--------|--------|
| Startup time | < 2 giây | DONE |
| Node render (100 nodes) | < 1 giây, no lag | Not benchmarked |
| API call execution | Không block UI | DONE (async) |
| File size (built JS) | < 500KB gzipped | DONE (~138KB gzipped) |
| Supported platforms | macOS, Linux, Windows | DONE (web-based) |
| Offline capability | 100% (except API calls) | DONE |
