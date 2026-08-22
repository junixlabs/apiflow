// cm:why These rules are where the product's structure is ENFORCED rather than described. Each one
// exists because a specific thing goes wrong when it is violated, and the comment says what.
const MAP = '^packages/map/';
const SCAN = '^packages/scan/';
const CLI = '^packages/cli/';

module.exports = {
  forbidden: [
    {
      name: 'map-stays-pure',
      comment:
        'packages/map is the format: parse, query, serialize. It must not import a node builtin. It ' +
        'is the only half that can run in a browser, a worker and inside a server process, and an ' +
        'fs import breaks that invisibly. It is also the line that keeps a hosted product a ' +
        'separate product: a store needs I/O, so forbidding I/O forbids the kernel growing a store.',
      severity: 'error',
      from: { path: MAP, pathNot: '\\.test\\.ts$' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'map-khong-goi-scan',
      comment:
        'The read half must not import the write half. A server that keeps maps has no repo on disk ' +
        'to read, and pulling a scanner into it is how "we never receive your source code" stops ' +
        'being true.',
      severity: 'error',
      from: { path: MAP },
      to: { path: SCAN },
    },
    {
      name: 'map-va-scan-khong-goi-cli',
      comment:
        'The two engine packages must not reach back into the CLI. They are consumed BY hosts (the ' +
        'CLI, an MCP server, a web page); a host is never a dependency of its engine.',
      severity: 'error',
      from: { path: `${MAP}|${SCAN}` },
      to: { path: CLI },
    },
    {
      name: 'khong-phu-thuoc-vong',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  required: [
    {
      // cm:why The accuracy gap between the CLI and MCP is not the query layer — both read the same
      // kernel. It is that MCP adds an argument-selection step performed by a model.
      // cm:why So the CLI is the reference implementation and MCP must BORROW its resolution, never
      // grow its own: two implementations mean two different answers to one question.
      name: 'mcp-phai-dung-lai-cli',
      comment:
        'packages/cli/src/mcp must depend on packages/cli/src/commands. If this fails, someone has ' +
        'given the MCP server its own resolution logic — the CLI is the reference implementation.',
      severity: 'error',
      module: { path: '^packages/cli/src/mcp/mapTools\\.ts$' },
      to: { path: '^packages/cli/src/commands/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.test\\.ts$' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
