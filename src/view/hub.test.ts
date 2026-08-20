import { describe, expect, it } from 'vitest';
import { renderHub } from './hub';
import type { HubMap, HubProject } from './hub';

const NOW = Date.parse('2026-01-10T12:00:00Z');

function map(over: Partial<HubMap> = {}): HubMap {
  return {
    kind: 'fe', scannedAt: '2026-01-10T10:00:00Z', endpoints: 12, screens: 4, calls: 20,
    unresolved: 3, open: 0, both: 8, uncalled: 2, feOnly: 1, unpaired: 1,
    hasFe: true, hasBe: false, ...over,
  };
}

const OPTIONS = { workspace: '/w', linkTo: (p: HubProject) => `/p/${p.id}`, live: true };

function hub(projects: HubProject[]): string {
  return renderHub(projects, OPTIONS, NOW);
}

const TWO: HubProject[] = [
  { id: 'beta', name: 'Beta', fe: '/repo/beta-ui', maps: [map()] },
  { id: 'alpha', name: 'Alpha', fe: '/repo/alpha-ui', maps: [] },
];

describe('hub filtering contract', () => {
  // cm:why The script hides a card with the `hidden` attribute, which loses to any rule that sets
  // `display` on the card — the symptom is a filter that counts correctly and hides nothing.
  it('overrides display for anything the script hides', () => {
    const html = hub(TWO);
    expect(html).toContain('[hidden] { display:none !important; }');
  });

  it('carries every data attribute the filter and sort read', () => {
    const html = hub(TWO);
    for (const key of ['data-hay', 'data-state', 'data-stale', 'data-scanned',
      'data-endpoints', 'data-screens', 'data-unresolved', 'data-open', 'data-feonly']) {
      expect(html, key).toContain(`${key}="`);
    }
  });

  it('makes an unscanned project findable as unscanned', () => {
    const html = hub(TWO);
    expect(html).toContain('data-state="unscanned"');
    expect(html).toContain('data-scanned="0"');
  });

  it('marks a map scanned from a root the project no longer points at', () => {
    const stale = hub([{ id: 'beta', name: 'Beta', fe: '/repo/new-ui', maps: [map({ scannedFrom: '/repo/old-ui' })] }]);
    expect(stale).toContain('data-stale="1"');
    expect(hub(TWO)).not.toContain('data-stale="1"');
  });

  it('searches on the paths as well as the name', () => {
    expect(hub(TWO)).toContain('/repo/beta-ui');
    const hay = /data-hay="([^"]*)"/.exec(hub(TWO)) as RegExpExecArray;
    expect(hay[1]).toContain('/repo/beta-ui');
    expect(hay[1]).toBe(hay[1].toLowerCase());
  });

  it('ships no toolbar when there is nothing to sort', () => {
    const html = hub([]);
    expect(html).not.toContain('id="hb-q"');
    expect(html).not.toContain('id="hb-sort"');
  });
});
