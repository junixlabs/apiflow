import type { MapKind } from '../workspace/store';
import { ADD_DIALOG, ADD_SCRIPT, ADD_STYLE } from './addProject';
import { APP_STYLE } from './appStyle';
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

// cm:edge lockstep -> src/view/appStyle.ts — the shell, the rail, the head, the tiles, the panels and
// the watch list all come from there so both pages are one design. Only what is unique to the list of
// projects lives here; anything added below that a project page would also want belongs there instead.
const HUB_STYLE = `
.detail { display:flex; flex-direction:column; }
.has-js .detail { display:none; }
.has-js .detail.on { display:flex; }
.mapline { display:flex; align-items:baseline; gap:8px; font-size:12px; margin-top:7px; }
.mapline:first-of-type { margin-top:0; }
.mapline .kind2 { font:600 10px/1 ui-monospace,monospace; border:1px solid var(--line);
  border-radius:5px; padding:4px 6px; color:var(--muted); min-width:50px; text-align:center; flex:none; }
.mapline .when { margin-left:auto; color:var(--muted); font-size:11px; flex:none; }
.mapline.stale .kind2 { color:var(--guess); border-color:var(--guess); }
.stalenote { margin:6px 0 0; font-size:11px; line-height:1.55; color:var(--guess); }
.stalenote code { font:10.5px ui-monospace,monospace; word-break:break-all; }
.watch .who2 { margin-left:auto; flex:none; font:11px ui-monospace,monospace; color:var(--muted); }
.watch .more { font-size:11.5px; color:var(--muted); }
.empty-box { border:1px dashed var(--line-2); border-radius:14px; background:var(--surface);
  padding:34px 26px; text-align:center; margin-top:8px; }
.empty-box h2 { margin:0 0 6px; font-size:17px; }
.empty-box p { margin:0 auto 16px; max-width:62ch; color:var(--muted); font-size:13px; line-height:1.65; }
.empty-box code { background:var(--surface-2); padding:2px 6px; border-radius:5px;
  font:12px ui-monospace,monospace; }
.none { color:var(--muted); font-size:12.5px; margin:0; }
`;

// cm:guard No backticks and no ${} below — embedded in a String.raw literal.
// cm:why Switches panes in the browser instead of asking the server: `apiflow hub` writes this same
// page as one static file with no server to ask, and a reload per click would wipe the scan log.
export const HUB_SCRIPT = String.raw`
(function () {
  const rail = document.getElementById('rail');
  if (!rail) return;
  const items = [...rail.querySelectorAll('.ri')];
  const projects = items.filter((el) => el.dataset.project !== undefined);
  const panes = [...document.querySelectorAll('.detail')];
  const search = document.getElementById('hb-q');
  const stateSel = document.getElementById('hb-state');
  const sortSel = document.getElementById('hb-sort');
  const count = document.getElementById('hb-count');
  const state = { q: '', pick: '', sort: 'name', sel: null };

  try {
    const saved = localStorage.getItem('apiflow-hub-sort');
    if (saved) { state.sort = saved; sortSel.value = saved; }
  } catch (err) { /* file:// vẫn phải sắp được */ }

  const num = (el, key) => Number(el.dataset[key] || 0);
  // cm:why A stale map outranks every real finding, because those findings were measured on a repo
  // the project no longer points at — the number being wrong beats the number being bad. The option
  // label spells this order out, so the ranking is not a mystery.
  const risk = (el) => num(el, 'open') * 3 + num(el, 'feonly') * 3
    + (el.dataset.stale === '1' ? 1000 : 0) + num(el, 'unresolved') / 1000;

  const ORDER = {
    name: (a, b) => a.dataset.project.localeCompare(b.dataset.project),
    recent: (a, b) => num(b, 'scanned') - num(a, 'scanned'),
    oldest: (a, b) => num(a, 'scanned') - num(b, 'scanned'),
    endpoints: (a, b) => num(b, 'endpoints') - num(a, 'endpoints'),
    unresolved: (a, b) => num(b, 'unresolved') - num(a, 'unresolved'),
    risk: (a, b) => risk(b) - risk(a),
  };

  const matches = (el) => {
    if (state.q && !el.dataset.hay.includes(state.q)) return false;
    if (state.pick === '') return true;
    if (state.pick === 'stale') return el.dataset.stale === '1';
    return el.dataset.state === state.pick;
  };

  const show = (id) => {
    state.sel = id;
    for (const el of items) el.classList.toggle('on', el.dataset.pick === id);
    for (const pane of panes) pane.classList.toggle('on', pane.dataset.detail === id);
  };

  // cm:guard Every deliberate switch goes through the hash, so the address bar can never name one
  // project while the pane shows another — a reload would then land somewhere else than the screen.
  const pick = (id) => {
    if (location.hash.slice(1) === id) show(id);
    else location.hash = id;
  };

  const apply = () => {
    const shown = projects.filter(matches);
    for (const el of projects) el.hidden = !matches(el);
    const box = rail.querySelector('.railitems');
    for (const el of [...shown].sort(ORDER[state.sort] || ORDER.name)) box.appendChild(el);
    // cm:guard Says how many are hidden, never just how many are left: a count of 3 with no mention
    // of the other 9 reads as "this workspace has three projects".
    count.textContent = shown.length === projects.length
      ? projects.length + ' project'
      : shown.length + '/' + projects.length + ' project · ' + (projects.length - shown.length) + ' bị lọc đi';
    // cm:guard Never leaves the selection on a project the filter just hid — a detail pane whose rail
    // row is gone reads as a page that lost track of itself.
    const gone = state.sel !== null && state.sel !== 'all'
      && !shown.some((el) => el.dataset.pick === state.sel);
    // cm:why Falling back to nothing leaves the hash alone on purpose: a filter is not remembered, so
    // a reload should return to the project that was open, not to an empty screen.
    if (gone) { if (shown.length > 0) pick(shown[0].dataset.pick); else show('none'); }
  };

  search.addEventListener('input', () => { state.q = search.value.trim().toLowerCase(); apply(); });
  stateSel.addEventListener('change', () => { state.pick = stateSel.value; apply(); });
  sortSel.addEventListener('change', () => {
    state.sort = sortSel.value;
    try { localStorage.setItem('apiflow-hub-sort', state.sort); } catch (err) { /* không lưu được thì thôi */ }
    apply();
  });
  for (const el of items) el.addEventListener('click', () => pick(el.dataset.pick));

  const reset = document.getElementById('hb-reset');
  if (reset) reset.addEventListener('click', () => {
    state.q = '';
    state.pick = '';
    search.value = '';
    stateSel.value = '';
    apply();
    // cm:why Lands on the workspace pane, not on whichever project the cleared filter happens to put
    // first: the selection that led here was thrown away when its row disappeared.
    pick('all');
  });

  const fromHash = () => {
    const want = decodeURIComponent(location.hash.slice(1));
    const found = items.some((el) => el.dataset.pick === want);
    show(found ? want : 'all');
  };
  window.addEventListener('hashchange', fromHash);

  // cm:edge contract -> src/view/addProject.ts — it fires this after DELETE /api/projects/:id
  // succeeds, because only this script knows the row and the pane are two separate elements.
  document.addEventListener('apiflow:project-removed', (ev) => {
    const id = ev.detail.id;
    const wasOpen = state.sel === id;
    for (const el of [...projects, ...panes]) {
      if (el.dataset.pick === id || el.dataset.detail === id) el.remove();
    }
    const at = projects.findIndex((el) => el.dataset.pick === id);
    if (at >= 0) projects.splice(at, 1);
    // cm:guard Clears the selection BEFORE re-filtering, or the fallback inside apply picks the next
    // project and lands on a detail pane nobody asked for right after a delete.
    if (wasOpen) state.sel = null;
    apply();
    if (wasOpen) pick('all');
  });

  apply();
  fromHash();
})();
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

const bestOf = (project: HubProject): HubMap | undefined =>
  project.maps.find((m) => m.kind === 'linked') ?? project.maps[0];

const sidesOf = (project: HubProject): string =>
  [project.fe !== undefined ? 'FE' : null, project.be !== undefined ? 'BE' : null].filter(Boolean).join('+');

const stateOf = (project: HubProject): string => {
  const best = bestOf(project);
  if (best === undefined) return 'unscanned';
  if (best.hasFe && best.hasBe) return 'both';
  return best.hasBe ? 'be' : 'fe';
};

const newestScan = (project: HubProject): number => project.maps
  .map((m) => (m.scannedAt === undefined ? 0 : new Date(m.scannedAt).getTime()))
  .reduce((a, b) => Math.max(a, b), 0);

// cm:guard The rail shows the age of the NEWEST map, not of maps[0]: on a linked project the first
// entry is whichever kind was written first, so reading it would age the row by a whole scan.
const newestAge = (project: HubProject, now: number): string => {
  const newest = newestScan(project);
  return newest === 0 ? 'chưa scan' : relativeAge(new Date(newest).toISOString(), now);
};

// cm:edge lockstep -> src/view/app.ts overview() — the same four buckets, the same class names, so the
// bar on a project card and the bar on that project's own page cannot end up telling different stories.
const SEGMENTS = [
  { key: 'both' as const, css: 'd-both', label: 'khớp cả hai phía' },
  { key: 'uncalled' as const, css: 'd-uncalled', label: 'API khai, không màn nào gọi' },
  { key: 'feOnly' as const, css: 'd-feonly', label: 'FE gọi, API không khai' },
  { key: 'unpaired' as const, css: 'd-unpaired', label: 'chưa đối chiếu được' },
];

const total4 = (map: HubMap): number => SEGMENTS.reduce((n, s) => n + map[s.key], 0);

function micro(map: HubMap): string {
  const total = total4(map);
  if (total === 0) return '';
  const fills = SEGMENTS
    .map((s) => `<i class="${s.css}" style="width:${((map[s.key] / total) * 100).toFixed(2)}%"></i>`)
    .join('');
  return `<span class="micro" title="${SEGMENTS.map((s) => `${map[s.key]} ${s.label}`).join(' · ')}">${fills}</span>`;
}

function recon(map: HubMap): string {
  const total = total4(map);
  if (total === 0) return '<p class="none">Chưa đối chiếu được gì — chưa có map.</p>';
  const bars = SEGMENTS
    .map((s) => `<i class="${s.css}" style="width:${((map[s.key] / total) * 100).toFixed(2)}%"></i>`)
    .join('');
  const legend = SEGMENTS
    .map((s) => `<div class="li"><b>${map[s.key].toLocaleString('vi-VN')}</b>`
      + `<span class="dot ${s.css}"></span> ${s.label}</div>`)
    .join('');
  return `<div class="recon">${bars}</div><div class="legend4">${legend}</div>`;
}

// cm:guard Says what is MISSING before it says what is wrong: on a one-sided scan the honest label
// is "chưa scan BE", and printing a comparison finding there invents a defect out of a gap.
// cm:edge lockstep -> src/view/app.ts overview() — same `watch` rows, so a finding looks the same
// here and on the project page it links into.
function watch(map: HubMap, href: string | null): string {
  const rows: string[] = [];
  const row = (n: number, text: string, tone: string, hash: string) => {
    const inner = `<span class="num">${n.toLocaleString('vi-VN')}</span><span class="txt">${text}</span>`;
    rows.push(href === null
      ? `<div class="${tone}">${inner}</div>`
      : `<a class="${tone}" href="${escapeHtml(href + hash)}">${inner}</a>`);
  };
  if (map.open > 0) row(map.open, 'không thấy cổng auth nào', 'bad', '#alerts');
  if (map.hasBe && map.feOnly > 0) row(map.feOnly, 'FE gọi, API không khai', 'bad', '#alerts');
  if (map.hasFe && map.uncalled > 0) row(map.uncalled, 'API khai mà không màn nào gọi', '', '#alerts');
  if (map.unresolved > 0) row(map.unresolved, 'lời gọi không giải được đường dẫn', 'warn', '#unresolved');
  if (!map.hasBe) rows.push('<div class="none">Chưa scan BE — chưa đối chiếu được phía nào.</div>');
  if (!map.hasFe) rows.push('<div class="none">Chưa scan FE — không biết màn nào gọi.</div>');
  return rows.length === 0
    ? '<p class="none">Không có gì đáng để mắt.</p>'
    : `<div class="watch">${rows.join('')}</div>`;
}

const revOf = (project: HubProject, kind: 'fe' | 'be'): string => {
  const found = (project.rev ?? []).find((r) => r.kind === kind);
  const label = [found?.branch, found?.sha].filter((x) => x !== undefined).join(' · ');
  return label === ''
    ? '<span class="dim">không đọc được revision</span>'
    : `<span class="rev">${escapeHtml(label)}</span>`;
};

// cm:edge lockstep -> src/view/panes.ts kpiStrip() — same three lines in the same order, because the
// strip on a project page and the strip here sit one click apart and must not be different heights.
const kpi = (lab: string, value: number, sub: string, alarm = false): string =>
  `<div class="k1${alarm && value > 0 ? ' alarm' : ''}"><div class="lab">${lab}</div>`
  + `<div class="val">${value.toLocaleString('vi-VN')}</div><div class="dlt">${sub}</div></div>`;

// cm:edge contract -> HUB_SCRIPT above — it filters, sorts and selects on these data-* attributes,
// so a renamed attribute silently turns a filter into a no-op.
function railItem(project: HubProject, now: number): string {
  const best = bestOf(project);
  const stale = project.maps.some((m) => m.scannedFrom !== undefined);
  const alerts = best === undefined ? 0 : best.open + (best.hasBe ? best.feOnly : 0);
  const badges = [
    best === undefined ? '' : `<span>${escapeHtml(newestAge(project, now))}</span>`,
    alerts > 0 ? `<span class="bad">${alerts.toLocaleString('vi-VN')} alert</span>` : '',
    stale ? '<span class="warn">lệch gốc</span>' : '',
  ].filter((x) => x !== '');
  const counts = best === undefined
    ? '<span class="num">chưa scan</span>'
    : `<span class="num">${best.endpoints.toLocaleString('vi-VN')} ep · ${best.screens.toLocaleString('vi-VN')} màn</span>`;
  return `<button class="ri" type="button" data-pick="${escapeHtml(project.id)}"
  data-project="${escapeHtml(project.id)}"
  data-hay="${escapeHtml([project.name, project.id, project.fe ?? '', project.be ?? ''].join(' ').toLowerCase())}"
  data-state="${stateOf(project)}"
  data-stale="${stale ? '1' : '0'}"
  data-scanned="${newestScan(project)}"
  data-endpoints="${best?.endpoints ?? 0}"
  data-unresolved="${best?.unresolved ?? 0}"
  data-open="${best?.open ?? 0}"
  data-feonly="${best !== undefined && best.hasBe ? best.feOnly : 0}">
  <span class="l1"><span class="nm" title="${escapeHtml(project.name)}">${escapeHtml(project.name)}</span>
    <span class="sides">${sidesOf(project)}</span></span>
  <span class="l2">${best ? micro(best) : ''}${counts}</span>
  ${badges.length === 0 ? '' : `<span class="l3">${badges.join('')}</span>`}
</button>`;
}

function detail(project: HubProject, options: HubOptions, now: number): string {
  const href = options.linkTo(project);
  const best = bestOf(project);
  const roots = (['fe', 'be'] as const)
    .filter((kind) => project[kind] !== undefined)
    .map((kind) => `<div class="side-row"><span class="tagk">${kind.toUpperCase()}</span>`
      + `<code title="${escapeHtml(project[kind] as string)}">${escapeHtml(project[kind] as string)}</code>`
      + ` ${revOf(project, kind)}</div>`)
    .join('');

  // cm:guard A map scanned from a directory the project no longer points at is labelled on its own
  // line, not folded into the findings: the numbers next to it describe a different repo, so the
  // reader has to see that before reading them.
  const lines = project.maps
    .map((m) => `<div class="mapline${m.scannedFrom === undefined ? '' : ' stale'}"><span class="kind2">${m.kind}</span>`
      + `<span>${m.endpoints.toLocaleString('vi-VN')} endpoint · ${m.screens.toLocaleString('vi-VN')} màn · ${m.calls.toLocaleString('vi-VN')} lời gọi</span>`
      + `<span class="when">${escapeHtml(relativeAge(m.scannedAt, now))}</span></div>`
      + (m.scannedFrom === undefined ? ''
        : `<p class="stalenote">map này scan từ <code title="${escapeHtml(m.scannedFrom)}">${escapeHtml(m.scannedFrom)}</code> — không phải gốc hiện tại. Scan lại để khớp.</p>`))
    .join('');

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

  // cm:guard Every tile says which map it was measured on: a project can hold three, and a number
  // with no map behind it invites the reader to assume it came from the fullest one.
  const from = best === undefined ? '' : `bản ${best.kind}`;
  const tiles = best === undefined ? '' : `<div class="kpistrip">
    ${kpi('endpoint', best.endpoints, from)}
    ${kpi('màn hình', best.screens, from)}
    ${kpi('lời gọi', best.calls, from)}
    ${kpi('không auth', best.open, 'không thấy cổng chặn', true)}
    ${kpi('FE gọi, API không khai', best.hasBe ? best.feOnly : 0, best.hasBe ? from : 'chưa scan BE', true)}
    ${kpi('unresolved', best.unresolved, 'không nằm trong các số trên', true)}
  </div>`;

  return `<section class="detail" data-detail="${escapeHtml(project.id)}">
  <div class="phead">
    <div class="pident">
      <h1>${escapeHtml(project.name)}</h1>
      <span class="kind">${sidesOf(project)}</span>
      ${project.name === project.id ? '' : `<span class="kind">${escapeHtml(project.id)}</span>`}
    </div>
    <div class="pmeta">${roots}</div>
    <div class="btnrow">
      ${href !== null ? `<a class="btn primary" href="${escapeHtml(href)}">Mở bản đồ →</a>` : ''}
      ${actions}
    </div>
  </div>
  ${tiles}
  <div class="panels">
    <div class="panel"><h3>Trạng thái đối chiếu${best === undefined ? '' : ` — ${best.endpoints.toLocaleString('vi-VN')} endpoint`}</h3>
      ${best === undefined ? '<p class="none">Chưa có map nào — bấm Scan để dựng bản đồ đầu tiên.</p>' : recon(best)}</div>
    <div class="panel"><h3>Bản đồ đã scan</h3>${project.maps.length > 0 ? lines
      : '<p class="none">Chưa có map nào — bấm Scan để dựng bản đồ đầu tiên.</p>'}</div>
    <div class="panel"><h3>Đáng để mắt</h3>${best === undefined
      ? '<p class="none">Chưa scan nên chưa biết gì.</p>' : watch(best, href)}</div>
  </div>
</section>`;
}

interface Todo {
  weight: number;
  tone: string;
  num: number;
  text: string;
  who: string;
  href: string | null;
  hash: string;
}

// cm:why One ranked list of things to actually go and look at. Six big numbers over the whole
// workspace say a lot and point nowhere: nothing in them tells you which project to open.
function todos(projects: HubProject[], options: HubOptions): Todo[] {
  const out: Todo[] = [];
  for (const project of projects) {
    const href = options.linkTo(project);
    const add = (weight: number, tone: string, num: number, text: string, hash: string) =>
      out.push({ weight, tone, num, text, who: project.id, href, hash });
    const best = bestOf(project);
    const staleMaps = project.maps.filter((m) => m.scannedFrom !== undefined).length;
    if (staleMaps > 0) add(100, 'warn', staleMaps, 'map scan từ gốc cũ — số đo trên repo khác', '');
    if (best === undefined) {
      add(60, '', 0, 'chưa scan lần nào', '');
      continue;
    }
    if (best.open > 0) add(50, 'bad', best.open, 'endpoint không thấy cổng auth nào', '#alerts');
    if (best.hasBe && best.feOnly > 0) add(45, 'bad', best.feOnly, 'FE gọi, API không khai', '#alerts');
    if (!best.hasBe) add(30, '', 0, 'chưa scan BE — chưa đối chiếu được', '');
    if (!best.hasFe) add(30, '', 0, 'chưa scan FE — không biết màn nào gọi', '');
    if (best.hasFe && best.uncalled > 0) add(20, '', best.uncalled, 'API khai mà không màn nào gọi', '#alerts');
    if (best.unresolved > 0) add(10, 'warn', best.unresolved, 'lời gọi không giải được đường dẫn', '#unresolved');
  }
  return out.sort((a, b) => b.weight - a.weight);
}

// cm:why Totals over every project, with unresolved kept OUT of the endpoint count: the two are
// counted separately everywhere else in apiflow, and a hub that adds them up contradicts every
// other page.
function overview(projects: HubProject[], options: HubOptions, live: boolean): string {
  const best = projects.map(bestOf).filter((m): m is HubMap => m !== undefined);
  const sum = (pick: (m: HubMap) => number) => best.reduce((n, m) => n + pick(m), 0);
  const scanned = projects.filter((p) => p.maps.length > 0).length;

  const list = todos(projects, options);
  const LIMIT = 10;
  // cm:guard Says how many it did not print. A list that stops at ten with no word about the rest
  // reads as "that is everything", which is exactly the lie this page must not tell.
  const rows = list.slice(0, LIMIT).map((item) => {
    const inner = `<span class="num">${item.num === 0 ? '—' : item.num.toLocaleString('vi-VN')}</span>`
      + `<span class="txt">${item.text}</span><span class="who2">${escapeHtml(item.who)}</span>`;
    return item.href === null
      ? `<div class="${item.tone}">${inner}</div>`
      : `<a class="${item.tone}" href="${escapeHtml(item.href + item.hash)}">${inner}</a>`;
  }).join('');
  const more = list.length > LIMIT
    ? `<div class="more">… và ${list.length - LIMIT} việc nữa, mở từng project để xem</div>`
    : '';

  return `<section class="detail" data-detail="all">
  <div class="phead">
    <div class="pident">
      <h1>Toàn workspace</h1>
      <span class="kind">${projects.length} project</span>
      ${live ? '<span class="kind live">bản sống</span>' : '<span class="kind">bản tĩnh</span>'}
    </div>
    <div class="pmeta">
      <div class="side-row"><span class="tagk">WS</span><code>${escapeHtml(options.workspace)}</code>
        <span class="dim">${scanned}/${projects.length} đã scan</span></div>
    </div>
  </div>
  <div class="kpistrip">
    ${kpi('endpoint', sum((m) => m.endpoints), 'trên mọi project')}
    ${kpi('màn hình', sum((m) => m.screens), 'trên mọi project')}
    ${kpi('lời gọi', sum((m) => m.calls), 'FE → endpoint')}
    ${kpi('không auth', sum((m) => m.open), 'không thấy cổng chặn', true)}
    ${kpi('FE gọi, API không khai', sum((m) => (m.hasBe ? m.feOnly : 0)), 'chỉ project scan hai phía', true)}
    ${kpi('unresolved', sum((m) => m.unresolved), 'không nằm trong các số trên', true)}
  </div>
  <div class="panel"><h3>Đáng để mắt${list.length === 0 ? '' : ` (${list.length})`}</h3>
    ${list.length === 0
      ? '<p class="none">Không có gì. Mọi project đã scan hai phía và không có alert nào.</p>'
      : `<div class="watch">${rows}${more}</div>`}</div>
</section>`;
}

export function renderHub(projects: HubProject[], options: HubOptions, now: number): string {
  // cm:guard The empty state points at the button when there IS one. Telling someone to go and type
  // a CLI command on a page that can do the thing is how a feature stays undiscovered.
  const empty = options.live
    ? `<div class="empty-box"><h2>Chưa có project nào</h2>
        <p>apiflow đọc một repo FE và một repo BE rồi dựng bản đồ màn ↔ endpoint ↔ field, để trả lời
        “đổi endpoint này thì màn nào vỡ”. Nó chỉ ghi vào workspace ở dưới, không bao giờ viết gì vào
        repo được đọc.</p>
        <button class="btn primary" id="add-open-2">+ Thêm project đầu tiên</button></div>`
    : `<div class="empty-box"><h2>Chưa có project nào</h2>
        <p>Bản tĩnh này được sinh khi workspace <code>${escapeHtml(options.workspace)}</code> còn rỗng.</p>
        <p><code>apiflow project add adminhub --fe=/đường/dẫn/ui --be=/đường/dẫn/api</code></p></div>`;

  const railHead = `<div class="railhead">
      <label class="search">🔎<input id="hb-q" placeholder="tìm tên, id, đường dẫn" autocomplete="off"></label>
      <div class="two">
        <select id="hb-state" title="lọc theo phía đã scan">
          <option value="">tất cả</option>
          <option value="both">cả hai phía</option>
          <option value="fe">chỉ FE</option>
          <option value="be">chỉ BE</option>
          <option value="unscanned">chưa scan</option>
          <option value="stale">map lệch gốc</option>
        </select>
        <select id="hb-sort" title="thứ tự sắp xếp">
          <option value="name">tên A→Z</option>
          <option value="recent">scan gần nhất</option>
          <option value="oldest">scan lâu nhất</option>
          <option value="endpoints">endpoint nhiều nhất</option>
          <option value="unresolved">unresolved nhiều nhất</option>
          <option value="risk">đáng để mắt trước</option>
        </select>
      </div>
      <span class="cnt" id="hb-count"></span>
    </div>
    <div class="railitems">
      <button class="ri allrow" type="button" data-pick="all">
        <span class="l1"><span class="nm">Toàn workspace</span></span>
        <span class="l2"><span class="num">${projects.length} project</span></span>
      </button>
      ${projects.map((p) => railItem(p, now)).join('\n')}
    </div>`;

  // cm:why The same shell as a project page, down to the rail width and the foot: opening a project
  // from here should look like walking into the next room, not into another application.
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>apiflow — ${projects.length} project</title>
<link rel="icon" href="${FAVICON}">
${THEME_BOOT}
<!-- cm:why Marks the document before first paint so CSS can hide the unselected panes. Without it
     the page either flashes every project at once, or hides them in markup and shows nothing at all
     when the script does not run. -->
<script>document.documentElement.classList.add('has-js')</script>
<style>${STYLE}${BRAND_STYLE}${THEME_STYLE}${APP_STYLE}${ADD_STYLE}${HUB_STYLE}</style>
</head>
<body>
<div class="app-shell">
  <div class="rail" id="rail">
    <div class="brandbar"><span class="home"><span class="mark">${MARK}</span><h1 style="font-size:16px">apiflow</h1></span></div>
    ${projects.length === 0 ? '' : railHead}
    <div class="railfoot">
      ${options.live ? '<button class="btn" id="add-open">+ Thêm project</button>' : ''}
      <button class="thbtn" id="theme-btn" type="button" title="đổi nền sáng / tối" style="width:100%">
        <span class="sw2"></span><span id="theme-label">theo hệ điều hành</span>
      </button>
      <p class="foot">${escapeHtml(options.workspace)}</p>
    </div>
  </div>
  <div class="main">
    ${options.live ? '<pre class="scanlog" id="scanlog"></pre>' : ''}
    ${projects.length === 0 ? empty : `${overview(projects, options, options.live)}
    ${projects.map((p) => detail(p, options, now)).join('\n')}
    <section class="detail" data-detail="none">
      <div class="panel"><h3>Không khớp</h3>
        <p class="none">Không project nào khớp ô tìm và bộ lọc đang đặt.</p>
        <div class="btnrow" style="margin-top:10px"><button class="btn" id="hb-reset" type="button">Bỏ lọc</button></div>
      </div>
    </section>`}
    ${projects.length === 0 ? '' : '<p class="note">Mỗi con số là <b>ứng viên, không phải phán quyết</b>. “không auth” nghĩa là không thấy cổng chặn nào trong code. “unresolved” là những lời gọi apiflow thấy nhưng không giải được đường dẫn — chúng <b>không</b> nằm trong các con số còn lại.</p>'}
  </div>
</div>
${options.live ? ADD_DIALOG : ''}
<script type="application/json" id="project">null</script>
${options.live ? `<script>${ADD_SCRIPT}</script>` : ''}
<script>${THEME_SCRIPT}${projects.length === 0 ? '' : HUB_SCRIPT}</script>
</body>
</html>
`;
}
