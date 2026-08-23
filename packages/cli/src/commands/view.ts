import { mkdirSync, realpathSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { renderApp } from '../view/app';
import { loadMapOrExit } from './loadMap';
import { tolerateClosedPipe } from './stdio';

// cm:why Renders the SAME app as `apiflow ui`, only with `live: false`.
// cm:why Two renderers over one .apimap drifted within a week: the served page grew a coverage map
// and an impact graph that the written file never got, and nothing failed to say so.
// cm:edge lockstep -> packages/cli/src/view/app.ts — every live-only control hangs off
// `live`/`projectId` there, so a control added without that guard ships into this offline file too.
function main(): void {
  tolerateClosedPipe();
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const flag = (n: string): string | undefined => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

  if (positional.length === 0) {
    console.error('Usage: apiflow view <file.apimap> [--out=map.html]');
    process.exit(1);
  }
  const mapPath = resolve(positional[0]);
  const map = loadMapOrExit(mapPath);

  const outPath = resolve(flag('out') ?? mapPath.replace(/\.apimap$/, '') + '.html');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderApp({ map, sourcePath: mapPath, live: false }));

  console.log('## Viewer');
  console.log('');
  console.log(`**Open in a browser**: file://${outPath}`);
  console.log(`**Contents**: ${map.endpoints.length} endpoints · ${map.screens.length} screens · ${map.calls.length} calls · ${map.fields.length} fields`);
  console.log('');
  console.log('Fully self-contained: no network, no server. The data lives inside the HTML.');
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
