# ADR-002: MCP Architecture for Claude Code Integration

**Status:** Accepted
**Date:** 2026-03-19
**Context:** API View needs to integrate with Claude Code so it can auto-analyze a codebase and run flows.

---

## Decision

### 1. MCP stdio transport (not HTTP, not CLI wrapper)

**Chosen:** an MCP server over stdio transport.

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| **MCP stdio** | Native Claude Code support, no port conflicts, simple setup (`claude mcp add`) | Must run as child process |
| MCP HTTP (SSE) | Can serve multiple clients, sharable | Port management, firewall issues, overkill for local tool |
| CLI wrapper | Simple to build | No structured tool/resource protocol; Claude has to parse stdout text |
| VS Code extension | Rich UI integration | Tied to VS Code, not Claude Code native |

**Why stdio:**
- Claude Code uses stdio for MCP servers — `claude mcp add api-view -- node src/mcp/server.js`
- No ports to manage, no conflict with the dev server
- JSON-RPC 2.0 over stdin/stdout = structured, typed communication
- The official `@modelcontextprotocol/sdk` supports it fully

### 2. Separate Core Engine from UI

**Chosen:** split the core engine (`src/core/`) out as pure TypeScript, shared by the MCP server and the web UI.

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| **Separate core** | Testable, reusable, the MCP server needs no React | Refactor effort from the current structure |
| Keep it in the UI | No refactor needed | The MCP server would have to import React components or duplicate the logic |
| Separate npm package | Clean boundary | Over-engineering for a single project |

**Why separate:**
- The MCP server runs in Node.js — no DOM, so it cannot import React components
- The core logic (execution, variable resolution, file I/O) does not depend on the UI
- Split out → the core engine is unit-testable with no browser and no JSDOM
- No separate npm package to publish — just the `src/core/` folder, imported directly

### 3. Laravel-first Skill approach

**Chosen:** build the skill for Laravel first, widen to other frameworks later.

**Options considered:**

| Option | Pros | Cons |
|--------|------|------|
| **Laravel first** | Concrete patterns to parse, testable on a real project right away | Only 1 framework initially |
| Generic (all frameworks) | Broader coverage | Too abstract, hard to parse accurately, low quality |
| Config-based (the user defines the patterns) | Flexible | Poor UX, too much for the user to configure |

**Why Laravel first:**
- Laravel has clear conventions: routes/api.php, Controllers/, Services/ — easy to parse
- The project at hand uses Laravel — it can be tested immediately
- The skill pattern can be replicated for other frameworks (Express, FastAPI, Spring Boot) once the approach is validated
- Better to do 1 framework well than many frameworks poorly

---

## Consequences

**Positive:**
- Claude Code talks to API View directly through structured MCP tools
- The core engine is testable on its own, not coupled to React
- The Laravel analyzer is accurate because the framework conventions are predictable
- Simple setup: one `claude mcp add` command

**Negative:**
- The existing code must be refactored to lift the core engine out of the UI components
- Laravel only at first — teams on another framework have to wait
- stdio transport = one Claude Code session per MCP server instance

**Risks:**
- Splitting the core engine out may break existing web UI imports → the migration has to be careful
- Laravel code patterns are not 100% standard (teams customize the structure) → the skill needs fallback strategies
