# API View — Product Vision & Overview

## Problem Statement

Backend developers building a feature that spans several internal and third-party APIs (for example: pushing a product to WooCommerce, syncing data between platforms) run into four problems:

1. **No view of the whole flow** — which API is called first, which API depends on which
2. **No clear view of the data shape** — which fields an API returns, in what format, so you can decide how to collect and transform them
3. **Debugging is hard** — when a flow fails midway, you re-run it from the start or read logs to trace it
4. **No living documentation** — a Swagger/Postman collection cannot express the order of the calls or the relationships between them

## Solution

**API View** — a lightweight, local-first web tool that lets a developer:

- Build a visual flow by dragging API nodes onto a canvas
- Connect nodes to define the execution order
- Run the whole flow, a single node, or step by step
- Inspect request/response in detail with a JSON tree/raw viewer
- Import cURL from DevTools, chain responses through dynamic variables
- Save a flow to a file and manage it in the Flow Library
- Undo/redo, keyboard shortcuts, auto-save, export PNG/SVG

## Current Status

| Phase | Status |
|-------|--------|
| Phase 1: MVP | DONE |
| Phase 2: Developer Experience | DONE |
| Phase 3: Integration & Advanced | NEXT |
| Phase 4: Claude Code Integration | PLANNED |

## Target User

**A backend developer** who is:
- Building a feature that wires several internal APIs together
- Integrating with third-party APIs (WooCommerce, Shopify, Lazada, payment gateways, and so on)
- Needs to check and understand the input/output of each step in an API chain before writing the handling logic

## Product Principles

1. **Lightweight** — no Docker, no database, one command to run
2. **Local-first** — all data stays local, nothing is sent out
3. **Visualization, not automation** — a tool for seeing and understanding, not for building business logic
4. **Developer-centric** — the UI serves a developer: it does not need to be pretty, it needs to be clear and fast
5. **Flow as documentation** — every saved flow is living documentation of how the APIs connect

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
