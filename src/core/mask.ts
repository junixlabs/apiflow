// cm:why One masker for every reader. The rule "a comment is not code" was written twice — once here
// and once as `blankComments` in the FE scanner — and the second copy had no newline guard, so a regex
// character class containing a quote (`/['"`]/`) put it in a string state that swallowed the REST OF
// THE FILE. Three phantom endpoints reached a published map that way, read out of the scanner's own
// comments. Two implementations of one rule is how one of them stays broken.
// cm:edge lockstep -> src/core/feScanner.ts · src/core/beScanner.ts · src/core/callerGraph.ts — every
// reader masks through this module; a reader that scans raw source reads prose as code.

// cm:guard Masks comments IN PLACE — same length, newlines kept — because every line number and
// every lookbehind below is an index into this string, and a shorter copy silently moves them.
// cm:why A `\bname\b` scan over raw source counts prose as code: a barrel whose comment lists the
// components it adapts produced a usage with no enclosing declaration, which widened the chain to
// ANY and sent one call to every route importing that barrel — measured at 10 of 11 wrong screens on
// a real app. Codebases that document well were penalised the hardest.
// cm:why Bare `//` in JSX text (an unquoted url) is masked to end of line — accepted, because a
// quoted url is protected by the string states and unquoted prose holds no identifiers worth an edge.
export function maskComments(src: string): string {
  const out = src.split('');
  let state: 'code' | 'line' | 'block' | 'sq' | 'dq' | 'tpl' = 'code';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (state === 'code') {
      // cm:guard `/\/\//g` is a regex, not a comment: the escape before the slash is the only thing
      // that separates them without parsing, so a preceding backslash vetoes the comment.
      if (c === '/' && d === '/' && src[i - 1] !== '\\') { state = 'line'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
      if (c === '/' && d === '*') { state = 'block'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
      if (c === "'") state = 'sq';
      else if (c === '"') state = 'dq';
      else if (c === '`') state = 'tpl';
      i++;
      continue;
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; i++; continue; }
      out[i] = ' ';
      i++;
      continue;
    }
    if (state === 'block') {
      if (c === '*' && d === '/') { out[i] = ' '; out[i + 1] = ' '; state = 'code'; i += 2; continue; }
      if (c !== '\n') out[i] = ' ';
      i++;
      continue;
    }
    if (c === '\\') { i += 2; continue; }
    if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"') || (state === 'tpl' && c === '`')) state = 'code';
    // cm:guard An unterminated quote ends at the newline instead of swallowing the rest of the file —
    // an apostrophe in JSX text ("don't") would otherwise mask every comment marker after it.
    else if ((state === 'sq' || state === 'dq') && c === '\n') state = 'code';
    i++;
  }
  return out.join('');
}

// cm:why Type-only imports are dropped here: a screen that imports only a type from an api module
// does not call it, and counting those turns every shared type into a fake dependency edge.

// cm:guard Blanks the TEXT of a template literal, keeping `${…}` intact — the interpolations are real
// code and a reader still has to see them. Route-shaped JSON inside a template is not a route: the
// probe harness's own example, `{ "method": "GET", "path": "/api/users" }`, was published as an
// endpoint of this repo.
// cm:why Applied only by the BE route readers, not by the FE call reader: a FE call legitimately
// builds its url as a template, and blanking that text would erase the paths the map exists to find.
export function maskTemplateText(src: string): string {
  const out = src.split('');
  let i = 0;
  let state: 'code' | 'tpl' | 'sq' | 'dq' = 'code';
  let depth = 0;
  while (i < src.length) {
    const c = src[i];
    if (state === 'code') {
      if (c === '`') state = 'tpl';
      else if (c === "'") state = 'sq';
      else if (c === '"') state = 'dq';
      i++;
      continue;
    }
    if (state === 'sq' || state === 'dq') {
      if (c === '\\') { i += 2; continue; }
      if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"') || c === '\n') state = 'code';
      i++;
      continue;
    }
    if (c === '\\') { i += 2; continue; }
    if (c === '$' && src[i + 1] === '{') { depth++; i += 2; continue; }
    if (depth > 0) {
      if (c === '}') depth--;
      i++;
      continue;
    }
    if (c === '`') { state = 'code'; i++; continue; }
    if (c !== '\n') out[i] = ' ';
    i++;
  }
  return out.join('');
}
