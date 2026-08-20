// cm:guard Hai vế của repo này chạm nhau 0 lần (đo 2026-08-20). Rule dưới đây làm cho con số 0 đó
// được cưỡng chế, không phải một sự tình cờ — đó là lý do apiflow ở MỘT repo mà không rối.
const MAP_SIDE = '^src/(cli|workspace|server|view)|^src/mcp/map|^src/core/(apimap|feScanner|beScanner|callerGraph|mountGraph|wrappers|routeTable|probeHarness)';
const RUN_SIDE = '^src/(components|engine|store|hooks)|^src/App\\.tsx|^src/main\\.tsx|^proxy/';

module.exports = {
  forbidden: [
    {
      name: 'map-khong-duoc-goi-run',
      comment:
        'Vế bản đồ (scan/CLI/workspace/server/view) không được import vế chạy request. Vế bản đồ ' +
        'phải chạy được headless, không có DOM và không có React.',
      severity: 'error',
      from: { path: MAP_SIDE },
      to: { path: RUN_SIDE },
    },
    {
      name: 'run-khong-duoc-goi-map',
      comment:
        'Vế chạy request không được import vế bản đồ. Muốn dùng bản đồ thì đọc .apimap qua CLI, ' +
        'không nối trực tiếp — nếu không thì SPA lôi cả scanner vào bundle browser.',
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
