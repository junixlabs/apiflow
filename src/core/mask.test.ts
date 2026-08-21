import { describe, expect, it } from 'vitest';
import { maskComments, maskTemplateText } from './mask';

// cm:why One masker for every reader. The rule was written twice, and the second copy had no newline
// guard: a regex character class containing a quote put it in a string state that swallowed the rest
// of the file, so three phantom endpoints reached a published map out of the scanner's own comments.
describe('maskComments', () => {
  it('keeps masking comments after a regex that contains a quote character', () => {
    const src = ["const QUOTE = /['\"`]/;", "// app.get('/x', h) registers a route"].join('\n');
    expect(maskComments(src).split('\n')[1].trim()).toBe('');
  });

  it('is the same length and keeps every newline, so a line number still resolves', () => {
    const src = "const a = 1\n// gone\nconst b = 2\n";
    const masked = maskComments(src);
    expect(masked).toHaveLength(src.length);
    expect(masked.split('\n')).toHaveLength(src.split('\n').length);
    expect(masked.split('\n')[2]).toBe('const b = 2');
  });

  it('does not mask a url inside a string', () => {
    const src = "const u = 'https://example.com/a'";
    expect(maskComments(src)).toContain('https://example.com/a');
  });
});

// cm:why Route-shaped JSON in a doc string is not a route: the probe harness's own example,
// `{ "method": "GET", "path": "/api/users" }`, was published as an endpoint of this repo.
describe('maskTemplateText', () => {
  it('blanks the text of a template literal', () => {
    const src = 'const doc = `{ "method": "GET", "path": "/api/users" }`';
    expect(maskTemplateText(src)).not.toContain('/api/users');
    expect(maskTemplateText(src)).toHaveLength(src.length);
  });

  // cm:guard The interpolations are real code and a reader still has to see them.
  it('keeps ${…} intact', () => {
    const src = 'const s = `prefix ${realCode} suffix`';
    expect(maskTemplateText(src)).toContain('${realCode}');
    expect(maskTemplateText(src)).not.toContain('prefix');
  });

  it('leaves quoted strings alone', () => {
    const src = "const p = '/api/users'";
    expect(maskTemplateText(src)).toContain('/api/users');
  });
});
