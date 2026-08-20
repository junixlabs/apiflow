import type { MapKind } from '../workspace/store';
import { ADD_DIALOG, ADD_SCRIPT, ADD_STYLE } from './addProject';
import { BRAND_STYLE, FAVICON, MARK, STYLE, THEME_BOOT, THEME_SCRIPT, THEME_STYLE } from './theme';

export interface HubMap {
  kind: MapKind;
  scannedAt?: string;
  scannedFrom?: string;
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

export interface HubRev {
  kind: 'fe' | 'be';
  branch?: string;
  sha?: string;
}

export interface HubProject {
  id: string;
  name: string;
  fe?: string;
  be?: string;
  hints?: string;
  rev?: HubRev[];
  maps: HubMap[];
}

export interface HubOptions {
  workspace: string;
  linkTo: (project: HubProject) => string | null;
  live: boolean;
}

const HUB_STYLE = `
.hubtop { display:flex; align-items:flex-start; gap:16px; flex-wrap:wrap;
  padding:0 0 16px; margin:0 0 18px; border-bottom:1px solid var(--line); }
.hubtop .brandbar { margin:0; }
.hubtop .who { margin:5px 0 0; font-size:12px; color:var(--muted); }
.hubtop .who code { font:11.5px ui-monospace,monospace; }
.hubtop .acts { margin-left:auto; display:flex; gap:8px; align-items:center; }

.totals { display:grid; grid-template-columns:repeat(auto-fit,minmax(126px,1fr)); gap:10px; margin:0 0 16px; }
.totals .t1 { border:1px solid var(--line); border-radius:10px; background:var(--surface); padding:8px 11px 9px; }
.totals .t1 .lab { font-size:9.5px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); }
.totals .t1 .val { font:650 20px/1.25 ui-sans-serif,sans-serif; letter-spacing:-.02em; margin-top:1px; }
.totals .t1 .sub { font-size:10.5px; color:var(--muted); }
.totals .t1.alarm .val { color:var(--dead); }

.cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(360px,1fr)); gap:16px;
  align-items:start; }
.card { border:1px solid var(--line); border-radius:14px; background:var(--surface);
  box-shadow:var(--shadow); padding:15px 16px 14px; display:flex; flex-direction:column; gap:10px; }
.card h2 { margin:0; font-size:15.5px; font-weight:650; display:flex; align-items:center; gap:8px;
  min-width:0; }
.card h2 .nm { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.card h2 .sides { font:600 9.5px/1 ui-sans-serif,sans-serif; letter-spacing:.07em; color:var(--muted);
  border:1px solid var(--line-2); border-radius:999px; padding:4px 8px; flex:none; }
.card .idline { margin:-6px 0 0; font:11px ui-monospace,monospace; color:var(--muted); }
.rootrow { display:flex; align-items:baseline; gap:7px; font-size:11.5px; min-width:0; }
.rootrow .tagk { font:650 9.5px/1 ui-sans-serif,sans-serif; letter-spacing:.09em; color:var(--muted);
  border:1px solid var(--line); border-radius:4px; padding:3px 5px; flex:none; }
.rootrow code { font:11.5px ui-monospace,monospace; color:var(--ink-2); min-width:0;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rootrow .rev { margin-left:auto; flex:none; font:10.5px ui-monospace,monospace; color:var(--brand);
  background:var(--tint-brand); border-radius:4px; padding:1px 6px; }
.rootrow .norev { margin-left:auto; flex:none; font-size:10.5px; color:var(--muted); }
.bar3 { display:flex; height:8px; border-radius:999px; overflow:hidden; background:var(--surface-3); }
.bar3 i { display:block; }
.bar3 .b-both { background:var(--exact); }
.bar3 .b-uncalled { background:var(--surface-3); box-shadow:inset 0 0 0 1px var(--line); }
.bar3 .b-feonly { background:var(--dead); }
.bar3 .b-unpaired { background:repeating-linear-gradient(135deg,var(--surface-3) 0 4px,var(--surface) 4px 8px); }
.mapline { display:flex; align-items:baseline; gap:8px; font-size:12px; }
.mapline .kind { font:600 10px/1 ui-monospace,monospace; border:1px solid var(--line);
  border-radius:5px; padding:4px 6px; color:var(--muted); min-width:50px; text-align:center; flex:none; }
.mapline .when { margin-left:auto; color:var(--muted); font-size:11px; flex:none; }
.mapline.stale .kind { color:var(--guess); border-color:var(--guess); }
.stalenote { margin:2px 0 4px; font-size:11px; line-height:1.5; color:var(--guess); }
.stalenote code { font:10.5px ui-monospace,monospace; word-break:break-all; }
.flags { display:flex; gap:6px; flex-wrap:wrap; }
.flag { font-size:10.5px; padding:2px 8px; border-radius:999px; border:1px solid var(--line); color:var(--muted); }
.flag.warn { color:var(--guess); } .flag.bad { color:var(--dead); }
.cardfoot { display:flex; gap:7px; align-items:center; margin-top:auto; padding-top:4px; flex-wrap:wrap; }
.open-btn { font-size:12.5px; font-weight:600; text-decoration:none; color:#fff;
  border:1px solid var(--brand); border-radius:8px; padding:6px 12px; background:var(--brand); }
.open-btn:hover { filter:brightness(1.08); }
.cardfoot .btn { padding:5px 10px; font-size:11.5px; }
.cardfoot .rm { color:var(--muted); }
.cardfoot .rm:hover { color:var(--dead); border-color:var(--dead); }
.none { color:var(--muted); font-size:12.5px; margin:0; }
.empty-box { border:1px dashed var(--line-2); border-radius:14px; background:var(--surface);
  padding:34px 26px; text-align:center; }
.empty-box h2 { margin:0 0 6px; font-size:17px; }
.empty-box p { margin:0 auto 16px; max-width:62ch; color:var(--muted); font-size:13px; line-height:1.65; }
.empty-box code { background:var(--surface-2); padding:2px 6px; border-radius:5px;
  font:12px ui-monospace,monospace; }
.hint { margin:0 0 16px; }
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

const revOf = (project: HubProject, kind: 'fe' | 'be'): string => {
  const found = (project.rev ?? []).find((r) => r.kind === kind);
  const label = [found?.branch, found?.sha].filter((x) => x !== undefined).join(' · ');
  return label === ''
    ? '<span class="norev">không đọc được revision</span>'
    : `<span class="rev">${escapeHtml(label)}</span>`;
};

function card(project: HubProject, options: HubOptions, now: number): string {
  const sides = [project.fe !== undefined ? 'FE' : null, project.be !== undefined ? 'BE' : null]
    .filter(Boolean)
    .join('+');
  const roots = (['fe', 'be'] as const)
    .filter((kind) => project[kind] !== undefined)
    .map((kind) => `<div class="rootrow"><span class="tagk">${kind.toUpperCase()}</span>`
      + `<code title="${escapeHtml(project[kind] as string)}">${escapeHtml(project[kind] as string)}</code>`
      + `${revOf(project, kind)}</div>`)
    .join('');

  const best = project.maps.find((m) => m.kind === 'linked') ?? project.maps[0];
  // cm:guard A map scanned from a directory the project no longer points at is labelled on its own
  // line, not folded into the flags: the numbers next to it describe a different repo, so the reader
  // has to see that before reading them.
  const lines = project.maps
    .map((m) => `<div class="mapline${m.scannedFrom === undefined ? '' : ' stale'}"><span class="kind">${m.kind}</span>`
      + `<span>${m.endpoints} endpoint · ${m.screens} màn · ${m.calls} lời gọi</span>`
      + `<span class="when">${escapeHtml(relativeAge(m.scannedAt, now))}</span></div>`
      + (m.scannedFrom === undefined ? ''
        : `<p class="stalenote">map này scan từ <code title="${escapeHtml(m.scannedFrom)}">${escapeHtml(m.scannedFrom)}</code> — không phải gốc hiện tại. Scan lại để khớp.</p>`))
    .join('');

  const href = options.linkTo(project);
  // cm:why A project with no map gets a scan button, not an instruction to go and type the CLI: this
  // page can run the scan itself now, and the state it is describing is the state it can fix.
  const actions = options.live
    ? `${project.fe === undefined ? '' : `<button class="btn" data-scan="fe" data-id="${escapeHtml(project.id)}">Scan FE</button>`}
       ${project.be === undefined ? '' : `<button class="btn" data-scan="be" data-id="${escapeHtml(project.id)}">Scan BE</button>`}
       <button class="btn" data-edit="${escapeHtml(project.id)}"
         data-name="${escapeHtml(project.name)}"
         data-fe="${escapeHtml(project.fe ?? '')}"
         data-be="${escapeHtml(project.be ?? '')}"
         data-hints="${escapeHtml(project.hints ?? '')}">Sửa gốc</button>
       <button class="btn rm" data-rm="${escapeHtml(project.id)}" data-name="${escapeHtml(project.name)}">Bỏ khỏi workspace</button>`
    : '';

  return `<div class="card">
  <h2><span class="nm" title="${escapeHtml(project.name)}">${escapeHtml(project.name)}</span><span class="sides">${sides}</span></h2>
  ${project.name === project.id ? '' : `<p class="idline">${escapeHtml(project.id)}</p>`}
  ${roots}
  ${project.maps.length > 0 ? lines : '<p class="none">Chưa có map nào — bấm Scan để dựng bản đồ đầu tiên.</p>'}
  ${best ? bar(best) : ''}
  ${best ? flags(best) : ''}
  <div class="cardfoot">
    ${href !== null ? `<a class="open-btn" href="${escapeHtml(href)}">Mở bản đồ →</a>` : ''}
    ${actions}
  </div>
</div>`;
}

// cm:why Totals over every project, with unresolved kept OUT of the endpoint count: the two are
// counted separately everywhere else in apiflow, and a hub that adds them up contradicts every
// other page.
function totals(projects: HubProject[]): string {
  const best = projects.map((p) => p.maps.find((m) => m.kind === 'linked') ?? p.maps[0]).filter((m) => m !== undefined);
  const sum = (pick: (m: HubMap) => number) => best.reduce((n, m) => n + pick(m as HubMap), 0);
  const scanned = projects.filter((p) => p.maps.length > 0).length;
  const t = (lab: string, value: number, sub: string, alarm = false) =>
    `<div class="t1${alarm && value > 0 ? ' alarm' : ''}"><div class="lab">${lab}</div>`
    + `<div class="val">${value.toLocaleString('vi-VN')}</div><div class="sub">${sub}</div></div>`;
  return `<div class="totals">
    ${t('project', projects.length, scanned === projects.length ? 'đã scan hết' : `${projects.length - scanned} chưa scan`)}
    ${t('endpoint', sum((m) => m.endpoints), 'trên mọi project')}
    ${t('màn hình', sum((m) => m.screens), 'trên mọi project')}
    ${t('không auth', sum((m) => m.open), 'không thấy cổng chặn', true)}
    ${t('FE gọi, API không khai', sum((m) => (m.hasBe ? m.feOnly : 0)), 'chỉ tính project đã scan hai phía', true)}
    ${t('unresolved', sum((m) => m.unresolved), 'không nằm trong các số trên', true)}
  </div>`;
}

export function renderHub(projects: HubProject[], options: HubOptions, now: number): string {
  // cm:guard The empty state points at the button when there IS one. Telling someone to go and type
  // a CLI command on a page that can do the thing is how a feature stays undiscovered.
  const empty = options.live
    ? `<div class="empty-box"><h2>Chưa có project nào</h2>
        <p>apiflow đọc một repo FE và một repo BE rồi dựng bản đồ màn ↔ endpoint ↔ field, để trả lời
        “đổi endpoint này thì màn nào vỡ”. Nó chỉ ghi vào workspace ở trên, không bao giờ viết gì vào
        repo được đọc.</p>
        <button class="btn primary" id="add-open-2">+ Thêm project đầu tiên</button></div>`
    : `<div class="empty-box"><h2>Chưa có project nào</h2>
        <p>Bản tĩnh này được sinh khi workspace <code>${escapeHtml(options.workspace)}</code> còn rỗng.</p>
        <p><code>apiflow project add adminhub --fe=/đường/dẫn/ui --be=/đường/dẫn/api</code></p></div>`;

  const legend = '<p class="hint sub">Thanh màu trong mỗi thẻ là tỉ lệ <b>có màn gọi</b> / '
    + '<b>không ai gọi</b> / <b>FE gọi mà API không khai</b> / <b>chưa đối chiếu được</b> '
    + '(kẻ sọc — thiếu một trong hai phía), tính trên bản đồ đầy đủ nhất của project đó.</p>';
  const body = projects.length === 0
    ? empty
    : `${totals(projects)}${legend}<div class="cards">${projects.map((p) => card(p, options, now)).join('\n')}</div>`;

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>apiflow — ${projects.length} project</title>
<link rel="icon" href="${FAVICON}">
${THEME_BOOT}
<style>${STYLE}${BRAND_STYLE}${THEME_STYLE}${ADD_STYLE}${HUB_STYLE}</style>
</head>
<body>
<div class="page">
  <div class="hubtop">
    <div>
      <div class="brandbar"><span class="mark">${MARK}</span><h1>apiflow</h1></div>
      <p class="who">${projects.length} project · workspace <code>${escapeHtml(options.workspace)}</code>${options.live ? ' · bản sống' : ' · bản tĩnh'}</p>
    </div>
    <div class="acts">
      ${options.live ? '<button class="btn primary" id="add-open">+ Thêm project</button>' : ''}
      <button class="thbtn" id="theme-btn" type="button" title="đổi nền sáng / tối">
        <span class="sw2"></span><span id="theme-label">theo hệ điều hành</span>
      </button>
    </div>
  </div>
  ${options.live ? '<pre class="scanlog" id="scanlog"></pre>' : ''}
  ${body}
  ${projects.length === 0 ? '' : `<p class="note">Mỗi con số là <b>ứng viên, không phải phán quyết</b>. “không auth” nghĩa là không thấy cổng chặn nào trong code. “unresolved” là những lời gọi apiflow thấy nhưng không giải được đường dẫn — chúng <b>không</b> nằm trong các con số còn lại.</p>`}
</div>
${options.live ? ADD_DIALOG : ''}
<script type="application/json" id="project">null</script>
${options.live ? `<script>${ADD_SCRIPT}</script>` : ''}
<script>${THEME_SCRIPT}</script>
</body>
</html>
`;
}
