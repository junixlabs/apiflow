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
  padding:0 0 14px; margin:0 0 16px; border-bottom:1px solid var(--line); }
.hubtop .brandbar { margin:0; }
.hubtop .who { margin:5px 0 0; font-size:12px; color:var(--muted); }
.hubtop .who code { font:11.5px ui-monospace,monospace; }
.hubtop .acts { margin-left:auto; display:flex; gap:8px; align-items:center; }

.shell { display:grid; grid-template-columns:298px minmax(0,1fr); border:1px solid var(--line);
  border-radius:14px; background:var(--surface); box-shadow:var(--shadow); overflow:hidden;
  min-height:420px; }
@media (max-width:1000px) { .shell { grid-template-columns:minmax(0,1fr); } }

.rail { border-right:1px solid var(--line); background:var(--surface-2);
  display:flex; flex-direction:column; min-width:0; }
@media (max-width:1000px) { .rail { border-right:0; border-bottom:1px solid var(--line); } }
.railhead { padding:11px 12px 10px; border-bottom:1px solid var(--line);
  display:flex; flex-direction:column; gap:7px; }
.railhead .search { display:flex; align-items:center; gap:6px; background:var(--surface);
  border:1px solid var(--line); border-radius:8px; padding:5px 9px; }
.railhead .search input { border:0; outline:0; background:transparent; color:var(--ink);
  font:12.5px inherit; width:100%; min-width:0; }
.railhead .two { display:flex; gap:6px; }
.railhead select { flex:1 1 0; min-width:0; border:1px solid var(--line); border-radius:7px;
  background:var(--surface); color:var(--ink-2); font:11.5px inherit; padding:5px 6px; }
.railhead .cnt { font-size:11px; color:var(--muted); }

.railitems { flex:1 1 auto; overflow:auto; padding:6px; display:flex; flex-direction:column; gap:3px; }
@media (max-width:1000px) { .railitems { max-height:250px; } }
.ri { display:block; width:100%; text-align:left; font:inherit; color:var(--ink); cursor:pointer;
  border:1px solid transparent; border-radius:9px; background:transparent; padding:8px 9px; }
.ri:hover { background:var(--surface-3); }
.ri.on { background:var(--surface); border-color:var(--line-2); }
.ri .l1 { display:flex; align-items:center; gap:7px; min-width:0; }
.ri .nm { font-weight:620; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ri .sides { margin-left:auto; flex:none; font:600 9px/1 ui-sans-serif,sans-serif; letter-spacing:.07em;
  color:var(--muted); border:1px solid var(--line-2); border-radius:999px; padding:3px 6px; }
.ri .l2, .ri .l3 { margin-top:6px; display:flex; align-items:center; gap:7px; font-size:11px;
  color:var(--muted); white-space:nowrap; min-width:0; }
.ri .l2 .num { color:var(--ink-2); overflow:hidden; text-overflow:ellipsis; }
.ri .l3 { margin-top:5px; gap:8px; }
.ri .l3 .bad { color:var(--dead); font-weight:620; }
.ri .l3 .warn { color:var(--guess); }
.ri .when { margin-left:auto; flex:none; }
.ri.allrow { border-bottom:1px solid var(--line); border-radius:9px 9px 0 0; margin-bottom:5px;
  padding-bottom:10px; }
.ri.allrow .nm { letter-spacing:-.01em; }

.micro { display:flex; width:54px; height:5px; border-radius:999px; overflow:hidden;
  background:var(--surface-3); flex:none; }
.micro i { display:block; }

.detailwrap { padding:15px 17px 17px; min-width:0; }
.detail { display:flex; flex-direction:column; gap:12px; }
.dhead { display:flex; align-items:flex-start; gap:12px; flex-wrap:wrap; }
.dhead h2 { margin:0; font-size:18px; font-weight:660; letter-spacing:-.015em; }
.dhead .idline { margin:3px 0 0; font:11.5px ui-monospace,monospace; color:var(--muted); }
.dhead .sides { font:600 9.5px/1 ui-sans-serif,sans-serif; letter-spacing:.07em; color:var(--muted);
  border:1px solid var(--line-2); border-radius:999px; padding:4px 8px; }
.dhead .titleline { display:flex; align-items:center; gap:9px; min-width:0; }
.dacts { margin-left:auto; display:flex; gap:7px; align-items:center; flex-wrap:wrap; }
.dacts .btn { padding:5px 10px; font-size:11.5px; }
.dacts .rm { color:var(--muted); }
.dacts .rm:hover { color:var(--dead); border-color:var(--dead); }
.open-btn { font-size:12.5px; font-weight:600; text-decoration:none; color:#fff;
  border:1px solid var(--brand); border-radius:8px; padding:6px 12px; background:var(--brand); }
.open-btn:hover { filter:brightness(1.08); }

.dgrid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:11px;
  align-items:start; }
.dgrid .wide { grid-column:1/-1; }
@media (max-width:1180px) { .dgrid { grid-template-columns:minmax(0,1fr); } }
.dbox { border:1px solid var(--line); border-radius:11px; background:var(--surface-2);
  padding:11px 12px 12px; min-width:0; }
.dbox h3 { margin:0 0 9px; font:600 9.5px/1 ui-sans-serif,sans-serif; letter-spacing:.09em;
  text-transform:uppercase; color:var(--muted); }
.dbox .none { margin:0; }

.rootrow { display:flex; align-items:baseline; gap:7px; font-size:11.5px; min-width:0; margin-top:6px; }
.rootrow:first-of-type { margin-top:0; }
.rootrow .tagk { font:650 9.5px/1 ui-sans-serif,sans-serif; letter-spacing:.09em; color:var(--muted);
  border:1px solid var(--line); border-radius:4px; padding:3px 5px; flex:none; }
.rootrow code { font:11.5px ui-monospace,monospace; color:var(--ink-2); min-width:0;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rootrow .rev { margin-left:auto; flex:none; font:10.5px ui-monospace,monospace; color:var(--brand);
  background:var(--tint-brand); border-radius:4px; padding:1px 6px; }
.rootrow .norev { margin-left:auto; flex:none; font-size:10.5px; color:var(--muted); }

.mapline { display:flex; align-items:baseline; gap:8px; font-size:12px; margin-top:7px; }
.mapline:first-of-type { margin-top:0; }
.mapline .kind { font:600 10px/1 ui-monospace,monospace; border:1px solid var(--line);
  border-radius:5px; padding:4px 6px; color:var(--muted); min-width:50px; text-align:center; flex:none; }
.mapline .when { margin-left:auto; color:var(--muted); font-size:11px; flex:none; }
.mapline.stale .kind { color:var(--guess); border-color:var(--guess); }
.stalenote { margin:5px 0 0; font-size:11px; line-height:1.55; color:var(--guess); }
.stalenote code { font:10.5px ui-monospace,monospace; word-break:break-all; }

.bar3 { display:flex; height:9px; border-radius:999px; overflow:hidden; background:var(--surface-3); }
.bar3 i { display:block; }
.b-both { background:var(--exact); }
.b-uncalled { background:var(--surface-3); box-shadow:inset 0 0 0 1px var(--line-2); }
.b-feonly { background:var(--dead); }
.b-unpaired { background:repeating-linear-gradient(135deg,var(--surface-3) 0 4px,var(--surface) 4px 8px); }
.lgd { display:flex; flex-wrap:wrap; gap:9px 14px; margin:9px 0 0; font-size:11.5px; color:var(--muted); }
.lgd i { width:9px; height:9px; border-radius:3px; display:inline-block; margin-right:5px;
  vertical-align:-1px; }
.lgd b { color:var(--ink); font-weight:620; }

.flags { display:flex; gap:6px; flex-wrap:wrap; }
.flag { font-size:11px; padding:3px 9px; border-radius:999px; border:1px solid var(--line);
  color:var(--muted); text-decoration:none; }
a.flag:hover { border-color:var(--line-2); background:var(--surface); }
.flag.warn { color:var(--guess); } .flag.bad { color:var(--dead); }

.totals { display:grid; grid-template-columns:repeat(auto-fit,minmax(132px,1fr)); gap:10px; }
.totals .t1 { border:1px solid var(--line); border-radius:10px; background:var(--surface-2);
  padding:9px 11px 10px; }
.totals .t1 .lab { font-size:9.5px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); }
.totals .t1 .val { font:650 21px/1.25 ui-sans-serif,sans-serif; letter-spacing:-.02em; margin-top:1px; }
.totals .t1 .sub { font-size:10.5px; color:var(--muted); }
.totals .t1.alarm .val { color:var(--dead); }

.todo { display:flex; flex-direction:column; }
.todo a, .todo div { display:flex; align-items:baseline; gap:9px; padding:7px 2px;
  border-top:1px solid var(--line); color:var(--ink); text-decoration:none; font-size:12.5px; }
.todo a:first-child, .todo div:first-child { border-top:0; }
.todo a:hover { color:var(--brand); }
.todo .who2 { margin-left:auto; flex:none; font:11px ui-monospace,monospace; color:var(--muted); }
.todo .sev { flex:none; width:7px; height:7px; border-radius:999px; background:var(--muted); }
.todo .sev.bad { background:var(--dead); } .todo .sev.warn { background:var(--guess); }
.todo .more { color:var(--muted); font-size:11.5px; }

.none { color:var(--muted); font-size:12.5px; margin:0; }
.empty-box { border:1px dashed var(--line-2); border-radius:14px; background:var(--surface);
  padding:34px 26px; text-align:center; }
.empty-box h2 { margin:0 0 6px; font-size:17px; }
.empty-box p { margin:0 auto 16px; max-width:62ch; color:var(--muted); font-size:13px; line-height:1.65; }
.empty-box code { background:var(--surface-2); padding:2px 6px; border-radius:5px;
  font:12px ui-monospace,monospace; }
.has-js .detail { display:none; }
.has-js .detail.on { display:flex; }
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
  for (const el of items) {
    el.addEventListener('click', () => pick(el.dataset.pick));
  }

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

// cm:guard The rail shows the age of the NEWEST map, not of maps[0]: on a linked project the first
// entry is whichever kind was written first, so reading it would age the row by a whole scan.
const newestAge = (project: HubProject, now: number): string => {
  const newest = newestScan(project);
  return newest === 0 ? 'chưa scan' : relativeAge(new Date(newest).toISOString(), now);
};

const newestScan = (project: HubProject): number => project.maps
  .map((m) => (m.scannedAt === undefined ? 0 : new Date(m.scannedAt).getTime()))
  .reduce((a, b) => Math.max(a, b), 0);

const SEGMENTS = [
  { key: 'both' as const, css: 'b-both', label: 'có màn gọi' },
  { key: 'uncalled' as const, css: 'b-uncalled', label: 'không màn nào gọi' },
  { key: 'feOnly' as const, css: 'b-feonly', label: 'FE gọi mà API không khai' },
  { key: 'unpaired' as const, css: 'b-unpaired', label: 'chưa đối chiếu được' },
];

function bar(map: HubMap, thin = false): string {
  const total = SEGMENTS.reduce((n, s) => n + map[s.key], 0);
  if (total === 0) return '';
  const pct = (n: number) => `${((n / total) * 100).toFixed(2)}%`;
  const title = SEGMENTS.map((s) => `${map[s.key]} ${s.label}`).join(' · ');
  const fills = SEGMENTS.map((s) => `<i class="${s.css}" style="width:${pct(map[s.key])}"></i>`).join('');
  return `<div class="${thin ? 'micro' : 'bar3'}" title="${title}">${fills}</div>`;
}

// cm:why The bar labels itself with its own numbers instead of pointing at a legend somewhere else on
// the page: a colour strip that needs a key three paragraphs up gets read as decoration.
function legend(map: HubMap): string {
  const parts = SEGMENTS.filter((s) => map[s.key] > 0)
    .map((s) => `<span><i class="${s.css}"></i><b>${map[s.key].toLocaleString('vi-VN')}</b> ${s.label}</span>`);
  return parts.length === 0 ? '' : `<div class="lgd">${parts.join('')}</div>`;
}

// cm:guard Says what is MISSING before it says what is wrong: on a one-sided scan the honest label
// is "chưa scan BE", and printing a comparison finding there invents a defect out of a gap.
function flags(map: HubMap, href: string | null): string {
  const out: string[] = [];
  const chip = (text: string, cls: string, hash: string): string =>
    href === null
      ? `<span class="flag ${cls}">${text}</span>`
      : `<a class="flag ${cls}" href="${escapeHtml(href + hash)}">${text}</a>`;
  if (!map.hasBe) out.push('<span class="flag">chưa scan BE — chưa đối chiếu được</span>');
  if (!map.hasFe) out.push('<span class="flag">chưa scan FE — không biết màn nào gọi</span>');
  if (map.open > 0) out.push(chip(`${map.open} không auth`, 'bad', '#alerts'));
  if (map.hasBe && map.feOnly > 0) out.push(chip(`${map.feOnly} FE gọi mà API không khai`, 'bad', '#alerts'));
  if (map.hasFe && map.uncalled > 0) out.push(chip(`${map.uncalled} không màn nào gọi`, '', '#alerts'));
  if (map.unresolved > 0) out.push(chip(`${map.unresolved} unresolved`, 'warn', '#unresolved'));
  return out.length > 0 ? `<div class="flags">${out.join('')}</div>` : '';
}

const revOf = (project: HubProject, kind: 'fe' | 'be'): string => {
  const found = (project.rev ?? []).find((r) => r.kind === kind);
  const label = [found?.branch, found?.sha].filter((x) => x !== undefined).join(' · ');
  return label === ''
    ? '<span class="norev">không đọc được revision</span>'
    : `<span class="rev">${escapeHtml(label)}</span>`;
};

// cm:edge contract -> HUB_SCRIPT above — it filters, sorts and selects on these data-* attributes,
// so a renamed attribute silently turns a filter into a no-op.
function railItem(project: HubProject, now: number): string {
  const best = bestOf(project);
  const counts = best === undefined
    ? '<span class="num">chưa scan</span>'
    : `<span class="num">${best.endpoints.toLocaleString('vi-VN')} ep · ${best.screens.toLocaleString('vi-VN')} màn</span>`;
  const stale = project.maps.some((m) => m.scannedFrom !== undefined);
  const alerts = best === undefined ? 0 : best.open + (best.hasBe ? best.feOnly : 0);
  const badges = [
    alerts > 0 ? `<span class="bad">${alerts.toLocaleString('vi-VN')} alert</span>` : '',
    stale ? '<span class="warn">map lệch gốc</span>' : '',
    best !== undefined && best.unresolved > 0 ? `<span>${best.unresolved.toLocaleString('vi-VN')} unresolved</span>` : '',
  ].filter((x) => x !== '');
  return `<button class="ri" type="button" data-pick="${escapeHtml(project.id)}"
  data-project="${escapeHtml(project.id)}"
  data-hay="${escapeHtml([project.name, project.id, project.fe ?? '', project.be ?? ''].join(' ').toLowerCase())}"
  data-state="${stateOf(project)}"
  data-stale="${project.maps.some((m) => m.scannedFrom !== undefined) ? '1' : '0'}"
  data-scanned="${newestScan(project)}"
  data-endpoints="${best?.endpoints ?? 0}"
  data-unresolved="${best?.unresolved ?? 0}"
  data-open="${best?.open ?? 0}"
  data-feonly="${best !== undefined && best.hasBe ? best.feOnly : 0}">
  <span class="l1"><span class="nm" title="${escapeHtml(project.name)}">${escapeHtml(project.name)}</span>
    <span class="sides">${sidesOf(project)}</span></span>
  <span class="l2">${best ? bar(best, true) : ''}${counts}
    <span class="when">${best === undefined ? '' : escapeHtml(newestAge(project, now))}</span></span>
  ${badges.length === 0 ? '' : `<span class="l3">${badges.join('')}</span>`}
</button>`;
}

function detail(project: HubProject, options: HubOptions, now: number): string {
  const href = options.linkTo(project);
  const best = bestOf(project);
  const roots = (['fe', 'be'] as const)
    .filter((kind) => project[kind] !== undefined)
    .map((kind) => `<div class="rootrow"><span class="tagk">${kind.toUpperCase()}</span>`
      + `<code title="${escapeHtml(project[kind] as string)}">${escapeHtml(project[kind] as string)}</code>`
      + `${revOf(project, kind)}</div>`)
    .join('');

  // cm:guard A map scanned from a directory the project no longer points at is labelled on its own
  // line, not folded into the flags: the numbers next to it describe a different repo, so the reader
  // has to see that before reading them.
  const lines = project.maps
    .map((m) => `<div class="mapline${m.scannedFrom === undefined ? '' : ' stale'}"><span class="kind">${m.kind}</span>`
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

  const coverage = best === undefined
    ? ''
    : `<div class="dbox wide"><h3>phủ endpoint</h3>${bar(best)}${legend(best)}</div>`;
  const found = best === undefined ? '' : flags(best, href);

  return `<section class="detail" data-detail="${escapeHtml(project.id)}">
  <div class="dhead">
    <div>
      <div class="titleline"><h2>${escapeHtml(project.name)}</h2><span class="sides">${sidesOf(project)}</span></div>
      ${project.name === project.id ? '' : `<p class="idline">${escapeHtml(project.id)}</p>`}
    </div>
    <div class="dacts">
      ${href !== null ? `<a class="open-btn" href="${escapeHtml(href)}">Mở bản đồ →</a>` : ''}
      ${actions}
    </div>
  </div>
  ${found === '' ? '' : `<div class="dbox"><h3>đáng để mắt</h3>${found}</div>`}
  <div class="dgrid">
    <div class="dbox"><h3>gốc</h3>${roots}</div>
    <div class="dbox"><h3>bản đồ đã scan</h3>${project.maps.length > 0 ? lines
      : '<p class="none">Chưa có map nào — bấm Scan để dựng bản đồ đầu tiên.</p>'}</div>
    ${coverage}
  </div>
</section>`;
}

interface Todo {
  weight: number;
  sev: string;
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
    const add = (weight: number, sev: string, text: string, hash: string) =>
      out.push({ weight, sev, text, who: project.id, href, hash });
    const best = bestOf(project);
    if (project.maps.some((m) => m.scannedFrom !== undefined)) {
      add(100, 'warn', 'map scan từ gốc cũ — số đo trên repo khác', '');
    }
    if (best === undefined) {
      add(60, '', 'chưa scan lần nào', '');
      continue;
    }
    if (best.open > 0) add(50, 'bad', `${best.open} endpoint không thấy cổng chặn`, '#alerts');
    if (best.hasBe && best.feOnly > 0) add(45, 'bad', `${best.feOnly} FE gọi mà API không khai`, '#alerts');
    if (!best.hasBe) add(30, '', 'chưa scan BE — chưa đối chiếu được', '');
    if (!best.hasFe) add(30, '', 'chưa scan FE — không biết màn nào gọi', '');
    if (best.hasFe && best.uncalled > 0) add(20, '', `${best.uncalled} endpoint không màn nào gọi`, '#alerts');
    if (best.unresolved > 0) add(10, 'warn', `${best.unresolved.toLocaleString('vi-VN')} lời gọi chưa giải được`, '#unresolved');
  }
  return out.sort((a, b) => b.weight - a.weight);
}

// cm:why Totals over every project, with unresolved kept OUT of the endpoint count: the two are
// counted separately everywhere else in apiflow, and a hub that adds them up contradicts every
// other page.
function overview(projects: HubProject[], options: HubOptions): string {
  const best = projects.map(bestOf).filter((m): m is HubMap => m !== undefined);
  const sum = (pick: (m: HubMap) => number) => best.reduce((n, m) => n + pick(m), 0);
  const scanned = projects.filter((p) => p.maps.length > 0).length;
  const t = (lab: string, value: number, sub: string, alarm = false) =>
    `<div class="t1${alarm && value > 0 ? ' alarm' : ''}"><div class="lab">${lab}</div>`
    + `<div class="val">${value.toLocaleString('vi-VN')}</div><div class="sub">${sub}</div></div>`;

  const list = todos(projects, options);
  const LIMIT = 9;
  // cm:guard Says how many it did not print. A list that stops at nine with no word about the rest
  // reads as "that is everything", which is exactly the lie this page must not tell.
  const rows = list.slice(0, LIMIT).map((item) => {
    const inner = `<span class="sev ${item.sev}"></span><span>${item.text}</span>`
      + `<span class="who2">${escapeHtml(item.who)}</span>`;
    return item.href === null
      ? `<div>${inner}</div>`
      : `<a href="${escapeHtml(item.href + item.hash)}">${inner}</a>`;
  }).join('');
  const more = list.length > LIMIT
    ? `<div class="more">… và ${list.length - LIMIT} việc nữa, xem trong từng project</div>`
    : '';

  return `<section class="detail" data-detail="all">
  <div class="dhead">
    <div>
      <div class="titleline"><h2>Toàn workspace</h2></div>
      <p class="idline">${projects.length} project · ${scanned} đã scan</p>
    </div>
  </div>
  <div class="totals">
    ${t('endpoint', sum((m) => m.endpoints), 'trên mọi project')}
    ${t('màn hình', sum((m) => m.screens), 'trên mọi project')}
    ${t('lời gọi', sum((m) => m.calls), 'FE → endpoint')}
    ${t('không auth', sum((m) => m.open), 'không thấy cổng chặn', true)}
    ${t('FE gọi, API không khai', sum((m) => (m.hasBe ? m.feOnly : 0)), 'chỉ tính project đã scan hai phía', true)}
    ${t('unresolved', sum((m) => m.unresolved), 'không nằm trong các số trên', true)}
  </div>
  ${list.length === 0
    ? '<div class="dbox"><h3>đáng để mắt</h3><p class="none">Không có gì. Mọi project đã scan hai phía và không có alert nào.</p></div>'
    : `<div class="dbox"><h3>đáng để mắt (${list.length})</h3><div class="todo">${rows}${more}</div></div>`}
</section>`;
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

  const allRow = `<button class="ri allrow" type="button" data-pick="all">
    <span class="l1"><span class="nm">Toàn workspace</span></span>
    <span class="l2"><span class="num">${projects.length} project</span></span>
  </button>`;

  const shell = `<div class="shell">
  <aside class="rail" id="rail">
    <div class="railhead">
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
      ${allRow}
      ${projects.map((p) => railItem(p, now)).join('\n')}
    </div>
  </aside>
  <div class="detailwrap">
    ${options.live ? '<pre class="scanlog" id="scanlog"></pre>' : ''}
    ${overview(projects, options)}
    ${projects.map((p) => detail(p, options, now)).join('\n')}
    <section class="detail" data-detail="none">
      <div class="dbox"><h3>không khớp</h3>
        <p class="none">Không project nào khớp ô tìm và bộ lọc đang đặt.</p>
        <p class="none" style="margin-top:9px"><button class="btn" id="hb-reset" type="button">Bỏ lọc</button></p>
      </div>
    </section>
  </div>
</div>`;

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
  ${projects.length === 0 ? (options.live ? '<pre class="scanlog" id="scanlog"></pre>' : '') + empty : shell}
  ${projects.length === 0 ? '' : `<p class="note">Mỗi con số là <b>ứng viên, không phải phán quyết</b>. “không auth” nghĩa là không thấy cổng chặn nào trong code. “unresolved” là những lời gọi apiflow thấy nhưng không giải được đường dẫn — chúng <b>không</b> nằm trong các con số còn lại.</p>`}
</div>
${options.live ? ADD_DIALOG : ''}
<script type="application/json" id="project">null</script>
${options.live ? `<script>${ADD_SCRIPT}</script>` : ''}
<script>${THEME_SCRIPT}${projects.length === 0 ? '' : HUB_SCRIPT}</script>
</body>
</html>
`;
}
