// cm:edge lockstep -> src/view/hub.ts, src/cli/view.ts — one token set for every page apiflow
// renders; a second copy is how the hub and the map view start looking like different products.
export const STYLE = `
:root {
  --bg:#f6f8fb; --surface:#fff; --surface-2:#f1f5f9; --surface-3:#e8eef6;
  --ink:#0f172a; --muted:#64748b; --line:#dde5ee;
  --exact:#059669; --inferred:#2563eb; --guess:#d97706; --dead:#dc2626;
  --shadow:0 1px 2px rgba(15,23,42,.05), 0 8px 24px rgba(15,23,42,.06);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg:#0a1020; --surface:#111a2c; --surface-2:#0e1626; --surface-3:#16233a;
    --ink:#e6edf6; --muted:#8fa2bb; --line:#223148;
    --exact:#34d399; --inferred:#60a5fa; --guess:#fbbf24; --dead:#f87171;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.35);
  }
}
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--ink);
  font:14px/1.55 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif; -webkit-font-smoothing:antialiased; }
.page { max-width:1500px; margin:0 auto; padding:24px 18px 60px; }
h1 { font-size:20px; margin:0 0 4px; font-weight:650; letter-spacing:-.01em; }
.sub { color:var(--muted); margin:0 0 18px; font-size:13px; }
.sub code { background:var(--surface-2); padding:1px 5px; border-radius:4px; }
.app { display:grid; grid-template-columns:272px 1fr 340px;
  border:1px solid var(--line); border-radius:14px; overflow:hidden;
  background:var(--surface); box-shadow:var(--shadow); min-height:680px; }
@media (max-width:1100px) { .app { grid-template-columns:1fr; } }
.bar { grid-column:1/-1; display:flex; align-items:center; gap:10px; flex-wrap:wrap;
  padding:10px 14px; border-bottom:1px solid var(--line); background:var(--surface-2); }
.brand { font-weight:650; }
.stat { color:var(--muted); font-size:12.5px; }
.spacer { flex:1; }
.search { display:flex; align-items:center; gap:7px; background:var(--surface);
  border:1px solid var(--line); border-radius:8px; padding:5px 9px; min-width:230px; }
.search input { border:0; outline:0; background:transparent; color:var(--ink); font:inherit; width:100%; }
.chip { font-size:11.5px; padding:3px 9px; border-radius:999px; border:1px solid var(--line);
  background:var(--surface); color:var(--muted); cursor:pointer; white-space:nowrap; }
.chip.on { color:var(--ink); border-color:currentColor; background:var(--surface-3); }
.side { border-right:1px solid var(--line); overflow:auto; max-height:78vh; }
.side h2, .insp h2 { font-size:11px; text-transform:uppercase; letter-spacing:.08em;
  color:var(--muted); margin:16px 14px 8px; font-weight:600; }
.group { display:flex; align-items:center; gap:8px; padding:6px 14px; cursor:pointer; font-size:13px; }
.group:hover { background:var(--surface-2); }
.group.on { background:var(--surface-3); font-weight:600; }
.group .n { margin-left:auto; color:var(--muted); font-size:11.5px; }
.list { overflow:auto; max-height:78vh; }
.row { display:flex; align-items:center; gap:10px; padding:8px 16px;
  border-bottom:1px solid var(--line); cursor:pointer; }
.row:hover { background:var(--surface-2); }
.row.on { background:var(--surface-3); }
.verb { font:600 10.5px/1 ui-monospace,monospace; padding:4px 6px; border-radius:5px;
  min-width:52px; text-align:center; border:1px solid var(--line); color:var(--muted); }
.verb.GET { color:var(--inferred); } .verb.POST { color:var(--exact); }
.verb.PUT, .verb.PATCH { color:var(--guess); } .verb.DELETE { color:var(--dead); }
.p { font:12.5px/1.4 ui-monospace,monospace; word-break:break-all; }
.tags { margin-left:auto; display:flex; gap:6px; align-items:center; flex-shrink:0; }
.tag { font-size:10.5px; padding:2px 7px; border-radius:999px; border:1px solid var(--line); color:var(--muted); }
.tag.lock { color:var(--exact); } .tag.open { color:var(--dead); }
.tag.shape { color:var(--inferred); } .tag.probed { color:var(--exact); }
.insp { border-left:1px solid var(--line); overflow:auto; max-height:78vh; padding-bottom:24px; }
.insp .k { color:var(--muted); font-size:12px; }
.insp .v { font:12.5px/1.5 ui-monospace,monospace; word-break:break-all; margin-bottom:10px; }
.insp .box { margin:0 14px; }
.field { display:flex; gap:8px; align-items:baseline; padding:5px 0; border-bottom:1px solid var(--line); }
.field .fp { font:12px/1.4 ui-monospace,monospace; }
.field .ft { color:var(--muted); font-size:11px; margin-left:auto; }
.empty { color:var(--muted); font-size:12.5px; margin:0 14px 14px; }
.caller { padding:7px 0; border-bottom:1px solid var(--line); font-size:12.5px; }
.caller .r { font:12.5px/1.4 ui-monospace,monospace; }
.caller .m { color:var(--muted); font-size:11.5px; }
.c-exact { color:var(--exact); } .c-inferred { color:var(--inferred); } .c-guess { color:var(--guess); }
.note { margin:18px 0 0; padding:12px 14px; border:1px dashed var(--line); border-radius:10px;
  color:var(--muted); font-size:12.5px; background:var(--surface-2); }
`;
