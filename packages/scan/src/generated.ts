// cm:why A committed bundle is not source. `backend/public/widget/chat.js` is 342 KB of minified React
// on 65 lines, producing ~4,000 `unresolved` entries that read `!0` and `l` as urls.
// cm:why That noise can never be resolved and it drowns the real gaps. Name-based skipping cannot
// catch it either: the file sits in `public/`, not `dist/`. Shape can.
// cm:why Across four real repos the widest AUTHORED file averages 152 bytes per line (an inline SVG);
// the two generated ones average 3,490 and 5,268 — the threshold sits in that gap.
// cm:edge lockstep -> packages/cli/src/commands/scanFe.ts — both readers must drop the same files,
// or one side of a project reports a bundle's phantom endpoints and the other does not.
const BUNDLE_NAME = /\.(min|bundle|chunk)\.[jt]sx?$/;
const GENERATED_MEAN_LINE = 400;
// cm:guard Byte floor before the mean: a 300-byte one-liner has a huge mean and is ordinary source.
const GENERATED_BYTES = 4096;

export function isGeneratedSource(file: string, content: string): boolean {
  if (BUNDLE_NAME.test(file)) return true;
  if (content.length < GENERATED_BYTES) return false;
  return content.length / (content.split('\n').length || 1) > GENERATED_MEAN_LINE;
}
