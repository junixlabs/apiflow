export const PANES_STYLE = `
.toolrow { display:flex; gap:9px; align-items:center; flex-wrap:wrap; margin:0 0 12px; }
.toolrow .search { display:flex; align-items:center; gap:7px; background:var(--surface);
  border:1px solid var(--line); border-radius:8px; padding:5px 9px; min-width:240px; }
.toolrow .search input { border:0; outline:0; background:transparent; color:var(--ink); font:inherit; width:100%; }
.facet { border:1px solid var(--line); border-radius:8px; background:var(--surface);
  color:var(--muted); font:inherit; font-size:12.5px; padding:5px 8px; }
.grid2 { display:grid; grid-template-columns:1fr 348px; gap:14px; align-items:start; }
@media (max-width:1150px) { .grid2 { grid-template-columns:1fr; } }
/* cm:guard The chain needs FOUR readable columns — squeezing it into the 348px inspector slot broke
   every label into one character per line, which is worse than not drawing it. */
.impgrid { display:grid; grid-template-columns:400px 1fr; gap:14px; align-items:start; }
@media (max-width:1250px) { .impgrid { grid-template-columns:1fr; } }
table.rows { width:100%; border-collapse:collapse; font-size:12.5px; }
table.rows th { text-align:left; font:600 10.5px/1 ui-sans-serif,sans-serif; text-transform:uppercase;
  letter-spacing:.07em; color:var(--muted); padding:0 8px 7px; border-bottom:1px solid var(--line); white-space:nowrap; }
table.rows td { padding:7px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
table.rows tbody tr { cursor:pointer; }
table.rows tbody tr:hover { background:var(--surface-2); }
table.rows tbody tr.on { background:var(--surface-3); }
.tblwrap { border:1px solid var(--line); border-radius:12px; background:var(--surface); padding:12px 12px 4px; overflow-x:auto; }
.mono { font:12px/1.45 ui-monospace,monospace; word-break:break-all; }
.sub2 { color:var(--muted); font:11px/1.4 ui-monospace,monospace; word-break:break-all; }
.micro { display:flex; width:74px; height:7px; border-radius:999px; overflow:hidden; background:var(--surface-3); }
.micro i { display:block; }
.nowrap { white-space:nowrap; }
.insp2 { border:1px solid var(--line); border-radius:12px; background:var(--surface); position:sticky; top:14px; }
.insp2 .htabs { display:flex; gap:2px; border-bottom:1px solid var(--line); padding:8px 10px 0; flex-wrap:wrap; }
.insp2 .htabs span { font-size:12px; padding:6px 9px; border-radius:8px 8px 0 0; cursor:pointer; color:var(--muted); }
.insp2 .htabs span.on { background:var(--surface-3); color:var(--ink); font-weight:600; }
.insp2 .body { padding:12px 14px 16px; max-height:70vh; overflow:auto; }
.insp2 h4 { margin:0 0 3px; font:12.5px/1.4 ui-monospace,monospace; word-break:break-all; }
.kv { display:grid; grid-template-columns:96px 1fr; gap:3px 10px; font-size:12px; margin:9px 0; }
.kv span:first-child { color:var(--muted); }
.chain { display:flex; flex-direction:column; gap:0; margin:8px 0 0; }
.chain .step { display:flex; gap:8px; align-items:baseline; padding:6px 0; border-bottom:1px dashed var(--line); }
.chain .role { font:600 9.5px/1 ui-sans-serif,sans-serif; text-transform:uppercase; letter-spacing:.06em;
  color:var(--muted); border:1px solid var(--line); border-radius:5px; padding:3px 5px; min-width:66px; text-align:center; flex:none; }
.chain .step.loose .role { color:var(--guess); border-color:var(--guess); }
.cols { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; }
@media (max-width:1000px) { .cols { grid-template-columns:1fr; } }
.col h4 { margin:0 0 8px; font:600 10.5px/1 ui-sans-serif,sans-serif; text-transform:uppercase;
  letter-spacing:.07em; color:var(--muted); }
.node { border:1px solid var(--line); border-radius:9px; background:var(--surface-2); padding:7px 9px; margin:0 0 7px; }
.node.loose { border-color:var(--guess); }
.node .nm { font:12px/1.35 ui-monospace,monospace; word-break:break-all; }
.badge { font-size:10px; padding:2px 6px; border-radius:999px; border:1px solid var(--line); color:var(--muted); }
.badge.exact { color:var(--exact); border-color:var(--exact); }
.badge.inferred { color:var(--inferred); border-color:var(--inferred); }
.badge.guess { color:var(--guess); border-color:var(--guess); }
.badge.high { color:var(--dead); border-color:var(--dead); }
.badge.medium { color:var(--guess); border-color:var(--guess); }
.cut { color:var(--guess); font-size:12.5px; margin:9px 0 0; }
.group { border:1px solid var(--line); border-radius:10px; margin:0 0 10px; background:var(--surface); }
.group > .gh { display:flex; gap:9px; align-items:baseline; padding:9px 12px; cursor:pointer; }
.group > .gh b { font-size:13px; }
.group > .gh .n { margin-left:auto; color:var(--muted); font:11.5px ui-monospace,monospace; }
.group > .gb { display:none; padding:0 12px 10px; }
.group.open > .gb { display:block; }
.gb .item { padding:6px 0; border-top:1px solid var(--line); }
.cmp { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:12px; margin:0 0 16px; }
.cmp .box { border:1px solid var(--line); border-radius:11px; background:var(--surface); padding:12px 14px; }
.cmp .box .k { font-size:10.5px; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); }
.cmp .arrow { display:flex; align-items:baseline; gap:9px; font:650 21px/1.2 ui-sans-serif,sans-serif; margin:4px 0 0; }
.cmp .arrow small { font:400 12px ui-sans-serif,sans-serif; color:var(--muted); }
.headline { font:650 15px/1.4 ui-sans-serif,sans-serif; margin:0 0 12px; }
.headline.bad { color:var(--dead); } .headline.good { color:var(--exact); }
.pp { font:600 12px ui-monospace,monospace; }
.pp.up { color:var(--exact); } .pp.down { color:var(--dead); }
.empty2 { color:var(--muted); font-size:12.5px; padding:14px 4px; }
`;

export const PANES_HTML = `
<section class="pane" id="pane-endpoints" hidden>
  <div class="toolrow">
    <label class="search">🔎<input id="q" placeholder="tìm theo method, path hoặc controller" autocomplete="off"></label>
    <select class="facet" id="f-method"></select>
    <select class="facet" id="f-auth"></select>
    <select class="facet" id="f-recon"></select>
    <select class="facet" id="f-conf"></select>
    <span class="stat" id="ep-count"></span>
  </div>
  <div class="grid2">
    <div class="tblwrap">
      <table class="rows">
        <thead><tr>
          <th>method</th><th>path</th><th>controller</th><th>auth</th>
          <th>trạng thái</th><th class="nowrap">#gọi</th><th>độ tin cậy</th>
        </tr></thead>
        <tbody id="ep-rows"></tbody>
      </table>
      <p class="cut" id="ep-cut"></p>
    </div>
    <div class="insp2">
      <div class="htabs" id="insp-tabs"></div>
      <div class="body" id="insp-body"></div>
    </div>
  </div>
</section>

<section class="pane" id="pane-impact" hidden>
  <div class="toolrow">
    <label class="search">🔎<input id="imp-q" placeholder="chọn endpoint: gõ method hoặc path" autocomplete="off"></label>
    <select class="facet" id="imp-pick"></select>
  </div>
  <div id="imp-body"></div>
</section>

<section class="pane" id="pane-screens" hidden>
  <div class="toolrow">
    <label class="search">🔎<input id="sc-q" placeholder="tìm màn theo route" autocomplete="off"></label>
    <span class="stat" id="sc-count"></span>
  </div>
  <div class="grid2">
    <div class="tblwrap">
      <table class="rows">
        <thead><tr><th>màn</th><th class="nowrap">#endpoint</th><th>độ tin cậy</th></tr></thead>
        <tbody id="sc-rows"></tbody>
      </table>
      <p class="cut" id="sc-cut"></p>
    </div>
    <div class="insp2"><div class="body" id="sc-insp"></div></div>
  </div>
</section>

<section class="pane" id="pane-unresolved" hidden>
  <p class="hintbox">Đây là những lời gọi apiflow <b>thấy nhưng không giải được đường dẫn</b>.
  Chúng không nằm trong bất kỳ con số endpoint nào — chúng là mẫu số của độ tin cậy.</p>
  <div class="toolrow"><label class="search">🔎<input id="un-q" placeholder="tìm theo file hoặc lý do" autocomplete="off"></label>
  <span class="stat" id="un-count"></span></div>
  <div id="un-body"></div>
</section>

<section class="pane" id="pane-alerts" hidden>
  <p class="hintbox"><b>Alert</b> là thứ apiflow hiểu được và thấy nguy hiểm — khác với Unresolved,
  là thứ nó không hiểu nổi. Mức nghiêm trọng xếp theo độ tin cậy của lời gọi: một mismatch ở mức
  <i>guess</i> có thể là hệ quả của phép suy đường dẫn của chính tool.</p>
  <div class="toolrow">
    <select class="facet" id="al-kind"></select>
    <select class="facet" id="al-sev"></select>
    <span class="stat" id="al-count"></span>
  </div>
  <div id="al-body"></div>
</section>

<section class="pane" id="pane-compare" hidden><div id="cmp-body"></div></section>
`;

// cm:guard No template literals and no backticks below — this block is embedded inside a String.raw
// literal, so one backtick closes it early and the page ships a syntax error.
export const PANES_SCRIPT = String.raw`
const MAP = JSON.parse(document.getElementById('apimap').textContent);
const ALERTS = JSON.parse(document.getElementById('alerts').textContent);
const RELIABILITY = new Map(JSON.parse(document.getElementById('reliability').textContent)
  .map((r) => [r[0], { exact: r[1], inferred: r[2], guess: r[3] }]));
const DIFF = JSON.parse(document.getElementById('diff').textContent);

const ROW_CAP = 400;
const SCREEN_CAP = 20;

const byId = (list) => new Map(list.map((x) => [x.id, x]));
const endpoints = byId(MAP.endpoints);
const screens = byId(MAP.screens);

const HAS_BE = MAP.endpoints.some((e) => e.source !== undefined);
const HAS_FE = MAP.calls.length > 0;

const callsByEndpoint = new Map();
const callsByScreen = new Map();
for (const c of MAP.calls) {
  if (!callsByEndpoint.has(c.endpointId)) callsByEndpoint.set(c.endpointId, []);
  callsByEndpoint.get(c.endpointId).push(c);
  if (!callsByScreen.has(c.screenId)) callsByScreen.set(c.screenId, []);
  callsByScreen.get(c.screenId).push(c);
}
const fieldsByEndpoint = new Map();
for (const f of MAP.fields) {
  if (!fieldsByEndpoint.has(f.endpointId)) fieldsByEndpoint.set(f.endpointId, []);
  fieldsByEndpoint.get(f.endpointId).push(f);
}
const alertsByEndpoint = new Map();
for (const a of ALERTS) {
  if (!alertsByEndpoint.has(a.endpointId)) alertsByEndpoint.set(a.endpointId, []);
  alertsByEndpoint.get(a.endpointId).push(a);
}

// cm:edge contract -> src/workspace/summary.ts — same four states as endpointState there. A one-sided
// scan makes every endpoint look feOnly; painting that red invents a defect out of a missing half.
function reconOf(e) {
  if (e.source === undefined) return HAS_BE ? 'feonly' : 'unpaired';
  if ((callsByEndpoint.get(e.id) || []).length > 0) return 'both';
  return HAS_FE ? 'uncalled' : 'unpaired';
}
const RECON_LABEL = {
  both: 'khớp hai phía',
  uncalled: 'không màn nào gọi',
  feonly: 'API không khai',
  unpaired: 'chưa đối chiếu',
};
const RECON_CLS = { both: 'd-both', uncalled: 'd-uncalled', feonly: 'd-feonly', unpaired: 'd-unpaired' };

const state = {
  section: 'overview', q: '', method: '', auth: '', recon: '', conf: '',
  endpoint: null, insp: 'overview', screen: null, impQ: '',
  alertKind: '', alertSev: '', unQ: '', scQ: '',
};

const el = (id) => document.getElementById(id);
function h(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
const bestConf = (calls) => {
  const rank = { exact: 0, inferred: 1, guess: 2 };
  return calls.reduce((acc, c) => (rank[c.confidence] < rank[acc] ? c.confidence : acc), calls.length ? 'guess' : undefined);
};

function microBar(id) {
  const r = RELIABILITY.get(id);
  const wrap = h('div', 'micro');
  if (!r) { wrap.title = 'chưa có lời gọi nào truy được'; return wrap; }
  const total = r.exact + r.inferred + r.guess;
  for (const k of ['exact', 'inferred', 'guess']) {
    if (!r[k]) continue;
    const seg = h('i', 'c-bg-' + k);
    seg.style.width = ((r[k] / total) * 100).toFixed(2) + '%';
    wrap.appendChild(seg);
  }
  // cm:why Title carries the COUNT, not just the split: one call at exact is not stronger evidence
  // than twenty calls at 90% exact, and a bare percentage hides exactly that.
  wrap.title = total + ' lời gọi · exact ' + r.exact + ' · inferred ' + r.inferred + ' · guess ' + r.guess;
  return wrap;
}

function fillFacet(id, label, options, value, onchange) {
  const sel = el(id);
  if (!sel) return;
  sel.textContent = '';
  const all = document.createElement('option');
  all.value = '';
  all.textContent = label;
  sel.appendChild(all);
  for (const [v, text] of options) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = text;
    sel.appendChild(o);
  }
  sel.value = value;
  sel.onchange = () => onchange(sel.value);
}

function visibleEndpoints() {
  const q = state.q.toLowerCase();
  return MAP.endpoints.filter((e) => {
    if (q && !(e.method + ' ' + e.path + ' ' + (e.handler || '')).toLowerCase().includes(q)) return false;
    if (state.method && e.method !== state.method) return false;
    if (state.auth === 'yes' && e.auth !== true) return false;
    if (state.auth === 'no' && e.auth !== false) return false;
    if (state.auth === 'murky' && e.auth !== undefined) return false;
    if (state.recon && reconOf(e) !== state.recon) return false;
    if (state.conf) {
      const b = bestConf(callsByEndpoint.get(e.id) || []);
      if (b !== state.conf) return false;
    }
    return true;
  });
}

function renderEndpoints() {
  const all = MAP.endpoints;
  const count = (fn) => all.filter(fn).length;
  const methods = [...new Set(all.map((e) => e.method))].sort()
    .map((m) => [m, m + ' (' + count((e) => e.method === m) + ')']);
  fillFacet('f-method', 'method — tất cả (' + all.length + ')', methods, state.method, (v) => { state.method = v; render(); });
  fillFacet('f-auth', 'auth — tất cả', [
    ['yes', 'có auth (' + count((e) => e.auth === true) + ')'],
    ['no', 'không auth (' + count((e) => e.auth === false) + ')'],
    ['murky', 'không rõ (' + count((e) => e.auth === undefined) + ')'],
  ], state.auth, (v) => { state.auth = v; render(); });
  fillFacet('f-recon', 'đối chiếu — tất cả', Object.keys(RECON_LABEL)
    .map((k) => [k, RECON_LABEL[k] + ' (' + count((e) => reconOf(e) === k) + ')']),
    state.recon, (v) => { state.recon = v; render(); });
  fillFacet('f-conf', 'độ tin cậy — tất cả', ['exact', 'inferred', 'guess']
    .map((k) => [k, k + ' (' + count((e) => bestConf(callsByEndpoint.get(e.id) || []) === k) + ')']),
    state.conf, (v) => { state.conf = v; render(); });

  const rows = visibleEndpoints();
  el('ep-count').textContent = rows.length + '/' + all.length + ' endpoint';
  const body = el('ep-rows');
  body.textContent = '';
  for (const e of rows.slice(0, ROW_CAP)) {
    const tr = document.createElement('tr');
    if (state.endpoint === e.id) tr.className = 'on';
    const verb = h('td');
    verb.appendChild(h('span', 'verb ' + e.method, e.method));
    tr.appendChild(verb);
    const path = h('td');
    path.appendChild(h('div', 'mono', e.path));
    tr.appendChild(path);
    const ctl = h('td');
    if (e.handler) ctl.appendChild(h('div', 'mono', e.handler));
    if (e.source) ctl.appendChild(h('div', 'sub2', e.source.file + ':' + e.source.line));
    if (!e.handler && !e.source) ctl.appendChild(h('div', 'sub2', '—'));
    tr.appendChild(ctl);
    tr.appendChild(h('td', 'nowrap', e.auth === true ? 'có' : e.auth === false ? 'KHÔNG' : '?'));
    const st = h('td', 'nowrap');
    st.appendChild(h('span', 'dot ' + RECON_CLS[reconOf(e)]));
    st.appendChild(document.createTextNode(' ' + RECON_LABEL[reconOf(e)]));
    tr.appendChild(st);
    tr.appendChild(h('td', 'nowrap', String((callsByEndpoint.get(e.id) || []).length)));
    const rel = h('td');
    rel.appendChild(microBar(e.id));
    tr.appendChild(rel);
    tr.onclick = () => { state.endpoint = e.id; render(); };
    body.appendChild(tr);
  }
  el('ep-cut').textContent = rows.length > ROW_CAP
    ? 'Còn ' + (rows.length - ROW_CAP) + ' endpoint nữa không hiện ở đây — lọc hẹp lại để thấy chúng.'
    : '';
  renderInspector();
}

const INSP_TABS = [['overview', 'Tổng quan'], ['calls', 'Lời gọi'], ['fields', 'Field'], ['chain', 'Chuỗi'], ['alerts', 'Alert']];

function renderInspector() {
  const tabs = el('insp-tabs');
  const body = el('insp-body');
  tabs.textContent = '';
  body.textContent = '';
  const e = state.endpoint ? endpoints.get(state.endpoint) : null;
  if (!e) {
    body.appendChild(h('p', 'empty2', 'Bấm một dòng để xem chi tiết.'));
    return;
  }
  for (const [id, label] of INSP_TABS) {
    const t = h('span', state.insp === id ? 'on' : '', label);
    t.onclick = () => { state.insp = id; renderInspector(); };
    tabs.appendChild(t);
  }
  const calls = callsByEndpoint.get(e.id) || [];
  body.appendChild(h('h4', null, e.method + ' ' + e.path));

  if (state.insp === 'overview') {
    const kv = h('div', 'kv');
    const add = (k, v) => { kv.appendChild(h('span', null, k)); kv.appendChild(h('span', 'mono', v)); };
    add('đối chiếu', RECON_LABEL[reconOf(e)]);
    add('auth', e.auth === true ? 'có cổng' : e.auth === false ? 'KHÔNG thấy cổng nào' : 'có cổng nhưng không phân loại được');
    add('handler', e.handler || '—');
    add('khai ở', e.source ? e.source.file + ':' + e.source.line : 'không thấy trong BE');
    add('số lời gọi', String(calls.length));
    add('độ tin cậy', calls.length ? bestConf(calls) + ' (tốt nhất)' : '—');
    body.appendChild(kv);
    const r = RELIABILITY.get(e.id);
    if (r) {
      body.appendChild(h('p', 'sub2', 'phân bố bằng chứng: exact ' + r.exact + ' · inferred ' + r.inferred + ' · guess ' + r.guess));
      body.appendChild(microBar(e.id));
    }
    const mine = alertsByEndpoint.get(e.id) || [];
    for (const a of mine) {
      const p = h('p', 'sub2');
      p.appendChild(h('span', 'badge ' + a.severity, a.kind));
      p.appendChild(document.createTextNode(' ' + a.detail));
      body.appendChild(p);
    }
    return;
  }

  if (state.insp === 'calls') {
    if (!calls.length) {
      body.appendChild(h('p', 'empty2', 'Không lời gọi nào truy được. Đó không phải bằng chứng là không ai gọi — xem Unresolved.'));
      return;
    }
    for (const c of calls) {
      const row = h('div', 'gb');
      const line = h('div');
      line.appendChild(h('span', 'badge ' + c.confidence, c.confidence));
      const s = screens.get(c.screenId);
      line.appendChild(document.createTextNode(' ' + (s && s.route ? s.route : (s ? s.label + ' (chưa gắn route)' : '?'))));
      row.appendChild(line);
      row.appendChild(h('div', 'sub2', c.source.file + ':' + c.source.line + ' · qua ' + c.via));
      body.appendChild(row);
    }
    return;
  }

  if (state.insp === 'fields') {
    const fs = fieldsByEndpoint.get(e.id) || [];
    if (!fs.length) {
      body.appendChild(h('p', 'empty2', 'Chưa thấy field nào. Code có thể dùng type TS thay vì đọc field tại call site, hoặc chưa chạy apiflow probe.'));
      return;
    }
    for (const f of fs) {
      const row = h('div', 'gb');
      row.appendChild(h('div', 'mono', f.path + (f.type ? ' : ' + f.type : '')));
      const tag = [];
      if (f.declared) tag.push('code khai');
      if (f.observed) tag.push('probe thấy thật');
      row.appendChild(h('div', 'sub2', f.kind + (tag.length ? ' · ' + tag.join(' · ') : ' · chưa rõ')));
      body.appendChild(row);
    }
    return;
  }

  if (state.insp === 'chain') {
    const withChain = calls.filter((c) => c.chain && c.chain.length);
    if (!withChain.length) {
      body.appendChild(h('p', 'empty2', 'Không lời gọi nào có chuỗi truy được về màn.'));
      return;
    }
    for (const c of withChain.slice(0, 8)) {
      const s = screens.get(c.screenId);
      body.appendChild(h('p', 'sub2', (s && s.route ? s.route : '?') + ' — ' + c.confidence));
      const box = h('div', 'chain');
      for (const step of c.chain) {
        const st = h('div', 'step' + (step.precise ? '' : ' loose'));
        st.appendChild(h('span', 'role', step.role));
        const t = h('div');
        t.appendChild(h('div', 'mono', step.symbol));
        t.appendChild(h('div', 'sub2', step.file + ':' + step.line));
        st.appendChild(t);
        box.appendChild(st);
      }
      body.appendChild(box);
    }
    if (withChain.length > 8) body.appendChild(h('p', 'cut', 'Còn ' + (withChain.length - 8) + ' chuỗi nữa — mở tab Ảnh hưởng để xem hết.'));
    return;
  }

  const mine = alertsByEndpoint.get(e.id) || [];
  if (!mine.length) { body.appendChild(h('p', 'empty2', 'Không alert nào cho endpoint này.')); return; }
  for (const a of mine) {
    const row = h('div', 'gb');
    const t = h('div');
    t.appendChild(h('span', 'badge ' + a.severity, a.severity));
    t.appendChild(document.createTextNode(' ' + a.kind));
    row.appendChild(t);
    row.appendChild(h('div', 'sub2', a.detail));
    if (a.screens.length) row.appendChild(h('div', 'sub2', 'màn: ' + a.screens.join(' · ')));
    body.appendChild(row);
  }
}
`;

export const PANES_SCRIPT_2 = String.raw`
const ROLE_COLS = [['client', 'api client'], ['hook', 'hook / util'], ['component', 'component'], ['screen', 'màn']];

function renderImpact() {
  const pick = el('imp-pick');
  const q = state.impQ.toLowerCase();
  // cm:guard The selected endpoint is always in the list: capping the options silently at 300 left
  // the <select> showing an empty label while the page below it displayed that very endpoint.
  const matched = MAP.endpoints
    .filter((e) => !q || (e.method + ' ' + e.path).toLowerCase().includes(q))
    .sort((a, b) => (callsByEndpoint.get(b.id) || []).length - (callsByEndpoint.get(a.id) || []).length
      || a.path.localeCompare(b.path));
  const options = matched.slice(0, 300);
  if (state.endpoint && !options.some((e) => e.id === state.endpoint)) {
    const current = endpoints.get(state.endpoint);
    if (current) options.unshift(current);
  }
  pick.textContent = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = matched.length > options.length
    ? '— chọn endpoint (' + options.length + '/' + matched.length + ', gõ để lọc hẹp) —'
    : '— chọn endpoint (' + matched.length + ') —';
  pick.appendChild(none);
  for (const e of options) {
    const o = document.createElement('option');
    o.value = e.id;
    o.textContent = e.method + ' ' + e.path + '  (' + (callsByEndpoint.get(e.id) || []).length + ' gọi)';
    pick.appendChild(o);
  }
  pick.value = state.endpoint || '';
  pick.onchange = () => { state.endpoint = pick.value || null; renderImpact(); };

  const box = el('imp-body');
  box.textContent = '';
  const e = state.endpoint ? endpoints.get(state.endpoint) : null;
  if (!e) { box.appendChild(h('p', 'empty2', 'Chọn một endpoint để xem vòng ảnh hưởng.')); return; }

  const calls = callsByEndpoint.get(e.id) || [];
  const head = h('div', 'panel');
  const title = h('h4');
  title.appendChild(h('span', 'verb ' + e.method, e.method));
  title.appendChild(document.createTextNode(' ' + e.path));
  head.appendChild(title);
  const r = RELIABILITY.get(e.id) || { exact: 0, inferred: 0, guess: 0 };
  const tot = r.exact + r.inferred + r.guess;
  head.appendChild(h('p', 'sub2', RECON_LABEL[reconOf(e)] + ' · ' + calls.length + ' lời gọi · '
    + (tot ? 'exact ' + r.exact + ' · inferred ' + r.inferred + ' · guess ' + r.guess : 'chưa có lời gọi nào truy được')));
  box.appendChild(head);

  // cm:guard States what is UNKNOWN before what is found: on a guess-heavy endpoint the list below is
  // a set of candidates, and a reader who missed that reads it as a list of screens that will break.
  const warn = [];
  if (e.source === undefined && HAS_BE) warn.push('API không khai endpoint này — vòng ảnh hưởng dưới đây chỉ dựa trên phía FE.');
  if (tot > 0 && r.guess / tot > 0.5) warn.push(Math.round((r.guess / tot) * 100) + '% lời gọi ở mức guess — chuỗi đi qua re-export, không chắc đúng màn.');
  if (warn.length) box.appendChild(h('p', 'hintbox', warn.join(' ')));

  if (!calls.length) {
    box.appendChild(h('p', 'empty2', 'Không lời gọi nào truy được tới endpoint này. Đó không phải bằng chứng là không ai gọi — xem Unresolved.'));
    return;
  }

  const rank = { exact: 0, inferred: 1, guess: 2 };
  const perScreen = new Map();
  for (const c of calls) {
    const s = screens.get(c.screenId);
    const label = s ? (s.route || s.label + ' (chưa gắn route)') : '?';
    const cur = perScreen.get(label);
    if (!cur || rank[c.confidence] < rank[cur.confidence]) perScreen.set(label, { call: c, confidence: c.confidence, screen: s });
  }
  const ordered = [...perScreen.entries()]
    .sort((a, b) => rank[a[1].confidence] - rank[b[1].confidence] || a[0].localeCompare(b[0]));

  const wrap = h('div', 'impgrid');
  const left = h('div', 'tblwrap');
  left.appendChild(h('h3', null, 'Màn bị ảnh hưởng — ' + ordered.length));
  const tbl = document.createElement('table');
  tbl.className = 'rows';
  const tb = document.createElement('tbody');
  // cm:why Cut, labelled, never silent: the honest move on a 54-screen fan-out is to rank by how
  // well each is known and say how many were left out — refusing to draw loses the count itself.
  for (const [label, info] of ordered.slice(0, SCREEN_CAP)) {
    const tr = document.createElement('tr');
    const c1 = h('td');
    c1.appendChild(h('div', 'mono', label));
    c1.appendChild(h('div', 'sub2', info.call.source.file + ':' + info.call.source.line));
    tr.appendChild(c1);
    const c2 = h('td', 'nowrap');
    c2.appendChild(h('span', 'badge ' + info.confidence, info.confidence));
    tr.appendChild(c2);
    tr.onclick = () => { state.screen = info.call.screenId; state.section = 'screens'; render(); };
    tb.appendChild(tr);
  }
  tbl.appendChild(tb);
  left.appendChild(tbl);
  if (ordered.length > SCREEN_CAP) {
    left.appendChild(h('p', 'cut', 'Hiện ' + SCREEN_CAP + ' màn được biết rõ nhất. Còn ' + (ordered.length - SCREEN_CAP)
      + ' màn nữa — ' + SCREEN_CAP + ' KHÔNG phải toàn bộ.'));
  }
  wrap.appendChild(left);

  const right = h('div', 'panel');
  right.appendChild(h('h3', null, 'Chuỗi phụ thuộc'));
  const chains = calls.filter((c) => c.chain && c.chain.length);
  if (!chains.length) {
    // cm:why Drops the abstraction instead of refusing: naming no screen still leaves the count of
    // downstream references, and that count is the honest answer when the chain is too wide to name.
    right.appendChild(h('p', 'empty2', 'Không chuỗi nào truy được về màn. Có ' + calls.length
      + ' lời gọi tới endpoint này ở mức module — mở tab Endpoints để xem vị trí.'));
  } else {
    const cols = h('div', 'cols');
    for (const [role, label] of ROLE_COLS) {
      const col = h('div', 'col');
      const seen = new Map();
      for (const c of chains) {
        for (const step of c.chain) {
          if (step.role !== role) continue;
          const k = step.file + '|' + step.symbol;
          if (!seen.has(k) || (!seen.get(k).precise && step.precise)) seen.set(k, step);
        }
      }
      col.appendChild(h('h4', null, label + ' (' + seen.size + ')'));
      for (const step of [...seen.values()].slice(0, 14)) {
        const n = h('div', 'node' + (step.precise ? '' : ' loose'));
        n.appendChild(h('div', 'nm', step.symbol));
        n.appendChild(h('div', 'sub2', step.file + ':' + step.line));
        col.appendChild(n);
      }
      if (seen.size > 14) col.appendChild(h('p', 'cut', '+' + (seen.size - 14) + ' nữa'));
      if (seen.size === 0) col.appendChild(h('p', 'sub2', '—'));
      cols.appendChild(col);
    }
    right.appendChild(cols);
    right.appendChild(h('p', 'sub2', 'Viền cam = bước mà chuỗi đã mất độ chắc (đi qua re-export hoặc default export không tên).'));
  }
  wrap.appendChild(right);
  box.appendChild(wrap);
}

function renderScreens() {
  const q = state.scQ.toLowerCase();
  const rows = MAP.screens
    .filter((s) => !q || (s.route || s.label || '').toLowerCase().includes(q))
    .map((s) => ({ s, calls: callsByScreen.get(s.id) || [] }))
    .sort((a, b) => b.calls.length - a.calls.length || (a.s.route || a.s.label).localeCompare(b.s.route || b.s.label));
  el('sc-count').textContent = rows.length + '/' + MAP.screens.length + ' màn';
  const body = el('sc-rows');
  body.textContent = '';
  for (const row of rows.slice(0, ROW_CAP)) {
    const tr = document.createElement('tr');
    if (state.screen === row.s.id) tr.className = 'on';
    const c1 = h('td');
    c1.appendChild(h('div', 'mono', row.s.route || row.s.label + ' (chưa gắn route)'));
    c1.appendChild(h('div', 'sub2', row.s.source.file + ':' + row.s.source.line));
    tr.appendChild(c1);
    tr.appendChild(h('td', 'nowrap', String(new Set(row.calls.map((c) => c.endpointId)).size)));
    const c3 = h('td');
    const b = bestConf(row.calls);
    if (b) c3.appendChild(h('span', 'badge ' + b, b));
    tr.appendChild(c3);
    tr.onclick = () => { state.screen = row.s.id; renderScreens(); };
    body.appendChild(tr);
  }
  el('sc-cut').textContent = rows.length > ROW_CAP ? 'Còn ' + (rows.length - ROW_CAP) + ' màn nữa.' : '';

  const insp = el('sc-insp');
  insp.textContent = '';
  const s = state.screen ? screens.get(state.screen) : null;
  if (!s) { insp.appendChild(h('p', 'empty2', 'Bấm một màn để xem nó phụ thuộc endpoint nào.')); return; }
  insp.appendChild(h('h4', null, s.route || s.label));
  insp.appendChild(h('p', 'sub2', s.source.file + ':' + s.source.line + (s.viaHops ? ' · ' + s.viaHops + ' hop' : '')));
  const deps = new Map();
  for (const c of callsByScreen.get(s.id) || []) {
    const e = endpoints.get(c.endpointId);
    if (!e) continue;
    const cur = deps.get(e.id);
    const rank = { exact: 0, inferred: 1, guess: 2 };
    if (!cur || rank[c.confidence] < rank[cur.confidence]) deps.set(e.id, { e, confidence: c.confidence, call: c });
  }
  if (!deps.size) { insp.appendChild(h('p', 'empty2', 'Không endpoint nào truy được từ màn này.')); return; }
  insp.appendChild(h('p', 'sub2', 'phụ thuộc ' + deps.size + ' endpoint'));
  for (const d of [...deps.values()].sort((a, b) => a.e.path.localeCompare(b.e.path))) {
    const row = h('div', 'gb');
    const t = h('div');
    t.appendChild(h('span', 'verb ' + d.e.method, d.e.method));
    t.appendChild(document.createTextNode(' '));
    t.appendChild(h('span', 'mono', d.e.path));
    row.appendChild(t);
    const meta = h('div', 'sub2');
    meta.appendChild(h('span', 'badge ' + d.confidence, d.confidence));
    meta.appendChild(document.createTextNode(' ' + d.call.source.file + ':' + d.call.source.line));
    row.appendChild(meta);
    row.onclick = () => { state.endpoint = d.e.id; state.section = 'impact'; render(); };
    row.style.cursor = 'pointer';
    insp.appendChild(row);
  }
}
`;

export const PANES_SCRIPT_3 = String.raw`
// cm:why Grouped by REASON, not listed flat: 9 311 unresolved calls as one list is unreadable, while
// "url là biến: 4 812" tells you which single fix would move the coverage number most.
function reasonKey(reason) {
  if (/no request or response schema/.test(reason)) return 'không thấy schema request/response trong code';
  if (/entirely interpolated/.test(reason)) return 'url toàn bộ là nội suy';
  if (/variable or expression/.test(reason)) return 'url là biến hoặc biểu thức';
  if (/too wide to name/.test(reason)) return 'fan-out quá rộng để nêu tên màn';
  if (/wrapper/.test(reason)) return 'đi qua wrapper không truy được';
  // cm:guard Strips the endpoint out of the reason before grouping: a BE reason embeds the route it
  // is about, so keeping it made 880 groups of one — a list wearing the costume of a summary.
  return reason.replace(/^[A-Z]+ \S+ — /, '').split(':')[0].slice(0, 60);
}

function renderUnresolved() {
  const q = state.unQ.toLowerCase();
  const rows = MAP.unresolved.filter((u) =>
    !q || (u.source.file + ' ' + u.reason + ' ' + (u.snippet || '')).toLowerCase().includes(q));
  el('un-count').textContent = rows.length + '/' + MAP.unresolved.length + ' mục';
  const groups = new Map();
  for (const u of rows) {
    const k = reasonKey(u.reason);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(u);
  }
  const box = el('un-body');
  box.textContent = '';
  if (!groups.size) { box.appendChild(h('p', 'empty2', 'Không mục nào.')); return; }
  for (const [name, items] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    const g = h('div', 'group');
    const head = h('div', 'gh');
    head.appendChild(h('b', null, name));
    head.appendChild(h('span', 'n', String(items.length)));
    const bodyEl = h('div', 'gb');
    for (const u of items.slice(0, 60)) {
      const item = h('div', 'item');
      item.appendChild(h('div', 'sub2', u.source.file + ':' + u.source.line));
      if (u.snippet) item.appendChild(h('div', 'mono', u.snippet));
      bodyEl.appendChild(item);
    }
    if (items.length > 60) bodyEl.appendChild(h('p', 'cut', 'Còn ' + (items.length - 60) + ' mục nữa trong nhóm này.'));
    head.onclick = () => g.classList.toggle('open');
    g.appendChild(head);
    g.appendChild(bodyEl);
    box.appendChild(g);
  }
}

const KIND_LABEL = {
  'method-mismatch': 'FE gọi sai method',
  'fe-only-path': 'FE gọi path API không khai',
  'open-auth': 'không thấy cổng auth',
  uncalled: 'API khai mà không ai gọi',
  'murky-auth': 'cổng auth không phân loại được',
};

function renderAlerts() {
  const count = (fn) => ALERTS.filter(fn).length;
  fillFacet('al-kind', 'loại — tất cả (' + ALERTS.length + ')',
    Object.keys(KIND_LABEL).filter((k) => count((a) => a.kind === k) > 0)
      .map((k) => [k, KIND_LABEL[k] + ' (' + count((a) => a.kind === k) + ')']),
    state.alertKind, (v) => { state.alertKind = v; renderAlerts(); });
  fillFacet('al-sev', 'mức — tất cả', ['high', 'medium', 'low']
    .filter((s) => count((a) => a.severity === s) > 0)
    .map((s) => [s, s + ' (' + count((a) => a.severity === s) + ')']),
    state.alertSev, (v) => { state.alertSev = v; renderAlerts(); });

  const rows = ALERTS.filter((a) =>
    (!state.alertKind || a.kind === state.alertKind) && (!state.alertSev || a.severity === state.alertSev));
  el('al-count').textContent = rows.length + '/' + ALERTS.length + ' alert';
  const box = el('al-body');
  box.textContent = '';
  if (!rows.length) { box.appendChild(h('p', 'empty2', 'Không alert nào khớp bộ lọc.')); return; }

  const wrap = h('div', 'tblwrap');
  const tbl = document.createElement('table');
  tbl.className = 'rows';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>mức</th><th>loại</th><th>endpoint</th><th>chi tiết</th><th>màn ảnh hưởng</th></tr>';
  tbl.appendChild(thead);
  const tb = document.createElement('tbody');
  for (const a of rows.slice(0, ROW_CAP)) {
    const tr = document.createElement('tr');
    const c0 = h('td', 'nowrap');
    c0.appendChild(h('span', 'badge ' + a.severity, a.severity));
    tr.appendChild(c0);
    tr.appendChild(h('td', 'nowrap', KIND_LABEL[a.kind] || a.kind));
    const c2 = h('td');
    c2.appendChild(h('span', 'verb ' + a.method, a.method));
    c2.appendChild(h('div', 'mono', a.path));
    tr.appendChild(c2);
    const c3 = h('td');
    c3.appendChild(h('div', null, a.detail));
    if (a.bestConfidence) c3.appendChild(h('div', 'sub2', 'lời gọi rõ nhất: ' + a.bestConfidence));
    tr.appendChild(c3);
    const c4 = h('td');
    c4.appendChild(h('div', 'mono', a.screens.length ? a.screens.slice(0, 4).join(' · ') : '(chưa truy được về màn nào)'));
    if (a.screens.length > 4) c4.appendChild(h('div', 'sub2', '+' + (a.screens.length - 4) + ' màn nữa'));
    tr.appendChild(c4);
    tr.onclick = () => { state.endpoint = a.endpointId; state.section = 'impact'; render(); };
    tb.appendChild(tr);
  }
  tbl.appendChild(tb);
  wrap.appendChild(tbl);
  if (rows.length > ROW_CAP) wrap.appendChild(h('p', 'cut', 'Còn ' + (rows.length - ROW_CAP) + ' alert nữa — lọc hẹp lại.'));
  box.appendChild(wrap);
}

function renderCompare() {
  const box = el('cmp-body');
  box.textContent = '';
  if (!DIFF) {
    box.appendChild(h('p', 'hintbox', 'Chưa có hai lần scan để so. apiflow lưu mỗi bản scan theo hash nội dung, '
      + 'nên một lần scan lại mà không có gì đổi sẽ KHÔNG tạo bản mới. Chạy lại scan sau khi code đổi rồi quay lại đây.'));
    return;
  }
  const d = DIFF;
  const bad = /kém đi|hẹp hơn/.test(d.headline);
  box.appendChild(h('p', 'headline ' + (bad ? 'bad' : 'good'), d.headline));

  const pp = (after, before, at, bt) => {
    const a = at ? (after / at) * 100 : 0;
    const b = bt ? (before / bt) * 100 : 0;
    const delta = a - b;
    return { text: (delta >= 0 ? '▲' : '▼') + ' ' + Math.abs(delta).toFixed(1) + 'pp', up: delta >= 0 };
  };
  const cmp = h('div', 'cmp');
  const box1 = h('div', 'box');
  box1.appendChild(h('div', 'k', 'lời gọi'));
  const a1 = h('div', 'arrow');
  a1.appendChild(h('span', null, String(d.calls.before)));
  a1.appendChild(h('small', null, '→'));
  a1.appendChild(h('span', null, String(d.calls.after)));
  box1.appendChild(a1);
  cmp.appendChild(box1);

  for (const k of ['exact', 'inferred', 'guess']) {
    const b = h('div', 'box');
    b.appendChild(h('div', 'k', k));
    const ar = h('div', 'arrow');
    ar.appendChild(h('span', null, String(d.confidence.before[k])));
    ar.appendChild(h('small', null, '→'));
    ar.appendChild(h('span', null, String(d.confidence.after[k])));
    b.appendChild(ar);
    const shift = pp(d.confidence.after[k], d.confidence.before[k], d.calls.after, d.calls.before);
    // cm:why Percentage POINTS, not a ratio: guess going 571 -> 13 144 while total calls triple is a
    // different story from guess tripling on a fixed total, and only the share tells them apart.
    b.appendChild(h('div', 'pp ' + (k === 'guess' ? (shift.up ? 'down' : 'up') : (shift.up ? 'up' : 'down')), shift.text + ' tỉ trọng'));
    cmp.appendChild(b);
  }
  const bu = h('div', 'box');
  bu.appendChild(h('div', 'k', 'unresolved'));
  const au = h('div', 'arrow');
  au.appendChild(h('span', null, String(d.unresolved.before)));
  au.appendChild(h('small', null, '→'));
  au.appendChild(h('span', null, String(d.unresolved.after)));
  bu.appendChild(au);
  cmp.appendChild(bu);
  box.appendChild(cmp);

  const section = (title, items) => {
    if (!items.length) return;
    const wrap = h('div', 'tblwrap');
    wrap.appendChild(h('h3', null, title + ' — ' + items.length));
    const tbl = document.createElement('table');
    tbl.className = 'rows';
    const tb = document.createElement('tbody');
    for (const it of items.slice(0, 120)) {
      const tr = document.createElement('tr');
      const c0 = h('td', 'nowrap');
      c0.appendChild(h('span', 'verb ' + it.method, it.method));
      tr.appendChild(c0);
      tr.appendChild(h('td', 'mono', it.path));
      tr.appendChild(h('td', null, it.detail || ''));
      const c3 = h('td', 'mono');
      c3.textContent = (it.screens && it.screens.length) ? it.screens.slice(0, 3).join(' · ') : '—';
      tr.appendChild(c3);
      tb.appendChild(tr);
    }
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    if (items.length > 120) wrap.appendChild(h('p', 'cut', 'Còn ' + (items.length - 120) + ' mục nữa.'));
    wrap.style.marginBottom = '14px';
    box.appendChild(wrap);
  };
  section('Endpoint mới', d.endpoints.added);
  section('Endpoint mất', d.endpoints.removed);
  section('Endpoint đổi', d.endpoints.changed);
}

function render() {
  for (const a of document.querySelectorAll('.rail a')) a.classList.toggle('on', a.dataset.section === state.section);
  for (const p of document.querySelectorAll('.pane')) p.hidden = p.id !== 'pane-' + state.section;
  if (state.section === 'endpoints') renderEndpoints();
  if (state.section === 'impact') renderImpact();
  if (state.section === 'screens') renderScreens();
  if (state.section === 'unresolved') renderUnresolved();
  if (state.section === 'alerts') renderAlerts();
  if (state.section === 'compare') renderCompare();
}

for (const a of document.querySelectorAll('[data-section]')) {
  a.onclick = (ev) => {
    ev.preventDefault();
    state.section = a.dataset.section;
    if (a.dataset.kind) { state.alertKind = a.dataset.kind; state.alertSev = ''; }
    location.hash = state.section;
    render();
  };
}
const bind = (id, key) => {
  const node = el(id);
  if (node) node.addEventListener('input', (ev) => { state[key] = ev.target.value.trim(); render(); });
};
bind('q', 'q');
bind('imp-q', 'impQ');
bind('sc-q', 'scQ');
bind('un-q', 'unQ');

const PROJECT = JSON.parse(el('project')?.textContent || 'null');

// cm:why Reads the stream line by line and never reloads on its own: a scan can fail halfway, and a
// page that refreshed itself would replace the error text with a map that did not change.
function startScan(kind, button) {
  const box = el('scanlog');
  box.classList.add('on');
  box.textContent = 'đang scan ' + kind.toUpperCase() + '…\n';
  for (const b of document.querySelectorAll('.btn')) b.disabled = true;
  fetch('/api/projects/' + PROJECT + '/scan?kind=' + kind, { method: 'POST' })
    .then((res) => {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const pump = () => reader.read().then(({ done, value }) => {
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        for (const part of parts) {
          const line = part.replace(/^data: /, '');
          if (!line) continue;
          let event;
          try { event = JSON.parse(line); } catch (err) { continue; }
          const span = document.createElement('span');
          span.className = event.kind === 'error' ? 'err' : event.kind === 'done' ? 'ok' : '';
          span.textContent = event.text + '\n';
          box.appendChild(span);
          box.scrollTop = box.scrollHeight;
          if (event.kind === 'done') {
            const note = document.createElement('span');
            note.className = 'ok';
            note.textContent = 'Tải lại trang để xem bản đồ mới.\n';
            box.appendChild(note);
          }
          if (event.kind !== 'log') for (const b of document.querySelectorAll('.btn')) b.disabled = false;
        }
        return pump();
      });
      return pump();
    })
    .catch((err) => {
      const span = document.createElement('span');
      span.className = 'err';
      span.textContent = 'không gọi được scan: ' + err.message + '\n';
      box.appendChild(span);
      for (const b of document.querySelectorAll('.btn')) b.disabled = false;
    });
}
if (PROJECT) {
  const fe = el('scan-fe');
  const be = el('scan-be');
  if (fe) fe.onclick = () => startScan('fe', fe);
  if (be) be.onclick = () => startScan('be', be);
}

const fromHash = location.hash.replace('#', '');
if (fromHash) state.section = fromHash;
render();
`;
