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
