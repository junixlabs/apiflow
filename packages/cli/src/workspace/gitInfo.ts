import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface GitHead {
  branch?: string;
  sha?: string;
}

// cm:why Reads .git by hand instead of spawning git: this runs per page render, and a page that
// forks a process per project is a page that hangs when one of the roots is on a dead mount.
// cm:guard Returns undefined fields rather than guessing. "unknown revision" is a fact; a wrong
// branch name next to a scan result is worse than no branch name at all.
export function gitHead(root: string): GitHead | null {
  const dir = join(root, '.git');
  if (!existsSync(dir)) return null;
  let head: string;
  try {
    head = readFileSync(join(dir, 'HEAD'), 'utf8').trim();
  } catch {
    return null;
  }

  const detached = /^[0-9a-f]{40}$/.exec(head);
  if (detached) return { sha: head.slice(0, 7) };

  const ref = /^ref:\s*(\S+)$/.exec(head)?.[1];
  if (ref === undefined) return null;
  const branch = ref.replace(/^refs\/heads\//, '');

  const loose = join(dir, ref);
  if (existsSync(loose)) {
    const sha = readFileSync(loose, 'utf8').trim();
    return { branch, sha: /^[0-9a-f]{7,}$/.test(sha) ? sha.slice(0, 7) : undefined };
  }
  // cm:why Falls back to packed-refs: a freshly cloned repo has no loose ref for its own branch, so
  // reading only .git/refs/heads reports "no revision" on exactly the repos someone just checked out.
  const packed = join(dir, 'packed-refs');
  if (existsSync(packed)) {
    for (const line of readFileSync(packed, 'utf8').split('\n')) {
      const m = /^([0-9a-f]{40})\s+(\S+)$/.exec(line);
      if (m && m[2] === ref) return { branch, sha: m[1].slice(0, 7) };
    }
  }
  return { branch };
}
