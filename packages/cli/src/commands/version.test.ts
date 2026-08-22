import { describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(import.meta.dirname, '..', '..');

// cm:why Runs the real binary: with no positional argument `--version` fell through to the dev
// server, so asking a published install its version opened a listener instead of answering.
describe('apiflow --version', () => {
  it('prints the manifest version and exits', () => {
    const expected = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
    for (const flag of ['--version', '-v']) {
      const out = execFileSync('node', [join(root, 'bin', 'cli.js'), flag], {
        encoding: 'utf8', timeout: 20_000,
      });
      expect(out.trim()).toBe(expected);
    }
  }, 60_000);
});

// cm:why HELP is a template literal, and a backtick in a flag description ended it mid-string: node
// still parsed the file, `--help` printed `NaN`, and nothing failed.
// cm:why This asserts the rendering, not the source, because that is the only thing that catches
// the next one.
describe('apiflow --help', () => {
  it('renders the command list', () => {
    const out = execFileSync('node', [join(root, 'bin', 'cli.js'), '--help'], { encoding: 'utf8', timeout: 20_000 });
    expect(out).toContain('apiflow scan-fe');
    expect(out).toContain('apiflow probe');
    expect(out).not.toContain('NaN');
    expect(out.split('\n').length).toBeGreaterThan(20);
  });
});
