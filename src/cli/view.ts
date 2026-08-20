import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { ApiMapFile } from '../core/apimap';

// cm:guard `</script>` inside a field name or a snippet would close the tag and turn the payload into
// markup. Escaping `<` is what keeps a scanned repo from injecting into the page it is rendered on.
export function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, (c) => (c === '\u2028' ? '\\u2028' : '\\u2029'));
}

const STYLE = `
:root {
  --bg:#f6f8fb; --surface:#fff; --surface-2:#f1f5f9; --surface-3:#e8eef6;
  --ink:#0f172a; --muted:#64748b; --line:#dde5ee;
  --exact:#059669; --inferred:#2563eb; --guess:#d97706; --dead:#dc2626;
  --shadow:0 1px 2px rgba(15,23,42,.05), 0 8px 24px rgba(15,23,42,.06);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg:#0a1020; --surface:#111a2c; --surface-2:#0e1626; --surface-3:#16233a;
    --ink:#e6edf6; --muted:#8fa2bb; --line:#223148;
    --exact:#34d399; --inferred:#60a5fa; --guess:#fbbf24; --dead:#f87171;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
  }
}
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--ink);
  font:14px/1.55 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif; -webkit-font-smoothing:antialiased; }
.page { max-width:1500px; margin:0 auto; padding:24px 18px 60px; }
h1 { font-size:20px; margin:0 0 4px; font-weight:650; letter-spacing:-.01em; }
.sub { color:var(--muted); margin:0 0 18px; font-size:13px; }
.sub code { background:var(--surface-2); padding:1px 5px; border-radius:4px; }
.app { display:grid; grid-template-columns:272px 1fr 340px;
  border:1px solid var(--line); border-radius:14px; overflow:hidden;
  background:var(--surface); box-shadow:var(--shadow); min-height:680px; }
@media (max-width:1100px) { .app { grid-template-columns:1fr; } }
.bar { grid-column:1/-1; display:flex; align-items:center; gap:10px; flex-wrap:wrap;
  padding:10px 14px; border-bottom:1px solid var(--line); background:var(--surface-2); }
.brand { font-weight:650; }
.stat { color:var(--muted); font-size:12.5px; }
.spacer { flex:1; }
.search { display:flex; align-items:center; gap:7px; background:var(--surface);
  border:1px solid var(--line); border-radius:8px; padding:5px 9px; min-width:230px; }
.search input { border:0; outline:0; background:transparent; color:var(--ink); font:inherit; width:100%; }
.chip { font-size:11.5px; padding:3px 9px; border-radius:999px; border:1px solid var(--line);
  background:var(--surface); color:var(--muted); cursor:pointer; white-space:nowrap; }
.chip.on { color:var(--ink); border-color:currentColor; background:var(--surface-3); }
.side { border-right:1px solid var(--line); overflow:auto; max-height:78vh; }
.side h2, .insp h2 { font-size:11px; text-transform:uppercase; letter-spacing:.08em;
  color:var(--muted); margin:16px 14px 8px; font-weight:600; }
.group { display:flex; align-items:center; gap:8px; padding:6px 14px; cursor:pointer; font-size:13px; }
.group:hover { background:var(--surface-2); }
.group.on { background:var(--surface-3); font-weight:600; }
.group .n { margin-left:auto; color:var(--muted); font-size:11.5px; }
.list { overflow:auto; max-height:78vh; }
.row { display:flex; align-items:center; gap:10px; padding:8px 16px;
  border-bottom:1px solid var(--line); cursor:pointer; }
.row:hover { background:var(--surface-2); }
.row.on { background:var(--surface-3); }
.verb { font:600 10.5px/1 ui-monospace,monospace; padding:4px 6px; border-radius:5px;
  min-width:52px; text-align:center; border:1px solid var(--line); color:var(--muted); }
.verb.GET { color:var(--inferred); } .verb.POST { color:var(--exact); }
.verb.PUT, .verb.PATCH { color:var(--guess); } .verb.DELETE { color:var(--dead); }
.p { font:12.5px/1.4 ui-monospace,monospace; word-break:break-all; }
.tags { margin-left:auto; display:flex; gap:6px; align-items:center; flex-shrink:0; }
.tag { font-size:10.5px; padding:2px 7px; border-radius:999px; border:1px solid var(--line); color:var(--muted); }
.tag.lock { color:var(--exact); } .tag.open { color:var(--dead); }
.tag.shape { color:var(--inferred); } .tag.probed { color:var(--exact); }
.insp { border-left:1px solid var(--line); overflow:auto; max-height:78vh; padding-bottom:24px; }
.insp .k { color:var(--muted); font-size:12px; }
.insp .v { font:12.5px/1.5 ui-monospace,monospace; word-break:break-all; margin-bottom:10px; }
.insp .box { margin:0 14px; }
.field { display:flex; gap:8px; align-items:baseline; padding:5px 0; border-bottom:1px solid var(--line); }
.field .fp { font:12px/1.4 ui-monospace,monospace; }
.field .ft { color:var(--muted); font-size:11px; margin-left:auto; }
.empty { color:var(--muted); font-size:12.5px; margin:0 14px 14px; }
.caller { padding:7px 0; border-bottom:1px solid var(--line); font-size:12.5px; }
.caller .r { font:12.5px/1.4 ui-monospace,monospace; }
.caller .m { color:var(--muted); font-size:11.5px; }
.c-exact { color:var(--exact); } .c-inferred { color:var(--inferred); } .c-guess { color:var(--guess); }
.note { margin:18px 0 0; padding:12px 14px; border:1px dashed var(--line); border-radius:10px;
  color:var(--muted); font-size:12.5px; background:var(--surface-2); }
`;

const SCRIPT = String.raw`
const MAP = JSON.parse(document.getElementById('apimap').textContent);
const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const screens = byId(MAP.screens);
const state = { group: null, endpoint: null, q: '', only: null };

const groupOf = (path) => path.split('/').slice(0, 4).join('/') || '/';

const callersOf = (id) =>
  MAP.calls.filter((c) => c.endpointId === id).map((c) => ({ ...c, screen: screens[c.screenId] }));

const fieldsOf = (id) => MAP.fields.filter((f) => f.endpointId === id);

function matches(e) {
  if (state.q && !(e.method + ' ' + e.path).toLowerCase().includes(state.q)) return false;
  if (state.only === 'open' && e.auth !== false) return false;
  if (state.only === 'auth' && e.auth !== true) return false;
  if (state.only === 'murky' && e.auth !== undefined) return false;
  if (state.only === 'unknown' && fieldsOf(e.id).length > 0) return false;
  if (state.only === 'called' && callersOf(e.id).length === 0) return false;
  return true;
}

function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

function renderGroups(visible) {
  const box = document.getElementById('groups');
  box.textContent = '';
  const counts = new Map();
  for (const e of visible) counts.set(groupOf(e.path), (counts.get(groupOf(e.path)) ?? 0) + 1);
  const all = h('div', 'group' + (state.group === null ? ' on' : ''));
  all.append(h('span', null, 'Tất cả'), h('span', 'n', String(visible.length)));
  all.onclick = () => { state.group = null; render(); };
  box.append(all);
  for (const [g, n] of [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    const row = h('div', 'group' + (state.group === g ? ' on' : ''));
    row.append(h('span', null, g), h('span', 'n', String(n)));
    row.onclick = () => { state.group = g; state.endpoint = null; render(); };
    box.append(row);
  }
}

function renderList(visible) {
  const box = document.getElementById('list');
  box.textContent = '';
  const rows = visible.filter((e) => state.group === null || groupOf(e.path) === state.group).slice(0, 600);
  for (const e of rows) {
    const row = h('div', 'row' + (state.endpoint === e.id ? ' on' : ''));
    row.append(h('span', 'verb ' + e.method, e.method), h('span', 'p', e.path));
    const tags = h('div', 'tags');
    if (e.auth === true) tags.append(h('span', 'tag lock', 'auth'));
    if (e.auth === false) tags.append(h('span', 'tag open', 'mở'));
    if (e.auth === undefined && e.source) tags.append(h('span', 'tag', 'cổng không rõ'));
    const fields = fieldsOf(e.id).length;
    if (fields > 0) tags.append(h('span', 'tag shape', fields + ' field'));
    if (e.probed) tags.append(h('span', 'tag probed', 'probed'));
    const callers = callersOf(e.id).length;
    if (callers > 0) tags.append(h('span', 'tag', callers + ' màn'));
    row.append(tags);
    row.onclick = () => { state.endpoint = e.id; render(); };
    box.append(row);
  }
  if (visible.length > rows.length) {
    box.append(h('div', 'empty', 'Còn ' + (visible.length - rows.length) + ' endpoint nữa — lọc hẹp lại để xem.'));
  }
  if (rows.length === 0) box.append(h('div', 'empty', 'Không có endpoint nào khớp bộ lọc.'));
}

function renderInspector() {
  const box = document.getElementById('insp');
  box.textContent = '';
  const e = MAP.endpoints.find((x) => x.id === state.endpoint);
  if (!e) {
    box.append(h('h2', null, 'Chi tiết'), h('div', 'empty', 'Chọn một endpoint ở giữa.'));
    return;
  }
  box.append(h('h2', null, 'Endpoint'));
  const wrap = h('div', 'box');
  wrap.append(h('div', 'v', e.method + ' ' + e.path));
  if (e.handler) { wrap.append(h('div', 'k', 'handler'), h('div', 'v', e.handler)); }
  if (e.source) { wrap.append(h('div', 'k', 'khai ở'), h('div', 'v', e.source.file + ':' + e.source.line)); }
  wrap.append(h('div', 'k', 'auth'), h('div', 'v', e.auth === undefined ? 'không rõ' : e.auth ? 'có cổng chặn' : 'không có cổng chặn nào'));
  box.append(wrap);

  const callers = callersOf(e.id);
  box.append(h('h2', null, 'Màn hình gọi — ' + (callers.length || 'chưa truy vết được')));
  const cwrap = h('div', 'box');
  for (const c of callers) {
    const row = h('div', 'caller');
    row.append(h('div', 'r', c.screen ? c.screen.route ?? c.screen.label : c.screenId));
    const meta = h('div', 'm');
    meta.append(h('span', 'c-' + c.confidence, c.confidence));
    meta.append(h('span', null, ' · ' + c.source.file + ':' + c.source.line));
    if (c.screen && c.screen.viaHops !== undefined) meta.append(h('span', null, ' · ' + c.screen.viaHops + ' hop'));
    row.append(meta);
    cwrap.append(row);
  }
  if (callers.length === 0) {
    cwrap.append(h('div', 'empty', MAP.screens.length === 0
      ? 'Bản đồ này chỉ có phía backend — chưa nối với bản đồ frontend nào.'
      : 'Không lời gọi nào truy vết được tới endpoint này. Không có nghĩa là không ai gọi.'));
  }
  box.append(cwrap);

  const fields = fieldsOf(e.id);
  box.append(h('h2', null, 'Field — ' + (fields.length || 'chưa biết')));
  const fwrap = h('div', 'box');
  for (const f of fields.slice(0, 120)) {
    const row = h('div', 'field');
    row.append(h('span', 'fp', f.path));
    const marks = [f.kind, f.type ?? '?', f.declared ? 'code' : null, f.observed ? 'thật' : null]
      .filter(Boolean).join(' · ');
    row.append(h('span', 'ft', marks));
    fwrap.append(row);
  }
  if (fields.length === 0) {
    fwrap.append(h('div', 'empty', 'Không có schema nào trong code. Chạy apiflow probe để lấy hình dạng thật.'));
  }
  box.append(fwrap);
}

function render() {
  const visible = MAP.endpoints.filter(matches);
  document.getElementById('shown').textContent = visible.length + '/' + MAP.endpoints.length + ' endpoint';
  renderGroups(visible);
  renderList(visible);
  renderInspector();
  for (const chip of document.querySelectorAll('[data-only]')) {
    chip.classList.toggle('on', state.only === chip.dataset.only);
  }
}

document.getElementById('q').addEventListener('input', (ev) => {
  state.q = ev.target.value.trim().toLowerCase();
  state.endpoint = null;
  render();
});
for (const chip of document.querySelectorAll('[data-only]')) {
  chip.onclick = () => {
    state.only = state.only === chip.dataset.only ? null : chip.dataset.only;
    state.endpoint = null;
    render();
  };
}
render();
`;

// cm:why Written to disk and opened from the filesystem on purpose — a map carries internal paths and
// field names, so it must never need a server, an upload, or a network request to be read.
export function renderViewer(map: ApiMapFile, sourcePath: string): string {
  const counts = {
    endpoints: map.endpoints.length,
    screens: map.screens.length,
    calls: map.calls.length,
    fields: map.fields.length,
    auth: map.endpoints.filter((e) => e.auth === true).length,
    open: map.endpoints.filter((e) => e.auth === false).length,
    murky: map.endpoints.filter((e) => e.auth === undefined).length,
    unresolved: map.unresolved.length,
  };

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>apiflow — ${escapeHtml(map.metadata.name)}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="page">
  <h1>${escapeHtml(map.metadata.name)}</h1>
  <p class="sub">
    <code>${escapeHtml(sourcePath)}</code> · gốc <code>${escapeHtml(map.metadata.root)}</code> · ${escapeHtml(map.metadata.generator)}
  </p>
  <div class="app">
    <div class="bar">
      <span class="brand">apiflow</span>
      <span class="stat" id="shown">${counts.endpoints} endpoint</span>
      <span class="stat">· ${counts.screens} màn · ${counts.calls} lời gọi · ${counts.fields} field</span>
      <span class="spacer"></span>
      <span class="chip" data-only="auth">có auth ${counts.auth}</span>
      <span class="chip" data-only="open">không auth ${counts.open}</span>
      <span class="chip" data-only="murky">cổng không rõ ${counts.murky}</span>
      <span class="chip" data-only="unknown">chưa biết shape</span>
      <span class="chip" data-only="called">có màn gọi</span>
      <label class="search">🔎<input id="q" placeholder="tìm theo method hoặc path" autocomplete="off"></label>
    </div>
    <div class="side"><h2>Nhóm tài nguyên</h2><div id="groups"></div></div>
    <div class="list" id="list"></div>
    <div class="insp" id="insp"></div>
  </div>
  <p class="note">
    Mỗi dòng là <b>ứng viên, không phải phán quyết</b>. “không auth” nghĩa là không thấy cổng chặn nào
    trong code — vẫn có thể bị chặn ở nơi khác. “chưa biết shape” nghĩa là code không khai, chưa chạy
    <code>apiflow probe</code>. ${counts.unresolved} mục trong danh sách Unresolved của file gốc không hiện ở đây.
  </p>
</div>
<script type="application/json" id="apimap">${embedJson(map)}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

function main(): void {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const flag = (n: string): string | undefined => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

  if (positional.length === 0) {
    console.error('Usage: apiflow view <file.apimap> [--out=map.html]');
    process.exit(1);
  }
  const mapPath = resolve(positional[0]);
  const map = JSON.parse(readFileSync(mapPath, 'utf8')) as ApiMapFile;
  if (map.version !== 1) throw new Error(`unsupported .apimap version: ${String(map.version)}`);

  const outPath = resolve(flag('out') ?? mapPath.replace(/\.apimap$/, '') + '.html');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderViewer(map, mapPath));

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
