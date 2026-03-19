# ADR-001: Tech Stack Selection

**Date:** 2026-03-19
**Status:** Accepted

## Decision

React 19 + @xyflow/react 12 + Vite 8 + Zustand 5 + Tailwind CSS 4 + TypeScript 5.9.

Monaco Editor was **not used** — plain textarea with custom JSON validation, formatting, and autocomplete provides sufficient UX at fraction of the bundle size (~440KB total vs ~2MB+ with Monaco).

## Options Considered

### Option A: React + @xyflow/react (Chosen)
- @xyflow/react is the only mature node-based canvas library for React
- Large ecosystem, extensive documentation
- Vite 8 for fast dev/build, Zustand 5 for lightweight state

### Option B: Vue + Vue Flow
- Vue Flow exists but smaller community
- Rejected: fewer examples for complex use cases

### Option C: Svelte + Svelvet
- Svelvet still immature
- Rejected: not production-ready

### Option D: Monaco Editor for JSON editing
- Full code editor experience
- Rejected: ~2MB bundle, lazy-load complexity, overkill for API body editing
- Replaced with: custom textarea + JSON validation + format/minify + autocomplete

## Consequences

- Bundle size ~440KB gzipped (total JS)
- No external editor dependency
- Custom JSON UX: validation, format/minify with variable preservation, bulk edit mode
