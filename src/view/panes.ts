export const PANES_STYLE = `
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
.cell:hover, .cell.sel { outline:2px solid var(--ink); outline-offset:1px; }
.cell.s-both { background:var(--exact); }
.cell.s-uncalled { background:var(--surface-3); border-color:var(--line); }
.cell.s-feonly { background:var(--dead); }
.cell.s-unpaired { background:repeating-linear-gradient(135deg,var(--surface-3) 0 3px,var(--surface) 3px 6px);
  border-color:var(--line); }
.cell.open { box-shadow:inset 0 0 0 2px var(--surface); }
.pick { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:0 0 12px; font-size:12.5px; }
.pick .hint { color:var(--muted); }
.pick .spacer { flex:1; }
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

.toolrow { display:flex; gap:9px; align-items:center; flex-wrap:wrap; margin:0 0 10px; }
.grid3 { display:grid; grid-template-columns:196px minmax(0,1fr) 336px; gap:14px; align-items:start; }
@media (max-width:1400px) { .grid3 { grid-template-columns:196px minmax(0,1fr); } }
@media (max-width:1000px) { .grid3 { grid-template-columns:1fr; } }

.kpistrip { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; margin:0 0 14px; }
@media (max-width:1250px) { .kpistrip { grid-template-columns:repeat(3,minmax(0,1fr)); } }
.kpistrip .k1 { border:1px solid var(--line); border-radius:10px; background:var(--surface); padding:8px 11px 9px; }
.kpistrip .k1 .lab { font-size:9.5px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); }
.kpistrip .k1 .val { font:650 20px/1.25 ui-sans-serif,sans-serif; letter-spacing:-.02em; margin-top:1px; }
.kpistrip .k1 .dlt { font-size:10.5px; color:var(--muted); }
.kpistrip .k1 .dlt.up { color:var(--exact); } .kpistrip .k1 .dlt.down { color:var(--dead); }
.kpistrip .k1.alarm .val { color:var(--dead); }
.kpistrip .k1 .spark { display:block; margin-top:3px; }

.facets { border:1px solid var(--line); border-radius:12px; background:var(--surface);
  padding:11px 0 6px; position:sticky; top:14px; max-height:80vh; overflow:auto; }
.facets .fhead { display:flex; align-items:center; padding:0 12px 8px; }
.facets .fhead span { font:650 10px/1 ui-sans-serif,sans-serif; text-transform:uppercase;
  letter-spacing:.09em; color:var(--muted); }
.facets .reset { margin-left:auto; font:11px inherit; color:var(--brand); background:none;
  border:0; cursor:pointer; padding:0; }
.facets .fg { border-top:1px solid var(--line); padding:8px 0 6px; }
.facets .fg > h5 { margin:0 0 4px; padding:0 12px; font:650 9.5px/1 ui-sans-serif,sans-serif;
  text-transform:uppercase; letter-spacing:.09em; color:var(--muted); }
.facets label { display:flex; align-items:center; gap:7px; padding:4px 12px; font-size:12px;
  cursor:pointer; color:var(--ink-2); }
.facets label:hover { background:var(--surface-2); }
.facets label.on { color:var(--ink); font-weight:600; }
.facets label input { accent-color:var(--brand); margin:0; flex:none; }
.facets label .fn { margin-left:auto; font:11px ui-monospace,monospace; color:var(--muted); }
.facets label .sw { width:8px; height:8px; border-radius:2px; flex:none; }

.pager { display:flex; align-items:center; gap:5px; padding:9px 2px 4px; flex-wrap:wrap; }
.pager button { min-width:28px; font:12px inherit; border:1px solid var(--line); border-radius:7px;
  background:var(--surface); color:var(--ink-2); padding:4px 7px; cursor:pointer; }
.pager button:hover:not([disabled]) { background:var(--surface-3); color:var(--ink); }
.pager button.on { background:var(--brand); border-color:var(--brand); color:#fff; font-weight:650; }
.pager button[disabled] { opacity:.4; cursor:default; }
.pager .gap { color:var(--muted); padding:0 2px; }
.pager .of { margin-left:auto; font-size:11.5px; color:var(--muted); }

.legendbar { display:flex; gap:16px; flex-wrap:wrap; align-items:center; margin:16px 0 0;
  padding:10px 13px; border:1px solid var(--line); border-radius:10px; background:var(--surface-2);
  font-size:11.5px; color:var(--muted); }
.legendbar b { color:var(--ink); font-weight:600; }
.cmp4 { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; margin:0 0 16px; }
@media (max-width:1150px) { .cmp4 { grid-template-columns:1fr; } }
.barow { display:flex; align-items:baseline; gap:10px; padding:5px 0; border-bottom:1px dashed var(--line); }
.barow:last-child { border-bottom:0; }
.barow .lb { font-size:12px; color:var(--muted); min-width:76px; }
.barow .lb .sw { width:8px; height:8px; border-radius:2px; display:inline-block; }
.ba { display:flex; align-items:baseline; gap:7px; margin-left:auto; }
.ba .b1 { font:600 13px ui-monospace,monospace; color:var(--muted); }
.ba .b2 { font:650 16px ui-monospace,monospace; }
.ba .ar { color:var(--muted); font-size:11px; }
.ba .dl { font-size:11px; color:var(--muted); }
.ba .dl.up { color:var(--exact); } .ba .dl.down { color:var(--dead); }
.stk { display:flex; align-items:center; gap:8px; margin:0 0 7px; }
.stk .tg { font-size:10.5px; color:var(--muted); min-width:32px; }
.stk .sb { display:flex; flex:1; height:9px; border-radius:999px; overflow:hidden; background:var(--surface-3); }
.stk .sb i { display:block; }
.stk .tot { font:600 11px ui-monospace,monospace; color:var(--muted); }
.bignum { display:flex; align-items:baseline; gap:9px; margin:2px 0 6px; }
.bignum .b1 { font:600 19px ui-monospace,monospace; color:var(--muted); }
.bignum .b2 { font:650 27px ui-sans-serif,sans-serif; letter-spacing:-.02em; }
.bignum .b2.worse { color:var(--dead); }
.bignum .ar { color:var(--muted); }
.chg { font:650 9.5px/1 ui-sans-serif,sans-serif; text-transform:uppercase; letter-spacing:.07em;
  border-radius:999px; padding:4px 8px; border:1px solid var(--line); color:var(--muted); }
.chg.ok { color:var(--exact); border-color:var(--exact); background:var(--tint-exact); }
.chg.bad { color:var(--dead); border-color:var(--dead); background:var(--tint-dead); }
.chg.warn { color:var(--guess); border-color:var(--guess); background:var(--tint-guess); }
.ihead { display:flex; align-items:center; gap:8px; margin:0 0 9px; min-width:0; }
.ihead h4 { margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.callout { border:1px solid var(--line); border-left-width:3px; border-radius:8px;
  padding:8px 10px; margin:0 0 11px; background:var(--surface-2); }
.callout .ct { font-weight:650; font-size:12.5px; }
.callout .cw { font-size:11.5px; color:var(--muted); margin-top:2px; line-height:1.5; }
.callout.d-both { border-left-color:var(--exact); background:var(--tint-exact); }
.callout.d-feonly { border-left-color:var(--dead); background:var(--tint-dead); }
.callout.d-uncalled { border-left-color:var(--guess); background:var(--tint-guess); }
.callout.d-unpaired { border-left-color:var(--line-2); }
.btn.wide2 { width:100%; margin-top:12px; text-align:center; display:block; }
.toolrow .search { display:flex; align-items:center; gap:7px; background:var(--surface);
  border:1px solid var(--line); border-radius:8px; padding:5px 9px; min-width:240px; }
.toolrow .search input { border:0; outline:0; background:transparent; color:var(--ink); font:inherit; width:100%; }
.facet { border:1px solid var(--line); border-radius:8px; background:var(--surface);
  color:var(--muted); font:inherit; font-size:12.5px; padding:5px 8px; }
.grid2 { display:grid; grid-template-columns:1fr 348px; gap:14px; align-items:start; }
@media (max-width:1150px) { .grid2 { grid-template-columns:1fr; } }
/* cm:guard The chain needs FOUR readable columns — squeezing it into the 348px inspector slot broke
   every label into one character per line, which is worse than not drawing it. */
.impgrid { display:grid; grid-template-columns:360px minmax(0,1fr); gap:14px; align-items:start; }
@media (max-width:1250px) { .impgrid { grid-template-columns:1fr; } }
table.rows { width:100%; border-collapse:collapse; font-size:12.5px; }
table.rows th { text-align:left; font:600 10.5px/1 ui-sans-serif,sans-serif; text-transform:uppercase;
  letter-spacing:.07em; color:var(--muted); padding:0 8px 7px; border-bottom:1px solid var(--line); white-space:nowrap; }
table.rows td { padding:7px 8px; border-bottom:1px solid var(--line); vertical-align:top; }
table.rows.dense { table-layout:fixed; }
table.rows.dense td { padding:6px 8px; vertical-align:middle; }
table.rows.dense th { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
table.rows.dense th.num, table.rows.dense td.num { text-align:right; font:600 12px ui-monospace,monospace; }
table.rows.dense .clip { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
table.rows.dense .mono { font:12px/1.4 ui-monospace,monospace; }
table.rows.dense .sub2 { font:10.5px/1.35 ui-monospace,monospace; }
table.rows tbody tr { cursor:pointer; }
table.rows tbody tr:hover { background:var(--surface-2); }
table.rows tbody tr.on { background:var(--surface-3); box-shadow:inset 3px 0 0 var(--brand); }
table.rows tbody tr.on .mono { color:var(--ink); font-weight:600; }
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
.chainwrap { overflow-x:auto; margin-top:6px; }
svg.chaing { width:100%; min-width:760px; height:auto; display:block; }
svg.chaing text { font:11px ui-monospace,monospace; fill:var(--ink); }
svg.chaing text.sub { font:9.5px ui-monospace,monospace; fill:var(--muted); }
svg.chaing text.head { font:650 9.5px ui-sans-serif,sans-serif; fill:var(--muted);
  letter-spacing:.09em; text-transform:uppercase; }
svg.chaing g.cnode rect { fill:var(--surface-2); stroke:var(--line-2); stroke-width:1; }
svg.chaing g.cnode.loose rect { stroke:var(--guess); stroke-dasharray:3 2; }
svg.chaing .cedge { fill:none; stroke-width:1.3; opacity:.55; }
svg.chaing .cedge.loose { stroke-dasharray:4 3; }
svg.chaing .cedge.c-exact { stroke:var(--exact); }
svg.chaing .cedge.c-inferred { stroke:var(--inferred); }
svg.chaing .cedge.c-guess { stroke:var(--guess); }
svg.chaing .arrowhead { fill:var(--muted); }
svg.chaing g.cnode { cursor:default; }
svg.chaing.dim .cedge { opacity:.07; }
svg.chaing.dim .cedge.lit { opacity:.95; stroke-width:2; }
svg.chaing.dim g.cnode { opacity:.25; }
svg.chaing.dim g.cnode.lit { opacity:1; }
svg.chaing.dim g.cnode.lit rect { stroke:var(--brand); }
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
  <div class="kpistrip" id="ep-kpis"></div>
  <div class="grid3">
    <aside class="facets" id="ep-facets">
      <div class="fhead"><span>Bộ lọc</span><button class="reset" id="f-reset" type="button">Bỏ lọc</button></div>
      <div id="f-groups"></div>
    </aside>
    <div>
      <div class="toolrow">
        <label class="search">🔎<input id="q" placeholder="tìm theo method, path hoặc controller" autocomplete="off"></label>
        <span class="stat" id="ep-count"></span>
        <span class="spacer"></span>
        <span class="stat" id="ep-range"></span>
      </div>
      <div class="tblwrap">
        <table class="rows dense">
          <colgroup>
            <col style="width:74px"><col><col style="width:54px">
            <col style="width:132px"><col style="width:38px"><col style="width:82px">
          </colgroup>
          <thead><tr>
            <th>method</th><th>path · controller</th>
            <th>auth</th><th>trạng thái</th><th class="num">#</th><th>tin cậy</th>
          </tr></thead>
          <tbody id="ep-rows"></tbody>
        </table>
        <div class="pager" id="ep-pager"></div>
      </div>
      <div class="legendbar">
        <span><b>độ tin cậy</b></span>
        <span><span class="swatch c-bg-exact"></span>exact — đọc trực tiếp từ code</span>
        <span><span class="swatch c-bg-inferred"></span>inferred — suy qua wrapper hoặc hằng số</span>
        <span><span class="swatch c-bg-guess"></span>guess — đi qua re-export, có thể sai màn</span>
        <span>Unresolved <b>không</b> nằm trong ba mức trên — apiflow không đọc được đường dẫn.</span>
      </div>
    </div>
    <div class="insp2">
      <div class="htabs" id="insp-tabs"></div>
      <div class="body" id="insp-body"></div>
    </div>
  </div>
</section>

<section class="pane" id="pane-cover" hidden>
  <div class="toolrow">
    <label class="search">🔎<input id="cv-q" placeholder="tìm theo method hoặc path" autocomplete="off"></label>
    <select class="facet" id="cv-recon"></select>
    <span class="stat" id="cv-count"></span>
  </div>
  <div class="legend">
    <span><span class="swatch" style="background:var(--exact)"></span>màn gọi &amp; API khai</span>
    <span><span class="swatch" style="background:var(--surface-3);border-color:var(--line)"></span>API khai, không màn nào gọi</span>
    <span><span class="swatch" style="background:var(--dead)"></span>FE gọi, API không khai</span>
    <span><span class="swatch" style="background:repeating-linear-gradient(135deg,var(--surface-3) 0 3px,var(--surface) 3px 6px)"></span>chưa đối chiếu được</span>
    <span><b>viền trong</b> = không thấy cổng auth</span>
    <span>bấm một ô để xem vòng ảnh hưởng của nó</span>
  </div>
  <div class="blocks" id="blocks"></div>
</section>

<section class="pane" id="pane-graph" hidden>
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
      <div class="pager" id="sc-pager"></div>
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
const el0 = (id) => (document.getElementById(id) || { textContent: 'null' }).textContent;
const MAP = JSON.parse(document.getElementById('apimap').textContent);
const ALERTS = JSON.parse(document.getElementById('alerts').textContent);
const RELIABILITY = new Map(JSON.parse(document.getElementById('reliability').textContent)
  .map((r) => [r[0], { exact: r[1], inferred: r[2], guess: r[3] }]));
const DIFF = JSON.parse(document.getElementById('diff').textContent);
const SERIES = JSON.parse(el0('series'));
const EPHIST = JSON.parse(el0('ephist'));

// cm:why "bản scan thứ 3/5" plus a date, not just a date: history holds only the scans that CHANGED
// something, so "2 ngày trước" alone hides that there were three scans in between that saw the same.
function seenText(endpointId) {
  if (!EPHIST) return null;
  const total = EPHIST.scans.length;
  const index = EPHIST.first[endpointId];
  if (index === undefined) return 'có ở cả ' + total + ' bản scan đã lưu';
  const at = EPHIST.scans[index] && EPHIST.scans[index].at;
  return 'xuất hiện ở bản scan thứ ' + (index + 1) + '/' + total
    + (at ? ' (' + new Date(at).toLocaleString('vi-VN') + ')' : '');
}

// cm:guard Kept for the panes that still cap instead of paginate — unresolved groups by reason, and
// a page boundary through a group would split one reason across two pages.
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
// cm:why Each state gets a sentence, not just a colour: "feonly" is a finding a reader has to act on,
// and the action depends on WHY apiflow says it — which the colour cannot carry.
const RECON_WHY = {
  both: 'API khai route này và có màn gọi nó. Đổi nó là đổi cả hai phía.',
  uncalled: 'API khai route này nhưng không màn nào trong FE đã scan gọi tới. Ứng viên route chết — client khác vẫn có thể đang gọi.',
  feonly: 'FE gọi đường dẫn này nhưng BE không khai. Hoặc sai đường dẫn, hoặc route nằm ở service khác.',
  unpaired: 'Chưa đối chiếu được vì thiếu một phía. Scan phía còn lại rồi mới kết luận được.',
};

const screensFor = (endpointId) =>
  [...new Set((callsByEndpoint.get(endpointId) || []).map((c) => c.screenId))];

const state = {
  section: 'overview', q: '', method: '', auth: '', recon: '', conf: '',
  endpoint: null, insp: 'overview', screen: null, impQ: '',
  alertKind: '', alertSev: '', unQ: '', scQ: '', cvQ: '', cvRecon: '', group: null, gEndpoint: null, page: 1, scPage: 1, alPage: 1,
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

const PAGE = 50;

function kpiStrip(id) {
  const box = el(id);
  if (!box) return;
  box.textContent = '';
  const d = DIFF;
  const rows = [
    ['endpoint', MAP.endpoints.length, d && (d.endpoints.added.length - d.endpoints.removed.length), ''],
    ['màn hình', MAP.screens.length, d && (d.screens.after - d.screens.before), ''],
    ['lời gọi', MAP.calls.length, d && (d.calls.after - d.calls.before), ''],
    ['field', MAP.fields.length, null, ''],
    ['unresolved', MAP.unresolved.length, d && (d.unresolved.after - d.unresolved.before), MAP.unresolved.length ? 'alarm' : ''],
    ['thấy hai phía', MAP.endpoints.filter((e) => reconOf(e) === 'both').length, null, ''],
  ];
  const SERIES_KEY = { endpoint: 'endpoints', 'màn hình': 'screens', 'lời gọi': 'calls', unresolved: 'unresolved' };
  for (const [lab, val, delta, cls] of rows) {
    const card = h('div', 'k1 ' + cls);
    card.appendChild(h('div', 'lab', lab));
    card.appendChild(h('div', 'val', val.toLocaleString('vi-VN')));
    // cm:why A delta is shown only when two scans exist — an unchanged "▲ 0" on a first scan reads
    // as "measured, no movement" when the truth is that nothing has been measured against yet.
    if (delta === null || delta === undefined || delta === 0) {
      card.appendChild(h('div', 'dlt', d ? '—' : 'chưa có bản trước để so'));
    } else {
      const up = lab === 'unresolved' ? delta < 0 : delta > 0;
      card.appendChild(h('div', 'dlt ' + (up ? 'up' : 'down'),
        (delta > 0 ? '▲ ' : '▼ ') + Math.abs(delta).toLocaleString('vi-VN') + ' so lần trước'));
    }
    const line = SERIES && SERIES[SERIES_KEY[lab]];
    if (line && line.length >= 3) card.appendChild(spark(line, cls === 'alarm'));
    box.appendChild(card);
  }
}

// cm:why Draws the series as-is with no y-axis and no baseline at zero: this is a shape, not a
// measurement — the number above it is the measurement, and a fake axis would invite reading values
// off 40 pixels of svg.
function spark(values, inverse) {
  const w = 78;
  const hgt = 16;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 2) + 1;
    const y = hgt - 1 - ((v - min) / span) * (hgt - 2);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  const rising = values[values.length - 1] > values[0];
  const good = inverse ? !rising : rising;
  const svg = svgEl('svg', { class: 'spark', width: w, height: hgt, viewBox: '0 0 ' + w + ' ' + hgt });
  svg.appendChild(svgEl('polyline', {
    points: pts, fill: 'none', 'stroke-width': '1.4', 'stroke-linejoin': 'round',
    stroke: 'var(--' + (values[0] === values[values.length - 1] ? 'muted' : good ? 'exact' : 'dead') + ')',
  }));
  svg.setAttribute('aria-label', values.length + ' lần scan: ' + values.join(' → '));
  const titleEl = svgEl('title', {});
  titleEl.textContent = values.length + ' lần scan gần nhất: ' + values.join(' → ');
  svg.appendChild(titleEl);
  return svg;
}

const FACET_GROUPS = [
  { key: 'method', title: 'method', values: () => [...new Set(MAP.endpoints.map((e) => e.method))].sort()
      .map((m) => ({ v: m, label: m, test: (e) => e.method === m })) },
  { key: 'auth', title: 'auth', values: () => [
      { v: 'yes', label: 'có auth', test: (e) => e.auth === true },
      { v: 'no', label: 'không auth', test: (e) => e.auth === false },
      { v: 'murky', label: 'không rõ', test: (e) => e.auth === undefined },
    ] },
  { key: 'recon', title: 'đối chiếu', values: () => Object.keys(RECON_LABEL)
      .map((k) => ({ v: k, label: RECON_LABEL[k], cls: RECON_CLS[k], test: (e) => reconOf(e) === k })) },
  { key: 'conf', title: 'độ tin cậy của lời gọi', values: () => ['exact', 'inferred', 'guess']
      .map((k) => ({ v: k, label: k, cls: 'c-bg-' + k, test: (e) => bestConf(callsByEndpoint.get(e.id) || []) === k })) },
];

// cm:why Every value carries its own count, and the count is over the WHOLE map, not the filtered
// rows: a facet whose number moves as you filter cannot tell you whether it is worth clicking.
function renderFacets() {
  const box = el('f-groups');
  box.textContent = '';
  for (const group of FACET_GROUPS) {
    const wrap = h('div', 'fg');
    const head = h('h5', null, group.title);
    wrap.appendChild(head);
    const all = h('label', state[group.key] === '' ? 'on' : null);
    const allInput = document.createElement('input');
    allInput.type = 'radio';
    allInput.name = 'f-' + group.key;
    allInput.checked = state[group.key] === '';
    allInput.onchange = () => { state[group.key] = ''; state.page = 1; render(); };
    all.append(allInput, h('span', null, 'tất cả'), h('span', 'fn', String(MAP.endpoints.length)));
    wrap.appendChild(all);
    for (const value of group.values()) {
      const n = MAP.endpoints.filter(value.test).length;
      const row = h('label', state[group.key] === value.v ? 'on' : null);
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'f-' + group.key;
      input.checked = state[group.key] === value.v;
      input.onchange = () => { state[group.key] = value.v; state.page = 1; render(); };
      row.appendChild(input);
      if (value.cls) row.appendChild(h('span', 'sw ' + value.cls));
      row.appendChild(h('span', null, value.label));
      row.appendChild(h('span', 'fn', String(n)));
      wrap.appendChild(row);
    }
    box.appendChild(wrap);
  }
  el('f-reset').onclick = () => {
    state.method = ''; state.auth = ''; state.recon = ''; state.conf = ''; state.q = '';
    const q = el('q');
    if (q) q.value = '';
    state.page = 1;
    render();
  };
}

// cm:why One pager for every long list: three panes each dumping 600+ rows was the reason the page
// scrolled for 23 000 pixels, and three hand-rolled pagers would drift apart within a week.
function renderPager(hostId, total, key, anchorId) {
  const box = el(hostId);
  if (!box) return;
  box.textContent = '';
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (state[key] > pages) state[key] = pages;
  const current = state[key];
  const go = (n) => {
    state[key] = n;
    render();
    const anchor = el(anchorId);
    if (anchor) anchor.scrollIntoView({ block: 'nearest' });
  };
  const btn = (label, n, on, disabled) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (on) b.className = 'on';
    if (disabled) b.disabled = true;
    else b.onclick = () => go(n);
    return b;
  };
  box.appendChild(btn('‹', current - 1, false, current === 1));
  // cm:why Shows first, last and a window around the current page — 22 numbered buttons is not
  // navigation, and dropping the last page hides how much is left.
  const want = new Set([1, pages, current, current - 1, current + 1]);
  let previous = 0;
  for (const n of [...want].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)) {
    if (n - previous > 1) box.appendChild(h('span', 'gap', '…'));
    box.appendChild(btn(String(n), n, n === current, false));
    previous = n;
  }
  box.appendChild(btn('›', current + 1, false, current === pages));
  box.appendChild(h('span', 'of', pages > 1 ? current + ' / ' + pages + ' trang' : ''));
}

function renderEndpoints() {
  kpiStrip('ep-kpis');
  renderFacets();

  const rows = visibleEndpoints();
  el('ep-count').textContent = rows.length.toLocaleString('vi-VN') + ' / '
    + MAP.endpoints.length.toLocaleString('vi-VN') + ' endpoint';

  const from = (state.page - 1) * PAGE;
  const page = rows.slice(from, from + PAGE);
  // cm:why Selects the first visible row when the current selection is filtered away: an inspector
  // that says "bấm một dòng" next to a full table is a third of the pane spent on an instruction.
  if (state.endpoint === null || !rows.some((e) => e.id === state.endpoint)) {
    state.endpoint = page.length > 0 ? page[0].id : null;
  }
  el('ep-range').textContent = rows.length === 0 ? 'không có dòng nào khớp'
    : 'đang xem ' + (from + 1) + '–' + (from + page.length) + ' trong ' + rows.length.toLocaleString('vi-VN');

  const body = el('ep-rows');
  body.textContent = '';
  for (const e of page) {
    const tr = document.createElement('tr');
    if (state.endpoint === e.id) tr.className = 'on';
    const verb = h('td');
    verb.appendChild(h('span', 'verb ' + e.method, e.method));
    tr.appendChild(verb);
    // cm:why Path and handler share ONE cell on two lines: seven columns of real Laravel paths do not
    // fit 740px, and a path clipped to 20 characters is a row you cannot identify at all.
    // cm:guard title carries the full value on both lines, because both are clipped.
    const path = h('td');
    const pathText = h('div', 'mono clip', e.path);
    pathText.title = e.path;
    path.appendChild(pathText);
    const where = e.handler
      ? e.handler + (e.source ? '  ·  ' + e.source.file + ':' + e.source.line : '')
      : e.source ? e.source.file + ':' + e.source.line : 'BE không khai route này';
    const sub = h('div', 'sub2 clip', where);
    sub.title = where;
    path.appendChild(sub);
    tr.appendChild(path);
    tr.appendChild(h('td', 'nowrap', e.auth === true ? 'có' : e.auth === false ? 'KHÔNG' : '?'));
    const st = h('td', 'nowrap');
    st.appendChild(h('span', 'dot ' + RECON_CLS[reconOf(e)]));
    st.appendChild(document.createTextNode(' ' + RECON_LABEL[reconOf(e)]));
    tr.appendChild(st);
    tr.appendChild(h('td', 'num', String((callsByEndpoint.get(e.id) || []).length)));
    const rel = h('td');
    rel.appendChild(microBar(e.id));
    tr.appendChild(rel);
    tr.onclick = () => { state.endpoint = e.id; render(); };
    body.appendChild(tr);
  }
  renderPager('ep-pager', rows.length, 'page', 'ep-rows');
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
  const title = h('div', 'ihead');
  title.appendChild(h('span', 'verb ' + e.method, e.method));
  const titlePath = h('h4', null, e.path);
  titlePath.title = e.path;
  title.appendChild(titlePath);
  body.appendChild(title);

  if (state.insp === 'overview') {
    const st = reconOf(e);
    const callout = h('div', 'callout ' + RECON_CLS[st]);
    callout.appendChild(h('div', 'ct', RECON_LABEL[st]));
    callout.appendChild(h('div', 'cw', RECON_WHY[st]));
    body.appendChild(callout);
    const kv = h('div', 'kv');
    const add = (k, v) => { kv.appendChild(h('span', null, k)); kv.appendChild(h('span', 'mono', v)); };
    add('đối chiếu', RECON_LABEL[reconOf(e)]);
    add('auth', e.auth === true ? 'có cổng' : e.auth === false ? 'KHÔNG thấy cổng nào' : 'có cổng nhưng không phân loại được');
    add('handler', e.handler || '—');
    add('khai ở', e.source ? e.source.file + ':' + e.source.line : 'không thấy trong BE');
    const seen = seenText(e.id);
    if (seen) add('lịch sử', seen);
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
    const go = h('button', 'btn primary wide2', calls.length
      ? 'Xem ' + calls.length + ' lời gọi tới ' + (screensFor(e.id).length) + ' màn →'
      : 'Xem pane ảnh hưởng →');
    go.onclick = () => {
      state.section = 'impact';
      location.hash = 'impact';
      render();
    };
    body.appendChild(go);
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
const COL_CAP = 14;

// cm:why Draws the edges, not four independent lists: the columns alone tell you WHICH components
// exist, never which screen each one leads to — and that mapping is the whole answer this pane owes.
function chainGraph(chains) {
  const byRole = new Map(ROLE_COLS.map(([role]) => [role, new Map()]));
  const key = (step) => step.role + '|' + step.file + '|' + step.symbol;
  for (const c of chains) {
    for (const step of c.chain) {
      const bucket = byRole.get(step.role);
      if (!bucket) continue;
      const k = key(step);
      if (!bucket.has(k) || (!bucket.get(k).precise && step.precise)) bucket.set(k, step);
    }
  }

  const shown = new Map();
  const cut = new Map();
  ROLE_COLS.forEach(([role]) => {
    const all = [...byRole.get(role).values()];
    cut.set(role, Math.max(0, all.length - COL_CAP));
    all.slice(0, COL_CAP).forEach((step) => shown.set(key(step), step));
  });

  const edges = new Map();
  const rank = { exact: 0, inferred: 1, guess: 2 };
  for (const c of chains) {
    const path = c.chain.filter((step) => shown.has(key(step)));
    for (let i = 0; i + 1 < path.length; i++) {
      const a = key(path[i]);
      const b = key(path[i + 1]);
      const id = a + '>' + b;
      const loose = path[i + 1].precise === false;
      const previous = edges.get(id);
      if (!previous || rank[c.confidence] < rank[previous.confidence]) {
        edges.set(id, { a, b, confidence: c.confidence, loose });
      }
    }
  }

  const W = 1080;
  const colW = 236;
  const gap = (W - colW * 4) / 3;
  const xOf = (index) => index * (colW + gap);
  const top = 26;
  const rowH = 34;
  const tallest = Math.max(...ROLE_COLS.map(([role]) => Math.min(byRole.get(role).size, COL_CAP)), 1);
  const span = tallest * rowH;
  const height = top + span + 12;

  const pos = new Map();
  ROLE_COLS.forEach(([role], index) => {
    const list = [...byRole.get(role).values()].slice(0, COL_CAP);
    list.forEach((step, i) => {
      pos.set(key(step), { x: xOf(index), y: top + ((i + 0.5) * span) / list.length, col: index });
    });
  });

  const svg = svgEl('svg', { class: 'chaing', viewBox: '0 0 ' + W + ' ' + height, role: 'img' });
  ROLE_COLS.forEach(([role, label], index) => {
    const t = svgEl('text', { x: xOf(index), y: 12, class: 'head' });
    t.textContent = label + ' (' + byRole.get(role).size + ')';
    svg.appendChild(t);
  });

  const edgeEls = [];
  for (const edge of edges.values()) {
    const from = pos.get(edge.a);
    const to = pos.get(edge.b);
    if (!from || !to) continue;
    const x1 = from.x + colW;
    const x2 = to.x;
    const mid = (x1 + x2) / 2;
    const path = svgEl('path', {
      class: 'cedge c-' + edge.confidence + (edge.loose ? ' loose' : ''),
      d: 'M ' + x1 + ' ' + from.y + ' C ' + mid + ' ' + from.y + ', ' + mid + ' ' + to.y + ', ' + (x2 - 5) + ' ' + to.y,
      'marker-end': 'url(#arrow)',
    });
    path.dataset.a = edge.a;
    path.dataset.b = edge.b;
    svg.appendChild(path);
    edgeEls.push(path);
  }

  const groups = new Map();
  for (const [k, step] of shown) {
    const at = pos.get(k);
    const g = svgEl('g', { class: 'cnode' + (step.precise ? '' : ' loose') });
    g.appendChild(svgEl('rect', { x: at.x, y: at.y - 13, width: colW, height: 26, rx: 7 }));
    const name = svgEl('text', { x: at.x + 9, y: at.y - 1 });
    name.textContent = clip(step.symbol, 26);
    const where = svgEl('text', { x: at.x + 9, y: at.y + 9, class: 'sub' });
    where.textContent = clip(step.file.split('/').slice(-2).join('/') + ':' + step.line, 32);
    g.appendChild(name);
    g.appendChild(where);
    const tip = svgEl('title', {});
    tip.textContent = step.symbol + '\n' + step.file + ':' + step.line
      + (step.precise ? '' : '\nbước này đã mất độ chắc');
    g.appendChild(tip);
    g.onmouseenter = () => {
      svg.classList.add('dim');
      const lit = new Set([k]);
      // cm:why Lights the whole reachable branch in BOTH directions, not just adjacent nodes: the
      // question at a component is "which screen breaks", and that answer is two hops away.
      for (let pass = 0; pass < 4; pass++) {
        for (const e of edgeEls) {
          if (lit.has(e.dataset.a)) lit.add(e.dataset.b);
          if (lit.has(e.dataset.b)) lit.add(e.dataset.a);
        }
      }
      for (const e of edgeEls) e.classList.toggle('lit', lit.has(e.dataset.a) && lit.has(e.dataset.b));
      for (const [nk, ng] of groups) ng.classList.toggle('lit', lit.has(nk));
    };
    g.onmouseleave = () => {
      svg.classList.remove('dim');
      for (const e of edgeEls) e.classList.remove('lit');
      for (const ng of groups.values()) ng.classList.remove('lit');
    };
    groups.set(k, g);
    svg.appendChild(g);
  }

  const defs = svgEl('defs', {});
  const marker = svgEl('marker', {
    id: 'arrow', viewBox: '0 0 8 8', refX: '7', refY: '4',
    markerWidth: '5', markerHeight: '5', orient: 'auto-start-reverse',
  });
  marker.appendChild(svgEl('path', { d: 'M 0 1 L 7 4 L 0 7 z', class: 'arrowhead' }));
  defs.appendChild(marker);
  svg.insertBefore(defs, svg.firstChild);

  const wrap = h('div', 'chainwrap');
  wrap.appendChild(svg);
  const dropped = ROLE_COLS.filter(([role]) => cut.get(role) > 0)
    .map(([role, label]) => cut.get(role) + ' ' + label);
  if (dropped.length) {
    wrap.appendChild(h('p', 'cut', 'Không vẽ: ' + dropped.join(' · ')
      + ' — mỗi cột chỉ vẽ ' + COL_CAP + ' hộp đầu.'));
  }
  return wrap;
}

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
    if (!cur) perScreen.set(label, { call: c, confidence: c.confidence, screen: s, n: 1 });
    else {
      cur.n++;
      if (rank[c.confidence] < rank[cur.confidence]) { cur.confidence = c.confidence; cur.call = c; }
    }
  }
  const ordered = [...perScreen.entries()]
    .sort((a, b) => rank[a[1].confidence] - rank[b[1].confidence] || b[1].n - a[1].n || a[0].localeCompare(b[0]));

  const wrap = h('div', 'impgrid');
  const left = h('div', 'tblwrap');
  left.appendChild(h('h3', null, 'Màn bị ảnh hưởng — ' + ordered.length));
  const tbl = document.createElement('table');
  tbl.className = 'rows dense';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const [label, cls] of [['màn', ''], ['tin cậy', 'nowrap'], ['#gọi', 'num']]) {
    hr.appendChild(h('th', cls, label));
  }
  thead.appendChild(hr);
  tbl.appendChild(thead);
  const tb = document.createElement('tbody');
  // cm:why Cut, labelled, never silent: the honest move on a 54-screen fan-out is to rank by how
  // well each is known and say how many were left out — refusing to draw loses the count itself.
  for (const [label, info] of ordered.slice(0, SCREEN_CAP)) {
    const tr = document.createElement('tr');
    const c1 = h('td');
    const name = h('div', 'mono clip', label);
    name.title = label;
    c1.appendChild(name);
    // cm:guard Names the SCREEN's own file, not the call site: every row of a 13-screen fan-out
    // shares one api-module line, and printing that made thirteen different screens look identical.
    const where = info.screen && info.screen.source
      ? info.screen.source.file + ':' + info.screen.source.line
      : info.call.source.file + ':' + info.call.source.line + ' (vị trí lời gọi)';
    const sub = h('div', 'sub2 clip', where);
    sub.title = where;
    c1.appendChild(sub);
    tr.appendChild(c1);
    const c2 = h('td', 'nowrap');
    c2.appendChild(h('span', 'badge ' + info.confidence, info.confidence));
    tr.appendChild(c2);
    tr.appendChild(h('td', 'num', String(info.n)));
    tr.onclick = () => { state.screen = info.call.screenId; state.section = 'screens'; location.hash = 'screens'; render(); };
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
    right.appendChild(chainGraph(chains));
    right.appendChild(h('p', 'sub2', 'Nét đứt = bước mà chuỗi đã mất độ chắc (đi qua re-export hoặc default export không tên). Trỏ vào một hộp để soi riêng nhánh của nó.'));
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
  const scFrom = (state.scPage - 1) * PAGE;
  for (const row of rows.slice(scFrom, scFrom + PAGE)) {
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
  renderPager('sc-pager', rows.length, 'scPage', 'sc-rows');

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
    state.alertKind, (v) => { state.alertKind = v; state.alPage = 1; renderAlerts(); });
  fillFacet('al-sev', 'mức — tất cả', ['high', 'medium', 'low']
    .filter((s) => count((a) => a.severity === s) > 0)
    .map((s) => [s, s + ' (' + count((a) => a.severity === s) + ')']),
    state.alertSev, (v) => { state.alertSev = v; state.alPage = 1; renderAlerts(); });

  const rows = ALERTS.filter((a) =>
    (!state.alertKind || a.kind === state.alertKind) && (!state.alertSev || a.severity === state.alertSev));
  el('al-count').textContent = rows.length + '/' + ALERTS.length + ' alert';
  const box = el('al-body');
  box.textContent = '';
  if (!rows.length) { box.appendChild(h('p', 'empty2', 'Không alert nào khớp bộ lọc.')); return; }

  const wrap = h('div', 'tblwrap');
  const tbl = document.createElement('table');
  tbl.className = 'rows';
  tbl.id = 'al-rows';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>mức</th><th>loại</th><th>endpoint</th><th>chi tiết</th><th>màn ảnh hưởng</th></tr>';
  tbl.appendChild(thead);
  const tb = document.createElement('tbody');
  const alFrom = (state.alPage - 1) * PAGE;
  for (const a of rows.slice(alFrom, alFrom + PAGE)) {
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
    tr.onclick = () => { state.endpoint = a.endpointId; state.section = 'impact'; location.hash = 'impact'; render(); };
    tb.appendChild(tr);
  }
  tbl.appendChild(tb);
  wrap.appendChild(tbl);
  const pager = h('div', 'pager');
  pager.id = 'al-pager';
  wrap.appendChild(pager);
  box.appendChild(wrap);
  renderPager('al-pager', rows.length, 'alPage', 'al-rows');
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

  const num = (n) => n.toLocaleString('vi-VN');
  const arrow = (before, after, invert) => {
    const row = h('div', 'ba');
    row.appendChild(h('span', 'b1', num(before)));
    row.appendChild(h('span', 'ar', '→'));
    row.appendChild(h('span', 'b2', num(after)));
    const delta = after - before;
    if (delta !== 0) {
      const good = invert ? delta < 0 : delta > 0;
      row.appendChild(h('span', 'dl ' + (good ? 'up' : 'down'),
        (delta > 0 ? '+' : '−') + num(Math.abs(delta))));
    }
    return row;
  };

  const panels = h('div', 'cmp4');

  const p1 = h('div', 'panel');
  p1.appendChild(h('h3', null, 'Tổng quan'));
  const rows1 = [
    ['màn hình', d.screens.before, d.screens.after, false],
    ['lời gọi', d.calls.before, d.calls.after, false],
    ['unresolved', d.unresolved.before, d.unresolved.after, true],
  ];
  const epLine = h('div', 'barow');
  epLine.appendChild(h('span', 'lb', 'endpoint'));
  const epTxt = h('div', 'ba');
  epTxt.appendChild(h('span', 'b2', '+' + d.endpoints.added.length));
  epTxt.appendChild(h('span', 'ar', '/'));
  epTxt.appendChild(h('span', 'b1', '−' + d.endpoints.removed.length));
  epTxt.appendChild(h('span', 'dl', d.endpoints.changed.length + ' đổi'));
  epLine.appendChild(epTxt);
  p1.appendChild(epLine);
  for (const [label, before, after, invert] of rows1) {
    const line = h('div', 'barow');
    line.appendChild(h('span', 'lb', label));
    line.appendChild(arrow(before, after, invert));
    p1.appendChild(line);
  }
  panels.appendChild(p1);

  const p2 = h('div', 'panel');
  p2.appendChild(h('h3', null, 'Độ chắc của lời gọi'));
  const stack = (counts, total, tag) => {
    const wrap = h('div', 'stk');
    wrap.appendChild(h('span', 'tg', tag));
    const bar = h('div', 'sb');
    for (const k of ['exact', 'inferred', 'guess']) {
      if (!counts[k]) continue;
      const seg = h('i', 'c-bg-' + k);
      seg.style.width = ((counts[k] / (total || 1)) * 100).toFixed(2) + '%';
      seg.title = k + ': ' + num(counts[k]) + ' / ' + num(total);
      bar.appendChild(seg);
    }
    wrap.appendChild(bar);
    wrap.appendChild(h('span', 'tot', num(total)));
    return wrap;
  };
  p2.appendChild(stack(d.confidence.before, d.calls.before, 'trước'));
  p2.appendChild(stack(d.confidence.after, d.calls.after, 'sau'));
  // cm:why Percentage POINTS, not a ratio: guess going 571 → 13 144 while total calls triple is a
  // different story from guess tripling on a fixed total, and only the share tells them apart.
  for (const k of ['exact', 'inferred', 'guess']) {
    const a = d.calls.after ? (d.confidence.after[k] / d.calls.after) * 100 : 0;
    const b = d.calls.before ? (d.confidence.before[k] / d.calls.before) * 100 : 0;
    const delta = a - b;
    const good = k === 'guess' ? delta < 0 : delta > 0;
    const line = h('div', 'barow');
    line.appendChild(h('span', 'lb'));
    const lab = h('span', 'lb');
    lab.appendChild(h('i', 'sw c-bg-' + k));
    lab.appendChild(document.createTextNode(' ' + k));
    line.textContent = '';
    line.appendChild(lab);
    line.appendChild(Math.abs(delta) < 0.05
      ? h('span', 'pp', 'tỉ trọng không đổi')
      : h('span', 'pp ' + (good ? 'up' : 'down'),
        (delta > 0 ? '▲ ' : '▼ ') + Math.abs(delta).toFixed(1) + 'pp tỉ trọng'));
    p2.appendChild(line);
  }
  panels.appendChild(p2);

  const p3 = h('div', 'panel');
  p3.appendChild(h('h3', null, 'Unresolved'));
  const big = h('div', 'bignum');
  big.appendChild(h('span', 'b1', num(d.unresolved.before)));
  big.appendChild(h('span', 'ar', '→'));
  big.appendChild(h('span', 'b2' + (d.unresolved.after > d.unresolved.before ? ' worse' : ''), num(d.unresolved.after)));
  p3.appendChild(big);
  const share = (n, calls) => (calls + n === 0 ? '0%' : ((n / (calls + n)) * 100).toFixed(1) + '%');
  p3.appendChild(h('p', 'sub2', 'chiếm ' + share(d.unresolved.before, d.calls.before) + ' → '
    + share(d.unresolved.after, d.calls.after) + ' số lời gọi apiflow nhìn thấy'));
  // cm:guard Says out loud that unresolved is NOT part of the three confidence levels — the two
  // panels sit side by side, and a reader adding them up gets a total that does not exist.
  p3.appendChild(h('p', 'sub2', 'Unresolved không nằm trong exact/inferred/guess bên cạnh — đó là những lời gọi apiflow không đọc được đường dẫn.'));
  panels.appendChild(p3);
  box.appendChild(panels);

  const CHG = {
    added: { label: 'mới', cls: 'ok' },
    removed: { label: 'mất', cls: 'bad' },
    changed: { label: 'đổi', cls: 'warn' },
  };
  const all = [
    ...d.endpoints.added.map((x) => ({ ...x, chg: 'added' })),
    ...d.endpoints.removed.map((x) => ({ ...x, chg: 'removed' })),
    ...d.endpoints.changed.map((x) => ({ ...x, chg: 'changed' })),
  ];
  if (all.length === 0) {
    box.appendChild(h('p', 'hintbox', 'Không endpoint nào thêm, mất hay đổi giữa hai bản. Thay đổi nằm ở phía lời gọi và độ chắc, xem bốn ô trên.'));
    return;
  }

  const wrap = h('div', 'tblwrap');
  wrap.appendChild(h('h3', null, 'Endpoint thay đổi — ' + all.length));
  const tbl = document.createElement('table');
  tbl.className = 'rows dense';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const [label, cls] of [['loại', 'nowrap'], ['method', 'nowrap'], ['endpoint', ''], ['chi tiết', ''], ['màn ảnh hưởng', 'num']]) {
    hr.appendChild(h('th', cls, label));
  }
  thead.appendChild(hr);
  tbl.appendChild(thead);
  const tb = document.createElement('tbody');
  for (const it of all.slice(0, 150)) {
    const tr = document.createElement('tr');
    const c0 = h('td', 'nowrap');
    c0.appendChild(h('span', 'chg ' + CHG[it.chg].cls, CHG[it.chg].label));
    tr.appendChild(c0);
    const c1 = h('td', 'nowrap');
    c1.appendChild(h('span', 'verb ' + it.method, it.method));
    tr.appendChild(c1);
    const c2 = h('td');
    const path = h('div', 'mono clip', it.path);
    path.title = it.path;
    c2.appendChild(path);
    tr.appendChild(c2);
    tr.appendChild(h('td', 'sub2', it.detail || (it.chg === 'added' ? 'chưa có ở bản trước' : it.chg === 'removed' ? 'bản trước có, bản này không' : '')));
    const c4 = h('td', 'num');
    c4.textContent = it.screens && it.screens.length ? String(it.screens.length) : '—';
    if (it.screens && it.screens.length) c4.title = it.screens.join('\n');
    tr.appendChild(c4);
    tb.appendChild(tr);
  }
  tbl.appendChild(tb);
  wrap.appendChild(tbl);
  if (all.length > 150) wrap.appendChild(h('p', 'cut', 'Còn ' + (all.length - 150) + ' thay đổi nữa không hiện ở đây.'));
  box.appendChild(wrap);
}

function render() {
  for (const a of document.querySelectorAll('.rail a')) a.classList.toggle('on', a.dataset.section === state.section);
  for (const p of document.querySelectorAll('.pane')) p.hidden = p.id !== 'pane-' + state.section;
  if (state.section === 'overview') kpiStrip('ov-kpis');
  if (state.section === 'endpoints') renderEndpoints();
  if (state.section === 'impact') renderImpact();
  if (state.section === 'screens') renderScreens();
  if (state.section === 'unresolved') renderUnresolved();
  if (state.section === 'alerts') renderAlerts();
  if (state.section === 'cover') renderCover();
  if (state.section === 'graph') renderGraph();
  if (state.section === 'compare') renderCompare();
}

for (const a of document.querySelectorAll('[data-section]')) {
  a.onclick = (ev) => {
    ev.preventDefault();
    state.section = a.dataset.section;
    if (a.dataset.kind) { state.alertKind = a.dataset.kind; state.alertSev = ''; state.alPage = 1; }
    location.hash = state.section;
    render();
  };
}
const bind = (id, key) => {
  const node = el(id);
  if (node) node.addEventListener('input', (ev) => { state[key] = ev.target.value.trim(); render(); });
};
bind('q', 'q');
// cm:guard Typing in the search resets to page 1 — otherwise a query that returns 8 rows while you
// sit on page 7 shows an empty table and looks like the search itself is broken.
el('q')?.addEventListener('input', () => { state.page = 1; });
bind('imp-q', 'impQ');
bind('sc-q', 'scQ');
el('sc-q')?.addEventListener('input', () => { state.scPage = 1; });
el('un-q')?.addEventListener('input', () => { state.alPage = 1; });
bind('un-q', 'unQ');
bind('cv-q', 'cvQ');

// cm:edge contract -> src/view/addProject.ts — the scan buttons, the add dialog and the SSE reader
// all live there now, shared with the hub. This pane only needs to know which project it shows.
const PROJECT = JSON.parse(el0('project'));

const fromHash = location.hash.replace('#', '');
if (fromHash) state.section = fromHash;
render();
`;

export const PANES_SCRIPT_4 = String.raw`
const MAX_ROWS = 90;
const groupOf = (path) => path.split('/').slice(0, 4).join('/') || '/';

function coverVisible() {
  const q = state.cvQ.toLowerCase();
  return MAP.endpoints.filter((e) => {
    if (q && !(e.method + ' ' + e.path).toLowerCase().includes(q)) return false;
    if (state.cvRecon && reconOf(e) !== state.cvRecon) return false;
    return true;
  });
}

function renderCover() {
  const visible = coverVisible();
  fillFacet('cv-recon', 'trạng thái: tất cả',
    Object.keys(RECON_LABEL).map((k) => [k, RECON_LABEL[k]]), state.cvRecon,
    (v) => { state.cvRecon = v; render(); });
  el('cv-count').textContent = visible.length + ' / ' + MAP.endpoints.length + ' endpoint';

  const box = el('blocks');
  box.textContent = '';
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
      const st = reconOf(e);
      const callers = (callsByEndpoint.get(e.id) || []).length;
      const cell = h('div', 'cell s-' + st + (e.auth === false ? ' open' : '')
        + (state.endpoint === e.id ? ' sel' : ''));
      cell.title = e.method + ' ' + e.path + '\n' + RECON_LABEL[st] + '\nmàn gọi: ' + callers
        + (e.auth === false ? '\nkhông thấy cổng auth nào' : '');
      cell.onclick = () => {
        // cm:why Sets the GRAPH's own scope, not the table selection: picking a row in the endpoints
        // table must not silently narrow this diagram to one endpoint behind the reader's back.
        state.gEndpoint = e.id;
        state.group = groupOf(e.path);
        state.section = 'graph';
        location.hash = 'graph';
        render();
      };
      cells.appendChild(cell);
    }
    block.appendChild(cells);
    box.appendChild(block);
  }
  if (sorted.length === 0) box.appendChild(h('p', 'empty', 'Không endpoint nào khớp bộ lọc.'));
}

// cm:why Falls back to the biggest group rather than drawing everything: a bipartite of 1000
// endpoints is a grey smear, and a picture nobody can read is not a smaller answer, it is no answer.
function scopeForGraph() {
  if (state.gEndpoint) {
    const e = endpoints.get(state.gEndpoint);
    if (e) return { eps: [e], label: e.method + ' ' + e.path, one: true };
  }
  const visible = coverVisible();
  if (state.group) {
    const eps = visible.filter((e) => groupOf(e.path) === state.group);
    if (eps.length > 0) return { eps, label: state.group, one: false };
  }
  const counts = new Map();
  for (const e of visible) counts.set(groupOf(e.path), (counts.get(groupOf(e.path)) || 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (!top) return { eps: [], label: '', one: false };
  return { eps: visible.filter((e) => groupOf(e.path) === top[0]), label: top[0], one: false };
}

const svgEl = (tag, attrs) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
};
const clip = (text, n) => (text.length > n ? text.slice(0, n - 1) + '…' : text);

function renderGraph() {
  const host = el('bip');
  host.textContent = '';
  const note = el('graph-note');
  note.textContent = '';
  const scope = scopeForGraph();

  const label = el('scope-label');
  label.textContent = scope.label || '—';
  if (scope.one) {
    const wider = h('a', 'link', ' — xem cả nhóm ' + groupOf(scope.eps[0].path));
    wider.href = '#graph';
    wider.onclick = (ev) => {
      ev.preventDefault();
      state.gEndpoint = null;
      render();
    };
    label.appendChild(wider);
  }

  const edges = [];
  for (const e of scope.eps) {
    for (const c of callsByEndpoint.get(e.id) || []) {
      if (!screens.get(c.screenId)) continue;
      edges.push({ ep: e.id, screen: c.screenId, confidence: c.confidence });
    }
  }
  if (edges.length === 0) {
    note.textContent = 'Không lời gọi nào tới ' + (scope.label || 'nhóm này')
      + '. Đó không phải bằng chứng là không ai gọi — xem pane Unresolved.';
    return;
  }

  const screenIds = [...new Set(edges.map((x) => x.screen))];
  const epIds = [...new Set(edges.map((x) => x.ep))];
  // cm:guard Reports the cut instead of silently drawing the first 90 — a diagram that looks
  // complete but is not answers the question wrongly, which is worse than not drawing it.
  if (screenIds.length > MAX_ROWS) {
    note.textContent = scope.label + ' được ' + screenIds.length + ' màn gọi — quá rộng để vẽ.'
      + ' Bấm một ô ở Bản đồ phủ để thu về một endpoint.';
    return;
  }

  const labelOf = (id) => {
    const sc = screens.get(id);
    if (!sc) return id;
    return sc.route || (sc.label + ' (chưa gắn route)');
  };
  screenIds.sort((a, b) => labelOf(a).localeCompare(labelOf(b)));
  epIds.sort((a, b) => {
    const x = endpoints.get(a);
    const y = endpoints.get(b);
    return (x.path + x.method).localeCompare(y.path + y.method);
  });

  const rows = Math.max(screenIds.length, epIds.length);
  const rowH = rows > 40 ? 15 : rows > 24 ? 19 : 24;
  const top = 34;
  const span = rows * rowH;
  const W = 1180;
  const xs = 300;
  const xe = 640;

  const svg = svgEl('svg', { class: 'bip', viewBox: '0 0 ' + W + ' ' + (top + span + 16), role: 'img' });
  const head = (x, anchor, text) => {
    const t = svgEl('text', { x: x, y: 16, class: 'head', 'text-anchor': anchor });
    t.textContent = text;
    svg.appendChild(t);
  };
  head(xs, 'end', 'màn (' + screenIds.length + ')');
  head(xe, 'start', 'endpoint (' + epIds.length + ')');

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
      d: 'M ' + (xs + 8) + ' ' + y1 + ' C ' + mid + ' ' + y1 + ', ' + mid + ' ' + y2
        + ', ' + (xe - 8) + ' ' + y2,
    });
    path.dataset.screen = edge.screen;
    path.dataset.ep = edge.ep;
    svg.appendChild(path);
    edgeEls.push(path);
  }

  const rowsByKey = {};
  const addRow = (id, y, side, text, cls) => {
    const g = svgEl('g', { class: 'row' });
    g.appendChild(svgEl('rect', {
      class: 'node ' + cls, x: side === 'left' ? xs : xe - 6, y: y - 4, width: 6, height: 8, rx: 2,
    }));
    const text2 = svgEl('text', {
      x: side === 'left' ? xs - 8 : xe + 8, y: y + 4,
      'text-anchor': side === 'left' ? 'end' : 'start',
    });
    text2.textContent = text;
    g.appendChild(text2);
    g.onmouseenter = () => {
      svg.classList.add('dim');
      for (const e of edgeEls) {
        const lit = side === 'left' ? e.dataset.screen === id : e.dataset.ep === id;
        e.classList.toggle('lit', lit);
        if (lit) {
          const other = side === 'left' ? e.dataset.ep : e.dataset.screen;
          if (rowsByKey[other]) rowsByKey[other].classList.add('lit');
        }
      }
      g.classList.add('lit');
    };
    g.onmouseleave = () => {
      svg.classList.remove('dim');
      for (const e of edgeEls) e.classList.remove('lit');
      for (const k in rowsByKey) rowsByKey[k].classList.remove('lit');
    };
    rowsByKey[id] = g;
    svg.appendChild(g);
  };

  for (const id of screenIds) addRow(id, yS[id], 'left', clip(labelOf(id), 40), 'screen');
  for (const id of epIds) {
    const e = endpoints.get(id);
    addRow(id, yE[id], 'right', clip(e.method + ' ' + e.path, 62), 'ep' + (e.source ? '' : ' dead'));
  }

  host.appendChild(svg);
  const guesses = edges.filter((x) => x.confidence === 'guess').length;
  note.textContent = edges.length + ' cạnh · ' + guesses + ' ở mức guess'
    + (guesses > 0 ? ' (nét đứt cam — chuỗi đi qua re-export, không chắc đúng màn)' : '');
}
`;
