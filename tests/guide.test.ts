import { describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(REPO, 'docs');
const GUIDE = join(DOCS, 'guide');
const CLI = join(REPO, 'packages', 'cli', 'bin', 'cli.js');

type Status = 'shipped' | 'upcoming' | 'reference';
interface Step { command: string; expected: string[] }
interface Page { file: string; status: Status; steps: Step[] }

// cm:why The guide is the test. A user guide made of prose can be wrong for months; a guide made of
// commands and their output is replayed on every push, so it cannot drift without failing.
// cm:edge lockstep -> docs/guide — every page here is executed. A page whose transcript stops
// matching is a page that lies, and CI fails rather than the reader finding out.
export function parsePage(file: string, text: string, fallback?: Status): Page {
  const front = /^---\n([\s\S]*?)\n---/.exec(text);
  const meta = front?.[1] ?? '';
  const status = (/status:\s*(shipped|upcoming|reference)/.exec(meta)?.[1] as Status | undefined) ?? fallback;
  if (status === undefined) throw new Error(`${file}: frontmatter needs status: shipped | upcoming | reference`);
  // cm:guard `reference` is the only page kind CI cannot replay, so it must say WHY in the
  // frontmatter.
  // cm:guard Without that field the status is a loophole: every stale page would become a reference
  // page the day its transcript broke.
  if (status === 'reference' && !/why-not-replayed:\s*\S/.test(meta)) {
    throw new Error(`${file}: status: reference must also carry "why-not-replayed: <reason>"`);
  }

  const steps: Step[] = [];
  // cm:edge contract -> docs/guide/index.md — fences carry a rouge option (`console?prompt=%24+`), so
  // dropping the query string here renders a page correctly while silently un-replaying it.
  for (const block of text.matchAll(/```console(?:\?\S*)?\n([\s\S]*?)```/g)) {
    let current: Step | undefined;
    for (const line of block[1].split('\n')) {
      if (line.startsWith('$ ')) {
        current = { command: line.slice(2).trim(), expected: [] };
        steps.push(current);
      } else if (current !== undefined && line.trim() !== '') {
        current.expected.push(line.trim());
      }
    }
  }
  if (steps.length === 0 && status !== 'reference') {
    throw new Error(`${file}: no \`\`\`console block with a "$ " command`);
  }
  return { file, status, steps };
}

// cm:guard Subsequence, not equality: an exact-output assertion breaks on a counter nobody promised
// and teaches the next person to delete the test.
// cm:guard Every expected line must appear, IN ORDER — that catches a changed number, a dropped row
// and a reordered chain, and tolerates nothing else being promised.
export function matchesTranscript(expected: string[], actual: string): { ok: boolean; missing?: string } {
  const lines = actual.split('\n').map((l) => l.trim());
  let at = 0;
  for (const want of expected) {
    const found = lines.indexOf(want, at);
    if (found === -1) return { ok: false, missing: want };
    at = found + 1;
  }
  return { ok: true };
}

function runPage(page: Page): { ok: boolean; detail: string } {
  const home = mkdtempSync(join(tmpdir(), 'apiflow-guide-'));
  try {
    for (const step of page.steps) {
      const command = step.command.replace(/^apiflow\b/, `node ${CLI}`).replaceAll('$TMP', home);
      let out: string;
      try {
        out = execFileSync('sh', ['-c', command], {
          cwd: REPO,
          env: { ...process.env, APIFLOW_HOME: home, NO_COLOR: '1' },
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (e) {
        const err = e as { stdout?: string; stderr?: string };
        out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
      }
      const normalized = out.replaceAll(home, '$TMP');
      const result = matchesTranscript(step.expected, normalized);
      if (!result.ok) {
        return { ok: false, detail: `\`${step.command}\`\n  missing line: ${result.missing}\n  got:\n${normalized}` };
      }
    }
    return { ok: true, detail: '' };
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

// cm:guard guide/index.md is the RULE and the section landing page, not a transcript — the one
// exemption, and the reason its prose may name a fence without owning one.
// cm:guard Every other .md file in docs/guide is a page: an un-replayed page must be impossible to
// add by forgetting to register it.
const guidePages = readdirSync(GUIDE)
  .filter((f) => f.endsWith('.md') && f !== 'index.md')
  .map((f) => parsePage(join('guide', f), readFileSync(join(GUIDE, f), 'utf8')));

function markdownUnder(dir: string, rel = ''): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('_')) return [];
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return markdownUnder(full, join(rel, name));
    return name.endsWith('.md') ? [join(rel, name)] : [];
  });
}

// cm:guard The rule is every transcript ON THE SITE, not every transcript in docs/guide: a landing
// page showing an answer it does not actually produce is the exact failure this harness exists for.
// cm:guard Outside docs/guide a console fence is implicitly `shipped` — roadmap pages live in the
// guide, where a status can be argued for.
const looseTranscripts = markdownUnder(DOCS)
  .filter((f) => !f.startsWith('guide/'))
  .map((f) => ({ f, text: readFileSync(join(DOCS, f), 'utf8') }))
  .filter(({ text }) => /```console(?:\?\S*)?\n/.test(text))
  .map(({ f, text }) => parsePage(f, text, 'shipped'));

const pages = [...guidePages, ...looseTranscripts];

describe('the site is replayed, not trusted', () => {
  it('has at least one page', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  for (const page of pages) {
    if (page.status === 'reference') {
      it(`${page.file} — reference, not replayable, and says why`, () => {
        expect(page.steps.length >= 0).toBe(true);
      });
    } else if (page.status === 'shipped') {
      it(`${page.file} — shipped, so the transcript must run`, () => {
        const result = runPage(page);
        expect(result.ok, result.detail).toBe(true);
      });
    } else {
      // cm:guard An `upcoming` page must FAIL.
      // cm:guard Both directions of drift are caught this way: a page cannot claim shipped for
      // something broken, and cannot sit at upcoming after it starts working.
      // cm:guard Status is a test result, never a label someone remembered to change.
      it(`${page.file} — upcoming, so the transcript must NOT run yet`, () => {
        const result = runPage(page);
        expect(
          result.ok,
          `${page.file} is marked upcoming but its transcript now passes — change status to shipped`,
        ).toBe(false);
      });
    }
  }
});
