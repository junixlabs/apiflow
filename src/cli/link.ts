import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile } from '../core/apimap';
import { endpointsWithTracedReads, linkMaps, orphanEndpoints, undeliveredFields, unreadResponseFields } from '../core/apimap';

function loadMap(path: string): ApiMapFile {
  const map = JSON.parse(readFileSync(path, 'utf8')) as ApiMapFile;
  if (map.version !== 1) throw new Error(`unsupported .apimap version: ${String(map.version)}`);
  return map;
}

export function renderAudit(map: ApiMapFile): string {
  const unread = unreadResponseFields(map);
  const undelivered = undeliveredFields(map);
  const orphans = orphanEndpoints(map);
  const lines: string[] = [];

  const called = new Set(map.calls.map((c) => c.endpointId));
  const analysable = endpointsWithTracedReads(map);
  const blind = [...called].filter((id) => !analysable.has(id)).length;

  lines.push(`### Fields the API sends that no screen reads — ${unread.length === 0 ? 'none' : unread.length}`);
  if (blind > 0) {
    lines.push(
      `_Counted over ${analysable.size} of ${called.size} called endpoints. The other ${blind} had no field read traced` +
        ' at all — typically a typed client, where the fields live in TS types rather than at the call site —' +
        ' so nothing is claimed about them._'
    );
    lines.push('');
  }
  for (const a of unread.slice(0, 30)) lines.push(`- ${a.endpoint.method} ${a.endpoint.path} → \`${a.field.path}\``);
  if (unread.length > 30) lines.push(`- ... ${unread.length - 30} more`);
  lines.push('');

  lines.push(`### Fields the code declares but the probe never saw — ${undelivered.length === 0 ? 'none' : undelivered.length}`);
  for (const a of undelivered.slice(0, 30)) {
    const readers = a.readers.length > 0 ? ` — read by ${a.readers.map((r) => r.label).join(', ')}` : '';
    lines.push(`- ${a.endpoint.method} ${a.endpoint.path} → \`${a.field.path}\`${readers}`);
  }
  lines.push('');

  lines.push(`### Endpoints no screen calls — ${orphans.length === 0 ? 'none' : orphans.length}`);
  for (const e of orphans.slice(0, 30)) lines.push(`- ${e.method} ${e.path}${e.handler ? ` (${e.handler})` : ''}`);
  if (orphans.length > 30) lines.push(`- ... ${orphans.length - 30} more`);
  lines.push('');
  lines.push(
    'Every line above is a **candidate, not a verdict**: an untraced read, another client (mobile,'
  );
  lines.push('a partner, a cron) or an unprobed branch all produce the same signal as genuinely dead code.');

  return lines.join('\n');
}

function main(): void {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const flag = (n: string): string | undefined => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

  if (positional.length < 2) {
    console.error('Usage: apiflow link <fe.apimap> <be.apimap> [--out=joined.apimap] [--name=…]');
    process.exit(1);
  }
  const fe = loadMap(resolve(positional[0]));
  const be = loadMap(resolve(positional[1]));
  const name = flag('name') ?? `${fe.metadata.name}+${be.metadata.name}`;
  const joined = linkMaps(fe, be, name);

  const outPath = resolve(flag('out') ?? `${name.replace(/[^\w.+-]/g, '-')}.apimap`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(joined, null, 2)}\n`);

  const matched = joined.endpoints.filter(
    (e) => joined.calls.some((c) => c.endpointId === e.id) && e.handler !== undefined
  ).length;

  console.log('## Linked map');
  console.log('');
  console.log(`**Written**: ${outPath}`);
  console.log(`**Screens**: ${joined.screens.length} · **Endpoints**: ${joined.endpoints.length} · **Fields**: ${joined.fields.length}`);
  console.log(`**Endpoints seen from both sides**: ${matched}`);
  console.log('');
  console.log(renderAudit(joined));
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
