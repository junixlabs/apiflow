import type { ApiMapFile } from '@junixlabs/apiflow-map';
import type { Alert } from '@junixlabs/apiflow-map';
import { alertCounts, alerts as computeAlerts } from '@junixlabs/apiflow-map';
import { endpointReliability, summarize } from '@junixlabs/apiflow-map';
import type { MapDiff } from '@junixlabs/apiflow-map';
import { APP_STYLE } from './appStyle';
import { relativeAge } from './hub';
import type { SideInfo } from '../workspace/sides';
import type { EndpointHistory, MapSeries } from '../workspace/series';
import { ADD_DIALOG, ADD_SCRIPT, ADD_STYLE } from './addProject';
import { PANES_HTML, PANES_SCRIPT, PANES_SCRIPT_2, PANES_SCRIPT_3, PANES_SCRIPT_4, PANES_STYLE } from './panes';
import { BRAND_STYLE, FAVICON, MARK, STYLE, THEME_BOOT, THEME_SCRIPT, THEME_STYLE } from './theme';

export interface AppPayload {
  map: ApiMapFile;
  projectId?: string;
  sourcePath: string;
  live: boolean;
  kind?: string;
  projectName?: string;
  homeHref?: string;
  hints?: string;
  sides?: SideInfo[];
  now?: number;
  series?: MapSeries | null;
  epHistory?: EndpointHistory | null;
  history?: Array<{ id: string; when?: string }>;
  diff?: MapDiff;
}

export type Section =
  | 'overview' | 'endpoints' | 'cover' | 'graph' | 'impact' | 'screens' | 'unresolved' | 'alerts' | 'compare';

export const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'cover', label: 'Coverage' },
  { id: 'graph', label: 'Impact ring' },
  { id: 'impact', label: 'Impact' },
  { id: 'screens', label: 'Screens' },
  { id: 'unresolved', label: 'Unresolved' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'compare', label: 'Compare' },
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


// cm:guard Stroke-only 16px glyphs using currentColor — a filled or coloured icon set would need a
// second pass for the dark palette, and the rail is the one place both themes must agree.
const ICONS: Record<Section, string> = {
  overview: '<path d="M2.5 8.5h4l1.5-4 2 8 1.5-4h2.5"/>',
  endpoints: '<path d="M2.5 4h11M2.5 8h11M2.5 12h7"/>',
  cover: '<path d="M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z"/>',
  graph: '<path d="M3 3v10M13 3v10"/><circle cx="3" cy="4.5" r="1.2"/><circle cx="3" cy="11.5" r="1.2"/><circle cx="13" cy="8" r="1.2"/><path d="M4.4 4.8 11.7 7.6M4.4 11.2 11.7 8.4"/>',
  impact: '<circle cx="8" cy="8" r="2"/><path d="M8 2v2.5M8 11.5V14M2 8h2.5M11.5 8H14"/>',
  screens: '<rect x="2.5" y="3" width="11" height="8" rx="1.2"/><path d="M6 13.5h4"/>',
  unresolved: '<path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3"/>',
  alerts: '<path d="M8 2.5a4 4 0 0 0-4 4v3l-1.2 2h10.4L12 9.5v-3a4 4 0 0 0-4-4z"/><path d="M6.5 13.5h3"/>',
  compare: '<path d="M4 3v10M12 3v10"/><path d="M4 6h8M12 10H4"/>',
};

const icon = (id: Section) =>
  `<svg class="ico" viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id]}</svg>`;

const KIND_WORD: Record<string, string> = { fe: 'FE', be: 'BE', linked: 'FE+BE' };

// cm:why Names the revision each half was scanned AT, not the revision it is on now: the map is a
// photograph, and a header that quietly shows today's branch makes a stale map look current.
// cm:guard Prints "revision unreadable" rather than nothing when .git is unreadable — a blank
// where a sha belongs reads as "same as before".
function sideLine(side: SideInfo, now: number): string {
  const rev = side.branch === undefined && side.sha === undefined
    ? '<span class="dim">revision unreadable</span>'
    : `<span class="rev">${escapeHtml([side.branch, side.sha].filter((x) => x !== undefined).join(' · '))}</span>`;
  return `<div class="side-row"><span class="tagk">${side.kind.toUpperCase()}</span>
    <code>${escapeHtml(side.root)}</code> ${rev}
    <span class="dim">${escapeHtml(relativeAge(side.scannedAt, now))}</span></div>`;
}

function header(payload: AppPayload, name: string): string {
  const now = payload.now ?? 0;
  // cm:guard Every control here is gated on `live`: the same renderer writes the offline file that
  // `apiflow view` produces, and a form posting to a server that is not running is a dead button.
  const sides = payload.sides ?? [];
  const root = (kind: 'fe' | 'be') => sides.find((s) => s.kind === kind)?.root ?? '';
  // cm:edge contract -> src/view/addProject.ts — it reads these data-* attributes to prefill the
  // dialog in edit mode, so a renamed attribute here silently opens an empty form.
  const editBtn = payload.projectId === undefined ? '' : `<button class="btn" data-edit="${escapeHtml(payload.projectId)}"
        data-name="${escapeHtml(payload.projectName ?? payload.map.metadata.name)}"
        data-fe="${escapeHtml(root('fe'))}" data-be="${escapeHtml(root('be'))}"
        data-hints="${escapeHtml(payload.hints ?? '')}">Edit roots</button>`;
  // cm:why `+ Add project` is a workspace action, so it lives at the foot of the rail on this page and
  // on the hub alike. In this row it read as one of the things you can do TO the project you opened.
  // cm:guard A side with no directory on this machine gets no scan button: pressing it answers "no
  // directory to scan", which reads as a broken project when the truth is the side arrives as a file.
  const scannable = (kind: 'fe' | 'be') => sides.some((s) => s.kind === kind && s.imported !== true);
  const scanBtn = (kind: 'fe' | 'be', cls: string) =>
    scannable(kind) || sides.every((s) => s.kind !== kind)
      ? `<button class="btn ${cls}" id="scan-${kind}">Re-scan ${kind.toUpperCase()}</button>`
      : `<button class="btn" disabled title="${kind.toUpperCase()} was scanned on ${escapeHtml(root(kind))} and imported as a file — re-import it to update">${kind.toUpperCase()} imported</button>`;
  const scanBtns = payload.live
    ? `<div class="btnrow">
        ${payload.projectId === undefined ? '' : `${scanBtn('fe', 'primary')}
        ${scanBtn('be', '')}`}
        ${editBtn}
      </div>`
    : '';
  return `  <div class="phead">
    <div class="pident">
      <h1>${escapeHtml(name)}</h1>
      ${payload.kind === undefined ? '' : `<span class="kind">${escapeHtml(KIND_WORD[payload.kind] ?? payload.kind)}</span>`}
      ${payload.live ? '<span class="kind live">live</span>' : '<span class="kind">static</span>'}
    </div>
    <div class="pmeta">
      ${sides.length === 0
        ? `<div class="side-row"><span class="tagk">ROOT</span><code>${escapeHtml(payload.map.metadata.root)}</code></div>`
        : sides.map((side) => sideLine(side, now)).join('\n')}
      <div class="side-row gen"><span class="dim">${escapeHtml(payload.map.metadata.generator)}</span></div>
    </div>
    ${scanBtns}
  </div>`;
}

function rail(payload: AppPayload, counts: { alerts: number; high: number }, unresolved: number): string {
  const link = (id: Section, label: string, n?: number, tone = '') =>
    `<a href="#${id}" data-section="${id}" class="${tone}">${icon(id)}<span class="lbl">${label}</span>${n === undefined ? '' : `<span class="n">${n}</span>`}</a>`;
  // cm:why The brand is the way back to the workspace, and it is a plain heading when there is nowhere
  // to go: `apiflow view` writes a file with no hub beside it, and a dead link there is worse than none.
  const brand = `<span class="mark">${MARK}</span><h1 style="font-size:16px">apiflow</h1>`;
  // cm:guard Same element either way, so the two pages start at the same height: a link only on one
  // of them shifted the whole rail by 16px, which is exactly the kind of drift nobody can name.
  return `<div class="rail">
  <div class="brandbar">${payload.homeHref === undefined ? `<span class="home">${brand}</span>`
    : `<a class="home" href="${escapeHtml(payload.homeHref)}" title="back to the project list">${brand}</a>`}</div>
  <nav>
    ${link('overview', 'Overview')}
    ${link('endpoints', 'Endpoints', payload.map.endpoints.length)}
    ${link('cover', 'Coverage')}
    ${link('graph', 'Impact ring')}
    ${link('impact', 'Impact')}
    ${link('screens', 'Screens', payload.map.screens.length)}
    <div class="sep"></div>
    ${link('unresolved', 'Unresolved', unresolved, 'warn')}
    ${link('alerts', 'Alerts', counts.high > 0 ? counts.high : counts.alerts, counts.high > 0 ? 'bad' : '')}
    ${link('compare', 'Compare')}
  </nav>
  <div class="railfoot">
    ${payload.live ? '<button class="btn" id="add-open">+ Add project</button>' : ''}
    <button class="thbtn" id="theme-btn" type="button" title="switch light / dark" style="width:100%">
      <span class="sw2"></span><span id="theme-label">follow the OS</span>
    </button>
    <p class="foot">${escapeHtml(payload.sourcePath)}</p>
  </div>
</div>`;
}

function overview(payload: AppPayload, list: Alert[]): string {
  const map = payload.map;
  const sum = summarize(map);
  const counts = alertCounts(list);
  const total = sum.both + sum.uncalled + sum.feOnly + sum.unpaired;
  const pct = (n: number) => (total === 0 ? '0%' : `${((n / total) * 100).toFixed(2)}%`);
  const calls = sum.confidence;
  const callTotal = calls.exact + calls.inferred + calls.guess;

  return `<section class="pane" id="pane-overview">
  <!-- cm:edge contract -> src/view/panes.ts kpiStrip() — it fills this and the twin on the endpoints
       pane. One renderer for both, so the two bands cannot report different numbers. -->
  <div class="kpistrip" id="ov-kpis"></div>

  <div class="panels">
    <div class="panel">
      <h3>Reconciliation — ${sum.endpoints} endpoints</h3>
      <div class="recon">
        <i class="d-both" style="width:${pct(sum.both)}"></i>
        <i class="d-uncalled" style="width:${pct(sum.uncalled)}"></i>
        <i class="d-feonly" style="width:${pct(sum.feOnly)}"></i>
        <i class="d-unpaired" style="width:${pct(sum.unpaired)}"></i>
      </div>
      <div class="legend4">
        <div class="li"><b>${sum.both}</b><span class="dot d-both"></span> seen from both sides</div>
        <div class="li"><b>${sum.uncalled}</b><span class="dot d-uncalled"></span> declared, no screen calls it</div>
        <div class="li"><b>${sum.feOnly}</b><span class="dot d-feonly"></span> FE calls it, API does not declare it</div>
        <div class="li"><b>${sum.unpaired}</b><span class="dot d-unpaired"></span> not reconciled yet</div>
      </div>
    </div>

    <div class="panel">
      <h3>Confidence — ${callTotal} calls</h3>
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
      <h3>Worth a look</h3>
      <div class="watch">
        ${counts.byKind['method-mismatch'] > 0 ? `<a href="#alerts" data-section="alerts" data-kind="method-mismatch" class="bad"><span class="num">${counts.byKind['method-mismatch']}</span><span class="txt">FE calls a method the API does not declare on that path</span></a>` : ''}
        ${counts.byKind['fe-only-path'] > 0 ? `<a href="#alerts" data-section="alerts" data-kind="fe-only-path" class="bad"><span class="num">${counts.byKind['fe-only-path']}</span><span class="txt">FE calls a path the API does not declare</span></a>` : ''}
        ${counts.byKind['open-auth'] > 0 ? `<a href="#alerts" data-section="alerts" data-kind="open-auth" class="bad"><span class="num">${counts.byKind['open-auth']}</span><span class="txt">no auth gate found</span></a>` : ''}
        ${counts.byKind.uncalled > 0 ? `<a href="#alerts" data-section="alerts" data-kind="uncalled" class="txt"><span class="num">${counts.byKind.uncalled}</span><span class="txt">declared by the API, called by no screen</span></a>` : ''}
        ${sum.unresolvedPaths > 0 ? `<a href="#unresolved" data-section="unresolved" class="warn"><span class="num">${sum.unresolvedPaths}</span><span class="txt">calls whose path could not be resolved</span></a>` : ''}
        ${sum.unresolvedSchemas > 0 ? `<a href="#unresolved" data-section="unresolved" class="warn"><span class="num">${sum.unresolvedSchemas}</span><span class="txt">endpoints with no request/response schema in the code</span></a>` : ''}
      </div>
    </div>
  </div>

  <p class="hintbox">Every number here is a <b>candidate, not a verdict</b>. The reconciliation bar does
  <b>not</b> include the ${sum.unresolved} Unresolved entries — those are the denominator of confidence,
  not endpoints. “no auth” means no gate was found <i>in the code</i>.</p>
</section>`;
}

export function renderApp(payload: AppPayload): string {
  const list = computeAlerts(payload.map);
  const counts = alertCounts(list);
  const reliability = [...endpointReliability(payload.map)].map(([id, r]) => [id, r.exact, r.inferred, r.guess] as const);
  // cm:guard Titled by the PROJECT when one backs the page, not by the map: the rail on the hub calls
  // it `adminhub`, and landing on a page headed `adminhub-ui+adminhub-api` reads as a different thing.
  // The map's own name still shows up in the generator line under the roots.
  const name = payload.projectName ?? payload.map.metadata.name;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>apiflow — ${escapeHtml(name)}</title>
<link rel="icon" href="${FAVICON}">
${THEME_BOOT}
<style>${STYLE}${BRAND_STYLE}${THEME_STYLE}${APP_STYLE}${ADD_STYLE}${PANES_STYLE}</style>
</head>
<body>
<div class="app-shell">
${rail(payload, { alerts: counts.total, high: counts.high }, payload.map.unresolved.length)}
<div class="main">
${header(payload, name)}
${overview(payload, list)}
  <pre class="scanlog" id="scanlog"></pre>
${payload.live ? ADD_DIALOG : ''}
${PANES_HTML}
</div>
</div>
<script type="application/json" id="apimap">${embedJson(payload.map)}</script>
<script type="application/json" id="alerts">${embedJson(list)}</script>
<script type="application/json" id="reliability">${embedJson(reliability)}</script>
<script type="application/json" id="project">${embedJson(payload.projectId ?? null)}</script>
<script type="application/json" id="ephist">${embedJson(payload.epHistory ?? null)}</script>
<script type="application/json" id="series">${embedJson(payload.series ?? null)}</script>
<script type="application/json" id="diff">${embedJson(payload.diff ?? null)}</script>
<script>${PANES_SCRIPT}${PANES_SCRIPT_2}${PANES_SCRIPT_4}${PANES_SCRIPT_3}${ADD_SCRIPT}${THEME_SCRIPT}</script>
</body>
</html>
`;
}
