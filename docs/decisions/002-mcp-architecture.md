# ADR-002: MCP Architecture for Claude Code Integration

**Status:** Accepted
**Date:** 2026-03-19
**Context:** API View cần tích hợp với Claude Code để auto-analyze codebase và chạy flows.

---

## Decision

### 1. MCP stdio transport (not HTTP, not CLI wrapper)

**Chosen:** MCP Server với stdio transport.

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| **MCP stdio** | Native Claude Code support, no port conflicts, simple setup (`claude mcp add`) | Must run as child process |
| MCP HTTP (SSE) | Can serve multiple clients, sharable | Port management, firewall issues, overkill for local tool |
| CLI wrapper | Simple to build | No structured tool/resource protocol, Claude phải parse stdout text |
| VS Code extension | Rich UI integration | Tied to VS Code, not Claude Code native |

**Why stdio:**
- Claude Code dùng stdio cho MCP servers — `claude mcp add api-view -- node src/mcp/server.js`
- Không cần manage ports, không conflict với dev server
- JSON-RPC 2.0 over stdin/stdout = structured, typed communication
- Official `@modelcontextprotocol/sdk` hỗ trợ đầy đủ

### 2. Separate Core Engine from UI

**Chosen:** Tách Core Engine (`src/core/`) thành pure TypeScript, shared giữa MCP Server và Web UI.

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| **Separate Core** | Testable, reusable, MCP Server không cần React | Refactor effort from current structure |
| Keep in UI | No refactor needed | MCP Server phải import React components hoặc duplicate logic |
| Separate npm package | Clean boundary | Over-engineering cho 1 project |

**Why separate:**
- MCP Server chạy trong Node.js — không có DOM, không thể import React components
- Core logic (execution, variable resolution, file I/O) không phụ thuộc UI
- Tách ra → test Core Engine bằng unit tests, không cần browser/JSDOM
- Không cần publish npm package riêng — just `src/core/` folder, import trực tiếp

### 3. Laravel-first Skill approach

**Chosen:** Build skill cho Laravel trước, mở rộng framework khác sau.

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| **Laravel first** | Concrete patterns to parse, test ngay trên project thực tế | Only 1 framework initially |
| Generic (all frameworks) | Broader coverage | Quá abstract, khó parse chính xác, chất lượng thấp |
| Config-based (user define patterns) | Flexible | UX kém, user phải config nhiều |

**Why Laravel first:**
- Laravel có conventions rõ ràng: routes/api.php, Controllers/, Services/ — dễ parse
- Project hiện tại dùng Laravel — test ngay được
- Skill pattern có thể replicate cho framework khác (Express, FastAPI, Spring Boot) sau khi validate approach
- Better to do 1 framework well than many frameworks poorly

---

## Consequences

**Positive:**
- Claude Code tương tác trực tiếp với API View qua structured MCP tools
- Core Engine testable independently, không bị coupled với React
- Laravel analyzer cho kết quả chính xác nhờ framework conventions
- Setup đơn giản: 1 command `claude mcp add`

**Negative:**
- Cần refactor existing code để tách Core Engine ra khỏi UI components
- Laravel-only ban đầu — team dùng framework khác phải chờ
- stdio transport = chỉ 1 Claude Code session dùng 1 MCP server instance

**Risks:**
- Core Engine tách ra có thể break existing Web UI imports → cần migration cẩn thận
- Laravel code patterns không standard 100% (team custom structure) → skill cần fallback strategies
