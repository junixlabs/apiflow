import type { ApiMapFile } from '../core/apimap';
import type { Alert } from '../workspace/alerts';
import { alertCounts, alerts as computeAlerts } from '../workspace/alerts';
import { endpointReliability, summarize } from '../workspace/summary';
import type { MapDiff } from '../workspace/diff';
import { APP_STYLE } from './appStyle';
import { PANES_HTML, PANES_SCRIPT, PANES_SCRIPT_2, PANES_SCRIPT_3, PANES_SCRIPT_4, PANES_STYLE } from './panes';
import { BRAND_STYLE, FAVICON, MARK, STYLE } from './theme';

export interface AppPayload {
  map: ApiMapFile;
  projectId?: string;
  sourcePath: string;
  live: boolean;
  history?: Array<{ id: string; when?: string }>;
  diff?: MapDiff;
}

export type Section =
  | 'overview' | 'endpoints' | 'cover' | 'graph' | 'impact' | 'screens' | 'unresolved' | 'alerts' | 'compare';

export const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'cover', label: 'Bản đồ phủ' },
  { id: 'graph', label: 'Vòng ảnh hưởng' },
  { id: 'impact', label: 'Ảnh hưởng' },
  { id: 'screens', label: 'Màn hình' },
  { id: 'unresolved', label: 'Unresolved' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'compare', label: 'So sánh' },
];

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

// cm:guard `</script>` inside a field name or a snippet would close the tag and turn the payload into
// markup. Escaping `<` is what keeps a scanned repo from injecting into the page it is rendered on.
export function embedJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/[\u2028\u2029]/g, (c) => (c === '\u2028' ? '\\u2028' : '\\u2029'));
}

function donut(parts: Array<{ n: number; cls: string }>, total: number): string {
  const R = 26;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const rings = parts
    .filter((p) => p.n > 0)
    .map((p) => {
      const len = total === 0 ? 0 : (p.n / total) * C;
      const seg = `<circle class="${p.cls}" cx="34" cy="34" r="${R}" fill="none" stroke="currentColor"`
        + ` stroke-width="11" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}"`
        + ` stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 34 34)"/>`;
      offset += len;
      return seg;
    })
    .join('');
  return `<svg width="68" height="68" viewBox="0 0 68 68" role="img">${rings}</svg>`;
}

function rail(payload: AppPayload, counts: { alerts: number; high: number }, unresolved: number): string {
  const link = (id: Section, label: string, n?: number, tone = '') =>
    `<a href="#${id}" data-section="${id}" class="${tone}">${label}${n === undefined ? '' : `<span class="n">${n}</span>`}</a>`;
  return `<div class="rail">
  <div class="brandbar"><span class="mark">${MARK}</span><h1 style="font-size:16px">apiflow</h1></div>
  <nav>
    ${link('overview', 'Tổng quan')}
    ${link('endpoints', 'Endpoints', payload.map.endpoints.length)}
    ${link('cover', 'Bản đồ phủ')}
    ${link('graph', 'Vòng ảnh hưởng')}
    ${link('impact', 'Ảnh hưởng')}
    ${link('screens', 'Màn hình', payload.map.screens.length)}
    <div class="sep"></div>
    ${link('unresolved', 'Unresolved', unresolved, 'warn')}
    ${link('alerts', 'Alerts', counts.high > 0 ? counts.high : counts.alerts, counts.high > 0 ? 'bad' : '')}
    ${link('compare', 'So sánh')}
  </nav>
  <p class="foot">${escapeHtml(payload.sourcePath)}</p>
</div>`;
}

function overview(payload: AppPayload, list: Alert[]): string {
  const map = payload.map;
  const sum = summarize(map);
  const counts = alertCounts(list);
  const total = sum.both + sum.uncalled + sum.feOnly + sum.unpaired;
  const pct = (n: number) => (total === 0 ? '0%' : `${((n / total) * 100).toFixed(2)}%`);
  const d = payload.diff;
  const delta = (n: number | undefined) =>
    n === undefined || n === 0 ? '' : `<div class="d ${n > 0 ? 'up' : 'down'}">${n > 0 ? '▲' : '▼'} ${Math.abs(n)} so với lần trước</div>`;

  const kpi = (k: string, v: number | string, extra = '', cls = '') =>
    `<div class="kpi ${cls}"><div class="k">${k}</div><p class="v">${typeof v === 'number' ? v.toLocaleString('vi-VN') : v}</p>${extra}</div>`;

  const calls = sum.confidence;
  const callTotal = calls.exact + calls.inferred + calls.guess;

  return `<section class="pane" id="pane-overview">
  <div class="kpis">
    ${kpi('endpoint', sum.endpoints, delta(d?.endpoints.added.length === undefined ? undefined : d.endpoints.added.length - d.endpoints.removed.length))}
    ${kpi('màn hình', sum.screens)}
    ${kpi('lời gọi', sum.calls)}
    ${kpi('field', sum.fields)}
    ${kpi('unresolved', sum.unresolved, '<div class="d">không nằm trong các số bên cạnh</div>', sum.unresolved > 0 ? 'alarm' : '')}
    ${kpi('thấy từ hai phía', sum.both, `<div class="d">${total === 0 ? '—' : `${((sum.both / total) * 100).toFixed(1)}% endpoint`}</div>`)}
  </div>

  <div class="panels">
    <div class="panel">
      <h3>Trạng thái đối chiếu — ${sum.endpoints} endpoint</h3>
      <div class="recon">
        <i class="d-both" style="width:${pct(sum.both)}"></i>
        <i class="d-uncalled" style="width:${pct(sum.uncalled)}"></i>
        <i class="d-feonly" style="width:${pct(sum.feOnly)}"></i>
        <i class="d-unpaired" style="width:${pct(sum.unpaired)}"></i>
      </div>
      <div class="legend4">
        <div class="li"><b>${sum.both}</b><span class="dot d-both"></span> khớp cả hai phía</div>
        <div class="li"><b>${sum.uncalled}</b><span class="dot d-uncalled"></span> API khai, không màn nào gọi</div>
        <div class="li"><b>${sum.feOnly}</b><span class="dot d-feonly"></span> FE gọi, API không khai</div>
        <div class="li"><b>${sum.unpaired}</b><span class="dot d-unpaired"></span> chưa đối chiếu được</div>
      </div>
    </div>

    <div class="panel">
      <h3>Độ tin cậy — ${callTotal} lời gọi</h3>
      <div class="donut">
        <span style="color:var(--exact)">${donut([
          { n: calls.exact, cls: 'c-exact' },
          { n: calls.inferred, cls: 'c-inferred' },
          { n: calls.guess, cls: 'c-guess' },
        ], callTotal)}</span>
        <div class="rows">
          <div><i class="c-bg-exact"></i> exact <b>${calls.exact}</b></div>
          <div><i class="c-bg-inferred"></i> inferred <b>${calls.inferred}</b></div>
          <div><i class="c-bg-guess"></i> guess <b>${calls.guess}</b></div>
        </div>
      </div>
    </div>

    <div class="panel">
      <h3>Đáng để mắt</h3>
      <div class="watch">
        ${counts.byKind['method-mismatch'] > 0 ? `<a href="#alerts" data-section="alerts" data-kind="method-mismatch" class="bad"><span class="num">${counts.byKind['method-mismatch']}</span><span class="txt">FE gọi sai method — path có nhưng method thì không</span></a>` : ''}
        ${counts.byKind['fe-only-path'] > 0 ? `<a href="#alerts" data-section="alerts" data-kind="fe-only-path" class="bad"><span class="num">${counts.byKind['fe-only-path']}</span><span class="txt">FE gọi đường dẫn API không khai</span></a>` : ''}
        ${counts.byKind['open-auth'] > 0 ? `<a href="#alerts" data-section="alerts" data-kind="open-auth" class="bad"><span class="num">${counts.byKind['open-auth']}</span><span class="txt">không thấy cổng auth nào</span></a>` : ''}
        ${counts.byKind.uncalled > 0 ? `<a href="#alerts" data-section="alerts" data-kind="uncalled" class="txt"><span class="num">${counts.byKind.uncalled}</span><span class="txt">API khai mà không màn nào gọi</span></a>` : ''}
        ${sum.unresolved > 0 ? `<a href="#unresolved" data-section="unresolved" class="warn"><span class="num">${sum.unresolved}</span><span class="txt">lời gọi không giải được đường dẫn</span></a>` : ''}
      </div>
    </div>
  </div>

  <p class="hintbox">Mỗi con số là <b>ứng viên, không phải phán quyết</b>. Các số trong thanh đối chiếu
  <b>không</b> bao gồm ${sum.unresolved} mục Unresolved — chúng là mẫu số của độ tin cậy, không phải endpoint.
  “không auth” nghĩa là không thấy cổng chặn nào <i>trong code</i>.</p>
</section>`;
}

export function renderApp(payload: AppPayload): string {
  const list = computeAlerts(payload.map);
  const counts = alertCounts(list);
  const reliability = [...endpointReliability(payload.map)].map(([id, r]) => [id, r.exact, r.inferred, r.guess] as const);
  const name = payload.map.metadata.name;

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>apiflow — ${escapeHtml(name)}</title>
<link rel="icon" href="${FAVICON}">
<style>${STYLE}${BRAND_STYLE}${APP_STYLE}${PANES_STYLE}</style>
</head>
<body>
<div class="app-shell">
${rail(payload, { alerts: counts.total, high: counts.high }, payload.map.unresolved.length)}
<div class="main">
  <div class="phead">
    <div>
      <h1>${escapeHtml(name)}</h1>
      <p class="roots">gốc ${escapeHtml(payload.map.metadata.root)}</p>
    </div>
    <div class="right">${escapeHtml(payload.map.metadata.generator)}${payload.live ? ' · bản sống' : ''}
      ${payload.live && payload.projectId !== undefined
        ? `<div style="margin-top:7px"><button class="btn" id="scan-fe">Scan lại FE</button> <button class="btn" id="scan-be">Scan lại BE</button></div>`
        : ''}
    </div>
  </div>
${overview(payload, list)}
  <pre class="scanlog" id="scanlog"></pre>
${PANES_HTML}
</div>
</div>
<script type="application/json" id="apimap">${embedJson(payload.map)}</script>
<script type="application/json" id="alerts">${embedJson(list)}</script>
<script type="application/json" id="reliability">${embedJson(reliability)}</script>
<script type="application/json" id="project">${embedJson(payload.projectId ?? null)}</script>
<script type="application/json" id="diff">${embedJson(payload.diff ?? null)}</script>
<script>${PANES_SCRIPT}${PANES_SCRIPT_2}${PANES_SCRIPT_4}${PANES_SCRIPT_3}</script>
</body>
</html>
`;
}
