import { mkdirSync, realpathSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { renderApp } from '../view/app';
import { sidesOf } from '../workspace/sides';
import { endpointHistory, mapSeries } from '../workspace/series';
import { renderHub } from '../view/hub';
import { workspaceRoot } from '../workspace/registry';
import { bestKind, hubProjects } from '../workspace/hubData';
import { mapPath, readMap } from '../workspace/store';
import { tolerateClosedPipe } from './stdio';

function main(): void {
  tolerateClosedPipe();
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  // cm:guard `--out=<dir>` is the form README and docs/getting-started.md name, so it has to be read
  // here: ignoring it fell back to ./apiflow-maps and wrote a page tree into whatever repo was cwd.
  const flag = args.find((a) => a.startsWith('--out='))?.slice('--out='.length);
  const out = resolve(flag ?? positional[0] ?? 'apiflow-maps');
  const projects = hubProjects();
  // cm:guard One `now` for every page in the batch: reading it per page makes two files written a
  // minute apart disagree about how old the same scan is.
  const now = Date.now();

  mkdirSync(out, { recursive: true });
  const written: string[] = [];
  for (const project of projects) {
    const kind = bestKind(project);
    if (kind === null) continue;
    const map = readMap(project.id, kind);
    if (map === null) continue;
    const file = join(out, `${project.id}.html`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, renderApp({
      map, sourcePath: mapPath(project.id, kind), live: false, kind, homeHref: './index.html',
      projectName: project.name,
      sides: sidesOf(project.id), now, series: mapSeries(project.id, kind), epHistory: endpointHistory(project.id, kind),
    }));
    written.push(file);
  }

  const index = join(out, 'index.html');
  writeFileSync(
    index,
    renderHub(
      projects,
      {
        workspace: workspaceRoot(),
        live: false,
        linkTo: (project) => (bestKind(project) === null ? null : `./${project.id}.html`),
      },
      now
    )
  );

  console.log('## apiflow hub');
  console.log('');
  console.log(`**Open in a browser**: file://${index}`);
  console.log(`**Projects**: ${projects.length} · **map pages written**: ${written.length}`);
  const skipped = projects.length - written.length;
  if (skipped > 0) console.log(`**Skipped**: ${skipped} project(s) with no map yet`);
  console.log('');
  console.log('Static output: open with file://, no server needed. Re-run after every scan.');
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
