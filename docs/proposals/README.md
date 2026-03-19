# API View — Product Vision & Overview

## Problem Statement

Backend developers khi phát triển tính năng liên quan đến nhiều API nội bộ và third-party (ví dụ: deploy sản phẩm lên WooCommerce, sync dữ liệu giữa các platform) gặp khó khăn trong việc:

1. **Không nhìn thấy toàn cảnh flow** — Không biết API nào gọi trước, API nào phụ thuộc API nào
2. **Không thấy rõ data shape** — Không biết API trả về field gì, format gì, để quyết định cách collect và transform
3. **Debug khó khăn** — Khi flow lỗi ở bước giữa, phải chạy lại từ đầu hoặc đọc log để trace
4. **Không có tài liệu sống** — Swagger/Postman collection không thể hiện được thứ tự và mối quan hệ giữa các API

## Solution

**API View** — Lightweight, local-first web tool cho phép developer:

- Tạo visual flow bằng cách kéo thả các API node trên canvas
- Nối các node để định nghĩa thứ tự thực thi
- Chạy toàn bộ flow hoặc từng node / step-by-step
- Inspect chi tiết request/response với JSON tree/raw viewer
- Import cURL từ DevTools, chain responses qua dynamic variables
- Lưu flow thành file, quản lý trong Flow Library
- Undo/redo, keyboard shortcuts, auto-save, export PNG/SVG

## Current Status

| Phase | Status |
|-------|--------|
| Phase 1: MVP | DONE |
| Phase 2: Developer Experience | DONE |
| Phase 3: Integration & Advanced | NEXT |
| Phase 4: Claude Code Integration | PLANNED |

## Target User

**Backend Developer** đang:
- Phát triển tính năng tích hợp nhiều API nội bộ với nhau
- Tích hợp với third-party API (WooCommerce, Shopify, Lazada, payment gateway, v.v.)
- Cần kiểm tra và hiểu rõ input/output của từng bước trong API chain trước khi code logic xử lý

## Product Principles

1. **Lightweight** — Không cần Docker, không cần database, chạy bằng 1 lệnh
2. **Local-first** — Mọi data ở local, không gửi ra ngoài
3. **Visualization, not automation** — Tool để nhìn và hiểu, không phải để build business logic
4. **Developer-centric** — UI phục vụ developer, không cần đẹp, cần rõ ràng và nhanh
5. **Flow as documentation** — Mỗi flow đã lưu là 1 tài liệu sống mô tả cách các API liên kết

## Document Index

### Proposals & Planning
| Document | Description |
|----------|-------------|
| [roadmap.md](roadmap.md) | Release roadmap (Phase 1-4 summary) |
| [roadmap-master.md](roadmap-master.md) | Detailed master roadmap with Phase 2 deliverables, Phase 3 chunks |
| [feature-spec.md](feature-spec.md) | Feature specifications (F1-F8) |
| [mvp-scope.md](mvp-scope.md) | MVP scope and phasing |
| [user-stories.md](user-stories.md) | User Stories with acceptance criteria |
| [ui-wireframe.md](ui-wireframe.md) | UI/UX layout descriptions |
| [claude-code-integration.md](claude-code-integration.md) | Phase 4 vision: MCP + Laravel Skill |

### Architecture
| Document | Description |
|----------|-------------|
| [../architecture/technical-overview.md](../architecture/technical-overview.md) | Technical architecture, source structure, data models |
| [../architecture/mcp-architecture.md](../architecture/mcp-architecture.md) | MCP server architecture for Phase 4 |

### Decisions
| Document | Description |
|----------|-------------|
| [../decisions/001-tech-stack.md](../decisions/001-tech-stack.md) | ADR: Tech stack selection |
| [../decisions/002-mcp-architecture.md](../decisions/002-mcp-architecture.md) | ADR: MCP architecture for Claude Code |
