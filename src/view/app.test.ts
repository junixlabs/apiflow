import { describe, expect, it } from 'vitest';
import { createApiMap, endpointId, finalizeApiMap } from '../core/apimap';
import { embedJson, renderApp, SECTIONS } from './app';
import { renderHub } from './hub';

function mapWith(name: string) {
  const map = createApiMap(name, '/repo', 'apiflow scan-be/1');
  map.endpoints.push({ id: endpointId('GET', '/x'), method: 'GET', path: '/x', source: { file: 'routes/api.php', line: 1 } });
  return finalizeApiMap(map);
}

const offline = (name = 'demo-api') => renderApp({ map: mapWith(name), sourcePath: '/tmp/demo.apimap', live: false });

describe('embedJson', () => {
  it('escapes a closing script tag hidden in scanned content', () => {
    expect(embedJson({ path: '</script><img>' })).not.toContain('</script>');
  });

  it('escapes the line separators that would break the script', () => {
    // cm:guard The input is written with \u escapes, never as literal separators: a raw U+2028 in
    // a source file is invisible in every editor and breaks the next reader who copies the line.
    expect(embedJson({ s: '\u2028\u2029' })).toBe('{"s":"\\u2028\\u2029"}');
  });
});

describe('renderApp offline', () => {
  const html = offline();

  it('opens with no request to anywhere', () => {
    // cm:why Checks FETCHABLE positions, not the substring "http": the SVG namespace URI is a name,
    // never a request, so a blanket match would forbid drawing anything and prove nothing.
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["']?https?:\/\//i);
    expect(html).not.toMatch(/url\(\s*["']?https?:\/\//i);
    expect(html).not.toMatch(/\b(?:importScripts|XMLHttpRequest|EventSource|WebSocket)\s*\(/);
    expect(html).not.toMatch(/\bimport\s*\(\s*["']https?:/);
    for (const url of html.match(/https?:\/\/[^\s"'<>)]+/g) ?? []) {
      expect(url).toBe('http://www.w3.org/2000/svg');
    }
  });

  // cm:guard The page ships the scan and add-project code even offline, so the ONLY thing keeping a
  // file:// page from posting at a server that is not there is the live gate — assert the gate and
  // the relative target, not the absence of fetch.
  it('aims every fetch at a relative apiflow route, and ships no control that fires one', () => {
    const calls = html.match(/fetch\([^,)]*/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      // cm:why Asserts the SHAPE of the target, not one literal: the target is a ternary now, and a
      // test pinned to one spelling would go green the moment someone wrote fetch(url) instead.
      expect(call, call).toMatch(/'\/api\//);
      expect(call, call).not.toMatch(/:\/\/|'\/\//);
    }
    expect(html).toContain('id="project">null<');
    for (const id of ['scan-fe', 'scan-be', 'add-open', 'add-dlg']) {
      expect(html).not.toContain(`id="${id}"`);
    }
  });

  it('carries the map inline and names it in the title', () => {
    expect(html).toContain('<title>apiflow — demo-api</title>');
    expect(html).toContain('id="apimap"');
  });

  it('escapes a map name that contains markup', () => {
    expect(offline('<b>x</b>')).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('says the counts are candidates rather than verdicts', () => {
    expect(html).toContain('ứng viên, không phải phán quyết');
  });
});

describe('panes', () => {
  const html = offline();

  it('ships a pane for every rail entry', () => {
    for (const section of SECTIONS) expect(html).toContain(`id="pane-${section.id}"`);
  });

  it('ships the mount points the visual panes draw into', () => {
    for (const id of ['blocks', 'bip', 'scope-label', 'graph-note', 'imp-body', 'ep-rows',
      'ep-kpis', 'ov-kpis', 'f-groups', 'ep-pager', 'sc-pager']) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('defines both dark selectors from one token string, so they cannot drift', () => {
    // cm:why Counts the palette twice on purpose: the media query serves a viewer who never chose,
    // the attribute selector one who did, and a palette present in only one is a half-dark page.
    const dark = html.match(/--bg:#070b14/g) ?? [];
    expect(dark).toHaveLength(2);
    expect(html).toContain('@media (prefers-color-scheme: dark) { :root:not([data-theme="light"])');
    expect(html).toContain(':root[data-theme="dark"]');
  });

  it('applies a stored theme before the body paints', () => {
    const headEnd = html.indexOf('</head>');
    expect(html.indexOf("localStorage.getItem('apiflow-theme')")).toBeLessThan(headEnd);
  });

  it('refuses to draw a graph too wide to read instead of cutting it', () => {
    expect(html).toContain('quá rộng để vẽ');
    expect(html).toContain('MAX_ROWS');
  });

  it('says out loud that the screen list is capped', () => {
    expect(html).toContain('SCREEN_CAP');
  });
});

describe('live extras', () => {
  const live = renderApp({ map: mapWith('demo-api'), sourcePath: '/tmp/demo.apimap', live: true, projectId: 'demo' });

  it('names the revision each side was scanned at', () => {
    const withSides = renderApp({
      map: mapWith('demo-api'), sourcePath: '/tmp/demo.apimap', live: true, projectId: 'demo',
      now: Date.parse('2026-08-20T10:00:00Z'),
      sides: [{ kind: 'fe', root: '/repo/web', branch: 'release/stg', sha: '387da27', scannedAt: '2026-08-20T09:30:00Z' }],
    });
    expect(withSides).toContain('release/stg · 387da27');
    expect(withSides).toContain('30 phút trước');
  });

  it('says the revision is unreadable rather than leaving a blank where a sha goes', () => {
    const noGit = renderApp({
      map: mapWith('demo-api'), sourcePath: '/tmp/demo.apimap', live: true, projectId: 'demo', now: 0,
      sides: [{ kind: 'be', root: '/repo/api' }],
    });
    expect(noGit).toContain('không đọc được revision');
  });

  it('only offers the scan buttons when a project backs the page', () => {
    expect(live).toContain('id="scan-fe"');
    expect(live).toContain('id="scan-be"');
    expect(live).toContain('id="project">"demo"<');
  });

  it('offers Thêm project on a live page even when no project backs it', () => {
    const bare = renderApp({ map: mapWith('demo-api'), sourcePath: '/tmp/demo.apimap', live: true });
    expect(bare).toContain('id="add-open"');
    expect(bare).toContain('id="add-dlg"');
    expect(bare).not.toContain('id="scan-fe"');
  });
});

describe('one shell for both pages', () => {
  const project = renderApp({
    map: mapWith('demo-api'), sourcePath: '/tmp/demo.apimap', live: true, projectId: 'demo', homeHref: '/',
  });
  const hub = renderHub(
    [{ id: 'demo', name: 'Demo', fe: '/repo/web', maps: [] }],
    { workspace: '/w', linkTo: () => null, live: true },
    Date.parse('2026-08-20T10:00:00Z')
  );

  // cm:guard The hub and a project page are one design or they are two products. These are the
  // structures that carry that: drift here is exactly what a reader feels as "another app".
  it('lays both pages out in the same shell', () => {
    for (const cls of ['class="app-shell"', 'class="rail"', 'class="main"', 'class="phead"',
      'class="pident"', 'class="pmeta"', 'class="btnrow"', 'class="railfoot"']) {
      expect(project, cls).toContain(cls);
      expect(hub, cls).toContain(cls);
    }
  });

  it('styles both pages from the one shell stylesheet', () => {
    // cm:why Asserts a rule only APP_STYLE defines. Two pages that merely look alike drift the first
    // time one of them grows its own copy of the rail.
    for (const rule of ['.app-shell { display:grid; grid-template-columns:248px 1fr',
      '.rail .railfoot', '.kpistrip .k1', '.watch a']) {
      expect(project, rule).toContain(rule);
      expect(hub, rule).toContain(rule);
    }
  });

  it('puts the brand at the top of the rail on both, and makes it the way home', () => {
    expect(hub).toContain('<div class="brandbar">');
    expect(project).toContain('<div class="brandbar">');
    expect(project).toContain('<a class="home" href="/"');
    // cm:guard The hub IS home, so its brand is not a link — but it keeps the same element, or the
    // two rails start at different heights.
    expect(hub).toContain('<span class="home">');
    expect(hub).not.toContain('<a class="home"');
  });

  it('leaves the offline file without a home link, because there is no hub beside it', () => {
    const file = renderApp({ map: mapWith('demo-api'), sourcePath: '/tmp/demo.apimap', live: false });
    expect(file).not.toContain('<a class="home"');
    expect(file).toContain('<span class="home">');
  });

  // cm:guard `+ Thêm project` is a workspace action: in the header button row it read as one of the
  // things you can do TO the project you opened.
  it('keeps the workspace action at the foot of the rail on both, not in the header row', () => {
    for (const page of [project, hub]) {
      const foot = page.slice(page.indexOf('class="railfoot"'));
      expect(foot).toContain('id="add-open"');
      expect(page.slice(0, page.indexOf('class="railfoot"'))).not.toContain('id="add-open"');
    }
  });
});

describe('favicon data URI', () => {
  const html = offline();

  // cm:why A raw `"` from an SVG attribute would close the href and break every tag after it —
  // the page still renders enough to look fine, which is exactly why this needs a test.
  it('carries no character that would close the href attribute', () => {
    const href = /<link rel="icon" href="([^"]*)">/.exec(html);
    expect(href).not.toBeNull();
    expect(href?.[1]).toContain('data:image/svg+xml,');
    expect(href?.[1]).not.toMatch(/["<>]/);
  });
});
