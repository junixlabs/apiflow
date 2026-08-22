---
title: FE here, BE elsewhere
blurb: "Two machines, one map, no server: the file travels because it carries no machine path."
status: reference
why-not-replayed: needs two machines; the whole point of the page is that the file travels between them
---

# FE here, BE on another machine

There is nothing to host. An `.apimap` is derived from content alone — no timestamps, no
coordinates — so scanning an unchanged repo twice produces byte-identical files. That makes the map a
**handover artefact**: scan each side where its code lives, move the file, and the workspace joins
them.

## The whole flow

On the machine that has the API:

```bash
apiflow scan-be /srv/webapp-api --out=./webapp-be.apimap
```

Move `webapp-be.apimap` however you already move files — `scp`, a shared drive, or a commit in a
private maps repo. Then on the machine that has the frontend:

```bash
apiflow project add Webapp --fe=/home/you/webapp-ui --be-map=./webapp-be.apimap
apiflow project scan webapp --fe
```

The scan re-links automatically, and the project now reconciles both halves — the four buckets
(`both`, `uncalled`, `feOnly`, `unpaired`), the alert list, and:

```bash
apiflow impact ~/.apiflow/projects/webapp/linked.apimap \
  --endpoint="DELETE /api/v1/attributes/{param}"
```

which answers from the API side of the join: **which screens break if I change this endpoint**. That
is the question the two machines could not answer separately.

## Keeping it current

Re-import each time the other machine re-scans:

```bash
apiflow project import webapp --be=./webapp-be.apimap
```

Import writes a history entry and re-links, exactly as a local scan does — so `apiflow check` and the
Compare pane show what moved between the two BE scans, even though neither happened here.

In the browser (`apiflow ui`), the same two fields are on the **Add project** dialog and on
**Edit roots**: *FE map file* and *BE map file*.

## What an imported side cannot do

- **It cannot be re-scanned here.** There is no directory to read, so the header shows
  `BE imported` instead of a Re-scan button, and `apiflow project scan` says which machine it came
  from. Re-import the file to update it.
- **It has no git revision.** A scanned side reads branch and sha from the root's `.git`; an imported
  one carries only the root string its own scan recorded.

## Telling the API side when a change breaks a screen

Two honest options today, neither needing a server:

1. **A maps repo.** Commit each side's `.apimap` to a private repo. The API's CI re-scans and commits
   on merge; the diff in that repo *is* the notification, and anyone can pull it and ask `impact`.
2. **Ask at review time.** In the API repo's CI, fetch the FE map from that repo, `link`, and run
   `impact` for the endpoints the merge request touches. A red job or a comment naming the affected
   screens lands where the decision is being made.

`apiflow ui` binds `127.0.0.1` and has no flag to widen it. A map carries real production paths, so
serving one to a network is a decision to make deliberately, not a flag to flip.
