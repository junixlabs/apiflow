# Release ritual

Not release notes. This is the checklist, and it is short so that it is actually followed.

## Before tagging

1. `npm test` · `npx tsc -b` · `npm run lint` · `npm run boundary` · `npm run codemap` — all five,
   all green. CI runs them on every push, so a red one here means you already knew.
2. `CHANGELOG.md` has an entry that says what changed **and what it cost**. The existing entries are
   the standard: measured numbers, the fault that was found, no varnish.
3. **If this version contains a DECISION rather than a feature, it must also have a `NORTH-STAR.md` §9
   entry. No entry, no tag.**

   That third line is the whole reason this file exists. §9 is the only thing that stops a decision
   being re-litigated six weeks later, and it failed exactly once, in exactly one way: it ran three
   days behind the code, so twelve versions of probe work landed with no record of why. Attaching it
   to the release — a ritual that is never skipped — is cheaper than remembering.
4. Version numbers across the workspace packages move together. They are one product.

## Tagging

```bash
git tag vX.Y.Z && git push origin vX.Y.Z
```

`.github/workflows/publish.yml` runs the four gates again and publishes on success. `ci.yml` is the
one that runs on ordinary pushes; publishing is gated separately so a tag cannot skip the gates.

## After

The docs site (`junixlabs.github.io/apiflow`) is built from `docs/` on the default branch. There is
nothing to publish by hand — and nothing to keep in sync, because `tests/guide.test.ts` already failed
if a page had drifted.
