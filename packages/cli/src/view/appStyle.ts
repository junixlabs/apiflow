// cm:edge lockstep -> src/view/theme.ts — tokens live there; this file only lays out the app shell.
// cm:edge contract -> src/view/hub.ts — the hub renders itself into this same shell (.app-shell,
// .rail, .main, .phead, .panel, .kpistrip, .watch), so a rule renamed here restyles two pages.
// cm:guard Nav item rules are scoped to `.rail nav a`, never `.rail a`: the brand is a link too, and
// the unscoped selector handed it the padding of a nav item — 16px of drift between the two pages.
export const APP_STYLE = `
.app-shell { display:grid; grid-template-columns:248px 1fr; min-height:100vh; }
@media (max-width:900px) { .app-shell { grid-template-columns:1fr; } }
.rail { border-right:1px solid var(--line); background:var(--surface-2); padding:16px 0 24px; }
.rail .brandbar { padding:0 16px 16px; margin:0; }
.rail .brandbar .home { display:flex; align-items:center; gap:9px; text-decoration:none; color:inherit; }
.rail .brandbar a.home:hover { color:var(--brand); }
.rail nav { display:flex; flex-direction:column; }
.rail nav a { display:flex; align-items:center; gap:9px; padding:8px 16px; text-decoration:none;
  color:var(--muted); font-size:13px; border-left:2px solid transparent; }
.rail nav a:hover { background:var(--surface-3); color:var(--ink); }
.rail nav a.on { color:var(--ink); font-weight:600; border-left-color:var(--brand); background:var(--surface); }
.rail nav a .ico { flex:none; opacity:.7; }
.rail nav a.on .ico { opacity:1; color:var(--brand); }
.rail nav a .lbl { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rail nav a .n { margin-left:auto; font:11px ui-monospace,monospace; color:var(--muted); }
.rail nav a.warn .n { color:var(--guess); }
.rail nav a.bad .n { color:var(--dead); }
.rail .sep { height:1px; background:var(--line); margin:12px 16px; }
.rail { display:flex; flex-direction:column; }
.rail .railfoot { margin-top:auto; padding:14px 16px 0; border-top:1px solid var(--line);
  display:flex; flex-direction:column; gap:9px; }
.rail .railfoot .btn { width:100%; }
.rail .foot { margin:0; font-size:10.5px; color:var(--muted); word-break:break-all; line-height:1.5; }

.rail .railhead { padding:0 12px 11px; margin:0 0 8px; border-bottom:1px solid var(--line);
  display:flex; flex-direction:column; gap:7px; }
.rail .railhead .search { min-width:0; }
.rail .railhead .search input { font:12.5px inherit; }
.rail .railhead .two { display:flex; gap:6px; }
.rail .railhead select { flex:1 1 0; min-width:0; border:1px solid var(--line); border-radius:7px;
  background:var(--surface); color:var(--ink-2); font:11.5px inherit; padding:5px 6px; }
.rail .railhead .cnt { font-size:11px; color:var(--muted); }
.rail .railitems { flex:1 1 auto; overflow:auto; }
.rail .ri { display:block; width:100%; text-align:left; font:inherit; color:var(--muted);
  cursor:pointer; background:transparent; border:0; border-left:2px solid transparent;
  padding:8px 16px; }
.rail .ri:hover { background:var(--surface-3); color:var(--ink); }
.rail .ri.on { color:var(--ink); border-left-color:var(--brand); background:var(--surface); }
.rail .ri .l1 { display:flex; align-items:center; gap:7px; min-width:0; }
.rail .ri .nm { font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rail .ri.on .nm { font-weight:600; }
.rail .ri .sides { margin-left:auto; flex:none; font:600 9px/1 ui-sans-serif,sans-serif;
  letter-spacing:.07em; border:1px solid var(--line-2); border-radius:999px; padding:3px 6px; }
.rail .ri .l2, .rail .ri .l3 { margin-top:5px; display:flex; align-items:center; gap:7px;
  font-size:11px; color:var(--muted); white-space:nowrap; min-width:0; }
.rail .ri .l2 .num { overflow:hidden; text-overflow:ellipsis; }
.rail .ri .l3 .bad { color:var(--dead); font-weight:620; }
.rail .ri .l3 .warn { color:var(--guess); }
.rail .ri.allrow { padding-bottom:11px; margin-bottom:7px; border-bottom:1px solid var(--line); }
.micro { display:flex; width:50px; height:5px; border-radius:999px; overflow:hidden;
  background:var(--surface-3); flex:none; }
.micro i { display:block; }

.main { min-width:0; padding:18px 24px 60px; display:flex; flex-direction:column; }
.phead { display:grid; grid-template-columns:auto 1fr auto; align-items:start; gap:8px 20px;
  padding:0 0 14px; margin:0 0 16px; border-bottom:1px solid var(--line); }
@media (max-width:1100px) { .phead { grid-template-columns:1fr; } }
.pident { display:flex; align-items:center; gap:9px; flex-wrap:wrap; }
.phead h1 { margin:0; font-size:20px; letter-spacing:-.015em; }
.phead .kind { font:600 10px/1 ui-sans-serif,sans-serif; text-transform:uppercase; letter-spacing:.07em;
  border:1px solid var(--line-2); border-radius:999px; padding:4px 9px; color:var(--muted); }
.phead .kind.live { color:var(--brand); border-color:var(--brand); background:var(--tint-brand); }
.pmeta { display:flex; flex-direction:column; gap:3px; padding-top:2px; min-width:0; }
.side-row { display:flex; align-items:baseline; gap:8px; font-size:11.5px; min-width:0; flex-wrap:wrap; }
.side-row code { font:11.5px/1.5 ui-monospace,monospace; color:var(--ink-2);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:min(52ch,100%); }
.side-row .tagk { font:650 9.5px/1 ui-sans-serif,sans-serif; letter-spacing:.09em; color:var(--muted);
  border:1px solid var(--line); border-radius:4px; padding:3px 5px; flex:none; }
.side-row .rev { font:11px ui-monospace,monospace; color:var(--brand);
  background:var(--tint-brand); border-radius:4px; padding:1px 6px; }
.side-row .dim { color:var(--muted); font-size:11px; }
.side-row.gen { margin-top:2px; }
.btnrow { display:flex; gap:8px; align-items:center; }

.kpistrip { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:10px; margin:0 0 14px; }
@media (max-width:1250px) { .kpistrip { grid-template-columns:repeat(3,minmax(0,1fr)); } }
.kpistrip .k1 { border:1px solid var(--line); border-radius:10px; background:var(--surface); padding:8px 11px 9px; }
.kpistrip .k1 .lab { font-size:9.5px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); }
.kpistrip .k1 .val { font:650 20px/1.25 ui-sans-serif,sans-serif; letter-spacing:-.02em; margin-top:1px; }
.kpistrip .k1 .dlt { font-size:10.5px; color:var(--muted); }
.kpistrip .k1 .dlt.up { color:var(--exact); } .kpistrip .k1 .dlt.down { color:var(--dead); }
.kpistrip .k1.alarm .val { color:var(--dead); }
.kpistrip .k1 .spark { display:block; margin-top:3px; }

.kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(148px,1fr)); gap:12px; margin:0 0 16px; }
.kpi { border:1px solid var(--line); border-radius:11px; background:var(--surface); padding:11px 13px; }
.kpi .k { font-size:10.5px; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); }
.kpi .v { font:650 25px/1.2 ui-sans-serif,sans-serif; letter-spacing:-.02em; margin:3px 0 0; }
.kpi .d { font-size:11px; color:var(--muted); margin-top:2px; }
.kpi .d.up { color:var(--exact); } .kpi .d.down { color:var(--dead); }
.kpi.alarm .v { color:var(--dead); }
.panels { display:grid; grid-template-columns:1.35fr 1fr 1fr; gap:14px; margin:0 0 18px; align-items:start; }
@media (max-width:1200px) { .panels { grid-template-columns:1fr; } }
.panel { border:1px solid var(--line); border-radius:12px; background:var(--surface); padding:13px 15px 15px; }
.panel h3 { margin:0 0 11px; font-size:10.5px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); }
.recon { display:flex; height:10px; border-radius:999px; overflow:hidden; background:var(--surface-3); margin-bottom:12px; }
.recon i { display:block; }
.legend4 { display:grid; grid-template-columns:1fr 1fr; gap:8px 14px; }
.legend4 .li { font-size:12px; }
.legend4 .li b { display:block; font:650 17px/1.2 ui-sans-serif,sans-serif; }
.legend4 .li span { color:var(--muted); font-size:11px; }
.donut { display:flex; align-items:center; gap:14px; }
.donut svg { flex:none; }
.donut .rows { font-size:12px; }
.donut .rows div { display:flex; align-items:center; gap:7px; padding:2px 0; }
.donut .rows i { width:9px; height:9px; border-radius:3px; display:inline-block; }
.donut .rows b { margin-left:auto; font:600 12px ui-monospace,monospace; }
.watch { display:flex; flex-direction:column; gap:9px; }
.watch a { display:flex; gap:10px; align-items:baseline; text-decoration:none; color:inherit;
  border:1px solid var(--line); border-radius:9px; padding:8px 10px; background:var(--surface-2); }
.watch a:hover { background:var(--surface-3); }
.watch .num { font:650 17px/1 ui-sans-serif,sans-serif; }
.watch .txt { font-size:11.5px; color:var(--muted); }
.watch a.bad .num { color:var(--dead); }
.watch a.warn .num { color:var(--guess); }
.dot { width:9px; height:9px; border-radius:3px; display:inline-block; flex:none; }
.d-both { background:var(--exact); }
.d-uncalled { background:var(--surface-3); box-shadow:inset 0 0 0 1px var(--line); }
.d-feonly { background:var(--dead); }
.d-unpaired { background:repeating-linear-gradient(135deg,var(--surface-3) 0 3px,var(--surface) 3px 6px); }
.c-bg-exact { background:var(--exact); } .c-bg-inferred { background:var(--inferred); } .c-bg-guess { background:var(--guess); }
.hintbox { margin:0 0 16px; padding:11px 13px; border:1px dashed var(--line); border-radius:10px;
  color:var(--muted); font-size:12.5px; background:var(--surface-2); }
.hintbox b { color:var(--ink); }


`;
