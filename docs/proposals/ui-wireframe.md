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

**Zones:**
- Left: branding + flow name (editable inline)
- Middle: file operations + node creation
- Right: execution controls + environment selector

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
[Fetch the source product from the database]

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

Click any field → a "Copy as variable" button appears:
→ `{{nodes["Get Product Info"].response.body.data.variants[0].sku}}`

---

### 4. Connection Lines

```
Idle:       ─────────────→   (gray, solid)
Running:    ═ ═ ═ ═ ═ ═ →   (blue, animated dash)
Success:    ─────────────→   (green, solid)
Error:      ─────────────→   (red, solid)
```

Hover a connection (Phase 2):
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

### Creating a node
1. Double-click the canvas OR click "+ Node" in the toolbar
2. A new node appears where you clicked
3. The inspector panel opens the Config tab automatically
4. The user types Method + URL → the node label updates in real time

### Connecting two nodes
1. Hover a node → its output port (on the right) becomes visible
2. Click and drag from the output port
3. Drag to the input port of the target node
4. Release → the connection is created

### Running a flow
1. Click "▶ Run" in the toolbar
2. The nodes highlight one by one in execution order
3. Each node shows a spinner while it runs
4. When it finishes → a status badge appears on the node (✅/❌)
5. Click any node → see its response in the inspector

### Inspect response
1. Click a node that has run
2. The inspector panel shows the Response tab
3. A JSON tree view — click to expand/collapse
4. Click a field → a "Copy as variable" button
5. Paste the variable into another node → the data flow is established

---

## Responsive Behavior

| Viewport | Layout |
|----------|--------|
| >= 1440px | Sidebar + Canvas + Inspector (3 columns) |
| 1024-1439px | Canvas + Inspector (2 columns, sidebar collapsible) |
| < 1024px | Not supported (shows a message asking for a larger screen) |

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

Default: dark mode (it is a developer tool).
Toggled in Settings.
