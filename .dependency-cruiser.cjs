// cm:guard The two halves of this repo touch each other 0 times (measured 2026-08-20). The rules
// below make that 0 enforced rather than accidental — which is why apiflow can live in ONE repo.
const MAP_SIDE = '^src/(cli|workspace|server|view)|^src/mcp/map|^src/core/(apimap|feScanner|beScanner|callerGraph|mountGraph|wrappers|routeTable|probeHarness)';
const RUN_SIDE = '^src/(components|engine|store|hooks)|^src/App\\.tsx|^src/main\\.tsx|^proxy/';

module.exports = {
  forbidden: [
    {
      name: 'map-khong-duoc-goi-run',
      comment:
        'The map side (scan/CLI/workspace/server/view) must not import the request-runner side. The ' +
        'map side has to run headless, with no DOM and no React.',
      severity: 'error',
      from: { path: MAP_SIDE },
      to: { path: RUN_SIDE },
    },
    {
      name: 'run-khong-duoc-goi-map',
      comment:
        'The request-runner side must not import the map side. To use a map, read the .apimap through ' +
        'the CLI instead of wiring it in directly — otherwise the SPA drags the scanner into the browser bundle.',
      severity: 'error',
      from: { path: RUN_SIDE },
      to: { path: MAP_SIDE },
    },
    {
      name: 'khong-phu-thuoc-vong',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.test\\.ts$' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
