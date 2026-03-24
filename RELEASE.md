# @junixlabs/apiflow v1.0.0 — Release Notes

**Release Date:** 2026-03-24

Visual API flow testing tool. Local-first, git-friendly, open source.

## Install

```bash
npx @junixlabs/apiflow
```

No clone, no setup. Opens in browser.

## Highlights

- **Visual Canvas** — Drag-and-drop API nodes, see how endpoints connect
- **Chain Responses** — `{{nodes["Name"].response.body.id}}` passes data between requests
- **Test Assertions** — Status codes, body content, JSONPath matching with pass/fail badges
- **Import** — cURL, OpenAPI 3.x, Postman collections
- **Conditional Branching** — If/else flow logic based on response
- **Per-Node Auth** — Bearer, Basic, API Key per endpoint
- **Endpoint Library** — Configure once, reuse everywhere
- **Project Storage** — `.apiview` files in `.apiview/` directory, git-committable
- **Multiple Environments** — Local/Staging/Production with one-click switch
- **MCP Server** — 12 tools for Claude Code integration
- **Laravel Analyzer** — Auto-generate flows from codebase
- **Dashboard** — Batch run all flows with pass/fail overview

## Links

- npm: https://www.npmjs.com/package/@junixlabs/apiflow
- GitHub: https://github.com/junixlabs/apiflow
- License: MIT
