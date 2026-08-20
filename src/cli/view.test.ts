import { describe, expect, it } from 'vitest';
import { createApiMap, endpointId, finalizeApiMap } from '../core/apimap';
import { embedJson, renderViewer } from './view';

function mapWith(name: string) {
  const map = createApiMap(name, '/repo', 'apiflow scan-be/1');
  map.endpoints.push({ id: endpointId('GET', '/x'), method: 'GET', path: '/x', source: { file: 'routes/api.php', line: 1 } });
  return finalizeApiMap(map);
}

describe('embedJson', () => {
  it('escapes a closing script tag hidden in scanned content', () => {
    const payload = embedJson({ path: '</script><img src=x onerror=alert(1)>' });
    expect(payload).not.toContain('</script>');
    expect(JSON.parse(payload).path).toBe('</script><img src=x onerror=alert(1)>');
  });

  it('escapes the line separators that would break the script', () => {
    expect(embedJson({ a: '\u2028\u2029' })).not.toMatch(/[\u2028\u2029]/);
  });
});

describe('renderViewer', () => {
  const html = renderViewer(mapWith('demo-api'), '/tmp/demo.apimap');

  it('needs no network to open', () => {
    // cm:why Checks FETCHABLE positions, not the substring "http": the SVG namespace URI is a name,
    // never a request, so a blanket match would forbid drawing anything and prove nothing.
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["']?https?:\/\//i);
    expect(html).not.toMatch(/url\(\s*["']?https?:\/\//i);
    expect(html).not.toMatch(/\b(?:fetch|importScripts|XMLHttpRequest|EventSource|WebSocket)\s*\(/);
    expect(html).not.toMatch(/\bimport\s*\(\s*["']https?:/);
    for (const url of html.match(/https?:\/\/[^\s"'<>)]+/g) ?? []) {
      expect(url).toBe('http://www.w3.org/2000/svg');
    }
  });

  it('carries the map inline and names it in the title', () => {
    expect(html).toContain('<title>apiflow — demo-api</title>');
    expect(html).toContain('id="apimap"');
  });

  it('escapes a map name that contains markup', () => {
    expect(renderViewer(mapWith('<b>x</b>'), '/tmp/x.apimap')).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});

describe('visual panes', () => {
  const html = renderViewer(mapWith('demo-api'), '/tmp/demo.apimap');

  it('ships all three panes and their mount points', () => {
    for (const id of ['pane-list', 'pane-cover', 'pane-graph', 'blocks', 'bip', 'scope-label', 'graph-note']) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('refuses to draw a graph too wide to read instead of cutting it', () => {
    expect(html).toContain('quá rộng để vẽ');
    expect(html).toContain('MAX_ROWS');
  });
});

describe('favicon data URI', () => {
  const html = renderViewer(mapWith('demo-api'), '/tmp/demo.apimap');

  // cm:why A raw `"` from an SVG attribute would close the href and break every tag after it —
  // the page still renders enough to look fine, which is exactly why this needs a test.
  it('carries no character that would close the href attribute', () => {
    const href = /<link rel="icon" href="([^"]*)">/.exec(html);
    expect(href).not.toBeNull();
    expect(href?.[1]).toContain('data:image/svg+xml,');
    expect(href?.[1]).not.toMatch(/["<>]/);
  });
});
