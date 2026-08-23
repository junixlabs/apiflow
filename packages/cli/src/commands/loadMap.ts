import { readFileSync } from 'fs';
import type { ApiMapFile } from '@junixlabs/apiflow-map';
import { parseMap } from '@junixlabs/apiflow-map';

// cm:guard Exit 2 — "no verdict" — and never 1. Every command here spends 1 on an answer about the
// map (drifted · diverged · nothing matched), so a file it could not read reported as 1 is a lie.
// cm:guard One definition for all of them. Each used to let parseMap throw, and node reports an
// uncaught throw as 1, so six commands quietly disagreed with their own documented exit codes.
export function loadMapOrExit(path: string): ApiMapFile {
  try {
    return parseMap(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`Cannot read ${path}: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
}
