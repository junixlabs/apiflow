import type { MapKind } from '../workspace/store';
import { STYLE } from './theme';

export interface HubMap {
  kind: MapKind;
  scannedAt?: string;
  endpoints: number;
  screens: number;
  calls: number;
  unresolved: number;
  open: number;
  both: number;
  uncalled: number;
  feOnly: number;
  unpaired: number;
  hasFe: boolean;
  hasBe: boolean;
}

export interface HubProject {
  id: string;
  name: string;
  fe?: string;
  be?: string;
  maps: HubMap[];
}

export interface HubOptions {
  workspace: string;
  linkTo: (project: HubProject) => string | null;
  live: boolean;
}

const HUB_STYLE = `
.cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:16px; }
.card { border:1px solid var(--line); border-radius:14px; background:var(--surface);
  box-shadow:var(--shadow); padding:16px 17px 15px; display:flex; flex-direction:column; gap:11px; }
.card h2 { margin:0; font-size:16px; font-weight:650; display:flex; align-items:center; gap:8px; }
.card h2 .sides { font:500 10.5px/1 ui-sans-serif,sans-serif; color:var(--muted);
  border:1px solid var(--line); border-radius:999px; padding:3px 8px; }
.roots { margin:0; font:11.5px/1.6 ui-monospace,monospace; color:var(--muted); word-break:break-all; }
.roots b { color:var(--ink); font-weight:600; margin-right:4px; }
.bar3 { display:flex; height:8px; border-radius:999px; overflow:hidden; background:var(--surface-3); }
.bar3 i { display:block; }
.bar3 .b-both { background:var(--exact); }
.bar3 .b-uncalled { background:var(--surface-3); box-shadow:inset 0 0 0 1px var(--line); }
.bar3 .b-feonly { background:var(--dead); }
.bar3 .b-unpaired { background:repeating-linear-gradient(135deg,var(--surface-3) 0 4px,var(--surface) 4px 8px); }
.mapline { display:flex; align-items:baseline; gap:8px; font-size:12.5px; flex-wrap:wrap; }
.mapline .kind { font:600 10.5px/1 ui-monospace,monospace; border:1px solid var(--line);
  border-radius:5px; padding:4px 6px; color:var(--muted); min-width:52px; text-align:center; }
.mapline .when { margin-left:auto; color:var(--muted); font-size:11.5px; }
.flags { display:flex; gap:6px; flex-wrap:wrap; }
.flag { font-size:10.5px; padding:2px 8px; border-radius:999px; border:1px solid var(--line); color:var(--muted); }
.flag.warn { color:var(--guess); } .flag.bad { color:var(--dead); }
.open-btn { align-self:flex-start; margin-top:auto; font-size:12.5px; font-weight:600;
  text-decoration:none; color:var(--ink); border:1px solid var(--line); border-radius:8px;
  padding:6px 12px; background:var(--surface-2); }
.open-btn:hover { background:var(--surface-3); }
.none { color:var(--muted); font-size:12.5px; margin:0; }
.hint { margin:0 0 18px; }
.hint code { background:var(--surface-2); padding:2px 6px; border-radius:5px;
  font:12px ui-monospace,monospace; }
`;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

// cm:why Ages are rendered on the SERVER for the live hub and baked in for the static one, so the
// caller decides `now` — a page that computes it in the browser would drift against the map it names.
export function relativeAge(iso: string | undefined, now: number): string {
  if (iso === undefined) return 'chưa scan';
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} giờ trước` : `${Math.round(hours / 24)} ngày trước`;
}

function bar(map: HubMap): string {
  const total = map.both + map.uncalled + map.feOnly + map.unpaired;
  if (total === 0) return '';
  const pct = (n: number) => `${((n / total) * 100).toFixed(2)}%`;
  const title = [
    `${map.both} có màn gọi`,
    `${map.uncalled} không ai gọi`,
    `${map.feOnly} FE gọi mà API không khai`,
    `${map.unpaired} chưa đối chiếu được`,
  ].join(' · ');
  return `<div class="bar3" title="${title}">`
    + `<i class="b-both" style="width:${pct(map.both)}"></i>`
    + `<i class="b-uncalled" style="width:${pct(map.uncalled)}"></i>`
    + `<i class="b-feonly" style="width:${pct(map.feOnly)}"></i>`
    + `<i class="b-unpaired" style="width:${pct(map.unpaired)}"></i></div>`;
}

// cm:guard Says what is MISSING before it says what is wrong: on a one-sided scan the honest label
// is "chưa scan BE", and printing a comparison finding there invents a defect out of a gap.
function flags(map: HubMap): string {
  const out: string[] = [];
  if (!map.hasBe) out.push('<span class="flag">chưa scan BE — chưa đối chiếu được</span>');
  if (!map.hasFe) out.push('<span class="flag">chưa scan FE — không biết màn nào gọi</span>');
  if (map.open > 0) out.push(`<span class="flag bad">${map.open} không auth</span>`);
  if (map.hasBe && map.feOnly > 0) out.push(`<span class="flag bad">${map.feOnly} FE gọi mà API không khai</span>`);
  if (map.hasFe && map.uncalled > 0) out.push(`<span class="flag">${map.uncalled} không màn nào gọi</span>`);
  if (map.unresolved > 0) out.push(`<span class="flag warn">${map.unresolved} unresolved</span>`);
  return out.length > 0 ? `<div class="flags">${out.join('')}</div>` : '';
}

function card(project: HubProject, options: HubOptions, now: number): string {
  const sides = [project.fe !== undefined ? 'FE' : null, project.be !== undefined ? 'BE' : null]
    .filter(Boolean)
    .join('+');
  const roots = [
    project.fe !== undefined ? `<b>FE</b>${escapeHtml(project.fe)}` : null,
    project.be !== undefined ? `<b>BE</b>${escapeHtml(project.be)}` : null,
  ].filter(Boolean).join('<br>');

  const best = project.maps.find((m) => m.kind === 'linked') ?? project.maps[0];
  const lines = project.maps
    .map((m) => `<div class="mapline"><span class="kind">${m.kind}</span>`
      + `<span>${m.endpoints} endpoint · ${m.screens} màn · ${m.calls} lời gọi</span>`
      + `<span class="when">${escapeHtml(relativeAge(m.scannedAt, now))}</span></div>`)
    .join('');

  const href = options.linkTo(project);
  const button = href !== null
    ? `<a class="open-btn" href="${escapeHtml(href)}">Mở bản đồ →</a>`
    : `<p class="none">Chưa có map — chạy <code>apiflow scan-fe</code> rồi <code>link</code>.</p>`;

  return `<div class="card">
  <h2>${escapeHtml(project.id)}<span class="sides">${sides}</span></h2>
  <p class="roots">${roots}</p>
  ${project.maps.length > 0 ? lines : '<p class="none">Chưa có map nào.</p>'}
  ${best ? bar(best) : ''}
  ${best ? flags(best) : ''}
  ${button}
</div>`;
}

export function renderHub(projects: HubProject[], options: HubOptions, now: number): string {
  const body = projects.length === 0
    ? `<p class="note">Chưa có project nào trong <code>${escapeHtml(options.workspace)}</code>.<br><br>`
      + 'Thêm bằng:<br><code>apiflow project add adminhub --fe=/đường/dẫn/ui --be=/đường/dẫn/api</code></p>'
    : `<div class="cards">${projects.map((p) => card(p, options, now)).join('\n')}</div>`;

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>apiflow — ${projects.length} project</title>
<style>${STYLE}${HUB_STYLE}</style>
</head>
<body>
<div class="page">
  <h1>apiflow</h1>
  <p class="sub">${projects.length} project · workspace <code>${escapeHtml(options.workspace)}</code>${options.live ? ' · bản sống' : ' · bản tĩnh'}</p>
  <p class="hint sub">Thanh màu là tỉ lệ <b>có màn gọi</b> / <b>không ai gọi</b> / <b>FE gọi mà API không khai</b> / <b>chưa đối chiếu được</b> (kẻ sọc — thiếu một trong hai phía) của bản đồ đầy đủ nhất trong project.</p>
  ${body}
  <p class="note">Mỗi con số là <b>ứng viên, không phải phán quyết</b>. “không auth” nghĩa là không thấy cổng chặn nào trong code. “unresolved” là những lời gọi apiflow thấy nhưng không giải được đường dẫn — chúng <b>không</b> nằm trong các con số còn lại.</p>
</div>
</body>
</html>
`;
}
