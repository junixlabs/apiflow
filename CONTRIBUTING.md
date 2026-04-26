# Contributing to apiflow

Thanks for your interest in **apiflow** — a local-first visual API flow testing tool.

This is an early v1 release; contributions, issues, and ideas are all welcome.

## Project intro

apiflow lets you build, chain, and assert HTTP request flows visually. Flows live in `<your-project>/.apiview/` so they can be committed alongside the code under test.

- Source: <https://github.com/junixlabs/apiflow>
- npm: <https://www.npmjs.com/package/@junixlabs/apiflow>
- License: [MIT](LICENSE)

## Setup

Prerequisites: **Node.js 20+** and **pnpm** (or npm).

```bash
git clone https://github.com/junixlabs/apiflow.git
cd apiflow
pnpm install      # or: npm install
pnpm dev          # or: npm run dev
```

Open the URL printed by Vite (default `http://localhost:5173`).

To run against a target project's `.apiview/` folder:

```bash
pnpm dev -- --project=/absolute/path/to/your-api-project
```

## Contribution flow

1. **Discuss first for non-trivial changes.** Open a GitHub issue describing the bug, feature, or refactor before sending a large PR — saves both sides time.
2. **Fork → branch → PR.** Branch names: `fix/<short-slug>` or `feat/<short-slug>`.
3. **Keep PRs scoped.** One concern per PR. Drop unrelated reformatting from the diff.
4. **Tests + types.** Add or update tests where reasonable; keep `pnpm build` green.
5. **Commit messages** follow [Conventional Commits](https://www.conventionalcommits.org/) (`fix:`, `feat:`, `docs:`, `chore:`, `refactor:`, `test:`).

## Filing issues / suggesting features

- **Bug reports** → <https://github.com/junixlabs/apiflow/issues/new>
  - Include: apiflow version, OS + browser, repro steps, expected vs actual.
- **Feature requests / discussions** → same tracker. Tag with `feature` or `discussion` if appropriate.
- **Security issues** → please email the maintainers privately rather than filing publicly.

## License

By contributing you agree your work is licensed under the [MIT License](LICENSE) carried by this repository.
