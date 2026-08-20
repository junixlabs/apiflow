export const GRAPH_STYLE = `
.tabs { display:flex; gap:4px; margin:0; }
.bar.toolbar { border:1px solid var(--line); border-radius:0 10px 0 0; background:var(--surface-2);
  display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:10px 14px; }
.app { border-top:0 !important; border-radius:0 0 14px 14px !important; }
.canvas { border-top:0; border-radius:0 0 14px 14px; }
.tab { padding:8px 16px; border:1px solid var(--line); border-bottom-color:transparent;
  border-radius:10px 10px 0 0; background:var(--surface-2); color:var(--muted);
  cursor:pointer; font-size:13px; font-weight:550; }
.tab.on { background:var(--surface); color:var(--ink); }
.pane { display:none; }
.pane.on { display:block; }
.canvas { border:1px solid var(--line); border-radius:0 14px 14px 14px; background:var(--surface);
  box-shadow:var(--shadow); padding:16px 18px 22px; }
.legend { display:flex; gap:16px; flex-wrap:wrap; align-items:center; margin:0 0 14px;
  font-size:12px; color:var(--muted); }
.legend b { color:var(--ink); font-weight:600; }
.swatch { display:inline-block; width:11px; height:11px; border-radius:3px; margin-right:6px;
  vertical-align:-1px; border:1px solid rgba(0,0,0,.12); }
.blocks { display:grid; grid-template-columns:repeat(auto-fill,minmax(228px,1fr)); gap:14px; }
.block { border:1px solid var(--line); border-radius:10px; padding:9px 11px 11px; background:var(--surface-2); }
.block h3 { margin:0 0 7px; font:600 12px/1.3 ui-monospace,monospace; word-break:break-all; }
.block h3 span { color:var(--muted); font-weight:400; }
.cells { display:flex; flex-wrap:wrap; gap:3px; }
.cell { width:13px; height:13px; border-radius:3px; cursor:pointer; border:1px solid transparent; }
.cell:hover { outline:2px solid var(--ink); outline-offset:1px; }
.cell.sel { outline:2px solid var(--ink); outline-offset:1px; }
.cell.s-both { background:var(--exact); }
.cell.s-uncalled { background:var(--surface-3); border-color:var(--line); }
.cell.s-feonly { background:var(--dead); }
.cell.s-unpaired { background:repeating-linear-gradient(135deg,var(--surface-3) 0 3px,var(--surface) 3px 6px);
  border-color:var(--line); }
.cell.open { box-shadow:inset 0 0 0 2px var(--bg); }
.pick { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:0 0 12px; }
.pick select { font:inherit; padding:5px 8px; border-radius:8px; border:1px solid var(--line);
  background:var(--surface); color:var(--ink); max-width:100%; }
.pick .hint { color:var(--muted); font-size:12px; }
svg.bip { width:100%; height:auto; display:block; }
svg.bip text { font:11.5px ui-monospace,monospace; fill:var(--ink); }
svg.bip text.head { font:600 11px ui-sans-serif,sans-serif; fill:var(--muted);
  letter-spacing:.08em; text-transform:uppercase; }
svg.bip .node { fill:var(--surface-3); stroke:var(--line); }
svg.bip .node.screen { fill:var(--inferred); stroke:none; }
svg.bip .node.ep { fill:var(--exact); stroke:none; }
svg.bip .node.ep.dead { fill:var(--dead); }
svg.bip .edge { fill:none; stroke-width:1.2; opacity:.5; }
svg.bip .edge.c-exact { stroke:var(--exact); }
svg.bip .edge.c-inferred { stroke:var(--inferred); }
svg.bip .edge.c-guess { stroke:var(--guess); stroke-dasharray:3 3; }
svg.bip g.row { cursor:pointer; }
svg.bip g.row:hover text { font-weight:700; }
svg.bip.dim .edge { opacity:.08; }
svg.bip.dim .edge.lit { opacity:.95; stroke-width:2; }
svg.bip.dim text { opacity:.35; }
svg.bip.dim g.lit text { opacity:1; font-weight:700; }
svg.bip.dim rect.node { opacity:.25; }
svg.bip.dim g.lit rect.node { opacity:1; }
.wide { color:var(--guess); font-size:12.5px; margin:10px 0 0; }
`;

// cm:guard No template literals in here — this whole block is embedded inside a String.raw literal,
// so a single backtick would close it early and the page would ship a syntax error.
export const GRAPH_SCRIPT = String.raw`
const MAX_ROWS = 90;

// cm:edge contract -> src/workspace/summary.ts — same four states as endpointState there; on a
// one-sided scan EVERY endpoint looks feOnly, and painting that red invents a defect out of a gap.
const HAS_BE = MAP.endpoints.some((e) => e.source !== undefined);
const HAS_FE = MAP.calls.length > 0;

const stateOf = (e) => {
  if (e.source === undefined) return HAS_BE ? 'feonly' : 'unpaired';
  if (callersOf(e.id).length > 0) return 'both';
  return HAS_FE ? 'uncalled' : 'unpaired';
};

const STATE_LABEL = {
  both: 'màn gọi + API có',
  uncalled: 'API có, không màn nào gọi',
  feonly: 'FE gọi, API không khai',
  unpaired: 'chưa đối chiếu được — thiếu một trong hai phía',
};

function renderCoverage() {
  const box = document.getElementById('blocks');
  box.textContent = '';
  const visible = MAP.endpoints.filter(matches);
  const groups = new Map();
  for (const e of visible) {
    const g = groupOf(e.path);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(e);
  }
  const sorted = [...groups].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  for (const [name, list] of sorted) {
    const block = h('div', 'block');
    const title = h('h3', null, name + ' ');
    title.appendChild(h('span', null, String(list.length)));
    block.appendChild(title);
    const cells = h('div', 'cells');
    for (const e of list.sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method))) {
      const st = stateOf(e);
      const cell = h('div', 'cell s-' + st + (e.auth === false ? ' open' : '') + (state.endpoint === e.id ? ' sel' : ''));
      cell.title = e.method + ' ' + e.path + '\n' + STATE_LABEL[st]
        + '\nmàn gọi: ' + callersOf(e.id).length
        + (e.auth === false ? '\nkhông thấy cổng auth nào' : '');
      cell.onclick = () => {
        state.endpoint = state.endpoint === e.id ? null : e.id;
        state.group = groupOf(e.path);
        render();
      };
      cells.appendChild(cell);
    }
    block.appendChild(cells);
    box.appendChild(block);
  }
  if (sorted.length === 0) box.appendChild(h('p', 'empty', 'Không endpoint nào khớp bộ lọc.'));
}

function scopeForGraph() {
  if (state.endpoint) {
    const e = MAP.endpoints.find((x) => x.id === state.endpoint);
    if (e) return { eps: [e], label: e.method + ' ' + e.path };
  }
  const visible = MAP.endpoints.filter(matches);
  const g = state.group;
  if (g) return { eps: visible.filter((e) => groupOf(e.path) === g), label: g };
  const counts = new Map();
  for (const e of visible) counts.set(groupOf(e.path), (counts.get(groupOf(e.path)) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (!top) return { eps: [], label: '' };
  return { eps: visible.filter((e) => groupOf(e.path) === top[0]), label: top[0] };
}

const svgEl = (tag, attrs) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
};

const clip = (text, n) => (text.length > n ? text.slice(0, n - 1) + '…' : text);

function renderGraph() {
  const host = document.getElementById('bip');
  host.textContent = '';
  const scope = scopeForGraph();
  document.getElementById('scope-label').textContent = scope.label || '—';
  const note = document.getElementById('graph-note');
  note.textContent = '';

  const edges = [];
  for (const e of scope.eps) {
    for (const c of callersOf(e.id)) {
      if (!c.screen) continue;
      edges.push({ ep: e.id, screen: c.screenId, confidence: c.confidence, screenNode: c.screen });
    }
  }
  if (edges.length === 0) {
    note.textContent = 'Không lời gọi nào tới ' + (scope.label || 'nhóm này')
      + '. Đó không phải bằng chứng là không ai gọi — xem danh sách Unresolved trong file .apimap.';
    return;
  }

  const screenIds = [...new Set(edges.map((x) => x.screen))];
  const epIds = [...new Set(edges.map((x) => x.ep))];
  // cm:guard Reports the cut instead of silently drawing the first 90 — a diagram that looks complete
  // but is not answers the question wrongly, which is worse than refusing to draw it.
  if (screenIds.length > MAX_ROWS) {
    note.textContent = scope.label + ' được ' + screenIds.length + ' màn gọi — quá rộng để vẽ.'
      + ' Chọn một endpoint cụ thể ở bản đồ phủ để thu hẹp lại.';
    return;
  }

  const labelOf = (id) => {
    const s = screens[id];
    if (!s) return id;
    return s.route || (s.label + ' (chưa gắn route)');
  };
  screenIds.sort((a, b) => labelOf(a).localeCompare(labelOf(b)));
  const epById = Object.fromEntries(MAP.endpoints.map((e) => [e.id, e]));
  epIds.sort((a, b) => (epById[a].path + epById[a].method).localeCompare(epById[b].path + epById[b].method));

  const rows = Math.max(screenIds.length, epIds.length);
  const rowH = rows > 40 ? 15 : rows > 24 ? 19 : 24;
  const top = 34;
  const span = rows * rowH;
  const height = top + span + 16;
  const W = 1180;
  const xs = 300;
  const xe = 640;

  const svg = svgEl('svg', { class: 'bip', viewBox: '0 0 ' + W + ' ' + height, role: 'img' });
  svg.appendChild(Object.assign(svgEl('text', { x: xs, y: 16, class: 'head', 'text-anchor': 'end' }),
    { textContent: 'màn (' + screenIds.length + ')' }));
  svg.appendChild(Object.assign(svgEl('text', { x: xe, y: 16, class: 'head' }),
    { textContent: 'endpoint (' + epIds.length + ')' }));

  // cm:why Each column is spread over the SAME vertical extent — laying both out at a fixed row
  // pitch stacks the shorter side in a clump at the top and the fan of edges stops being readable.
  const yS = {};
  const yE = {};
  const spread = (ids, out) => ids.forEach((id, i) => { out[id] = top + ((i + 0.5) * span) / ids.length; });
  spread(screenIds, yS);
  spread(epIds, yE);

  const edgeEls = [];
  for (const edge of edges) {
    const y1 = yS[edge.screen];
    const y2 = yE[edge.ep];
    const mid = (xs + xe) / 2;
    const path = svgEl('path', {
      class: 'edge c-' + edge.confidence,
      d: 'M ' + (xs + 8) + ' ' + y1 + ' C ' + mid + ' ' + y1 + ', ' + mid + ' ' + y2 + ', ' + (xe - 8) + ' ' + y2,
    });
    path.dataset.screen = edge.screen;
    path.dataset.ep = edge.ep;
    svg.appendChild(path);
    edgeEls.push(path);
  }

  const groupsByKey = {};
  const addRow = (id, y, side, text, cls) => {
    const g = svgEl('g', { class: 'row' });
    const rect = svgEl('rect', {
      class: 'node ' + cls, x: side === 'left' ? xs : xe - 6, y: y - 4, width: 6, height: 8, rx: 2,
    });
    const label = svgEl('text', {
      x: side === 'left' ? xs - 8 : xe + 8, y: y + 4,
      'text-anchor': side === 'left' ? 'end' : 'start',
    });
    label.textContent = text;
    g.appendChild(rect);
    g.appendChild(label);
    g.onmouseenter = () => {
      svg.classList.add('dim');
      for (const el of edgeEls) {
        const lit = side === 'left' ? el.dataset.screen === id : el.dataset.ep === id;
        el.classList.toggle('lit', lit);
        if (lit) {
          const other = side === 'left' ? el.dataset.ep : el.dataset.screen;
          if (groupsByKey[other]) groupsByKey[other].classList.add('lit');
        }
      }
      g.classList.add('lit');
    };
    g.onmouseleave = () => {
      svg.classList.remove('dim');
      for (const el of edgeEls) el.classList.remove('lit');
      for (const k in groupsByKey) groupsByKey[k].classList.remove('lit');
    };
    groupsByKey[id] = g;
    svg.appendChild(g);
  };

  for (const id of screenIds) addRow(id, yS[id], 'left', clip(labelOf(id), 40), 'screen');
  for (const id of epIds) {
    const e = epById[id];
    addRow(id, yE[id], 'right', clip(e.method + ' ' + e.path, 62), 'ep' + (e.source ? '' : ' dead'));
  }

  host.appendChild(svg);
  const guesses = edges.filter((x) => x.confidence === 'guess').length;
  note.textContent = edges.length + ' cạnh · ' + guesses + ' ở mức guess'
    + (guesses > 0 ? ' (nét đứt cam — chuỗi đi qua re-export, không chắc đúng màn)' : '');
}
`;

export const GRAPH_TABS = `
  <div class="tabs">
    <div class="tab on" data-pane="list">Danh sách</div>
    <div class="tab" data-pane="cover">Bản đồ phủ</div>
    <div class="tab" data-pane="graph">Vòng ảnh hưởng</div>
  </div>`;

export const GRAPH_PANES = `
  <div class="pane" id="pane-cover">
    <div class="canvas">
      <div class="legend">
        <span><span class="swatch" style="background:var(--exact)"></span>có màn gọi &amp; API khai</span>
        <span><span class="swatch" style="background:var(--surface-3);border-color:var(--line)"></span>API khai, không màn nào gọi</span>
        <span><span class="swatch" style="background:var(--dead)"></span>FE gọi nhưng API không khai</span>
        <span><span class="swatch" style="background:repeating-linear-gradient(135deg,var(--surface-3) 0 3px,var(--surface) 3px 6px)"></span>chưa đối chiếu được</span>
        <span><b>viền trong</b> = không thấy cổng auth</span>
        <span>bấm một ô để xem vòng ảnh hưởng</span>
      </div>
      <div class="blocks" id="blocks"></div>
    </div>
  </div>
  <div class="pane" id="pane-graph">
    <div class="canvas">
      <div class="pick">
        <span class="hint">đang xem</span><b id="scope-label">—</b>
        <span class="spacer"></span>
        <span class="hint">trỏ vào một hàng để soi riêng nhánh đó</span>
      </div>
      <div class="legend">
        <span><span class="swatch" style="background:var(--inferred)"></span>màn</span>
        <span><span class="swatch" style="background:var(--exact)"></span>endpoint API có khai</span>
        <span><span class="swatch" style="background:var(--dead)"></span>endpoint API không khai</span>
        <span style="color:var(--exact)">── exact</span>
        <span style="color:var(--inferred)">── inferred</span>
        <span style="color:var(--guess)">╌╌ guess</span>
      </div>
      <div id="bip"></div>
      <p class="wide" id="graph-note"></p>
    </div>
  </div>`;

export const TAB_SCRIPT = String.raw`
function showPane(name) {
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t.dataset.pane === name);
  document.getElementById('pane-list').classList.toggle('on', name === 'list');
  document.getElementById('pane-cover').classList.toggle('on', name === 'cover');
  document.getElementById('pane-graph').classList.toggle('on', name === 'graph');
  state.pane = name;
  render();
}
for (const t of document.querySelectorAll('.tab')) t.onclick = () => showPane(t.dataset.pane);
`;
