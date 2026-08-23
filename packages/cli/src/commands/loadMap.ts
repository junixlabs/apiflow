import { readFileSync } from 'fs';
import type { ApiMapFile } from '@junixlabs/apiflow-map';
import { parseMap } from '@junixlabs/apiflow-map';

// cm:guard One definition, but NOT one code. Each caller passes the code that means "no verdict" in
// its own protocol, because there is no number free across all of them.
// cm:guard `check`, `diff` and `probe` spend 2 on a refusal, so 2 is theirs. `impact` spends 2 on an
// ANSWER — "nothing matched" — so handing it 2 here makes a map it could not read look like a miss.
// cm:why Every one of them used to let parseMap throw instead, and node reports an uncaught throw as
// 1: a raw stack trace wearing whichever verdict that command spends 1 on.
export function loadMapOrExit(path: string, cannotAnswer: number): ApiMapFile {
  try {
    return parseMap(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`Cannot read ${path}: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(cannotAnswer);
  }
}
