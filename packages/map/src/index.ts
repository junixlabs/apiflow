// cm:guard This package must stay at zero dependencies and zero I/O. It is the only half that can run
// in a browser, in a worker and inside a server process — and the fs import that breaks that is
// invisible until something tries. `packages/map/package.json` keeps "dependencies" empty on purpose.
export * from './apimap';
export * from './shape';
export * from './diff';
export * from './summary';
export * from './alerts';
