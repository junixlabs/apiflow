# API View — MVP Scope & Phasing

## MVP Definition (Phase 1)

Mục tiêu: Developer có thể tạo flow, chạy, và inspect response trong **2-3 ngày phát triển**.

### In Scope (MVP)

| # | Feature | User Story | Priority |
|---|---------|------------|----------|
| 1 | Canvas cơ bản | US-1.1, US-1.2, US-1.5 | Must have |
| 2 | Node config (method, URL, headers, body) | US-1.3 | Must have |
| 3 | Connection giữa nodes | US-1.4 | Must have |
| 4 | Run toàn bộ flow | US-2.1 | Must have |
| 5 | Run từng node riêng lẻ | US-2.2 | Must have |
| 6 | Inspect response (JSON viewer) | US-2.3 | Must have |
| 7 | Environment variables cơ bản | US-3.1 | Must have |
| 8 | Save/Load flow (JSON file) | US-4.1, US-4.2 | Must have |

### Out of Scope (MVP)

| Feature | Lý do defer | Phase |
|---------|-------------|-------|
| Dynamic variables (reference node output) | Cần execution engine phức tạp hơn | Phase 2 |
| cURL import | Nice-to-have, nhập thủ công OK cho MVP | Phase 2 |
| OpenAPI/Swagger import | Nice-to-have | Phase 3 |
| Postman collection import | Nice-to-have | Phase 3 |
| Export hình ảnh (PNG/SVG) | Không block core workflow | Phase 2 |
| Annotations trên canvas | Không block core workflow | Phase 2 |
| Step-by-step execution | Run all đủ cho MVP | Phase 2 |
| Test assertions | Không phải core need | Phase 3 |
| Auto-save | Save thủ công OK cho MVP | Phase 2 |
| Flow library (home screen) | File picker đủ cho MVP | Phase 2 |
| Keyboard shortcuts đầy đủ | Cơ bản (Delete, Ctrl+Z) đủ cho MVP | Phase 2 |

---

## Phase 2: Developer Experience

Mục tiêu: Nâng cao trải nghiệm sử dụng hàng ngày. **Ước lượng: 3-5 ngày**.

| # | Feature | User Story |
|---|---------|------------|
| 1 | Dynamic variables (reference output từ node trước) | US-3.2 |
| 2 | Data flow visualization (hover connection xem data) | US-2.4 |
| 3 | cURL import | US-6.2 |
| 4 | Step-by-step execution mode | F3 |
| 5 | Export canvas thành PNG/SVG | US-5.1 |
| 6 | Canvas annotations và grouping | US-5.3 |
| 7 | Auto-save | F6 |
| 8 | Flow library (home screen) | US-4.3 |
| 9 | Keyboard shortcuts đầy đủ | US-6.1 |
| 10 | Node description/notes | US-5.2 |

---

## Phase 3: Integration & Advanced

Mục tiêu: Tích hợp với ecosystem hiện có. **Ước lượng: 5-7 ngày**.

| # | Feature | User Story |
|---|---------|------------|
| 1 | OpenAPI/Swagger import | US-6.3 |
| 2 | Postman collection import | F7 |
| 3 | Export thành Postman collection | F8 |
| 4 | Export thành cURL commands | F8 |
| 5 | Test assertions (status code, body contains) | F2 |
| 6 | Response diff (so sánh 2 lần chạy) | - |
| 7 | Multiple environment hỗ trợ đầy đủ | US-3.1 (extended) |
| 8 | Request history per node | F3 |

---

## MVP Acceptance Criteria (Definition of Done)

Flow hoàn chỉnh phải hoạt động end-to-end:

```
Scenario: WooCommerce Product Deploy Flow

1. Mở app → tạo flow mới tên "WooCommerce Deploy"
2. Thêm node "Get Product" → config GET http://localhost:8000/api/products/123
3. Thêm node "Get Shop" → config GET http://localhost:8000/api/shops/456
4. Thêm node "Get Categories" → config GET http://localhost:8000/api/categories?shop_id=456
5. Thêm node "Deploy" → config POST http://localhost:8000/api/deploy
   với body chứa product_id, shop_id, categories
6. Nối: Get Product → Deploy, Get Shop → Deploy, Get Categories → Deploy
7. Set environment variable: base_url = http://localhost:8000
8. Click "Run" → tất cả node chạy theo thứ tự
9. Click vào "Get Product" → thấy response JSON với fields: id, name, price, variants
10. Click vào "Deploy" → thấy request body đã gửi và response từ server
11. Save flow → file .apiview được tạo
12. Đóng app → mở lại → Open file → flow được restore đúng
```
