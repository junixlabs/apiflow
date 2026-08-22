import { existsSync } from 'fs';
import { join } from 'path';

// cm:why A git worktree is a whole second copy of the repo. One real app kept fifteen of them under
// `.claude/worktrees/`, and the scan counted every screen sixteen times: 11,340 calls of which 10,485
// were copies, so `impact` answered a one-file change with sixteen files. The rule is not "skip
// `.claude`" — a subtree carrying its own `.git` is a DIFFERENT checkout, whoever put it there and
// whatever they named the directory.
// cm:edge lockstep -> packages/cli/src/commands/scanFe.ts · packages/cli/src/commands/scanBe.ts — both walks apply this. The scan ROOT is
// never tested: the walk only asks about directories it is about to descend into.
export function isNestedCheckout(dir: string): boolean {
  return existsSync(join(dir, '.git'));
}
