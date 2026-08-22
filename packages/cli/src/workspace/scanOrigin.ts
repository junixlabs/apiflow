import { existsSync, readFileSync, statSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';

// cm:why A machine path inside the map file is what stops the map from being shared. Everything
// else in .apimap is already repo-relative (`src/routes/x.tsx`), so this one field decided whether
// two people scanning the same commit get the same bytes — and therefore whether the map can be
// reviewed in a PR or served to a team at all.
// cm:guard Never put the remote URL in verbatim: a clone made with `https://user:token@host/...`
// carries the token in .git/config, and copying it here would write a live credential into a file
// meant to be committed and shared.

interface GitDirs {
  checkout: string;
  configDir: string;
}

function findGit(from: string): GitDirs | null {
  let dir = resolve(from);
  for (;;) {
    const dot = join(dir, '.git');
    if (existsSync(dot)) {
      if (statSync(dot).isDirectory()) return { checkout: dir, configDir: dot };
      // cm:why A linked worktree has `.git` as a FILE pointing at <main>/.git/worktrees/<name>;
      // the config (and so the remote) lives in the common dir, not there. Without this a scan run
      // inside a worktree reports a different origin than the same commit in the main checkout.
      const m = /^gitdir:\s*(.+)$/m.exec(readFileSync(dot, 'utf8'));
      if (m === null) return null;
      const gitdir = resolve(dir, m[1].trim());
      const commondir = join(gitdir, 'commondir');
      const common = existsSync(commondir)
        ? resolve(gitdir, readFileSync(commondir, 'utf8').trim())
        : dirname(dirname(gitdir));
      return { checkout: dir, configDir: common };
    }
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function remoteUrl(configDir: string): string | null {
  const file = join(configDir, 'config');
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8');
  const named = /\[remote "origin"\]([^[]*)/.exec(text) ?? /\[remote "[^"]+"\]([^[]*)/.exec(text);
  if (named === null) return null;
  return /^\s*url\s*=\s*(.+)$/m.exec(named[1])?.[1].trim() ?? null;
}

// cm:why An ssh alias from ~/.ssh/config — `git@github.com-junixlabs:org/repo` — is a name that
// exists on ONE machine. Left in, the same repo gets one id from a developer's aliased clone and
// another from CI's https checkout, which breaks the one thing the id is for. Measured: KineTrak
// resolved to `github.com-junixlabs/junixlabs/kinetrak` while the https remote gave
// `github.com/junixlabs/kinetrak`.
// cm:guard Only ever trims inside the LAST host segment, so a real host with dashes earlier
// (`git.my-company.com`) is left alone. An alias with no dot at all (`gh-work:org/repo`) cannot be
// told from a hostname and still resolves per-machine — write remotes with the real host.
function dealias(host: string): string {
  const dot = host.lastIndexOf('.');
  if (dot < 0) return host;
  const dash = host.indexOf('-', dot);
  return dash < 0 ? host : host.slice(0, dash);
}

// cm:why Two clones of one repo differ in scheme, in the ssh user, in a `.git` suffix and in case;
// none of that is a different repo. Collapsing all of it is what makes the id comparable between a
// developer's ssh clone and a CI job's https checkout.
export function normalizeRemote(url: string): string {
  let s = url.trim().replace(/\.git$/, '');
  s = s.replace(/^[a-z+]+:\/\//i, '');
  s = s.replace(/^[^@/]*@/, '');
  s = s.replace(/:(\d+)\//, '/');
  s = s.replace(':', '/');
  s = s.replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
  const parts = s.split('/').filter((p) => p !== '' && p !== '~');
  if (parts.length === 0) return '';
  const host = dealias(parts[0]);
  parts[0] = host;
  if (!host.includes('.') || parts.length === 1) return basename(parts[parts.length - 1]).toLowerCase();
  return parts.join('/').toLowerCase();
}

// cm:edge contract -> src/workspace/hubData.ts staleRoot — the hub decides "this map was scanned
// somewhere else" by comparing this exact string against the registry path run through this same
// function, so the two must never diverge.
export function scanOrigin(absDir: string): string {
  const dir = resolve(absDir);
  const git = findGit(dir);
  if (git === null) return basename(dir);
  const url = remoteUrl(git.configDir);
  const repo = url === null ? basename(git.checkout).toLowerCase() : normalizeRemote(url);
  const sub = dir.slice(git.checkout.length).replace(/^\//, '');
  return sub === '' ? repo : `${repo}//${sub}`;
}
