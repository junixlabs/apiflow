import { describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createApiMap, endpointId, finalizeApiMap, serializeMap } from '@junixlabs/apiflow-map';

// cm:why Runs the real CLI through a real closed pipe — a unit test on the handler passes while
// `apiflow impact map | head` still prints a stack trace.
// cm:why Two details make it reproduce: the output must exceed the pipe buffer (~64KB), or every
// write lands before `head` exits.
// cm:why And the verdict must come from PIPESTATUS[0] — `$?` after a pipeline is head's status,
// which is always 0.
describe('a closed pipe is not a crash', () => {
  it('exits 0 and stays silent when the reader goes away mid-listing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'apiflow-epipe-'));
    const map = createApiMap('big', 'github.com/acme/app', 'apiflow scan-fe/1');
    const long = 'mot-duong-dan-du-dai-de-vuot-qua-buffer-cua-pipe';
    for (let i = 0; i < 6000; i++) {
      const path = `/api/${i}/${long}`;
      map.endpoints.push({ id: endpointId('GET', path), method: 'GET', path });
    }
    const file = join(dir, 'big.apimap');
    const errFile = join(dir, 'err.txt');
    writeFileSync(file, serializeMap(finalizeApiMap(map)));
    const out = execFileSync(
      'bash',
      ['-c', `node bin/cli.js impact ${file} 2>${errFile} | head -3; echo "rc=\${PIPESTATUS[0]}"`],
      { cwd: join(import.meta.dirname, '..', '..'), encoding: 'utf8' }
    );
    expect(out).toContain('6000 endpoint');
    expect(out).toContain('rc=0');
    expect(readFileSync(errFile, 'utf8')).toBe('');
  }, 60_000);
});
