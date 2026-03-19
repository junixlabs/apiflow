# API View — UI/UX Specification

## Layout Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Toolbar                                                         │
│ [Open] [Save] [+ Node] [▶ Run] [▶▶ Run All]  | Env: [Local ▼] │
├────────────┬────────────────────────────┬───────────────────────┤
│            │                            │                       │
│  Sidebar   │       Canvas               │   Inspector Panel     │
│  (optional)│                            │                       │
│            │   ┌──────────┐             │   Request  Response   │
│  Flow List │   │GET       │             │   ─────────────────   │
│  or        │   │/products │─────┐       │   Status: 200 OK     │
│  Endpoints │   └──────────┘     │       │   Time: 45ms         │
│  (OpenAPI) │                    ▼       │                       │
│            │   ┌──────────┐  ┌──────┐   │   {                   │
│            │   │GET       │  │POST  │   │     "id": 123,       │
│            │   │/shops    │──│deploy│   │     "name": "...",    │
│            │   └──────────┘  └──────┘   │     "price": 29.99   │
│            │                    ▲       │   }                   │
│            │   ┌──────────┐     │       │                       │
│            │   │GET       │─────┘       │                       │
│            │   │/categori.│             │                       │
│            │   └──────────┘             │                       │
│            │                            │                       │
│            │              [Mini-map]    │                       │
├────────────┴────────────────────────────┴───────────────────────┤
│ Status Bar: Ready | Nodes: 4 | Last run: 2 seconds ago          │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Toolbar

```
┌──────────────────────────────────────────────────────────────┐
│ 🔗 API View  │ [📂 Open] [💾 Save] │ [+ Node] [📋 Paste cURL] │
│              │                     │                          │
│ Flow: "WooCommerce Deploy"         │ [▶ Run] [⏭ Step] [⏹ Stop]│
│                                    │                          │
│                                    │ Env: [Local ▼]           │
└──────────────────────────────────────────────────────────────┘
```

**Phân vùng:**
- Trái: Branding + flow name (editable inline)
- Giữa: File operations + node creation
- Phải: Execution controls + environment selector

---

### 2. API Node

**Default state:**
```
┌────────────────────────┐
│ ● GET    /products/123 │
│   "Get Product Info"   │
└────────────────────────┘
  ○ (input)         (output) ○
```

**After execution — Success:**
```
┌────────────────────────┐
│ ● GET    /products/123 │  ✅
│   "Get Product Info"   │
│   200 OK · 45ms        │
└────────────────────────┘
```

**After execution — Error:**
```
┌────────────────────────┐
│ ● POST   /deploy       │  ❌
│   "Deploy to WC"       │
│   500 Error · 1.2s     │
└────────────────────────┘
```

**Running state:**
```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
  ● GET    /products/123   ⟳
│   "Get Product Info"   │
  Running...
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

**Method color coding:**
| Method | Color | Hex |
|--------|-------|-----|
| GET | Green | #22C55E |
| POST | Yellow/Amber | #F59E0B |
| PUT | Orange | #F97316 |
| DELETE | Red | #EF4444 |
| PATCH | Purple | #A855F7 |

---

### 3. Inspector Panel (Right Side)

**Tabs structure:**

```
┌─────────────────────────────────────┐
│ Node: "Get Product Info"            │
├──────┬──────────┬────────┬──────────┤
│Config│ Request  │Response│ Timing   │
├──────┴──────────┴────────┴──────────┤
│                                     │
│  [Active tab content]               │
│                                     │
└─────────────────────────────────────┘
```

**Config tab:**
```
Method:  [GET ▼]
URL:     [{{base_url}}/api/products/123    ]

Description:
[Lấy thông tin sản phẩm gốc từ database   ]

── Headers ──────────────────────────
  Content-Type    application/json
  Authorization   Bearer {{token}}
  [+ Add Header]

── Query Params ─────────────────────
  include         variants,images
  [+ Add Param]

── Body (POST/PUT/PATCH only) ───────
  ┌─────────────────────────────────┐
  │ {                               │
  │   "product_id": 123,            │
  │   "shop_id": 456                │
  │ }                               │
  └─────────────────────────────────┘
```

**Response tab:**
```
  Status: 200 OK          Size: 1.2KB
  Time: 45ms

  ── Response Body ────────────────
  [Tree ▼] [Raw] [Copy]  🔍 Search

  ▼ {
      "id": 123,
    ▼ "data": {
        "name": "Product ABC",
        "price": 29.99,
      ▼ "variants": [
        ▼ {
            "id": 1,
            "sku": "ABC-S",
            "size": "S"     [📋 Copy path]
          }
        ]
      }
    }
```

Click vào bất kỳ field → hiện button "Copy as variable":
→ `{{nodes["Get Product Info"].response.body.data.variants[0].sku}}`

---

### 4. Connection Lines

```
Idle:       ─────────────→   (gray, solid)
Running:    ═ ═ ═ ═ ═ ═ →   (blue, animated dash)
Success:    ─────────────→   (green, solid)
Error:      ─────────────→   (red, solid)
```

Hover lên connection (Phase 2):
```
         ┌──────────────────────┐
         │ Data passed:         │
         │ product_id: 123      │
         │ name: "Product ABC"  │
         └──────────────────────┘
─────────────────────────────────→
```

---

### 5. Environment Panel

```
┌─────────────────────────────────────┐
│ Environments          [+ New Env]   │
├─────────────────────────────────────┤
│ ● Local  ○ Staging  ○ Production   │
├─────────────────────────────────────┤
│ Key            │ Value              │
├────────────────┼────────────────────┤
│ base_url       │ http://localhost:  │
│                │ 8000               │
│ token          │ ●●●●●●●● [👁]     │
│ shop_id        │ 456                │
│ [+ Add Variable]                    │
└─────────────────────────────────────┘
```

---

## Interaction Flows

### Tạo node mới
1. Double-click canvas HOẶC click "+ Node" trên toolbar
2. Node mới xuất hiện tại vị trí click
3. Inspector panel mở tab Config tự động
4. User nhập Method + URL → node label update real-time

### Kết nối 2 nodes
1. Hover lên node → output port (bên phải) hiện rõ
2. Click + drag từ output port
3. Kéo đến input port của node đích
4. Thả → connection được tạo

### Chạy flow
1. Click "▶ Run" trên toolbar
2. Nodes highlight lần lượt theo thứ tự thực thi
3. Mỗi node hiện spinner khi đang chạy
4. Hoàn thành → status badge hiện trên node (✅/❌)
5. Click vào bất kỳ node → xem response trong Inspector

### Inspect response
1. Click node đã chạy
2. Inspector panel hiện tab Response
3. JSON tree view — click expand/collapse
4. Click vào field → "Copy as variable" button
5. Paste variable vào node khác → data flow established

---

## Responsive Behavior

| Viewport | Layout |
|----------|--------|
| >= 1440px | Sidebar + Canvas + Inspector (3 columns) |
| 1024-1439px | Canvas + Inspector (2 columns, sidebar collapsible) |
| < 1024px | Không hỗ trợ (hiển thị message yêu cầu dùng màn hình lớn hơn) |

---

## Theme

| Element | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Background | #FFFFFF | #1E1E1E |
| Canvas background | #FAFAFA | #252526 |
| Grid dots | #E5E7EB | #3E3E42 |
| Node background | #FFFFFF | #2D2D30 |
| Node border | #D1D5DB | #3E3E42 |
| Text primary | #111827 | #D4D4D4 |
| Text secondary | #6B7280 | #808080 |
| Connection line | #9CA3AF | #6B6B6B |
| Selection highlight | #3B82F6 | #264F78 |

Mặc định: Dark Mode (developer tool).
Toggle ở Settings.
