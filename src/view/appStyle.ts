// cm:edge lockstep -> src/view/theme.ts — tokens live there; this file only lays out the app shell.
export const APP_STYLE = `
.app-shell { display:grid; grid-template-columns:210px 1fr; min-height:100vh; }
@media (max-width:900px) { .app-shell { grid-template-columns:1fr; } }
.rail { border-right:1px solid var(--line); background:var(--surface-2); padding:16px 0 24px; }
.rail .brandbar { padding:0 16px 16px; margin:0; }
.rail nav { display:flex; flex-direction:column; }
.rail a { display:flex; align-items:center; gap:9px; padding:8px 16px; text-decoration:none;
  color:var(--muted); font-size:13px; border-left:2px solid transparent; }
.rail a:hover { background:var(--surface-3); color:var(--ink); }
.rail a.on { color:var(--ink); font-weight:600; border-left-color:var(--brand); background:var(--surface); }
.rail a .n { margin-left:auto; font:11px ui-monospace,monospace; color:var(--muted); }
.rail a.warn .n { color:var(--guess); }
.rail a.bad .n { color:var(--dead); }
.rail .sep { height:1px; background:var(--line); margin:12px 16px; }
.rail .foot { padding:10px 16px 0; font-size:11px; color:var(--muted); word-break:break-all; }
.main { min-width:0; padding:20px 24px 60px; }
.phead { display:flex; align-items:flex-start; gap:14px; flex-wrap:wrap; margin:0 0 14px; }
.phead h1 { margin:0; font-size:19px; }
.phead .kind { font:600 10.5px/1 ui-monospace,monospace; border:1px solid var(--line);
  border-radius:999px; padding:4px 9px; color:var(--muted); }
.phead .roots { margin:4px 0 0; font:11.5px/1.6 ui-monospace,monospace; color:var(--muted); }
.phead .right { margin-left:auto; text-align:right; font-size:11.5px; color:var(--muted); }
.kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(148px,1fr)); gap:12px; margin:0 0 16px; }
.kpi { border:1px solid var(--line); border-radius:11px; background:var(--surface); padding:11px 13px; }
.kpi .k { font-size:10.5px; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); }
.kpi .v { font:650 25px/1.2 ui-sans-serif,sans-serif; letter-spacing:-.02em; margin:3px 0 0; }
.kpi .d { font-size:11px; color:var(--muted); margin-top:2px; }
.kpi .d.up { color:var(--exact); } .kpi .d.down { color:var(--dead); }
.kpi.alarm .v { color:var(--dead); }
.panels { display:grid; grid-template-columns:1.35fr 1fr 1fr; gap:14px; margin:0 0 18px; }
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

.btn { font-size:12.5px; font-weight:600; border:1px solid var(--line); border-radius:8px;
  padding:6px 12px; background:var(--surface); color:var(--ink); cursor:pointer; }
.btn:hover { background:var(--surface-3); }
.btn[disabled] { opacity:.5; cursor:progress; }
.scanlog { margin:10px 0 0; padding:10px 12px; border:1px solid var(--line); border-radius:9px;
  background:var(--surface-2); font:11.5px/1.6 ui-monospace,monospace; max-height:220px;
  overflow:auto; white-space:pre-wrap; display:none; }
.scanlog.on { display:block; }
.scanlog .err { color:var(--dead); }
.scanlog .ok { color:var(--exact); }
`;
