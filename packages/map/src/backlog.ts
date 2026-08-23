// An unresolved call site is a hole in "which screens break", so the list is a backlog, not an error
// log — and a backlog is only actionable ranked by what it costs. Three of the eight reason producers
// interpolate variable text, so one cause reads as N distinct strings: on the Hono API of §9 (2 of 103
// routes understood) ~101 flat lines are a single shape, which the flat list cannot show.
//
// Normalization is three narrow rules, one per interpolating producer — not a general normalizer. Each
// rule is gated on something only its own producer writes, because a rule that fires on a reason it
// was not written for fabricates a shape no producer emits, and a ranking that points at a shape
// nobody wrote is worse than no ranking.

import type { SourceRef, UnresolvedCall } from './apimap';
import { MAP_METHODS } from './apimap';

export interface BacklogShape {
  shape: string;
  count: number;
  example: SourceRef;
}

const VERBS = new Set<string>(MAP_METHODS);
const SEP = ' — ';
const FAN_OUT = 'reachable from ';

// cm:guard Every rule must leave the five FIXED reason strings byte-identical — they are the majority
// of the producers, and a rule that touches one invents a shape nobody wrote.
// cm:guard Cut at the FIRST separator, and take everything before it as the path: a route path may
// contain a space (`/user profile`), and matching the path as one token leaked it into the ranking.
// cm:edge contract -> packages/cli/src/commands/scanBe.ts — writes `<METHOD> <path> — <cause>`; a
// producer that stops spelling it that way silently splits one shape into N again.
// cm:edge contract -> packages/scan/src/feScanner.ts — writes `<cause>: <60 chars of source>`, same rule.
// cm:edge contract -> packages/cli/src/commands/scanFe.ts — writes `reachable from <N>+ screens…`, same rule.
export function unresolvedShape(reason: string): string {
  let shape = reason;
  const sep = shape.indexOf(SEP);
  const verb = sep === -1 ? '' : shape.slice(0, shape.indexOf(' '));
  if (sep > 0 && VERBS.has(verb)) shape = shape.slice(sep + SEP.length);
  // cm:why First `: `, not the last — feScanner slices 60 characters of raw source, so a signature
  // arrives as `…expression: id: string` and a trailing cut would keep half of it.
  const colon = shape.indexOf(': ');
  if (colon !== -1) shape = shape.slice(0, colon);
  // cm:why Gated on the one producer that interpolates a count. Ungated it rewrote a path that had
  // survived the strip — `/v1/reports 2024` became `/vN/reports N`, a string nothing ever emits.
  return shape.startsWith(FAN_OUT) ? shape.replace(/\d+/g, 'N') : shape;
}

// cm:guard Ordered count desc then shape asc, never insertion order — this is read next to a map that
// promises to be byte-identical between scans, and a ranking that moved on a tie would undo that.
// cm:edge contract -> packages/cli/src/view/panes.ts#reasonKey — the browser pane groups unresolved
// the same way and cannot import this, so the two must keep agreeing on what one group means.
export function unresolvedBacklog(unresolved: readonly UnresolvedCall[]): BacklogShape[] {
  const byShape = new Map<string, BacklogShape>();
  for (const u of unresolved) {
    const shape = unresolvedShape(u.reason);
    const seen = byShape.get(shape);
    if (seen === undefined) byShape.set(shape, { shape, count: 1, example: u.source });
    else seen.count++;
  }
  return [...byShape.values()].sort((a, b) => b.count - a.count || a.shape.localeCompare(b.shape));
}
