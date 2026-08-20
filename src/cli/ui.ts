import { realpathSync } from 'fs';
import { fileURLToPath } from 'url';
import { serve } from '../server/index';
import { workspaceRoot } from '../workspace/registry';
import { hubProjects } from '../workspace/hubData';

const HOST = '127.0.0.1';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (n: string): string | undefined => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
  const port = Number(flag('port') ?? 3030);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`--port không hợp lệ: ${String(flag('port'))}`);
    process.exit(1);
  }

  const projects = hubProjects();
  let running;
  try {
    running = await serve({ port, host: HOST });
  } catch (err) {
    // cm:why A port clash is the single most likely way this command fails, and a raw EADDRINUSE
    // stack says nothing about the one thing that fixes it.
    const code = (err as { code?: string }).code;
    if (code === 'EADDRINUSE') {
      console.error(`Cổng ${port} đang bị chiếm. Chạy lại với --port=<số khác>, hoặc dừng tiến trình đang giữ cổng đó:`);
      console.error(`  ss -ltnp | grep :${port}`);
      process.exit(1);
    }
    if (code === 'EACCES') {
      console.error(`Không có quyền mở cổng ${port}. Dùng một cổng >= 1024.`);
      process.exit(1);
    }
    throw err;
  }

  console.log('## apiflow ui');
  console.log('');
  console.log(`**Mở**: http://${HOST}:${running.port}`);
  console.log(`**Workspace**: ${workspaceRoot()}`);
  console.log(`**Project**: ${projects.length}`);
  for (const p of projects) {
    const kinds = p.maps.map((m) => m.kind).join(', ');
    console.log(`- ${p.id} — ${kinds === '' ? 'chưa có map' : kinds}`);
  }
  console.log('');
  console.log(`Chỉ nghe trên ${HOST}. Bản đồ chứa đường dẫn nội bộ và mọi endpoint không có cổng auth,`);
  console.log('nên nó không nghe ra ngoài và không có cờ nào để mở ra.');
  console.log('Ctrl-C để dừng.');
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) void main();
