import { describe, expect, it } from 'vitest';
import { ADD_SCRIPT } from './addProject';
import { PANES_SCRIPT, PANES_SCRIPT_2, PANES_SCRIPT_3, PANES_SCRIPT_4 } from './panes';
import { HUB_SCRIPT } from './hub';
import { THEME_BOOT, THEME_SCRIPT } from './theme';

// cm:why Compiles every embedded script instead of eyeballing it. A backtick or a real newline inside
// a quoted string ends the String.raw literal early or breaks the JS, and the only symptom is one
// console error in the browser — the page still renders, having silently lost that whole script.
const compiles = (source: string) => {
  new Function(source);
};

const PIECES: Array<[string, string]> = [
  ['PANES_SCRIPT', PANES_SCRIPT],
  ['PANES_SCRIPT_2', PANES_SCRIPT_2],
  ['PANES_SCRIPT_4', PANES_SCRIPT_4],
  ['PANES_SCRIPT_3', PANES_SCRIPT_3],
  ['ADD_SCRIPT', ADD_SCRIPT],
  ['THEME_SCRIPT', THEME_SCRIPT],
];

// cm:why The hub ships its own pair, not the panes: it is a separate page, so concatenating all of
// them would test a combination that never loads and miss the one that does.
const HUB_PIECES: Array<[string, string]> = [
  ['ADD_SCRIPT', ADD_SCRIPT],
  ['THEME_SCRIPT', THEME_SCRIPT],
  ['HUB_SCRIPT', HUB_SCRIPT],
];

describe('embedded scripts', () => {
  // cm:guard The pieces are concatenated into ONE <script> in the shipped page, so they share a
  // scope — a name declared twice across two pieces compiles alone and throws in the browser.
  it('compiles as one script, the way the page ships it', () => {
    expect(() => compiles(PIECES.map(([, source]) => source).join(''))).not.toThrow();
  });

  for (const [name, source] of PIECES) {
    it(`compiles ${name} on its own`, () => {
      expect(() => compiles(source)).not.toThrow();
    });
  }

  it('compiles the hub combination, which is a different set of pieces', () => {
    expect(() => compiles(HUB_PIECES.map(([, source]) => source).join(''))).not.toThrow();
  });

  it('compiles the boot snippet that runs in <head>', () => {
    const inner = /<script>([\s\S]*)<\/script>/.exec(THEME_BOOT);
    expect(inner).not.toBeNull();
    expect(() => compiles(inner?.[1] ?? '')).not.toThrow();
  });

  // cm:guard A backtick anywhere inside these would have ended the String.raw literal at build time,
  // so finding one means the literal was closed and reopened — assert none survives.
  it('carries no backtick, which would have closed the literal it lives in', () => {
    for (const [name, source] of [...PIECES, ['HUB_SCRIPT', HUB_SCRIPT] as [string, string]]) {
      expect(source, name).not.toContain('`');
    }
  });
});
