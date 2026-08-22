import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApiMap, endpointId, finalizeApiMap, serializeMap } from '@junixlabs/apiflow-map';
import { addProject, findProject } from './registry';
import { importMap, readImportable } from './importMap';
import { historyOf, readMap } from './store';
import { sidesOf } from './sides';

let home: string;
let handover: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'apiflow-home-'));
  handover = mkdtempSync(join(tmpdir(), 'apiflow-handover-'));
  process.env.APIFLOW_HOME = home;
});

afterEach(() => {
  delete process.env.APIFLOW_HOME;
  rmSync(home, { recursive: true, force: true });
  rmSync(handover, { recursive: true, force: true });
});

const write = (name: string, generator: string, root: string): string => {
  const map = createApiMap('webapp', root, generator);
  map.endpoints.push({ id: endpointId('GET', '/orders'), method: 'GET', path: '/orders' });
  const file = join(handover, name);
  writeFileSync(file, serializeMap(finalizeApiMap(map)));
  return file;
};

// cm:why A BE that runs on another device is scanned there and the FILE travels: the map is
// content-derived and timestamp-free, so it is the whole handover and there is nothing to host.
describe('importing a side scanned on another machine', () => {
  it('registers a project whose only side is an imported map', () => {
    const file = write('be.apimap', 'apiflow scan-be/1', 'gitlab.com/acme/api');
    const entry = addProject({ name: 'Webapp', imported: ['be'] });
    const done = importMap(entry.id, 'be', file);

    expect(findProject('webapp')?.be).toBeUndefined();
    expect(readMap('webapp', 'be')?.metadata.root).toBe('gitlab.com/acme/api');
    expect(done.root).toBe('gitlab.com/acme/api');
    expect(historyOf('webapp', 'be')).toHaveLength(1);
  });

  it('marks the side imported so the header cannot offer a re-scan', () => {
    const file = write('be.apimap', 'apiflow scan-be/1', 'gitlab.com/acme/api');
    addProject({ name: 'Webapp', imported: ['be'] });
    importMap('webapp', 'be', file);

    const be = sidesOf('webapp').find((s) => s.kind === 'be');
    expect(be?.imported).toBe(true);
    expect(be?.root).toBe('gitlab.com/acme/api');
  });

  // cm:guard Dropping an fe map into the be slot makes the reconciliation compare a side against
  // itself and report every endpoint as agreeing — a silent wrong answer, not a visible failure.
  it('refuses a map of the wrong half', () => {
    const file = write('fe.apimap', 'apiflow scan-fe/1', 'github.com/acme/ui');
    expect(() => readImportable('be', file)).toThrow(/is a fe map, not a be map/);
  });

  it('refuses a linked map, which has no single side', () => {
    const file = write('linked.apimap', 'apiflow link/1', 'github.com/acme/ui + gitlab.com/acme/api');
    expect(() => readImportable('be', file)).toThrow(/not a one-sided scan/);
  });

  it('refuses a path that is not a file', () => {
    expect(() => readImportable('be', join(handover, 'nope.apimap'))).toThrow(/not an existing file/);
  });

  it('still refuses a project with no directory and no import', () => {
    expect(() => addProject({ name: 'Empty' })).toThrow(/or a map file to import/);
  });
});
