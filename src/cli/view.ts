import { parseMap } from '../core/apimap';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { renderApp } from '../view/app';
import { tolerateClosedPipe } from './stdio';

// cm:why Renders the SAME app as `apiflow ui`, only with `live: false`. Two renderers over one
// .apimap drifted within a week: the served page grew a coverage map and an impact graph that the
// written file never got, and nothing failed to say so.
// cm:edge lockstep -> src/view/app.ts — every live-only control hangs off `live`/`projectId` there,
// so a control added without that guard ships into this offline file too.
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
  const map = parseMap(readFileSync(mapPath, 'utf8'));
  if (map.version !== 1) throw new Error(`unsupported .apimap version: ${String(map.version)}`);

  const outPath = resolve(flag('out') ?? mapPath.replace(/\.apimap$/, '') + '.html');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderApp({ map, sourcePath: mapPath, live: false }));

  console.log('## Viewer');
  console.log('');
  console.log(`**Mở bằng browser**: file://${outPath}`);
  console.log(`**Nội dung**: ${map.endpoints.length} endpoint · ${map.screens.length} màn · ${map.calls.length} lời gọi · ${map.fields.length} field`);
  console.log('');
  console.log('Tự chứa hoàn toàn: không gọi mạng, không cần server. Dữ liệu nằm trong chính file HTML.');
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
