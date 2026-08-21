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
    console.error(`Invalid --port: ${String(flag('port'))}`);
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
      console.error(`Port ${port} is taken. Retry with --port=<other>, or stop whatever holds it:`);
      console.error(`  ss -ltnp | grep :${port}`);
      process.exit(1);
    }
    if (code === 'EACCES') {
      console.error(`Not allowed to open port ${port}. Use a port >= 1024.`);
      process.exit(1);
    }
    throw err;
  }

  console.log('## apiflow ui');
  console.log('');
  console.log(`**Open**: http://${HOST}:${running.port}`);
  console.log(`**Workspace**: ${workspaceRoot()}`);
  console.log(`**Project**: ${projects.length}`);
  for (const p of projects) {
    const kinds = p.maps.map((m) => m.kind).join(', ');
    console.log(`- ${p.id} — ${kinds === '' ? 'no map yet' : kinds}`);
  }
  console.log('');
  console.log(`Listens on ${HOST} only. A map holds internal paths and every endpoint with no auth gate,`);
  console.log('so it is not served off this machine and there is no flag to widen that.');
  console.log('Ctrl-C to stop.');
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) void main();
