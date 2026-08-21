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
  } catch (err) { /* a file:// page must still be able to sort */ }

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
      ? projects.length + (projects.length === 1 ? ' project' : ' projects')
      : shown.length + '/' + projects.length + ' projects · ' + (projects.length - shown.length) + ' filtered out';
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
    try { localStorage.setItem('apiflow-hub-sort', state.sort); } catch (err) { /* if it cannot be stored, let it go */ }
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
  if (iso === undefined) return 'not scanned';
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

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
  return newest === 0 ? 'not scanned' : relativeAge(new Date(newest).toISOString(), now);
};

// cm:edge lockstep -> src/view/app.ts overview() — the same four buckets, the same class names, so the
// bar on a project card and the bar on that project's own page cannot end up telling different stories.
const SEGMENTS = [
  { key: 'both' as const, css: 'd-both', label: 'seen from both sides' },
  { key: 'uncalled' as const, css: 'd-uncalled', label: 'declared, no screen calls it' },
  { key: 'feOnly' as const, css: 'd-feonly', label: 'FE calls it, API does not declare it' },
  { key: 'unpaired' as const, css: 'd-unpaired', label: 'not reconciled yet' },
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
  if (total === 0) return '<p class="none">Nothing reconciled yet — no map.</p>';
  const bars = SEGMENTS
    .map((s) => `<i class="${s.css}" style="width:${((map[s.key] / total) * 100).toFixed(2)}%"></i>`)
    .join('');
  const legend = SEGMENTS
    .map((s) => `<div class="li"><b>${map[s.key].toLocaleString('en-US')}</b>`
      + `<span class="dot ${s.css}"></span> ${s.label}</div>`)
    .join('');
  return `<div class="recon">${bars}</div><div class="legend4">${legend}</div>`;
}

// cm:guard Says what is MISSING before it says what is wrong: on a one-sided scan the honest label
// is "BE not scanned", and printing a comparison finding there invents a defect out of a gap.
// cm:edge lockstep -> src/view/app.ts overview() — same `watch` rows, so a finding looks the same
// here and on the project page it links into.
function watch(map: HubMap, href: string | null): string {
  const rows: string[] = [];
  const row = (n: number, text: string, tone: string, hash: string) => {
    const inner = `<span class="num">${n.toLocaleString('en-US')}</span><span class="txt">${text}</span>`;
    rows.push(href === null
      ? `<div class="${tone}">${inner}</div>`
      : `<a class="${tone}" href="${escapeHtml(href + hash)}">${inner}</a>`);
  };
  if (map.open > 0) row(map.open, 'no auth gate found', 'bad', '#alerts');
  if (map.hasBe && map.feOnly > 0) row(map.feOnly, 'FE calls it, API does not declare it', 'bad', '#alerts');
  if (map.hasFe && map.uncalled > 0) row(map.uncalled, 'declared by the API, called by no screen', '', '#alerts');
  if (map.unresolved > 0) row(map.unresolved, 'calls whose path could not be resolved', 'warn', '#unresolved');
  if (!map.hasBe) rows.push('<div class="none">BE not scanned — nothing to reconcile against.</div>');
  if (!map.hasFe) rows.push('<div class="none">FE not scanned — no idea which screens call it.</div>');
  return rows.length === 0
    ? '<p class="none">Nothing worth a look.</p>'
    : `<div class="watch">${rows.join('')}</div>`;
}

const revOf = (project: HubProject, kind: 'fe' | 'be'): string => {
  const found = (project.rev ?? []).find((r) => r.kind === kind);
  const label = [found?.branch, found?.sha].filter((x) => x !== undefined).join(' · ');
  return label === ''
    ? '<span class="dim">revision unreadable</span>'
    : `<span class="rev">${escapeHtml(label)}</span>`;
};

// cm:edge lockstep -> src/view/panes.ts kpiStrip() — same three lines in the same order, because the
// strip on a project page and the strip here sit one click apart and must not be different heights.
const kpi = (lab: string, value: number, sub: string, alarm = false): string =>
  `<div class="k1${alarm && value > 0 ? ' alarm' : ''}"><div class="lab">${lab}</div>`
  + `<div class="val">${value.toLocaleString('en-US')}</div><div class="dlt">${sub}</div></div>`;

// cm:edge contract -> HUB_SCRIPT above — it filters, sorts and selects on these data-* attributes,
// so a renamed attribute silently turns a filter into a no-op.
function railItem(project: HubProject, now: number): string {
  const best = bestOf(project);
  const stale = project.maps.some((m) => m.scannedFrom !== undefined);
  const alerts = best === undefined ? 0 : best.open + (best.hasBe ? best.feOnly : 0);
  const badges = [
    best === undefined ? '' : `<span>${escapeHtml(newestAge(project, now))}</span>`,
    alerts > 0 ? `<span class="bad">${alerts.toLocaleString('en-US')} alert</span>` : '',
    stale ? '<span class="warn">root drifted</span>' : '',
  ].filter((x) => x !== '');
  const counts = best === undefined
    ? '<span class="num">not scanned</span>'
    : `<span class="num">${best.endpoints.toLocaleString('en-US')} ep · ${best.screens.toLocaleString('en-US')} screens</span>`;
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
      + `<span>${m.endpoints.toLocaleString('en-US')} endpoints · ${m.screens.toLocaleString('en-US')} screens · ${m.calls.toLocaleString('en-US')} calls</span>`
      + `<span class="when">${escapeHtml(relativeAge(m.scannedAt, now))}</span></div>`
      + (m.scannedFrom === undefined ? ''
        : `<p class="stalenote">this map was scanned from <code title="${escapeHtml(m.scannedFrom)}">${escapeHtml(m.scannedFrom)}</code> — not the current root. Re-scan to make it true.</p>`))
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
         data-hints="${escapeHtml(project.hints ?? '')}">Edit roots</button>
       <button class="btn rm" data-rm="${escapeHtml(project.id)}" data-name="${escapeHtml(project.name)}">Drop from workspace</button>`
    : '';

  // cm:guard Every tile says which map it was measured on: a project can hold three, and a number
  // with no map behind it invites the reader to assume it came from the fullest one.
  const from = best === undefined ? '' : `${best.kind} map`;
  const tiles = best === undefined ? '' : `<div class="kpistrip">
    ${kpi('endpoint', best.endpoints, from)}
    ${kpi('screens', best.screens, from)}
    ${kpi('calls', best.calls, from)}
    ${kpi('no auth', best.open, 'no gate found', true)}
    ${kpi('FE-only', best.hasBe ? best.feOnly : 0, best.hasBe ? from : 'BE not scanned', true)}
    ${kpi('unresolved', best.unresolved, 'not part of the numbers above', true)}
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
      ${href !== null ? `<a class="btn primary" href="${escapeHtml(href)}">Open the map →</a>` : ''}
      ${actions}
    </div>
  </div>
  ${tiles}
  <div class="panels">
    <div class="panel"><h3>Reconciliation${best === undefined ? '' : ` — ${best.endpoints.toLocaleString('en-US')} endpoints`}</h3>
      ${best === undefined ? '<p class="none">No map yet — hit Scan to build the first one.</p>' : recon(best)}</div>
    <div class="panel"><h3>Maps scanned</h3>${project.maps.length > 0 ? lines
      : '<p class="none">No map yet — hit Scan to build the first one.</p>'}</div>
    <div class="panel"><h3>Worth a look</h3>${best === undefined
      ? '<p class="none">Not scanned, so nothing is known yet.</p>' : watch(best, href)}</div>
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
    if (staleMaps > 0) add(100, 'warn', staleMaps, 'maps scanned from an older root — measured on a different repo', '');
    if (best === undefined) {
      add(60, '', 0, 'never scanned', '');
      continue;
    }
    if (best.open > 0) add(50, 'bad', best.open, 'endpoints with no auth gate found', '#alerts');
    if (best.hasBe && best.feOnly > 0) add(45, 'bad', best.feOnly, 'FE calls it, API does not declare it', '#alerts');
    if (!best.hasBe) add(30, '', 0, 'BE not scanned — nothing to reconcile', '');
    if (!best.hasFe) add(30, '', 0, 'FE not scanned — no idea which screens call it', '');
    if (best.hasFe && best.uncalled > 0) add(20, '', best.uncalled, 'declared by the API, called by no screen', '#alerts');
    if (best.unresolved > 0) add(10, 'warn', best.unresolved, 'calls whose path could not be resolved', '#unresolved');
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
    const inner = `<span class="num">${item.num === 0 ? '—' : item.num.toLocaleString('en-US')}</span>`
      + `<span class="txt">${item.text}</span><span class="who2">${escapeHtml(item.who)}</span>`;
    return item.href === null
      ? `<div class="${item.tone}">${inner}</div>`
      : `<a class="${item.tone}" href="${escapeHtml(item.href + item.hash)}">${inner}</a>`;
  }).join('');
  const more = list.length > LIMIT
    ? `<div class="more">… and ${list.length - LIMIT} more, open a project to see them</div>`
    : '';

  return `<section class="detail" data-detail="all">
  <div class="phead">
    <div class="pident">
      <h1>Whole workspace</h1>
      <span class="kind">${plural(projects.length, 'project')}</span>
      ${live ? '<span class="kind live">live</span>' : '<span class="kind">static</span>'}
    </div>
    <div class="pmeta">
      <div class="side-row"><span class="tagk">WS</span><code>${escapeHtml(options.workspace)}</code>
        <span class="dim">${scanned}/${projects.length} scanned</span></div>
    </div>
  </div>
  <div class="kpistrip">
    ${kpi('endpoints', sum((m) => m.endpoints), 'across every project')}
    ${kpi('screens', sum((m) => m.screens), 'across every project')}
    ${kpi('calls', sum((m) => m.calls), 'FE → endpoint')}
    ${kpi('no auth', sum((m) => m.open), 'no gate found', true)}
    ${kpi('FE-only', sum((m) => (m.hasBe ? m.feOnly : 0)), 'only projects scanned on both sides', true)}
    ${kpi('unresolved', sum((m) => m.unresolved), 'not part of the numbers above', true)}
  </div>
  <div class="panel"><h3>Worth a look${list.length === 0 ? '' : ` (${list.length})`}</h3>
    ${list.length === 0
      ? '<p class="none">Nothing. Every project is scanned on both sides with no alerts.</p>'
      : `<div class="watch">${rows}${more}</div>`}</div>
</section>`;
}

export function renderHub(projects: HubProject[], options: HubOptions, now: number): string {
  // cm:guard The empty state points at the button when there IS one. Telling someone to go and type
  // a CLI command on a page that can do the thing is how a feature stays undiscovered.
  const empty = options.live
    ? `<div class="empty-box"><h2>No project yet</h2>
        <p>apiflow reads an FE repo and a BE repo and builds a screen ↔ endpoint ↔ field map, so it can
        answer “if I change this endpoint, which screens break”. It only writes to the workspace below —
        never a single byte into the repo it reads.</p>
        <button class="btn primary" id="add-open-2">+ Add the first project</button></div>`
    : `<div class="empty-box"><h2>No project yet</h2>
        <p>This static page was generated while the workspace <code>${escapeHtml(options.workspace)}</code> was still empty.</p>
        <p><code>apiflow project add adminhub --fe=/path/to/ui --be=/path/to/api</code></p></div>`;

  const railHead = `<div class="railhead">
      <label class="search">🔎<input id="hb-q" placeholder="search name, id, path" autocomplete="off"></label>
      <div class="two">
        <select id="hb-state" title="filter by the side scanned">
          <option value="">all</option>
          <option value="both">both sides</option>
          <option value="fe">FE only</option>
          <option value="be">BE only</option>
          <option value="unscanned">not scanned</option>
          <option value="stale">map root drifted</option>
        </select>
        <select id="hb-sort" title="sort order">
          <option value="name">name A→Z</option>
          <option value="recent">scanned most recently</option>
          <option value="oldest">scanned longest ago</option>
          <option value="endpoints">most endpoints</option>
          <option value="unresolved">most unresolved</option>
          <option value="risk">worth a look first</option>
        </select>
      </div>
      <span class="cnt" id="hb-count"></span>
    </div>
    <div class="railitems">
      <button class="ri allrow" type="button" data-pick="all">
        <span class="l1"><span class="nm">Whole workspace</span></span>
        <span class="l2"><span class="num">${plural(projects.length, 'project')}</span></span>
      </button>
      ${projects.map((p) => railItem(p, now)).join('\n')}
    </div>`;

  // cm:why The same shell as a project page, down to the rail width and the foot: opening a project
  // from here should look like walking into the next room, not into another application.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>apiflow — ${plural(projects.length, 'project')}</title>
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
      ${options.live ? '<button class="btn" id="add-open">+ Add project</button>' : ''}
      <button class="thbtn" id="theme-btn" type="button" title="switch light / dark" style="width:100%">
        <span class="sw2"></span><span id="theme-label">follow the OS</span>
      </button>
      <p class="foot">${escapeHtml(options.workspace)}</p>
    </div>
  </div>
  <div class="main">
    ${options.live ? '<pre class="scanlog" id="scanlog"></pre>' : ''}
    ${projects.length === 0 ? empty : `${overview(projects, options, options.live)}
    ${projects.map((p) => detail(p, options, now)).join('\n')}
    <section class="detail" data-detail="none">
      <div class="panel"><h3>No match</h3>
        <p class="none">No project matches the search box and the filters as set.</p>
        <div class="btnrow" style="margin-top:10px"><button class="btn" id="hb-reset" type="button">Clear filters</button></div>
      </div>
    </section>`}
    ${projects.length === 0 ? '' : '<p class="note">Every number here is a <b>candidate, not a verdict</b>. “no auth” means no gate was found in the code. “unresolved” are calls apiflow saw but could not resolve to a path — they are <b>not</b> part of any of the other numbers.</p>'}
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
