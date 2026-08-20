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
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('carries the map inline and names it in the title', () => {
    expect(html).toContain('<title>apiflow — demo-api</title>');
    expect(html).toContain('id="apimap"');
  });

  it('escapes a map name that contains markup', () => {
    expect(renderViewer(mapWith('<b>x</b>'), '/tmp/x.apimap')).toContain('&lt;b&gt;x&lt;/b&gt;');
  });
});
