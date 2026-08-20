import { describe, expect, it } from 'vitest';
import { renderHub } from './hub';
import type { HubMap, HubOptions, HubProject } from './hub';

const NOW = Date.parse('2026-01-10T12:00:00Z');

function map(over: Partial<HubMap> = {}): HubMap {
  return {
    kind: 'fe', scannedAt: '2026-01-10T10:00:00Z', endpoints: 12, screens: 4, calls: 20,
    unresolved: 3, open: 0, both: 8, uncalled: 2, feOnly: 1, unpaired: 1,
    hasFe: true, hasBe: false, ...over,
  };
}

const OPTIONS: HubOptions = { workspace: '/w', linkTo: (p) => `/p/${p.id}`, live: true };

function hub(projects: HubProject[], over: Partial<HubOptions> = {}): string {
  return renderHub(projects, { ...OPTIONS, ...over }, NOW);
}

const TWO: HubProject[] = [
  { id: 'beta', name: 'Beta', fe: '/repo/beta-ui', maps: [map()] },
  { id: 'alpha', name: 'Alpha', fe: '/repo/alpha-ui', maps: [] },
];

const attrs = (html: string, name: string): string[] =>
  [...html.matchAll(new RegExp(`${name}="([^"]*)"`, 'g'))].map((m) => m[1]);

describe('hub shell', () => {
  // cm:guard A rail row with no pane behind it is a dead click, and a pane with no row is
  // unreachable. Both are silent, so the two lists are compared here instead of by eye.
  it('backs every rail row with a pane and vice versa', () => {
    const html = hub(TWO);
    expect(attrs(html, 'data-pick').sort()).toEqual(['all', 'alpha', 'beta']);
    expect(attrs(html, 'data-detail').sort()).toEqual(['all', 'alpha', 'beta', 'none']);
  });

  // cm:why The script hides rows with the `hidden` attribute, which loses to any rule that sets
  // `display` on the row — the symptom is a filter that counts correctly and hides nothing.
  it('overrides display for anything the script hides', () => {
    expect(hub(TWO)).toContain('[hidden] { display:none !important; }');
  });

  // cm:guard Without the marker the page either flashes every project at once before the script
  // runs, or hides them in markup and shows an empty column when the script never runs.
  it('gates pane hiding on a marker set before first paint', () => {
    const html = hub(TWO);
    expect(html).toContain(".classList.add('has-js')");
    expect(html).toContain('.has-js .detail { display:none; }');
    expect(html).not.toContain('<section class="detail" hidden');
  });

  it('carries every data attribute the filter and sort read', () => {
    const html = hub(TWO);
    for (const key of ['data-hay', 'data-state', 'data-stale', 'data-scanned',
      'data-endpoints', 'data-unresolved', 'data-open', 'data-feonly']) {
      expect(html, key).toContain(`${key}="`);
    }
  });

  it('opens on the workspace pane, not on whichever project sorts first', () => {
    expect(hub(TWO)).toContain("show(found ? want : 'all')");
  });

  it('makes an unscanned project findable as unscanned', () => {
    const html = hub(TWO);
    expect(html).toContain('data-state="unscanned"');
    expect(html).toContain('data-scanned="0"');
  });

  it('marks a map scanned from a root the project no longer points at', () => {
    const stale = hub([{ id: 'beta', name: 'Beta', fe: '/repo/new-ui', maps: [map({ scannedFrom: '/repo/old-ui' })] }]);
    expect(stale).toContain('data-stale="1"');
    expect(stale).toContain('lệch gốc');
    expect(hub(TWO)).not.toContain('data-stale="1"');
  });

  it('searches on the paths as well as the name', () => {
    const hay = attrs(hub(TWO), 'data-hay')[0];
    expect(hay).toContain('/repo/');
    expect(hay).toBe(hay.toLowerCase());
  });

  it('ships no shell at all when there is nothing to list', () => {
    const html = hub([]);
    expect(html).not.toContain('id="hb-q"');
    expect(html).not.toContain('class="shell"');
    expect(html).toContain('Chưa có project nào');
  });
});

describe('hub numbers', () => {
  // cm:why The bar carries its own numbers instead of pointing at a legend elsewhere on the page.
  it('labels each segment of the coverage bar with its own count', () => {
    const html = hub([{ id: 'beta', name: 'Beta', fe: '/r', maps: [map({ both: 8, uncalled: 2, feOnly: 1, unpaired: 1 })] }]);
    expect(html).toContain('có màn gọi');
    expect(html).toContain('<b>8</b>');
    expect(html).not.toContain('Thanh màu trong mỗi thẻ');
  });

  it('leaves out the segments that are zero rather than printing 0', () => {
    const html = hub([{ id: 'b', name: 'B', fe: '/r', maps: [map({ both: 8, uncalled: 0, feOnly: 0, unpaired: 0 })] }]);
    expect(html).toContain('<b>8</b> có màn gọi');
    expect(html).not.toContain('<b>0</b>');
  });

  it('sends each finding to the pane that shows it', () => {
    const html = hub([{ id: 'b', name: 'B', fe: '/r', be: '/r2', maps: [map({ hasBe: true, open: 4, feOnly: 2, unresolved: 5 })] }]);
    expect(html).toContain('href="/p/b#alerts"');
    expect(html).toContain('href="/p/b#unresolved"');
  });

  it('keeps a finding unlinked when the project has no map page to open', () => {
    const html = hub([{ id: 'b', name: 'B', fe: '/r', maps: [map({ unresolved: 5 })] }], { linkTo: () => null });
    expect(html).toContain('<span class="flag warn">5 unresolved</span>');
    expect(html).not.toContain('href="null');
  });

  // cm:guard A stale map outranks every real finding: those numbers were measured on a repo the
  // project no longer points at, so "the number is wrong" beats "the number is bad".
  it('ranks a stale root above an open endpoint in the todo list', () => {
    const html = hub([
      { id: 'open', name: 'Open', be: '/r', maps: [map({ hasFe: false, hasBe: true, open: 40 })] },
      { id: 'moved', name: 'Moved', fe: '/r', maps: [map({ scannedFrom: '/old' })] },
    ]);
    const todo = html.slice(html.indexOf('class="todo"'));
    expect(todo.indexOf('gốc cũ')).toBeLessThan(todo.indexOf('không thấy cổng chặn'));
  });

  it('says how many findings it did not print', () => {
    const many: HubProject[] = Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`, name: `P${i}`, fe: '/r', be: '/r2',
      maps: [map({ hasBe: true, open: 2, feOnly: 2, uncalled: 2, unresolved: 2 })],
    }));
    const html = hub(many);
    expect(html).toMatch(/… và \d+ việc nữa/);
  });

  it('says so when there is nothing to look at rather than printing an empty box', () => {
    const clean = hub([{ id: 'ok', name: 'Ok', fe: '/r', be: '/r2',
      maps: [map({ hasBe: true, open: 0, feOnly: 0, uncalled: 0, unresolved: 0, unpaired: 0 })] }]);
    expect(clean).toContain('Không có gì');
  });
});
