# API View — MVP Scope & Phasing

## MVP Definition (Phase 1)

Goal: a developer can build a flow, run it and inspect the responses, in **2-3 days of development**.

### In Scope (MVP)

| # | Feature | User Story | Priority |
|---|---------|------------|----------|
| 1 | A basic canvas | US-1.1, US-1.2, US-1.5 | Must have |
| 2 | Node config (method, URL, headers, body) | US-1.3 | Must have |
| 3 | Connections between nodes | US-1.4 | Must have |
| 4 | Run the whole flow | US-2.1 | Must have |
| 5 | Run a single node on its own | US-2.2 | Must have |
| 6 | Inspect response (JSON viewer) | US-2.3 | Must have |
| 7 | Basic environment variables | US-3.1 | Must have |
| 8 | Save/Load flow (JSON file) | US-4.1, US-4.2 | Must have |

### Out of Scope (MVP)

| Feature | Why it is deferred | Phase |
|---------|-------------|-------|
| Dynamic variables (referencing node output) | Needs a more capable execution engine | Phase 2 |
| cURL import | Nice-to-have; typing it by hand is fine for the MVP | Phase 2 |
| OpenAPI/Swagger import | Nice-to-have | Phase 3 |
| Postman collection import | Nice-to-have | Phase 3 |
| Image export (PNG/SVG) | Does not block the core workflow | Phase 2 |
| Annotations on the canvas | Does not block the core workflow | Phase 2 |
| Step-by-step execution | Run-all is enough for the MVP | Phase 2 |
| Test assertions | Not a core need | Phase 3 |
| Auto-save | Saving by hand is fine for the MVP | Phase 2 |
| Flow library (home screen) | A file picker is enough for the MVP | Phase 2 |
| A full set of keyboard shortcuts | The basics (Delete, Ctrl+Z) are enough for the MVP | Phase 2 |

---

## Phase 2: Developer Experience

Goal: improve the day-to-day experience. **Estimate: 3-5 days**.

| # | Feature | User Story |
|---|---------|------------|
| 1 | Dynamic variables (referencing the output of an earlier node) | US-3.2 |
| 2 | Data-flow visualization (hover a connection to see the data) | US-2.4 |
| 3 | cURL import | US-6.2 |
| 4 | Step-by-step execution mode | F3 |
| 5 | Export the canvas as PNG/SVG | US-5.1 |
| 6 | Canvas annotations and grouping | US-5.3 |
| 7 | Auto-save | F6 |
| 8 | Flow library (home screen) | US-4.3 |
| 9 | A full set of keyboard shortcuts | US-6.1 |
| 10 | Node description/notes | US-5.2 |

---

## Phase 3: Integration & Advanced

Goal: integrate with the existing ecosystem. **Estimate: 5-7 days**.

| # | Feature | User Story |
|---|---------|------------|
| 1 | OpenAPI/Swagger import | US-6.3 |
| 2 | Postman collection import | F7 |
| 3 | Export as a Postman collection | F8 |
| 4 | Export as cURL commands | F8 |
| 5 | Test assertions (status code, body contains) | F2 |
| 6 | Response diff (comparing two runs) | - |
| 7 | Full support for multiple environments | US-3.1 (extended) |
| 8 | Request history per node | F3 |

---

## MVP Acceptance Criteria (Definition of Done)

A complete flow has to work end to end:

```
Scenario: WooCommerce Product Deploy Flow

1. Open the app → create a new flow named "WooCommerce Deploy"
2. Add a "Get Product" node → configure GET http://localhost:8000/api/products/123
3. Add a "Get Shop" node → configure GET http://localhost:8000/api/shops/456
4. Add a "Get Categories" node → configure GET http://localhost:8000/api/categories?shop_id=456
5. Add a "Deploy" node → configure POST http://localhost:8000/api/deploy
   with a body containing product_id, shop_id, categories
6. Connect: Get Product → Deploy, Get Shop → Deploy, Get Categories → Deploy
7. Set environment variable: base_url = http://localhost:8000
8. Click "Run" → every node runs in order
9. Click "Get Product" → see the JSON response with the fields: id, name, price, variants
10. Click "Deploy" → see the request body that was sent and the response from the server
11. Save the flow → an .apiview file is written
12. Close the app → reopen it → Open file → the flow is restored exactly
```
