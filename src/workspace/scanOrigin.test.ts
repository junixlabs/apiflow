import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { normalizeRemote, scanOrigin } from './scanOrigin';

function repo(url: string | null): string {
  const root = mkdtempSync(join(tmpdir(), 'apiflow-origin-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  writeFileSync(
    join(root, '.git', 'config'),
    url === null
      ? '[core]\n\trepositoryformatversion = 0\n'
      : `[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\turl = ${url}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n`
  );
  return root;
}

describe('scanOrigin', () => {
  it('turns an ssh remote into host/path, dropping user and .git', () => {
    expect(scanOrigin(repo('git@gitlab.com:sidcorp-it/canawan-api.git'))).toBe('gitlab.com/sidcorp-it/canawan-api');
  });

  it('gives the same id for the ssh clone and the https checkout of one repo', () => {
    const ssh = scanOrigin(repo('git@github.com:SidCorp-co/getcontent.git'));
    const https = scanOrigin(repo('https://github.com/sidcorp-co/getcontent'));
    expect(ssh).toBe(https);
  });

  // cm:guard This test is the reason normalizeRemote strips userinfo: a token that reaches the map
  // reaches every reviewer of the commit that carries it.
  it('never copies a credential out of the remote url', () => {
    const id = scanOrigin(repo('https://oauth2:glpat-SECRETTOKEN@gitlab.com/sidcorp-it/canawan-api.git'));
    expect(id).toBe('gitlab.com/sidcorp-it/canawan-api');
    expect(id).not.toContain('glpat');
    expect(id).not.toContain('oauth2');
  });

  it('marks the scanned subdirectory of a monorepo', () => {
    const root = repo('git@github.com:sidcorp-co/getcontent.git');
    const sub = join(root, 'apps', 'web-next');
    mkdirSync(sub, { recursive: true });
    expect(scanOrigin(sub)).toBe('github.com/sidcorp-co/getcontent//apps/web-next');
  });

  it('reads the remote through a linked worktree, where .git is a file', () => {
    const main = repo('git@github.com:sidcorp-co/getcontent.git');
    const wt = mkdtempSync(join(tmpdir(), 'apiflow-wt-'));
    const gitdir = join(main, '.git', 'worktrees', 'iss-1');
    mkdirSync(gitdir, { recursive: true });
    writeFileSync(join(gitdir, 'commondir'), '../..\n');
    writeFileSync(join(wt, '.git'), `gitdir: ${gitdir}\n`);
    expect(scanOrigin(wt)).toBe('github.com/sidcorp-co/getcontent');
  });

  it('falls back to the checkout name when the repo has no remote', () => {
    const root = repo(null);
    expect(scanOrigin(root)).toBe(root.split('/').pop()?.toLowerCase());
  });

  it('falls back to the directory name outside a repo', () => {
    const plain = mkdtempSync(join(tmpdir(), 'apiflow-plain-'));
    expect(scanOrigin(plain)).toBe(plain.split('/').pop());
  });

  it('keeps a port out of the path', () => {
    expect(normalizeRemote('ssh://git@gitlab.com:2222/sidcorp-it/canawan-api.git')).toBe('gitlab.com/sidcorp-it/canawan-api');
  });

  it('uses the last segment for a filesystem remote', () => {
    expect(normalizeRemote('/srv/git/canawan-api.git')).toBe('canawan-api');
  });
});
