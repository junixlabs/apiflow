import { mkdirSync, realpathSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { renderApp } from '../view/app';
import { renderHub } from '../view/hub';
import { workspaceRoot } from '../workspace/registry';
import { bestKind, hubProjects } from '../workspace/hubData';
import { mapPath, readMap } from '../workspace/store';

function main(): void {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const out = resolve(positional[0] ?? 'apiflow-maps');
  const projects = hubProjects();

  mkdirSync(out, { recursive: true });
  const written: string[] = [];
  for (const project of projects) {
    const kind = bestKind(project);
    if (kind === null) continue;
    const map = readMap(project.id, kind);
    if (map === null) continue;
    const file = join(out, `${project.id}.html`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, renderApp({ map, sourcePath: mapPath(project.id, kind), live: false }));
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
      Date.now()
    )
  );

  console.log('## apiflow hub');
  console.log('');
  console.log(`**Mở bằng browser**: file://${index}`);
  console.log(`**Project**: ${projects.length} · **trang bản đồ đã sinh**: ${written.length}`);
  const skipped = projects.length - written.length;
  if (skipped > 0) console.log(`**Bỏ qua**: ${skipped} project chưa có map nào`);
  console.log('');
  console.log('Bản tĩnh: mở bằng file://, không cần server. Chạy lại lệnh này sau mỗi lần scan.');
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
